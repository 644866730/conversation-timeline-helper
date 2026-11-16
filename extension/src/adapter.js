/* DOM-only adapter. Does not read cookies, React internals, network traffic or APIs.
 * Evidence and limitations: docs/COMPATIBILITY.md. Add future selectors here.
 */
(function (root) {
  'use strict';
  const C = root.GTNextCore;
  const DECLARED_PLATFORM = C.platformFromURL(location.href);
  let inferredBody = null, inferredPlatform = 'chatgpt';
  const ROLE_MARKERS = [
    {name: 'chat-work-user', role: 'user', selector: '[data-content-search-unit-key$=":user"]', priority: 100},
    {name: 'chat-work-assistant', role: 'assistant', selector: '[data-content-search-unit-key$=":assistant"]', priority: 100},
    {name: 'chat-work-search-user', role: 'user', selector: '[data-chatgpt-search-unit-key$=":user"]', priority: 95},
    {name: 'chat-work-search-assistant', role: 'assistant', selector: '[data-chatgpt-search-unit-key$=":assistant"]', priority: 95},
    {name: 'data-turn-user', role: 'user', selector: '[data-turn="user"]', priority: 90},
    {name: 'data-turn-assistant', role: 'assistant', selector: '[data-turn="assistant"]', priority: 90},
    {name: 'legacy-user', role: 'user', selector: '[data-message-author-role="user"]', priority: 85},
    {name: 'legacy-assistant', role: 'assistant', selector: '[data-message-author-role="assistant"]', priority: 85},
    {name: 'user-bubble', role: 'user', selector: '[data-user-message-bubble="true"]', priority: 70}
  ];
  const GEMINI_MARKERS = [
    {name:'gemini-user',role:'user',selector:'user-query',priority:120},
    {name:'gemini-assistant',role:'assistant',selector:'model-response',priority:120},
    {name:'gemini-user-fallback',role:'user',selector:'.user-query-bubble-with-background',priority:70},
    {name:'gemini-assistant-fallback',role:'assistant',selector:'model-response-content',priority:70}
  ];
  const TURN_SELECTOR = '[data-turn-key], [data-testid^="conversation-turn-"], [data-turn="user"], [data-turn="assistant"], user-query, model-response';
  const MESSAGE_SELECTOR = TURN_SELECTOR + ', [data-message-author-role], [data-content-search-unit-key]';
  const GEMINI_HISTORY = 'infinite-scroller[data-test-id="chat-history-container"], infinite-scroller.chat-history, [data-test-id="chat-history-container"].chat-history';
  const EXCLUDED = 'nav, aside, [role="navigation"], [role="dialog"], [inert], form, [contenteditable="true"], #' + C.HOST_ID;
  let cache = new WeakMap();
  function invalidateTextCache() { cache = new WeakMap(); }

  function query(scope, selector) { try { return Array.from(scope.querySelectorAll(selector)); } catch { return []; } }
  function validateSelector(selector, language = 'auto') {
    if (!selector) return '';
    try { document.createDocumentFragment().querySelector(selector); return ''; }
    catch { return root.GTNextI18n ? root.GTNextI18n.t('CSS 选择器语法无效',{},language) : 'CSS 选择器语法无效'; }
  }
  function rendered(element) {
    if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"], ' + EXCLUDED)) return false;
    // checkVisibility intentionally keeps content-visibility:auto off-screen turns.
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({checkVisibilityCSS: true, contentVisibilityAuto: false})) return false;
    if (getComputedStyle(element).visibility === 'hidden') return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 || box.height > 0 || element.getClientRects().length > 0;
  }
  function platform() {
    if (DECLARED_PLATFORM !== 'unknown') return DECLARED_PLATFORM;
    // Local fixture/demo support without weakening the manifest's host boundary.
    if (inferredBody !== document.body) {
      inferredBody = document.body;
      inferredPlatform = document.querySelector('chat-window user-query, chat-window model-response, [data-test-id="chat-history-container"] user-query, [data-test-id="chat-history-container"] model-response') ? 'gemini' : 'chatgpt';
    }
    return inferredPlatform;
  }
  function chooseScope() {
    if (platform() === 'gemini') {
      const candidates = query(document,GEMINI_HISTORY + ', chat-window, chat-window-content');
      const visible = candidates.filter(rendered);
      const withTurns = visible.find(node => node.querySelector('user-query,model-response'));
      if (withTurns) return withTurns;
      if (visible.length) return visible[0];
    }
    const mains = query(document, 'main, [role="main"]');
    const visible = mains.filter(rendered);
    // Prefer the main containing actual turns, rather than a project/work canvas.
    const selector = ROLE_MARKERS.map(rule => rule.selector).join(',');
    let best = null, max = 0;
    for (const main of visible) {
      const hits = main.querySelectorAll(selector).length;
      if (hits > max) { best = main; max = hits; }
    }
    return best || visible[0] || document.body;
  }
  function isOwnTurn(rootNode, child) {
    if (!rootNode.matches(TURN_SELECTOR)) return true;
    return child.closest(TURN_SELECTOR) === rootNode;
  }
  /** Extract text without action buttons, hidden tooltips, scripts or editable drafts. */
  function cleanText(element) {
    const raw = element.textContent || '';
    const mediaCount = element.querySelectorAll('img, audio, video, canvas').length;
    const mediaLabel = Array.from(element.querySelectorAll('img[alt]'), image => image.getAttribute('alt')).join('|');
    const previous = cache.get(element);
    if (previous && previous.raw === raw && previous.mediaCount === mediaCount && previous.mediaLabel === mediaLabel) return previous.text;
    const copy = element.cloneNode(true);
    copy.querySelectorAll('script, style, noscript, button, svg, mat-icon, gem-icon, [role="button"], [role="toolbar"], [aria-hidden="true"], [hidden], .sr-only, .cdk-visually-hidden, .visually-hidden, .screen-reader-user-query-label, form, textarea, [contenteditable="true"]').forEach(node => node.remove());
    // Do not merge neighboring block text into a single unsearchable word.
    copy.querySelectorAll('p, div, li, pre, h1, h2, h3, h4, h5, h6, tr, br').forEach(node => node.append(document.createTextNode(' ')));
    let text = C.normalizeText(copy.textContent), placeholder = null;
    if (!text) {
      const descriptions = Array.from(element.querySelectorAll('img[alt]')).map(img => C.normalizeText(img.getAttribute('alt'))).filter(Boolean);
      if (descriptions.length) { placeholder={key:'[图片]',detail:descriptions.join(' / ')}; text = '[图片] ' + placeholder.detail; }
      else if (mediaCount) { placeholder={key:'[图片、音频或其他非文本消息]',detail:''}; text = placeholder.key; }
      else { placeholder={key:'[非文本消息或内容尚未呈现]',detail:''}; text = placeholder.key; }
    }
    // Cap unusually large generated blocks in the in-memory search index.
    if (text.length > 120000) text = text.slice(0, 120000) + ' … [索引已截断]';
    cache.set(element, {raw, mediaCount, mediaLabel, text, placeholder});
    return text;
  }
  function preferredTextNode(element, role) {
    const gemini = platform() === 'gemini';
    const selectors = role === 'user'
      ? [...(gemini ? ['.query-text','user-query-content'] : []), '[data-user-message-bubble="true"]', '.whitespace-pre-wrap']
      : [...(gemini ? ['.markdown-main-panel','message-content','.markdown','model-response-content'] : []), '[data-markdown-text-style="assistant-message"]', '[data-message-author-role="assistant"]', '.markdown', '[class~="prose"]'];
    for (const selector of selectors) {
      const visibleNodes = query(element, selector).filter(node => isOwnTurn(element, node) && rendered(node));
      const child = visibleNodes[0];
      if (child) {
        // A compound assistant may have multiple markdown blocks; preserve all of them.
        if (role === 'assistant' && visibleNodes.length > 1) continue;
        return child;
      }
    }
    return element;
  }
  /** Resolve live headings on demand; the memory index only stores plain metadata. */
  function outlineNodes(content) {
    if (!content?.isConnected) return [];
    return query(content, 'h1,h2,h3,h4,h5,h6').filter(node =>
      !node.closest('pre,code,button,[role="button"],[role="toolbar"],.cdk-visually-hidden,.visually-hidden,.screen-reader-user-query-label') && rendered(node) && C.normalizeText(node.textContent)).slice(0,64);
  }
  const EXPORT_SKIP = 'script,style,noscript,button,svg,mat-icon,gem-icon,[role="button"],[role="toolbar"],[aria-hidden="true"],[hidden],.sr-only,.cdk-visually-hidden,.visually-hidden,.screen-reader-user-query-label,form,textarea,[contenteditable="true"]';
  /** Best-effort Markdown for common rendered blocks. No image downloads or DOM writes. */
  function toMarkdown(content, language = 'auto') {
    if (!content?.isConnected) return '';
    const escape = text => String(text).replace(/([\\`*_[\]<>])/g, '\\$1');
    const fence = (text,minimum = 3) => {
      let size = minimum; for (const match of text.matchAll(/`+/g)) size = Math.max(size,match[0].length + 1);
      return '`'.repeat(size);
    };
    function walk(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) return escape(node.nodeValue.replace(/\s+/gu, ' '));
      if (node.nodeType !== Node.ELEMENT_NODE || node.matches(EXPORT_SKIP)) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'pre') {
        const copy = (node.querySelector('code') || node).cloneNode(true);
        copy.querySelectorAll(EXPORT_SKIP).forEach(n => n.remove());
        const text = copy.textContent.replace(/\r\n/g,'\n').replace(/^\n|\n$/g,''), ticks = fence(text);
        const language = (copy.className || '').match(/(?:^|\s)language-([\w+-]+)/)?.[1] || '';
        return '\n\n' + ticks + language + '\n' + text + '\n' + ticks + '\n\n';
      }
      if (node.matches('.katex-display,.katex')) {
        const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
        if (tex) return node.matches('.katex-display') ? '\n\n$$\n' + tex + '\n$$\n\n' : '$' + tex + '$';
      }
      if (tag === 'code') {
        const text = node.textContent, ticks = fence(text,1);
        return ticks + ' ' + text + ' ' + ticks;
      }
      if (tag === 'img') return '[' + (root.GTNextI18n?.t('图片',{},language) || '图片') + (node.alt ? ': ' + escape(node.alt) : '') + ']';
      if (tag === 'br') return '\n';
      if (tag === 'hr') return '\n\n---\n\n';
      if (tag === 'ul' || tag === 'ol') {
        const start = Number(node.getAttribute('start')) || 1;
        const lines = Array.from(node.children).filter(n => n.tagName === 'LI').map((li,i) => {
          const body = Array.from(li.childNodes).map(n => walk(n, depth + 1)).join('').trim();
          return '  '.repeat(depth) + (tag === 'ol' ? (start + i) + '. ' : '- ') + body;
        });
        return '\n' + lines.join('\n') + '\n\n';
      }
      if (tag === 'table') {
        const rows = query(node, 'tr').filter(row => row.closest('table') === node).map(row =>
          Array.from(row.children).filter(c => /^(TH|TD)$/.test(c.tagName)).map(cell =>
            Array.from(cell.childNodes).map(n => walk(n, depth)).join('').trim().replace(/\n+/g,' ').replace(/\|/g,'\\|')));
        if (!rows.length) return '';
        const width = Math.max(...rows.map(row => row.length));
        const line = row => '| ' + Array.from({length:width},(_,i) => row[i] || '').join(' | ') + ' |';
        return '\n\n' + [line(rows[0]),line(Array(width).fill('---')),...rows.slice(1).map(line)].join('\n') + '\n\n';
      }
      const text = Array.from(node.childNodes).map(n => walk(n, depth)).join('');
      if (/^h[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + text.trim() + '\n\n';
      if (tag === 'strong' || tag === 'b') return '**' + text.trim() + '**';
      if (tag === 'em' || tag === 'i') return '*' + text.trim() + '*';
      if (tag === 'del' || tag === 's') return '~~' + text.trim() + '~~';
      if (tag === 'blockquote') return '\n\n' + text.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
      if (tag === 'a') {
        try {
          const url = new URL(node.getAttribute('href'), location.href);
          if (node.hasAttribute('href') && ['https:','http:'].includes(url.protocol)) return '[' + text.trim() + '](<' + url.href.replace(/[<>]/g, encodeURIComponent) + '>)';
        } catch { /* Retain visible link text for invalid or unsafe links. */ }
      }
      return ['p','div','section','article'].includes(tag) ? '\n\n' + text.trim() + '\n\n' : text;
    }
    const lines = [], source = walk(content).trim().split('\n');
    let codeFence = 0, mathBlock = false, blank = false;
    for (const line of source) {
      const ticks = line.match(/^(`{3,})(.*)$/);
      if (codeFence) {
        lines.push(line);
        if (ticks && ticks[1].length >= codeFence && !ticks[2].trim()) codeFence = 0;
        blank = false; continue;
      }
      if (ticks) { codeFence = ticks[1].length; lines.push(line); blank = false; continue; }
      if (line.trim() === '$$') { mathBlock = !mathBlock; lines.push(line); blank = false; continue; }
      if (!line.trim() && !mathBlock) { if (!blank) lines.push(''); blank = true; }
      else { lines.push(line); blank = false; }
    }
    return lines.join('\n').trim();
  }
  function messageIds(element, target) {
    const ids = new Set(), selector = '[data-message-id], [data-chatgpt-selection-message-id], [data-chatgpt-search-message-ids]';
    const nodes = [element, ...element.querySelectorAll(selector)];
    const outer = element.closest('[data-chatgpt-search-unit-key]'); if (outer) nodes.push(outer);
    if (target && target !== element && !target.querySelector('[data-turn="user"] [data-turn="assistant"]')) {
      // Only attributes on the outer wrapper, never unrelated descendants.
      nodes.push(target);
    }
    for (const node of nodes) for (const attr of ['data-message-id', 'data-chatgpt-selection-message-id', 'data-chatgpt-search-message-ids']) {
      for (const id of (node.getAttribute(attr) || '').split(/\s+/)) if (id && id.length <= 256) ids.add(id);
    }
    return [...ids];
  }
  function positionalHint(element, target) {
    const values = [element, target].filter(Boolean).flatMap(node => ['data-content-search-unit-key', 'data-chatgpt-search-unit-key', 'data-turn-key', 'data-testid'].map(a => node.getAttribute(a) || ''));
    for (const value of values) {
      const match = value.match(/fallback-turn-(\d+)(?::(\d+))?/i) || value.match(/conversation-turn-(\d+)/);
      if (match) return Number(match[1]) * 1000 + Number(match[2] || 0);
    }
    return null;
  }
  function navigationMeta(element, target) {
    const nodes = [...new Set([element,target,element.closest('[data-turn-key]'),element.closest('[data-index],[data-item-index],[data-virtual-index]')].filter(Boolean))];
    const keys = [];
    let index = null;
    for (const node of nodes) {
      for (const attr of ['data-turn-key','data-content-search-unit-key','data-chatgpt-search-unit-key','data-item-key']) {
        const value=node.getAttribute(attr); if (value) keys.push(value);
      }
      for (const attr of ['data-index','data-item-index','data-virtual-index']) {
        const value=node.getAttribute(attr); if (value !== null && /^\d+$/.test(value) && Number(value)<100000) index=Number(value);
      }
    }
    return {navigationKeys:[...new Set(keys)],virtualIndex:index};
  }
  function nativeIdentity(element, target, role) {
    if (platform() === 'gemini') {
      const turn = element.closest('.conversation-container[id]');
      if (turn?.id) return 'gemini-turn:' + turn.id + ':' + role;
      const explicit = element.getAttribute('data-message-id') || element.getAttribute('data-response-id');
      if (explicit) return 'gemini-message:' + explicit + ':' + role;
      if (role === 'assistant') {
        const content = element.querySelector('message-content[id^="message-content-id-"], [id^="model-response-message-content"]');
        if (content?.id) return 'gemini-response:' + content.id + ':' + role;
      }
      // user-query-content-N is only a local ordinal, never a persistent ID.
      return '';
    }
    const ids = messageIds(element, target);
    if (ids.length) return 'message:' + ids[0] + ':' + role;
    const message = element.matches('[data-message-id]') ? element : element.querySelector('[data-message-id]');
    const messageId = message?.getAttribute('data-message-id');
    if (messageId) return 'message:' + messageId + ':' + role;
    const unit = element.getAttribute('data-content-search-unit-key');
    if (unit) return 'unit:' + unit + ':' + role;
    const turnKey = target.getAttribute('data-turn-key');
    if (turnKey) return 'turn:' + turnKey + ':' + role;
    // conversation-turn-N is positional and changes when history is prepended. Do NOT persist it.
    return '';
  }

  function collect(settings = C.DEFAULTS) {
    const scope = chooseScope();
    if (!scope) return {items: [], diagnostics: {adapter: 'empty', counts: {}, errors: []}, scope: null};
    const rules = [...(platform() === 'gemini' ? GEMINI_MARKERS : ROLE_MARKERS)];
    if (settings.customUserSelector) rules.unshift({name: 'custom-user', role: 'user', selector: settings.customUserSelector, priority: 200});
    if (settings.customAssistantSelector) rules.unshift({name: 'custom-assistant', role: 'assistant', selector: settings.customAssistantSelector, priority: 200});
    const counts = {}, errors = [], candidates = [];
    for (const rule of rules) {
      const error = validateSelector(rule.selector,settings.language);
      if (error) { errors.push(rule.name + ': ' + error); counts[rule.name] = 0; continue; }
      // Custom selectors may intentionally point outside <main>. Still exclude composer/navigation.
      const nodes = query(rule.name.startsWith('custom-') ? document.body : scope, rule.selector).filter(rendered);
      counts[rule.name] = nodes.length;
      for (const node of nodes) candidates.push({...rule, node});
    }
    // Resolve explicit role markers nested in wrappers, never infer role by alternating position.
    candidates.sort((a, b) => b.priority - a.priority);
    const accepted = [];
    for (const candidate of candidates) {
      const overlapping = accepted.find(entry => entry.node === candidate.node || entry.node.contains(candidate.node) || candidate.node.contains(entry.node));
      if (overlapping) continue;
      accepted.push(candidate);
    }
    accepted.sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    const occurrences = new Map(), nativeOccurrences = new Map(), roleCounts = {user: 0, assistant: 0};
    const items = accepted.map((entry, index) => {
      const outer = entry.node.closest(TURN_SELECTOR);
      // Some [data-turn-key] wrappers contain BOTH user and assistant: don't scroll both to the same outer node.
      const otherRole = accepted.some(other => other !== entry && other.role !== entry.role && outer?.contains(other.node));
      const target = outer && !otherRole ? outer : entry.node;
      const content = preferredTextNode(entry.node, entry.role);
      const text = cleanText(content);
      const placeholder = cache.get(content)?.placeholder || null;
      const outline = entry.role === 'assistant' ? outlineNodes(content).map((node,index) =>
        ({index, level:Number(node.tagName[1]), text:C.excerpt(node.textContent,160)})) : [];
      const native = nativeIdentity(entry.node, target, entry.role);
      const fingerprint = entry.role + ':' + C.hash(text);
      let key;
      if (native) {
        const count = (nativeOccurrences.get(native) || 0) + 1;
        nativeOccurrences.set(native, count);
        key = native + (count > 1 ? ':duplicate-' + count : '');
      } else {
        const count = (occurrences.get(fingerprint) || 0) + 1;
        occurrences.set(fingerprint, count);
        key = 'text:' + fingerprint + ':' + count;
      }
      roleCounts[entry.role]++;
      return {key, role: entry.role, ordinal: index + 1, roleOrdinal: roleCounts[entry.role], text, outline, placeholder,
        preview: C.excerpt(text, 110), target, content, source: entry.name, native: !!native,
        ...navigationMeta(entry.node, target), messageIds: messageIds(entry.node, target), orderHint: positionalHint(entry.node, target),
        aliases: [entry.node.getAttribute('data-content-search-unit-key') ? 'unit:' + entry.node.getAttribute('data-content-search-unit-key') + ':' + entry.role : '',
          target.getAttribute('data-turn-key') ? 'turn:' + target.getAttribute('data-turn-key') + ':' + entry.role : ''].filter(Boolean),
        signature: key + ':' + C.hash(text + '|' + outline.map(h => h.level + ':' + h.text).join('|'))};
    });
    let adapter = '未识别';
    if (accepted.some(entry => entry.name.startsWith('gemini-'))) adapter = 'Gemini';
    else if (accepted.some(entry => entry.name.startsWith('chat-work'))) adapter = 'Chat/Work';
    else if (accepted.some(entry => entry.name.startsWith('data-turn'))) adapter = 'data-turn';
    else if (accepted.some(entry => entry.name.startsWith('legacy'))) adapter = 'legacy';
    else if (items.length) adapter = 'fallback/custom';
    if (accepted.some(entry => entry.name.startsWith('custom-'))) adapter += ' + custom';
    return {items, scope, diagnostics: {adapter, counts, errors, users: roleCounts.user, assistants: roleCounts.assistant,
      stableIdentities: items.filter(item => item.native).length, textFallbacks: items.filter(item => !item.native).length}};
  }
  function findScrollParent(element) {
    let parent = element?.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|overlay)/.test(style.overflowY) && (parent.scrollHeight > parent.clientHeight + 4 || (platform() === 'gemini' && parent.matches(GEMINI_HISTORY) && parent.clientHeight > 0))) return parent;
      parent = parent.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }
  function isDocumentScroller(element) { return element === document.scrollingElement || element === document.documentElement || element === document.body; }
  function scrollTop(element) { return isDocumentScroller(element) ? window.scrollY : element.scrollTop; }
  function viewportTop(element) { return isDocumentScroller(element) ? 0 : element.getBoundingClientRect().top + element.clientTop; }
  function findConversationScroller() {
    const main = chooseScope();
    if (platform() === 'gemini') {
      const histories = [main,...query(document,GEMINI_HISTORY)].filter(Boolean);
      const history = histories.find(node => node.matches(GEMINI_HISTORY) && rendered(node) && /(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY));
      if (history) return history;
    }
    const marked = main?.closest('[data-scroll-root]');
    if (marked) return marked;
    for (const node of query(main || document, '[data-scroll-root], [data-app-action-timeline-scroll]')) {
      if (node.scrollHeight > node.clientHeight + 4) return node;
    }
    const first = query(main || document, TURN_SELECTOR)[0];
    return findScrollParent(first || main);
  }
  function scrollBounds(element) {
    const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
    const reverse = !isDocumentScroller(element) && getComputedStyle(element).flexDirection === 'column-reverse';
    return reverse ? {min: -maximum, max: 0} : {min: 0, max: maximum};
  }
  root.GTNextAdapter = Object.freeze({collect, validateSelector, cleanText, invalidateTextCache, outlineNodes, toMarkdown, findScrollParent, isDocumentScroller, scrollTop, viewportTop, ROLE_MARKERS, GEMINI_MARKERS, TURN_SELECTOR, MESSAGE_SELECTOR, conversationScope:chooseScope, platform, findConversationScroller, scrollBounds, messageIds});
})(globalThis);
