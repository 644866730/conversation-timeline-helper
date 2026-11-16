/* 对话时间轴助手 — core and MIT-licensed upstream layout adaptation. No runtime dependencies. */
(function (root) {
  'use strict';
  const VERSION = '1.8.1';
  const HOST_ID = 'gpt-timeline-next-root';
  const SETTING_PREFIX = 'gtn:setting:';
  const STAR_PREFIX = 'gtn:star:';
  const DEFAULTS = Object.freeze({
    enabled: true,
    includeAssistant: true,
    theme: 'auto',
    language: 'auto',
    side: 'right',
    smoothScroll: true,
    showPreview: true,
    keyboard: true,
    verticalPosition: 52,
    customUserSelector: '',
    customAssistantSelector: ''
  });

  /** Small deterministic identifier, NOT encryption or an anonymization guarantee. */
  function hash(value) {
    const input = String(value);
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < input.length; i++) {
      a = Math.imul(a ^ input.charCodeAt(i), 0x01000193);
      b = Math.imul(b ^ input.charCodeAt(i), 0x85ebca6b);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeText = text => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/gu, ' ').trim();
  function excerpt(text, max = 100) {
    const chars = Array.from(normalizeText(text));
    return chars.length > max ? chars.slice(0, Math.max(0, max - 1)).join('') + '…' : chars.join('');
  }
  function normalizeSettings(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
    const out = {...DEFAULTS};
    for (const key of ['enabled', 'includeAssistant', 'smoothScroll', 'showPreview', 'keyboard']) {
      if (typeof input[key] === 'boolean') out[key] = input[key];
    }
    if (['auto', 'light', 'dark'].includes(input.theme)) out.theme = input.theme;
    if (['auto','zh-CN','zh-TW','en','ja','ko','es','fr','de'].includes(input.language)) out.language = input.language;
    if (['left', 'right'].includes(input.side)) out.side = input.side;
    if (typeof input.verticalPosition === 'number' && Number.isFinite(input.verticalPosition)) {
      out.verticalPosition = clamp(Math.round(input.verticalPosition), 25, 75);
    }
    for (const key of ['customUserSelector', 'customAssistantSelector']) {
      if (typeof input[key] === 'string') out[key] = input[key].trim().slice(0, 1000);
    }
    return out;
  }
  function settingsFromStorage(data) {
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) settings[key] = data[SETTING_PREFIX + key];
    return normalizeSettings(settings);
  }
  function settingsToStorage(settings) {
    return Object.fromEntries(Object.entries(normalizeSettings(settings)).map(([key, value]) => [SETTING_PREFIX + key, value]));
  }
  function platformFromURL(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return 'unknown';
      if (parsed.hostname === 'gemini.google.com') return 'gemini';
      if (parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com') return 'chatgpt';
    } catch { /* Unsupported or malformed URLs stay outside the supported platforms. */ }
    return 'unknown';
  }
  function platformName(platformOrURL) {
    const platform = ['chatgpt', 'gemini'].includes(platformOrURL) ? platformOrURL : platformFromURL(platformOrURL);
    return platform === 'gemini' ? 'Gemini' : platform === 'chatgpt' ? 'ChatGPT' : '当前页面';
  }
  /** Stable platform-isolated scopes; ChatGPT's existing fingerprint input is unchanged. */
  function scopeFromURL(url) {
    try {
      const parsed = new URL(url);
      const platform = platformFromURL(parsed);
      if (platform === 'gemini') {
        const match = parsed.pathname.match(/^\/(?:u\/\d+\/)?(app|share)\/([^/]+)\/?$/);
        if (match) return {persistent: true, key: hash('gemini:' + match[1] + ':' + match[2])};
        const gem = parsed.pathname.match(/^\/(?:u\/\d+\/)?gem\/[^/]+\/([^/]+)\/?$/);
        return gem ? {persistent: true, key: hash('gemini:app:' + gem[1])} : {persistent: false, key: 'ephemeral'};
      }
      if (platform !== 'chatgpt') return {persistent: false, key: 'ephemeral'};
      const match = parsed.pathname.match(/(?:^|\/)c\/([^/]+)(?:\/|$)/) || parsed.pathname.match(/^\/share\/([^/]+)(?:\/|$)/);
      return match ? {persistent: true, key: hash('chatgpt:' + (parsed.pathname.startsWith('/share/') ? 'share:' : 'c:') + match[1])}
        : {persistent: false, key: 'ephemeral'};
    } catch { return {persistent: false, key: 'ephemeral'}; }
  }
  function routeFromURL(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/\/$/, '') + (parsed.searchParams.get('temporary-chat') === 'true' ? '?temporary-chat=true' : '');
    } catch { return String(url); }
  }
  function starKey(scope, itemKey) { return STAR_PREFIX + scope.key + ':' + hash(itemKey); }
  function matchesQuery(item, query) {
    const terms = normalizeText(query).toLocaleLowerCase().split(' ').filter(Boolean);
    const haystack = (item.text + ' ' + item.ordinal + ' ' + (item.role === 'user' ? '提问 user' : '回复 assistant')).toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  }
  /** Literal text segments, never HTML. Center snippets around the first hit. */
  function queryPreview(item, query, max = 160) {
    const source = normalizeText(item.text || item.preview);
    const terms = [...new Set(normalizeText(query).split(' ').filter(Boolean))];
    if (!terms.length) return [{text: excerpt(source, max), match: false}];
    const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(escaped.join('|'), 'giu');
    const first = pattern.exec(source);
    const chars = Array.from(source), hit = first ? Array.from(source.slice(0, first.index)).length : 0;
    const start = Math.max(0, hit - 24), end = Math.min(chars.length, start + max);
    const visible = (start ? '…' : '') + chars.slice(start, end).join('') + (end < chars.length ? '…' : '');
    const segments = []; let offset = 0;
    pattern.lastIndex = 0;
    for (const found of visible.matchAll(pattern)) {
      if (found.index > offset) segments.push({text: visible.slice(offset, found.index), match: false});
      segments.push({text: found[0], match: true}); offset = found.index + found[0].length;
    }
    if (offset < visible.length) segments.push({text: visible.slice(offset), match: false});
    return segments;
  }
  /** Index of the last top <= viewport anchor, including the first-item edge case. */
  function activeIndex(positions, anchor) {
    if (!positions.length) return -1;
    let low = 0, high = positions.length - 1, result = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (positions[mid] <= anchor) { result = mid; low = mid + 1; }
      else high = mid - 1;
    }
    return result;
  }
  /** Fixed-height chronological rail. Screen position is based on message order,
   * never message height or the currently mounted viewport. Once dots become
   * crowded, an adaptive power curve gives newer (bottom) items more spacing.
   * Both endpoints are exact. No minimum-gap expansion or internal scrolling.
   */
  function timelineGeometry(positions, viewportHeight, _previous = [], padding = 16) {
    const n = positions.length, height = Math.max(0, Number(viewportHeight) || 0);
    const pad = Math.min(Math.max(0, Number(padding) || 0), height / 2);
    const span = Math.max(0, height - 2 * pad);
    const crowding = Math.max(1, Math.max(0, n - 1) * 24 / Math.max(1, span));
    const exponent = 1 + Math.min(1, Math.log2(crowding) * .32);
    const ratios = Array.from({length: n}, (_, i) => n === 1 ? 0 : Math.pow(i / (n - 1), exponent));
    const y = ratios.map(r => pad + r * span);
    const diameters = y.map((v, i) => {
      const gap = Math.min(i ? v - y[i - 1] : Infinity, i + 1 < n ? y[i + 1] - v : Infinity);
      return Math.max(2.5, Math.min(12, gap * .72));
    });
    return {height, y, ratios, normalized: ratios.slice(), diameters, exponent};
  }
  /** Nearest marker, independent of overlapping DOM hit boxes. O(log n). */
  function nearestIndex(positions, value) {
    if (!positions.length || !Number.isFinite(value)) return -1;
    let lo = 0, hi = positions.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (positions[mid] < value) lo = mid + 1; else hi = mid; }
    return lo > 0 && value - positions[lo - 1] <= positions[lo] - value ? lo - 1 : lo;
  }
  function isDense(positions, index, minimum = 8) {
    if (!Number.isInteger(index) || index < 0 || index >= positions.length) return false;
    return (index > 0 && positions[index] - positions[index - 1] < minimum) ||
      (index + 1 < positions.length && positions[index + 1] - positions[index] < minimum);
  }
  function nearbyWindow(length, index, size = 10) {
    const total = Math.max(0, Math.floor(length)), count = clamp(Math.floor(size) || 10, 1, 20);
    const start = clamp(Math.floor(index) - Math.floor(count / 2), 0, Math.max(0, total - count));
    return {start, end: Math.min(total, start + count)};
  }
  function isStarKey(key) { return /^gtn:star:[0-9a-f]{16}:[0-9a-f]{16}$/.test(key); }
  function validateBackup(input, language = 'auto') {
    const message = key => root.GTNextI18n ? root.GTNextI18n.t(key,{},language) : key;
    if (!input || input.format !== 'gpt-timeline-next-bookmarks' || input.version !== 1 || !Array.isArray(input.entries)) {
      throw new Error(message('不是有效的 对话时间轴助手 收藏备份。'));
    }
    if (input.entries.length > 20000) throw new Error(message('备份条目超过 20,000 条限制。'));
    const data = {};
    for (const row of input.entries) {
      if (!Array.isArray(row) || row.length !== 2 || !isStarKey(row[0]) || !row[1] ||
          typeof row[1].savedAt !== 'number' || !Number.isFinite(row[1].savedAt) || row[1].savedAt <= 0) {
        throw new Error(message('备份中存在无效的收藏记录，未导入。'));
      }
      data[row[0]] = {version: 1, savedAt: row[1].savedAt};
    }
    return data;
  }
  const api = Object.freeze({VERSION, HOST_ID, SETTING_PREFIX, STAR_PREFIX, DEFAULTS, hash, clamp, normalizeText, excerpt,
    normalizeSettings, settingsFromStorage, settingsToStorage, platformFromURL, platformName, scopeFromURL, routeFromURL, starKey, matchesQuery, queryPreview, activeIndex, timelineGeometry, nearestIndex, isDense, nearbyWindow, isStarKey, validateBackup});
  root.GTNextCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
