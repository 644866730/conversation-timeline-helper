/* Pure on-demand navigation planning. No DOM, network, timers or history crawling. */
(function (root) {
  'use strict';
  const LIMITS = Object.freeze({timeout: 60000, stalled: 8000, poll: 160, steps: 320});
  function identities(item) {
    return [...new Set([...(item?.messageIds || []), ...(item?.navigationKeys || [])]
      .filter(s => typeof s === 'string' && s.length > 0 && s.length <= 512))];
  }
  function exactKey(value, keys) {
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const key = String(value);
    return keys.some(s => key === s);
  }
  function direction(target, live) {
    const ordinals = live.map(m => m.ordinal).filter(Number.isFinite);
    if (!ordinals.length) return null;
    const lo = Math.min(...ordinals), hi = Math.max(...ordinals);
    if (target.ordinal < lo) return -1;
    if (target.ordinal > hi) return 1;
    // A gap inside the mounted window: move toward the nearest chronological neighbour.
    let nearest = live[0];
    for (const m of live) if (Math.abs(m.ordinal - target.ordinal) < Math.abs(nearest.ordinal - target.ordinal)) nearest = m;
    return target.ordinal < nearest.ordinal ? -1 : 1;
  }
  function stepPosition(position, bounds, viewport, sign, scale = 1) {
    const step = Math.max(100, viewport * .82 * Math.max(.12, Math.min(1, scale)));
    return Math.max(bounds.min, Math.min(bounds.max, position + sign * step));
  }
  function stableShift(deltas) {
    if (deltas.length < 2) return null;
    const sorted = [...deltas].sort((a,b) => a-b), mid = sorted[Math.floor(sorted.length / 2)];
    return sorted.filter(n => Math.abs(n - mid) <= 6).length >= Math.ceil(sorted.length * .75) ? mid : null;
  }
  root.GTNextNavigationCore = Object.freeze({LIMITS, identities, exactKey, direction, stepPosition, stableShift});
  if (typeof module === 'object' && module.exports) module.exports = root.GTNextNavigationCore;
})(globalThis);
