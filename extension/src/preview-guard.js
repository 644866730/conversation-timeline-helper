/* Keep the actual reading viewport across a native image/file dialog.
 * No history loading, no virtualizer seek, no focus override and no prototype patches.
 * Checkpoints exist only in this tab; a route change or fresh user input discards them.
 */
(function (global) {
  'use strict';
  const A = global.GTNextAdapter;
  const MODALS = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], ' +
    '[data-testid="image-lightbox"], [data-testid="image-viewer"], [data-testid="file-preview-modal"]';
  const TURN = A.MESSAGE_SELECTOR;
  function create(hooks) {
    let phase = 'idle', checkpoint = null, candidate = null, lastGood = null;
    let timer = 0, frame = 0, destroyed = false, endAt = 0, correcting = false;
    let route = hooks.route(), corrections = 0, outcome = 'none';
    const listeners = [];
    const on = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      listeners.push(() => target.removeEventListener(type, fn, options));
    };
    const ours = node => node === hooks.host || hooks.host.contains(node);
    function visible(node) {
      if (!node?.isConnected || ours(node) || node.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' &&
        r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }
    function overlayOpen() {
      if (document.fullscreenElement && !ours(document.fullscreenElement)) return true;
      for (const node of document.querySelectorAll(MODALS)) if (visible(node)) return true;
      // Native scroll-lock/inert often arrives a frame before the dialog portal.
      // Ordinary overflow:hidden is NOT a signal: ChatGPT uses it for its app shell.
      const lock = document.body?.getAttribute('data-scroll-locked');
      if (lock !== null && lock !== undefined && lock !== '0' && lock !== 'false') return true;
      const mains = [...new Set([...document.querySelectorAll('main, [role="main"], #thread'), A.conversationScope()].filter(Boolean))];
      const targets = hooks.items().map(item => item.target).filter(node => node?.isConnected);
      // An inactive/hidden second main (e.g. a canvas or old route) must not
      // disable the timeline belonging to the still-readable conversation.
      const active = targets.length ? mains.filter(main => targets.some(node => main.contains(node))) : mains;
      return active.some(main => main.isConnected && main.querySelector(TURN) &&
        !!main.closest('[inert], [aria-hidden="true"]') && main.getBoundingClientRect().width > 0);
    }
    function capture() {
      if (!hooks.enabled() || document.hidden) return null;
      const live = hooks.items().filter(item => item.target?.isConnected);
      if (!live.length) return null;
      const root = A.findConversationScroller(), top = A.scrollTop(root), edge = A.viewportTop(root);
      const height = A.isDocumentScroller(root) ? innerHeight : root.clientHeight;
      if (!Number.isFinite(top) || height <= 0) return null;
      const anchors = [];
      for (const item of live) {
        const r = item.target.getBoundingClientRect();
        if (r.width > 0 && r.bottom > edge + 32 && r.top < edge + height && A.findScrollParent(item.target) === root) {
          anchors.push({key: item.key, offset: r.top - edge});
          if (anchors.length === 3) break;
        }
      }
      return {route: hooks.route(), root, top, scrollHeight: root.scrollHeight, anchors, at: performance.now()};
    }
    function remember() {
      if (!destroyed && phase === 'idle' && hooks.enabled() && !overlayOpen()) lastGood = capture();
    }
    function conceal(value) {
      // Never modify the page's dialog, focus trap, overflow or other app nodes.
      hooks.host.toggleAttribute('data-preview-blocked', value);
      hooks.host.inert = value;
      if (value) hooks.host.setAttribute('aria-hidden', 'true'); else hooks.host.removeAttribute('aria-hidden');
    }
    function clearWork() { clearTimeout(timer); timer = 0; cancelAnimationFrame(frame); frame = 0; }
    function finish(reason) {
      clearWork(); const wasBlocked = phase !== 'idle';
      phase = 'idle'; checkpoint = candidate = lastGood = null; outcome = reason;
      conceal(false);
      if (wasBlocked && !destroyed) hooks.resume?.();
    }
    function reset() { finish('reset'); route = hooks.route(); corrections = 0; }
    function restore() {
      if (!checkpoint || checkpoint.route !== hooks.route() || document.hidden || !hooks.enabled()) return;
      // Resolve actual current message IDs, not cached ordinals or active timeline dots.
      const live = A.collect(hooks.settings()).items;
      let root = null, desired = null;
      for (const anchor of checkpoint.anchors) {
        const item = live.find(m => m.key === anchor.key || m.aliases?.includes(anchor.key));
        if (!item?.target?.isConnected) continue;
        root = A.findScrollParent(item.target);
        desired = A.scrollTop(root) + item.target.getBoundingClientRect().top - A.viewportTop(root) - anchor.offset;
        break;
      }
      if (!root) {
        // A temporarily virtualized anchor can be recovered only in the SAME
        // coordinate frame. Never guess an old message from a different page.
        root = checkpoint.root;
        if (!root?.isConnected || Math.abs(root.scrollHeight - checkpoint.scrollHeight) > 4) return;
        desired = checkpoint.top;
      }
      const bounds = A.scrollBounds(root);
      if (!Number.isFinite(desired) || desired < bounds.min - 2 || desired > bounds.max + 2) return;
      const top = Math.min(bounds.max, Math.max(bounds.min, desired));
      if (Math.abs(A.scrollTop(root) - top) <= 2) return;
      correcting = true;
      try {
        // Do not animate a correction or trigger navigation/pagination buttons.
        if (A.isDocumentScroller(root)) window.scrollTo({top, behavior: 'instant'});
        else root.scrollTo({top, behavior: 'instant'});
        corrections++;
      } finally { correcting = false; }
    }
    function tick() {
      timer = 0;
      if (destroyed) return;
      check();
      if (phase === 'settling') {
        restore();
        if (performance.now() >= endAt) { finish(corrections ? 'restored' : 'unchanged'); return; }
      }
      if (phase !== 'idle' && !timer) timer = setTimeout(tick, phase === 'open' ? 140 : 80);
    }
    function check() {
      if (destroyed) return false;
      if (hooks.route() !== route) reset();
      if (!hooks.enabled()) { if (phase !== 'idle') finish('disabled'); return false; }
      if (overlayOpen()) {
        if (phase === 'idle') {
          const fresh = candidate && performance.now() - candidate.at < 1800 ? candidate : null;
          checkpoint = fresh || lastGood || capture(); corrections = 0; outcome = 'none';
          if (checkpoint?.route !== hooks.route()) checkpoint = null;
          cancelAnimationFrame(frame); frame = 0;
          phase = 'open'; conceal(true); hooks.pause?.();
        } else phase = 'open'; // Nested viewers share the original checkpoint.
        if (!timer) timer = setTimeout(tick, 140);
      } else if (phase === 'open') {
        phase = 'settling'; endAt = performance.now() + 1000;
        clearTimeout(timer); timer = 0;
        // Wait until the current close/focus/scroll-lock cleanup has completed.
        frame = requestAnimationFrame(() => { frame = 0; tick(); });
      }
      return phase !== 'idle';
    }
    function interaction(event) {
      if (destroyed || !hooks.enabled()) return;
      // Closing pointerdown/keydown runs while the dialog is still open. A NEW
      // gesture after closing abandons restoration, rather than fighting the user.
      if (phase === 'settling' && !overlayOpen()) { finish('user'); return; }
      if (phase !== 'idle' || overlayOpen()) return;
      if (event.type === 'wheel' || event.type === 'touchstart') { candidate = null; return; }
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      const target = event.composedPath()[0];
      if (!(target instanceof Element) || event.composedPath().includes(hooks.host) || !target.closest(TURN)) return;
      // Pointerdown precedes default focus scrolling. Do not overwrite it on click.
      if (event.type === 'click' && candidate && performance.now() - candidate.at < 1200) return;
      candidate = capture();
    }
    for (const name of ['pointerdown','touchstart','wheel','keydown','click']) on(document, name, interaction, {capture: true, passive: true});
    on(window, 'scroll', () => {
      if (correcting) return;
      if (phase === 'settling') {
        // Native focus restoration may be delayed until after close animations.
        // Correct the resulting drift on the next frame, not the next poll tick.
        if (!frame) frame = requestAnimationFrame(() => {
          frame = 0; check(); if (phase === 'settling') restore();
        });
        return;
      }
      if (phase !== 'idle') return;
      candidate = null;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; remember(); });
    }, {capture: true, passive: true});
    for (const name of ['fullscreenchange','close','cancel','toggle']) on(document, name, () => check(), true);
    on(document, 'visibilitychange', () => { if (document.hidden && phase !== 'idle') { checkpoint = null; outcome = 'hidden'; } else check(); });
    const observer = new MutationObserver(records => {
      if (records.some(record => !ours(record.target))) check();
    });
    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true,
      attributeFilter: ['role','aria-modal','aria-hidden','hidden','inert','open','data-state','data-scroll-locked','class','style']});
    function destroy() {
      destroyed = true; clearWork(); observer.disconnect(); listeners.forEach(remove => remove());
      phase = 'idle'; checkpoint = candidate = lastGood = null; conceal(false);
    }
    return {check, remember, reset, destroy, get blocked() { return phase !== 'idle'; },
      status: () => ({stage: phase, corrections, outcome})};
  }
  global.GTNextPreviewGuard = Object.freeze({create});
})(globalThis);
