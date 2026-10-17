/* Passive DOM-only index. Never reads APIs, initiates loading or keeps detached DOM trees. */
(function (root) {
  'use strict';
  const C = root.GTNextCore || (typeof require === 'function' ? require('./core.js') : null);
  const TEXT_BUDGET = 32 * 1024 * 1024;
  function create() {
    let remembered = [], byTarget = new WeakMap(), inferredBatches = 0, truncated = 0;
    function reset() { remembered = []; byTarget = new WeakMap(); inferredBatches = 0; truncated = 0; }
    function collect(domItems, {direction = 'newer'} = {}) {
      const known = new Map(remembered.map(m => [m.key, m]));
      const aliases = new Map();
      for (const m of remembered) for (const alias of m.aliases || []) if (!known.has(alias)) aliases.set(alias, m.key);
      const incoming = [], live = new Map();
      for (const raw of domItems) {
        const d = {...raw, aliases: [...(raw.aliases || [])]};
        const canonical = aliases.get(d.key);
        if (canonical) { d.aliases.push(d.key); d.key = canonical; }
        const previous = d.target && byTarget.get(d.target);
        // Text-only streaming must not create a new dot for every token.
        // A stable native ID change, however, is a genuinely different message.
        if (previous && previous.role === d.role && !previous.native && known.has(previous.key) &&
            (d.text.startsWith(previous.text) || previous.text.startsWith(d.text))) {
          if (d.key !== previous.key) d.aliases.push(d.key);
          d.key = previous.key;
        }
        if (live.has(d.key)) continue;
        if (d.target) byTarget.set(d.target, {key: d.key, native: d.native, role: d.role, text: d.text});
        incoming.push(d); live.set(d.key, d);
      }
      const shared = incoming.filter(d => known.has(d.key));
      let output;
      if (!remembered.length) output = incoming;
      else if (!incoming.length) output = remembered;
      else if (shared.length) {
        // Insert new runs next to overlapping chronological anchors. DOM order
        // wins over positional hints, which may be renumbered after a prepend.
        const before = new Map(); let pending = [], lastAnchor = '';
        for (const d of incoming) {
          if (known.has(d.key)) { if (pending.length) before.set(d.key, pending); pending = []; lastAnchor = d.key; }
          else pending.push(d);
        }
        output = [];
        for (const old of remembered) {
          const run = before.get(old.key); if (run) output.push(...run);
          output.push(live.get(old.key) || old);
          if (old.key === lastAnchor && pending.length) output.push(...pending);
        }
      } else {
        // Completely disjoint virtual windows need global position hints, or
        // failing that, the direction of the user's actual scrolling. No hidden
        // history is requested to discover the gap.
        const oldHints = remembered.map(m => m.orderHint), newHints = incoming.map(m => m.orderHint);
        const completeHints = oldHints.every(Number.isFinite) && newHints.every(Number.isFinite);
        let older = direction === 'older', hinted = false;
        if (completeHints) {
          const oldMin = oldHints.reduce((a,b)=>Math.min(a,b), Infinity), oldMax = oldHints.reduce((a,b)=>Math.max(a,b), -Infinity);
          const newMin = newHints.reduce((a,b)=>Math.min(a,b), Infinity), newMax = newHints.reduce((a,b)=>Math.max(a,b), -Infinity);
          if (newMax < oldMin) { older = true; hinted = true; }
          else if (newMin > oldMax) { older = false; hinted = true; }
        }
        if (!hinted) inferredBatches++;
        output = older ? [...incoming, ...remembered] : [...remembered, ...incoming];
      }
      let budget = 0; truncated = 0; const counts = {user: 0, assistant: 0};
      output = output.map((m, i) => {
        const current = live.get(m.key), next = {...m, target: current?.target || null, content: current?.content || null};
        next.text = String(next.text || '');
        budget += next.text.length;
        if (budget > TEXT_BUDGET) { next.text = next.preview || C.excerpt(next.text, 110); next.truncated = true; }
        if (next.truncated) truncated++;
        next.ordinal = i + 1; next.roleOrdinal = ++counts[next.role];
        return next;
      });
      // Only serializable message metadata/text survive the scan, never detached
      // React components, ancestors, event handlers or image/video DOM resources.
      remembered = output.map(m => ({...m, target: null, content: null}));
      return output;
    }
    function diagnostics() { return {inferredOrderBatches: inferredBatches, textTruncated: truncated}; }
    return {reset, collect, diagnostics};
  }
  root.GTNextLoadedIndex = Object.freeze({create});
  if (typeof module === 'object' && module.exports) module.exports = root.GTNextLoadedIndex;
})(globalThis);
