/* MAIN-world helper: ONE requested virtual-list seek, never a history reader.
 * No startup scans, polling, request interception, authentication or data APIs.
 * Private React/virtualizer shapes are optional accelerators, not stable contracts.
 * A reported acceptance is NOT success: the isolated controller verifies the DOM.
 */
(function () {
  'use strict';
  if (window.top !== window) return;
  const BUS = 'gtn-navigation-v1', HOST = 'gpt-timeline-next-root';
  globalThis.__GTNextPageNavigation?.destroy();
  let cancelled = new Set();
  const data = (o, k) => { try { return Object.getOwnPropertyDescriptor(o, k)?.value; } catch { return undefined; } };
  const prop = (o, k) => { for (let i = 0; o && i < 3; i++, o = Object.getPrototypeOf(o)) { const v = data(o,k); if (v !== undefined) return v; } };
  const route = () => location.origin + location.pathname;
  const post = m => window.postMessage({bus: BUS, from: 'page', ...m}, location.origin === 'null' ? '*' : location.origin);
  const validKeys = a => Array.isArray(a) && a.length <= 32 && a.every(s => typeof s === 'string' && s.length <= 512);
  function seek(m) {
    const main = document.querySelector('main, [role="main"], #thread');
    if (!main) return {accepted: false, reason: 'no-main'};
    const selector = '[data-turn-key], [data-turn], [data-message-author-role], [data-content-search-unit-key]';
    const messages = Array.from(main.querySelectorAll(selector)).filter(n => !n.closest('nav,aside,form,[role="dialog"],#' + HOST));
    const seeds = [main, ...messages.slice(0, 12), ...messages.slice(-6)], queue = [], seenNodes = new Set(), seen = new WeakSet();
    for (let e of seeds) for (let depth = 0; e && depth < 7; e = e.parentElement, depth++) {
      if (seenNodes.has(e)) continue; seenNodes.add(e);
      for (const k of Object.getOwnPropertyNames(e)) if (/^__react(Fiber|Props|InternalInstance|Container)\$/.test(k)) queue.push([data(e,k), 0]);
    }
    const start = performance.now(), candidates = [];
    const preferred = ['memoizedState','memoizedProps','ref','current','return','child','sibling','next','virtualizer','virtualizerRef','listRef','scrollRef','value'];
    // Descriptor-only reads: never evaluate arbitrary getters, effects or callbacks.
    for (let i = 0; i < queue.length && i < 4500 && performance.now() - start < 55; i++) {
      const [o, depth] = queue[i];
      if (!o || typeof o !== 'object' || o instanceof Node || seen.has(o)) continue;
      seen.add(o);
      const method = typeof prop(o,'scrollToIndex') === 'function' ? 'scrollToIndex' : typeof prop(o,'scrollToItem') === 'function' ? 'scrollToItem' : '';
      if (method) {
        const scroller = prop(o,'scrollElement');
        // A code-block/table/list inside a reply is NOT the conversation virtualizer.
        const correctScroller = scroller instanceof Element && (scroller.contains(main) || messages.filter(e => scroller.contains(e)).length >= Math.min(2, messages.length || 2));
        const insideAnswer = scroller instanceof Element && !!scroller.closest(selector);
        if ((!scroller || correctScroller) && !insideAnswer) candidates.push({o, method, correctScroller});
      }
      if (depth > 17 || queue.length > 14000) continue;
      for (const k of preferred) { const v = data(o,k); if (v && typeof v === 'object') queue.push([v, depth + 1]); }
      // React hooks can hide the ref in a small tuple or a named object. Skip app caches/auth/stateNode.
      let entries; try { entries = Object.entries(Object.getOwnPropertyDescriptors(o)); } catch { continue; }
      for (const [k, d] of entries.slice(0,60)) {
        if (preferred.includes(k) || /^(stateNode|_owner|updateQueue|dependencies|cache|client|session|auth|token|children)$/i.test(k)) continue;
        if (d.value && typeof d.value === 'object' && (/^\d+$/.test(k) || /^(?:.*Ref|.*Virtualizer|list|virtual|scroll|handle|instance)$/i.test(k))) queue.push([d.value, depth + 1]);
      }
    }
    for (const candidate of candidates.sort((a,b) => Number(b.correctScroller) - Number(a.correctScroller))) {
      const {o, method} = candidate, options = prop(o,'options');
      const countValue = prop(options,'count'), count = Number.isInteger(countValue) && countValue > 0 && countValue <= 100000 ? countValue : null;
      const measurements = prop(o,'measurementsCache');
      let index = null, kind = '';
      if (Array.isArray(measurements)) {
        for (let n = 0; n < Math.min(measurements.length,100000); n++) {
          const key = prop(measurements[n],'key');
          if (m.keys.includes(String(key))) { index = Number.isInteger(prop(measurements[n],'index')) ? prop(measurements[n],'index') : n; kind = 'exact-key'; break; }
        }
      }
      const getKey = prop(options,'getItemKey');
      if (index === null && count && typeof getKey === 'function') {
        try {
          // Derive the current index from the exact observed ID/turn key, never a cached ordinal.
          for (let n = 0; n < count && performance.now() - start < 95; n++) if (m.keys.includes(String(getKey(n)))) { index = n; kind = 'exact-key'; break; }
        } catch { /* Fall through to DOM-calibrated index or scrolling. */ }
      }
      // Virtualizer without stable keys: use a previously observed DOM index only
      // when a live witness confirms the same index frame and a conversation root.
      if (index === null && candidate.correctScroller && Number.isInteger(m.index) && m.index >= 0 && m.index < (count || 100000) && m.calibrated === true) {
        index = m.index; kind = 'dom-index';
      }
      if (!Number.isInteger(index) || index < 0 || (count && index >= count)) continue;
      try {
        const fn = prop(o,method);
        if (method === 'scrollToItem') fn.call(o, index, 'start');
        else if (typeof prop(o,'getVirtualItems') === 'function' || count) fn.call(o, index, {align: 'start', behavior: 'auto'});
        else fn.call(o, {index, align: 'start', behavior: 'auto'});
        return {accepted: true, method: method + ':' + kind};
      } catch { /* Another candidate may be the conversation list. */ }
    }
    return {accepted: false, reason: 'no-matching-virtualizer'};
  }
  function receive(event) {
    if (event.source !== window || event.origin !== location.origin) return;
    const m = event.data;
    if (m?.bus !== BUS || m.from !== 'content' || typeof m.requestId !== 'string' || !/^[a-f\d]{24,64}$/.test(m.requestId)) return;
    if (m.type === 'cancel') { cancelled.add(m.requestId); if (cancelled.size > 128) cancelled = new Set([m.requestId]); return; }
    if (document.getElementById(HOST)?.hasAttribute('data-preview-blocked')) return;
    if (m.type !== 'seek' || m.route !== route() || !document.getElementById(HOST) || document.hidden || cancelled.has(m.requestId) ||
        !Number.isFinite(m.deadline) || Date.now() > m.deadline || m.deadline > Date.now() + 2000 || !validKeys(m.keys)) return;
    // A queued helper request must not move the background of a native dialog.
    if (document.fullscreenElement || Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open]')).some(n => {
      const r = n.getBoundingClientRect(), s = getComputedStyle(n);
      return !n.closest('[hidden], [aria-hidden="true"]') && r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
    })) return;
    let result; try { result = seek(m); } catch { result = {accepted: false, reason: 'helper-error'}; }
    post({requestId: m.requestId, route: m.route, ...result});
  }
  window.addEventListener('message',receive);
  globalThis.__GTNextPageNavigation = {destroy() { window.removeEventListener('message',receive); cancelled.clear(); }};
})();
