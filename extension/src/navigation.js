/* Click-to-reveal navigation. Idle = zero page movement. Only an explicit jump
 * starts bounded native scrolling/pagination; every success is DOM-verified.
 * This module never requests conversation data and never changes the chat URL.
 */
(function (global) {
  'use strict';
  const P = global.GTNextNavigationCore, A = global.GTNextAdapter;
  const BUS = 'gtn-navigation-v1';
  function create(hooks) {
    let task = null, destroyed = false, points = new Map(), previousRoot = null;
    let last = {stage: 'idle', method: '', steps: 0, reason: '', durationMs: 0};
    const pending = new Map();
    const currentRoute = () => location.origin + location.pathname;
    const emit = (stage, extra = {}) => { last = {...last, stage, ...extra}; hooks.progress?.({...last}); };
    const requestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
    const post = m => window.postMessage({bus: BUS, from: 'content', ...m}, location.origin === 'null' ? '*' : location.origin);
    function receive(event) {
      if (event.source !== window || event.origin !== location.origin) return;
      const m = event.data;
      if (m?.bus !== BUS || m.from !== 'page' || m.route !== currentRoute()) return;
      pending.get(m.requestId)?.(m);
    }
    window.addEventListener('message', receive);
    function cancel(reason = 'user') {
      if (!task) return;
      const t = task; task = null; t.controller.abort();
      if (t.requestId) post({type: 'cancel', requestId: t.requestId});
      emit('cancelled', {reason, durationMs: Math.round(performance.now() - t.started)});
    }
    function valid(t) {
      return !destroyed && task === t && !t.controller.signal.aborted && !document.hidden && hooks.enabled() && hooks.route() === t.route;
    }
    function sleep(t, ms) {
      if (!valid(t)) return Promise.resolve(false);
      return new Promise(resolve => {
        let timer;
        const done = () => { clearTimeout(timer); t.controller.signal.removeEventListener('abort',done); resolve(valid(t)); };
        timer = setTimeout(done, ms); t.controller.signal.addEventListener('abort',done,{once: true});
      });
    }
    const getItem = key => hooks.items().find(m => m.key === key || m.aliases?.includes(key));
    function scroll(root, position, behavior = 'instant') {
      const b = A.scrollBounds(root), top = Math.max(b.min,Math.min(b.max,position));
      if (A.isDocumentScroller(root)) window.scrollTo({top, behavior}); else root.scrollTo({top, behavior});
    }
    function viewport(root) { return A.isDocumentScroller(root) ? innerHeight : root.clientHeight; }
    function measure(root, node) { return node.getBoundingClientRect().top - A.viewportTop(root) + A.scrollTop(root); }
    function record(items) {
      const live = items.filter(m => m.target?.isConnected);
      if (!live.length) return;
      const root = A.findScrollParent(live[0].target), measured = new Map(live.map(m => [m.key, measure(root,m.target)]));
      // Adjust previous checkpoints for a stable prepend/layout shift, but never
      // treat a checkpoint as proof that the requested message is mounted.
      if (root === previousRoot) {
        const deltas = live.filter(m => points.has(m.key)).map(m => measured.get(m.key) - points.get(m.key).y);
        const shift = P.stableShift(deltas);
        if (shift !== null && Math.abs(shift) > 1) for (const p of points.values()) p.y += shift;
      }
      previousRoot = root;
      for (const m of live) points.set(m.key, {y: measured.get(m.key), index: m.virtualIndex,
        keys: P.identities(m), witnesses: live.filter(n => n.key !== m.key && Number.isInteger(n.virtualIndex)).slice(0,6).map(n => [n.key,n.virtualIndex])});
    }
    async function nativeSeek(t, item) {
      const p = points.get(item.key), witnesses = p?.witnesses || [];
      const calibrated = witnesses.some(([key,index]) => { const m = getItem(key); return m?.target?.isConnected && m.virtualIndex === index; });
      t.requestId = requestId();
      const result = await new Promise(resolve => {
        let timer;
        const done = value => { clearTimeout(timer); pending.delete(t.requestId); t.controller.signal.removeEventListener('abort',abort); resolve(value); };
        const abort = () => done({accepted: false});
        pending.set(t.requestId,done); timer = setTimeout(() => done({accepted: false}),400);
        t.controller.signal.addEventListener('abort',abort,{once: true});
        post({type:'seek',requestId:t.requestId,route:currentRoute(),deadline:Date.now()+700,
          keys:P.identities(item),index:Number.isInteger(p?.index)?p.index:null,calibrated});
      });
      if (!valid(t)) return false;
      if (result.accepted) {
        t.method = 'native'; emit('locating', {method:'native'});
        // Private helper acknowledgement only starts a verification wait.
        for (let i=0;i<7 && valid(t);i++) {
          await sleep(t,130); if (!valid(t)) break;
          hooks.scan(); if (getItem(t.key)?.target?.isConnected) return true;
        }
      }
      return false;
    }
    function loadButton(root, sign) {
      const main = document.querySelector('main, [role="main"], #thread');
      if (!main) return null;
      const scope = root instanceof Element && root.contains(main) ? root : main;
      const older = /^(?:load|show) (?:earlier|older|previous|more) messages(?:[.…]+)?$|^(?:加载|显示)(?:更早|之前|更多)(?:的)?消息[。.…]*$/i;
      const newer = /^(?:load|show) (?:newer|next) messages(?:[.…]+)?$|^(?:加载|显示)(?:更新|后续)(?:的)?消息[。.…]*$/i;
      return Array.from(scope.querySelectorAll('button, [role="button"]')).find(b =>
        !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.getClientRects().length &&
        !b.closest('form,nav,aside,[role="dialog"],[data-message-author-role],[data-turn],[data-turn-key],#gpt-timeline-next-root') &&
        (sign < 0 ? older : newer).test((b.getAttribute('aria-label') || b.textContent || '').trim()));
    }
    async function align(t) {
      // Smooth only for an already mounted target; long-history recovery moves
      // instantly so native virtualization never chases an animation target.
      let stable = 0, lastY = null;
      for (let n=0;n<10 && valid(t);n++) {
        hooks.scan(); const item = getItem(t.key);
        if (!item?.target?.isConnected) return false;
        const root = A.findScrollParent(item.target), rect = item.target.getBoundingClientRect(), top = A.viewportTop(root), offset = Math.max(20,84-top);
        const error = rect.top - top - offset;
        const behavior = n === 0 && t.method === 'direct' && hooks.smooth() ? 'smooth' : 'instant';
        if (Math.abs(error)>3) {
          const b=A.scrollBounds(root), raw=A.scrollTop(root)+error;
          // Do not sit exactly on a lazy-page sentinel while aligning a target
          // already in this page. A tiny interior margin keeps the first/last
          // message visible without immediately unloading its page again.
          const margin=b.max-b.min>20?6:0;
          scroll(root,Math.max(b.min+margin,Math.min(b.max-margin,raw)),behavior);
        }
        const y = measure(root,item.target);
        stable = lastY !== null && Math.abs(y-lastY)<3 ? stable+1 : 0; lastY=y;
        if (stable>=3) {
          const r=item.target.getBoundingClientRect();
          if (r.bottom>top && r.top<top+viewport(root)) return true;
        }
        await sleep(t, behavior==='smooth'?500:120);
      }
      if (!valid(t)) return false;
      hooks.scan(); const item=getItem(t.key);
      if (!item?.target?.isConnected) return false;
      const root=A.findScrollParent(item.target), r=item.target.getBoundingClientRect(), top=A.viewportTop(root);
      return r.bottom>top && r.top<top+viewport(root);
    }
    async function jump(key) {
      cancel('superseded');
      if (destroyed || !hooks.enabled()) return {ok:false, reason:'disabled'};
      hooks.scan(); const original=getItem(key);
      if (!original) return {ok:false,reason:'not-observed'};
      const t={key:original.key,route:hooks.route(),controller:new AbortController(),started:performance.now(),method:original.target?.isConnected?'direct':'scroll',requestId:''};
      task=t; emit('locating',{method:t.method,steps:0,reason:'',durationMs:0});
      let reason='timeout', previousSign=null, scale=1, lastFingerprint='', progressAt=performance.now(), buttonAt=0, step=0, lastPosition=null;
      try {
        if (!original.target?.isConnected) {
          await nativeSeek(t,original);
          if (!valid(t)) return {ok:false,reason:'cancelled'};
          hooks.scan();
          // Fast checkpoint only once; later progress follows actual mounted IDs.
          if (!getItem(t.key)?.target?.isConnected) {
            t.method='scroll';
            const p=points.get(t.key), root=A.findConversationScroller(), bounds=A.scrollBounds(root);
            if (p && Number.isFinite(p.y) && p.y>=bounds.min && p.y<=bounds.max+viewport(root)) {
              const live=hooks.items().filter(m=>m.target?.isConnected), sign=P.direction(getItem(t.key),live);
              const current=A.scrollTop(root), dest=Math.max(bounds.min,Math.min(bounds.max,p.y-90));
              if (sign && Math.sign(dest-current)===sign && Math.abs(dest-current)>viewport(root)) {
                hooks.direction?.(sign); scroll(root,dest); await sleep(t,250);
              }
            }
          }
        }
        while (valid(t) && performance.now()-t.started<P.LIMITS.timeout && step<P.LIMITS.steps) {
          hooks.scan(); if (!valid(t)) break;
          const target=getItem(t.key);
          if (!target) { reason='not-observed'; break; }
          if (target.target?.isConnected && await align(t)) {
            if (!valid(t)) break;
            const item=getItem(t.key); task=null;
            emit('success',{method:t.method,steps:step,reason:'',durationMs:Math.round(performance.now()-t.started)});
            return {ok:true,item};
          }
          if (!valid(t)) break;
          const all=hooks.items(), live=all.filter(m=>m.target?.isConnected), root=A.findConversationScroller();
          const bounds=A.scrollBounds(root), position=A.scrollTop(root), view=viewport(root);
          const fingerprint=live.map(m=>m.key).join('|')+':'+Math.round(root.scrollHeight);
          if (fingerprint!==lastFingerprint || (lastPosition!==null && Math.abs(position-lastPosition)>4)) {
            progressAt=performance.now(); lastFingerprint=fingerprint;
          }
          if (performance.now()-progressAt>P.LIMITS.stalled) { reason='stalled'; break; }
          let sign=P.direction(target,live);
          if (sign===null) { emit('locating',{method:t.method,steps:step}); await sleep(t,240); step++; continue; }
          if (previousSign && sign!==previousSign) scale=Math.max(.15,scale*.5);
          previousSign=sign; hooks.direction?.(sign);
          const dest=P.stepPosition(position,bounds,view,sign,scale), atBoundary=Math.abs(dest-position)<3;
          if (atBoundary) {
            const button=loadButton(root,sign);
            if (button && performance.now()-buttonAt>1400) { buttonAt=performance.now(); button.click(); }
            // Let native lazy loading finish instead of treating an unchanged
            // scrollHeight as end of history. Do NOT nudge endlessly at a boundary.
            if (performance.now()-progressAt>1800 && !t.nudgedFor?.has(fingerprint+sign)) {
              t.nudgedFor ||= new Set(); t.nudgedFor.add(fingerprint+sign);
              scroll(root,position-sign*Math.min(60,view*.1));
              await sleep(t,100); if (!valid(t)) break;
              scroll(root,sign<0?A.scrollBounds(root).min:A.scrollBounds(root).max);
            }
            await sleep(t,360);
          } else { scroll(root,dest); await sleep(t,P.LIMITS.poll); }
          if (!valid(t)) break;
          lastPosition=position; step++; emit('locating',{method:t.method,steps:step});
        }
        if (!valid(t)) return {ok:false,reason:'cancelled'};
        task=null; emit('failed',{reason,steps:step,durationMs:Math.round(performance.now()-t.started)});
        return {ok:false,reason};
      } catch {
        if (!valid(t)) return {ok:false,reason:'cancelled'};
        task=null; emit('failed',{reason:'page-error',steps:step,durationMs:Math.round(performance.now()-t.started)});
        return {ok:false,reason:'page-error'};
      } finally {
        // Settle posted requests so no late page helper can revive an old click.
        if (t.requestId) post({type:'cancel',requestId:t.requestId});
      }
    }
    function reset() { cancel('reset'); points.clear(); previousRoot=null; last={stage:'idle',method:'',steps:0,reason:'',durationMs:0}; }
    function destroy() { destroyed=true; cancel('destroyed'); window.removeEventListener('message',receive); for (const fn of pending.values()) fn({accepted:false}); pending.clear(); points.clear(); previousRoot=null; }
    return {jump,cancel,reset,record,destroy,status:()=>({...last}),get busy(){return !!task;}};
  }
  global.GTNextNavigation=Object.freeze({create});
})(globalThis);
