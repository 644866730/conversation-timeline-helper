/* 对话时间轴助手 — content controller. All message text stays in this tab's memory. */
(function () {
  'use strict';
  const C = globalThis.GTNextCore, A = globalThis.GTNextAdapter;
  if (!C || !A || !globalThis.chrome?.storage?.local || window.top !== window) return;
  globalThis.__GTNextInstance?.destroy();

  const paths = {
    timeline: 'M6 3v18M6 6h12M6 12h8M6 18h12M4 6h4M4 12h4M4 18h4',
    list: 'M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01',
    up: 'm6 15 6-6 6 6', down: 'm6 9 6 6 6-6',
    close: 'm6 6 12 12M6 18 18 6', search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    star: 'm12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z',
    refresh: 'M20 7v5h-5M4 17v-5h5M6.2 6.2a8 8 0 0 1 13 2.2M4.8 15.6a8 8 0 0 0 13 2.2',
    first: 'M5 4h14M6 15l6-6 6 6M12 9v11', last: 'M5 20h14M6 9l6 6 6-6M12 15V4',
    info: 'M12 11v6M12 7h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0'
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name] || paths.list);
    svg.append(path); return svg;
  }
  function button(action, title, name, className = 'icon-button') {
    const node = el('button', className); node.type = 'button'; node.dataset.action = action;
    node.title = title; node.setAttribute('aria-label', title);
    if (name) node.append(icon(name));
    return node;
  }
  const host = el('div'); host.id = C.HOST_ID;
  // Remove only our previous host after extension reload; never change ChatGPT's message nodes.
  document.getElementById(C.HOST_ID)?.remove();
  const shadow = host.attachShadow({mode: 'open'});
  const style = el('style'); style.textContent = globalThis.GTNextCSS; shadow.append(style);
  // Reborn14 circle/tooltip styling, with a new fixed-height rank layout. Search/extra controls
  // live only in the opt-in directory, not in the original-style timeline.
  const widget = el('nav', 'chatgpt-timeline-bar widget');
  widget.setAttribute('aria-label', 'ChatGPT 对话时间轴');
  const track = el('div', 'timeline-track track');
  const markers = el('div', 'timeline-track-content markers');
  track.append(markers); widget.append(track);
  const panel = el('section', 'panel'); panel.id = 'gtn-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', '消息目录');
  const panelHeader = el('header', 'panel-header'), brand = el('div', 'brand-icon'); brand.append(icon('timeline'));
  const headings = el('div', 'headings'), title = el('div', 'title', '对话导航'), subtitle = el('div', 'subtitle', '把长对话，变成清晰的路径。');
  headings.append(title, subtitle); panelHeader.append(brand, headings, button('close', '收起目录 · Esc', 'close'));
  const searchWrap = el('div', 'search-wrap'), search = el('input', 'search-input');
  search.type = 'search'; search.placeholder = '搜索已加载消息或序号…'; search.autocomplete = 'off';
  search.maxLength = 300; search.setAttribute('aria-label', '搜索本页已加载过的消息');
  const clearSearch = button('clear-search', '清空搜索', 'close', 'icon-button clear-search'); clearSearch.hidden = true;
  searchWrap.append(icon('search'), search, clearSearch);
  const filterRow = el('div', 'filter-row'), scopeSelect = el('select', 'scope-select');
  scopeSelect.setAttribute('aria-label', '显示消息范围');
  for (const [value, label] of [['user', '只看我的提问'], ['all', '提问与回复']]) {
    const option = el('option', '', label); option.value = value; scopeSelect.append(option);
  }
  const starFilter = button('filter-stars', '仅看收藏', 'star', 'star-filter'); starFilter.append(el('span', '', '收藏'));
  starFilter.setAttribute('aria-pressed', 'false');
  const resultCount = el('span', 'result-count', '0 条'); filterRow.append(scopeSelect, starFilter, resultCount);
  const list = el('div', 'message-list'); list.setAttribute('role', 'list'); list.setAttribute('aria-label', '当前消息');
  const footer = el('footer', 'panel-footer'), footerActions = el('div', 'footer-actions');
  const firstButton = button('first', '跳到第一条消息', 'first', 'text-button'); firstButton.append(el('span', '', '首条'));
  const lastButton = button('last', '跳到最后一条消息', 'last', 'text-button'); lastButton.append(el('span', '', '末条'));
  const infoButton = button('info', '识别状态与快捷键', 'info', 'icon-button'); infoButton.setAttribute('aria-expanded', 'false');
  const rescan = button('rescan', '重新识别当前页面', 'refresh', 'text-button rescan'); rescan.append(el('span', '', '重新识别'));
  const diagnosticsBox = el('div', 'diagnostics'); diagnosticsBox.hidden = true;
  footerActions.append(firstButton, lastButton, infoButton, rescan);
  const footnote = el('div', 'footnote', '仅已加载消息 · 点击节点才自动翻页定位');
  const historyLine = el('div', 'history-line'), historyLabel = el('span', '', '随页面加载自动更新');
  historyLine.append(historyLabel);
  footer.append(footerActions, diagnosticsBox, footnote);
  panel.append(panelHeader, historyLine, searchWrap, filterRow, list, footer);
  const navigationNotice = el('div','navigation-notice'); navigationNotice.hidden = true;
  navigationNotice.setAttribute('role','status'); navigationNotice.setAttribute('aria-live','polite');
  const navigationLabel = el('span','navigation-label');
  const navigationCancel = button('cancel-jump','取消定位',null,'navigation-control'); navigationCancel.textContent = '取消';
  const navigationRetry = button('retry-jump','重试网页定位',null,'navigation-control'); navigationRetry.textContent = '重试'; navigationRetry.hidden = true;
  navigationNotice.append(navigationLabel,navigationRetry,navigationCancel);

  const tooltip = el('div', 'timeline-tooltip tooltip'); tooltip.id = 'gtn-preview';
  tooltip.setAttribute('role', 'tooltip'); tooltip.setAttribute('aria-hidden', 'true'); tooltip.hidden = true;
  const tooltipMeasure = el('div', 'timeline-tooltip timeline-tooltip-measure');
  tooltipMeasure.setAttribute('aria-hidden', 'true');
  const toastBox = el('div', 'toast'); toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); toastBox.hidden = true;
  const focusRing = el('div', 'focus-ring'); focusRing.hidden = true;
  shadow.append(widget, panel, tooltip, tooltipMeasure, toastBox, focusRing, navigationNotice);
  (document.body || document.documentElement).append(host);

  let data = {}, settings = {...C.DEFAULTS}, items = [], railItems = [], filtered = [], groups = [], activeKey = '', panelOpen = false;
  let query = '', starredOnly = false, route = C.routeFromURL(location.href), scope = C.scopeFromURL(location.href);
  let diagnostics = {adapter: '初始化', counts: {}, errors: []}, blocked = new Map();
  let scrollRoot = document.scrollingElement, positions = [], renderSignature = '', starRevision = 0;
  let scanTimer = 0, frame = 0, toastTimer = 0, ringFrame = 0, routeTimer = 0, destroyed = false, pausedFollowUntil = 0;
  let lastSafetyScan = 0, scanCount = 0, lastScanMs = 0, storageError = false, renderEpoch = 0;
  let pressTimer = 0, pressOrigin = null, pressedNode = null, suppressedClickUntil = 0;
  let previewTimer = 0, previewFrame = 0, previewNode = null;
  let timelineLayout = {height: 0, y: [], ratios: [], normalized: [], diameters: []};
  let activity = 0, navigationKey = '', navigationName = '', scrollDirection = 'newer', lastScrollPosition = null, lastScrollRoot = null;
  let previewGuard = null;
  const loadedIndex = globalThis.GTNextLoadedIndex.create();
  const navigator = globalThis.GTNextNavigation.create({
    items: () => items, scan: scanNow, route: () => C.routeFromURL(location.href),
    enabled: () => settings.enabled && !destroyed && !previewGuard?.blocked,
    smooth: () => settings.smoothScroll && !reducedMotion.matches,
    direction: sign => { scrollDirection = sign < 0 ? 'older' : 'newer'; },
    progress: status => {
      navigationNotice.hidden = !['locating','failed'].includes(status.stage);
      navigationRetry.hidden = status.stage !== 'failed';
      navigationCancel.textContent = status.stage === 'failed' ? '关闭' : '取消';
      navigationCancel.setAttribute('aria-label',status.stage === 'failed' ? '关闭提示' : '取消定位');
      navigationLabel.textContent = status.stage === 'failed'
        ? '网页暂未恢复目标消息，请重试。'
        : `正在定位${navigationName}…${status.method === 'direct' ? '' : ' 自动换页中'}`;
    }
  });

  const ephemeralStars = new Set(), busyStars = new Set(), listeners = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)'), darkPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const rowMap = new Map(), markerNodes = [];
  function on(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }
  function toast(message) {
    toastBox.textContent = message; toastBox.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastBox.hidden = true; }, 3000);
  }
  function starred(item) { return scope.persistent ? [item.key, ...(item.aliases || [])].some(k => !!data[C.starKey(scope, k)]) : ephemeralStars.has(item.key); }
  function historySummary() { return `已加载过 ${items.length} 条 · 网页当前挂载 ${items.filter(m => m.target?.isConnected).length} 条`; }
  function updateHistoryLine() {
    historyLabel.textContent = historySummary(); historyLine.dataset.state = 'ready';
    footnote.textContent = '不自动补全历史 · 点击旧节点，自动换页定位';
  }

  function updateTheme() {
    let theme = settings.theme;
    if (theme === 'auto') {
      const html = document.documentElement, body = document.body;
      const explicit = html.getAttribute('data-theme') || html.getAttribute('data-color-mode') || body?.getAttribute('data-theme') || body?.getAttribute('data-color-mode') ||
        document.querySelector('main, [role="main"]')?.closest('[data-theme]')?.getAttribute('data-theme');
      if (explicit === 'dark' || explicit === 'light') theme = explicit;
      else if (html.classList.contains('dark') || body?.classList.contains('dark')) theme = 'dark';
      else if (html.classList.contains('light') || body?.classList.contains('light')) theme = 'light';
      else theme = darkPreference.matches ? 'dark' : 'light';
    }
    host.dataset.theme = theme; host.dataset.side = settings.side;
    // Original bar is top:60px / bottom:40px; legacy verticalPosition is ignored.
  }
  function updateVisibility() {
    widget.hidden = !settings.enabled || !railItems.length; panel.hidden = !settings.enabled || !panelOpen;
    if (!settings.enabled || !settings.showPreview) hidePreview();
  }
  function openPanel(open, focusSearch = false) {
    if (previewGuard?.check()) return;
    panelOpen = open; updateVisibility();
    if (open) { panel.classList.add('is-entering'); render(); if (focusSearch) search.focus({preventScroll: true}); }
    else { hidePreview(); if (shadow.activeElement && panel.contains(shadow.activeElement)) markers.querySelector('.active, .timeline-dot')?.focus({preventScroll: true}); }
  }
  async function saveSetting(key, value) {
    if (!Object.hasOwn(C.DEFAULTS, key)) return;
    const safe = C.normalizeSettings({...settings, [key]: value})[key];
    try { await chrome.storage.local.set({[C.SETTING_PREFIX + key]: safe}); }
    catch { toast('设置保存失败；扩展更新后请刷新此页面。'); }
  }
  function describe(item) { return (item.role === 'user' ? '提问 ' : '回复 ') + item.roleOrdinal; }
  async function toggleStar(key, quiet = false) {
    const item = items.find(entry => entry.key === key);
    if (!item || busyStars.has(key)) return;
    const old = starred(item), scopeAtStart = {...scope};
    if (!scope.persistent) {
      if (old) ephemeralStars.delete(key); else ephemeralStars.add(key);
      starRevision++; render();
      if (!quiet) toast(old ? '已取消临时收藏' : '当前会话没有稳定编号，收藏仅在本页有效。'); return;
    }
    busyStars.add(key);
    const storageKey = C.starKey(scope, key), oldValue = data[storageKey];
    const aliasKeys = (item.aliases || []).map(k => C.starKey(scope, k));
    const oldAliases = Object.fromEntries(aliasKeys.filter(k => data[k]).map(k => [k, data[k]]));
    if (old) aliasKeys.forEach(k => delete data[k]);
    if (old) delete data[storageKey]; else data[storageKey] = {version: 1, savedAt: Date.now()};
    starRevision++; render();
    try {
      if (old) await chrome.storage.local.remove([storageKey, ...aliasKeys]);
      else await chrome.storage.local.set({[storageKey]: data[storageKey]});
      if (!quiet && scopeAtStart.key === scope.key) toast(old ? '已取消收藏' : '已收藏，保存在此浏览器');
    } catch {
      if (oldValue) data[storageKey] = oldValue; else delete data[storageKey];
      Object.assign(data, oldAliases);
      starRevision++; render(); toast('收藏保存失败：请刷新页面，或检查扩展存储是否已满。');
    } finally { busyStars.delete(key); }
  }
  function resetRoute(newRoute) {
    // URL can change BEFORE React commits the next conversation. Ignore unchanged old nodes.
    blocked = new Map(items.filter(item => item.target).map(item => [item.target, item.domSignature || item.signature]));
    activity++; navigator.reset(); previewGuard?.reset(); navigationNotice.hidden = true; navigationKey = ''; loadedIndex.reset();
    route = newRoute; scope = C.scopeFromURL(location.href);
    items = []; railItems = []; filtered = []; positions = []; activeKey = ''; ephemeralStars.clear();
    scrollDirection = 'newer'; lastScrollPosition = null; lastScrollRoot = null; cancelPress();
    query = ''; search.value = ''; clearSearch.hidden = true; starredOnly = false;
    starFilter.setAttribute('aria-pressed', 'false'); renderSignature = ''; hidePreview();
    cancelAnimationFrame(ringFrame); focusRing.hidden = true; render();
  }
  function checkRoute() {
    const newRoute = C.routeFromURL(location.href);
    if (newRoute !== route) { resetRoute(newRoute); scheduleScan(80); return true; }
    return false;
  }
  function scheduleScan(delay = 260) {
    if (destroyed || scanTimer || !settings.enabled || document.hidden) return;
    scanTimer = setTimeout(() => { scanTimer = 0; scanNow(); }, delay);
  }
  function scanNow() {
    if (destroyed || !settings.enabled) return;
    clearTimeout(scanTimer); scanTimer = 0;
    checkRoute();
    if (previewGuard?.check()) return;
    const start = performance.now();
    try {
      const result = A.collect(settings);
      const domItems = result.items.filter(item => blocked.get(item.target) !== item.signature);
      observeScrollDirection();
      items = loadedIndex.collect(domItems, {direction: scrollDirection});
      navigator.record(items);

      // Reassign ordinals if the route was briefly displaying a mix of old and new nodes.
      const counts = {user: 0, assistant: 0};
      items.forEach((item, i) => { item.ordinal = i + 1; item.roleOrdinal = ++counts[item.role]; });
      diagnostics = {...result.diagnostics, users: counts.user, assistants: counts.assistant, domMessages: domItems.length,
        indexMode: 'loaded-only', remembered: items.length, ...loadedIndex.diagnostics()};
      if (blocked.size && items.length) {
        const stillBlocked = result.items.filter(item => blocked.get(item.target) === item.signature);
        if (!stillBlocked.length) blocked.clear();
      }
      render(); updateGeometry(); updateActive(); updateTheme();
      if (!host.isConnected) (document.body || document.documentElement).append(host);
    } catch (error) {
      diagnostics.errors = ['页面识别失败：' + String(error?.name || 'Error')];
      // Never log conversation data or full exception objects.
      updateDiagnostics();
    }
    lastScanMs = Math.round((performance.now() - start) * 10) / 10; scanCount++;
    lastSafetyScan = Date.now();
  }
  function updateDiagnostics() {
    diagnosticsBox.textContent = `识别器：${diagnostics.adapter}\n${historySummary()}\n${diagnostics.users || 0} 条提问 / ${diagnostics.assistants || 0} 条回复\n页面挂载：${diagnostics.domMessages || 0} 条\n` +
      (scope.persistent ? '收藏：此浏览器本地保存\n' : '收藏：临时会话，仅本页有效\n') +
      'Alt+Shift+T：展开/收起目录\nAlt+Shift+↑ / ↓：上一条/下一条\n' +
      (diagnostics.errors?.length ? diagnostics.errors.join('\n') : '更多设置：浏览器工具栏的扩展图标');
  }
  function render() {
    if (previewGuard?.blocked) return;
    railItems = items.filter(item => settings.includeAssistant || item.role === 'user');
    filtered = railItems.filter(item => (!starredOnly || starred(item)) && C.matchesQuery(item, query));
    subtitle.textContent = `${diagnostics.users || 0} 条提问 · ${diagnostics.assistants || 0} 条回复`;
    resultCount.textContent = filtered.length + ' 条';
    firstButton.disabled = lastButton.disabled = !filtered.length;
    scopeSelect.value = settings.includeAssistant ? 'all' : 'user';
    starFilter.setAttribute('aria-pressed', String(starredOnly));
    updateDiagnostics(); updateVisibility(); updateHistoryLine();
    const capacity = railItems.length; // One marker per message; no grouping.
    const signature = C.hash(railItems.map(item => item.key + ':' + item.preview).join('\n')) + ':' + starRevision + ':' + capacity + ':' + query + ':' + starredOnly + ':' + panelOpen + ':' + C.hash(filtered.map(item => item.key).join('|'));
    if (signature === renderSignature) return;
    renderSignature = signature; renderEpoch++; cancelPress();
    const previewKey = previewNode?.dataset.key; hidePreview();
    const oldScroll = list.scrollTop;
    const focused = shadow.activeElement;
    const focusedKey = focused?.dataset?.key, focusedAction = focused?.dataset?.action;
    const fragment = document.createDocumentFragment(); rowMap.clear();
    for (const item of panelOpen ? filtered : []) {
      const row = el('div', 'message-row'); row.dataset.role = item.role; row.setAttribute('role', 'listitem');
      const go = button('goto', describe(item) + '：' + item.preview, null, 'message-link'); go.dataset.key = item.key;
      const meta = el('div', 'row-meta'); meta.append(el('span', 'row-dot'), el('span', '', describe(item)), el('span', '', '· #' + item.ordinal));
      go.append(meta, el('div', 'row-preview', item.preview));
      const star = button('star', starred(item) ? '取消收藏' : '收藏这条消息', 'star', 'icon-button star-button');
      star.dataset.key = item.key; star.setAttribute('aria-pressed', String(starred(item)));
      row.append(go, star); fragment.append(row); rowMap.set(item.key, {row, go, star});
    }
    if (!filtered.length) {
      const empty = el('div', 'empty'); empty.append(icon('timeline'));
      const hasItems = items.length > 0;
      empty.append(el('strong', '', hasItems ? '没有符合条件的消息' : '还没有识别到消息'));
      empty.append(el('span', '', hasItems ? '试试更短的关键词、切换范围，或关闭收藏筛选。' : '请打开一段对话。内容已显示但这里仍为空时，可重新识别，或在扩展设置中查看诊断、配置备用选择器。'));
      fragment.append(empty);
    }
    list.replaceChildren(fragment); list.scrollTop = oldScroll;
    if (focusedKey && rowMap.has(focusedKey)) rowMap.get(focusedKey)[focusedAction === 'star' ? 'star' : 'go'].focus({preventScroll: true});
    groups = railItems.map(item => [item]); markerNodes.length = 0;
    markers.replaceChildren();
    updateGeometry(); paintActive();
    const restoredPreview = markerNodes.find(node => node?.dataset.key === previewKey);
    if (restoredPreview) showPreview(restoredPreview);
  }
  function referenceY() { return A.scrollTop(scrollRoot) + Math.max(24, 94 - A.viewportTop(scrollRoot)); }
  function observeScrollDirection() {
    if (previewGuard?.blocked) return;
    const root = A.findConversationScroller(), value = A.scrollTop(root);
    if (root === lastScrollRoot && lastScrollPosition !== null && Math.abs(value - lastScrollPosition) > 2)
      scrollDirection = value < lastScrollPosition ? 'older' : 'newer';
    lastScrollPosition = value; lastScrollRoot = root;
  }
  function updateGeometry() {
    if (previewGuard?.blocked) return;
    const first = railItems.find(item => item.target?.isConnected);
    scrollRoot = first ? A.findScrollParent(first.target) : A.findConversationScroller();
    const y = A.scrollTop(scrollRoot), top = A.viewportTop(scrollRoot);
    positions = railItems.map(item => item.target?.isConnected ? item.target.getBoundingClientRect().top - top + y : NaN);
    timelineLayout = C.timelineGeometry(railItems, widget.clientHeight || Math.max(0, innerHeight - 100));
    // One viewport, forever. Message count never changes canvas height.
    markers.style.height = '100%';
    renderMarkerWindow();
    previewGuard?.remember();
  }
  function renderMarkerWindow() {
    groups.forEach((group, index) => {
      const item = group[0]; let node = markerNodes[index];
      if (!node) {
        node = button('marker', describe(item) + '：' + item.preview, null, 'timeline-dot marker');
        node.removeAttribute('title'); node.dataset.group = String(index); node.dataset.key = item.key;
        node.dataset.role = item.role; node.dataset.targetTurnId = item.key;
        markers.append(node); markerNodes[index] = node;
      }
      node.classList.toggle('starred', starred(item)); node.classList.toggle('is-starred', starred(item));
      node.classList.toggle('active', item.key === activeKey); node.classList.toggle('is-active', item.key === activeKey);
      node.setAttribute('aria-pressed', String(starred(item)));
      if (item.key === activeKey) node.setAttribute('aria-current', 'true'); else node.removeAttribute('aria-current');
      node.tabIndex = item.key === activeKey || (!activeKey && index === 0) ? 0 : -1;
      node.style.setProperty('--n', String(timelineLayout.normalized[index] || 0));
      node.style.setProperty('--marker-diameter', timelineLayout.diameters[index] + 'px');
      node.style.top = timelineLayout.y[index] + 'px';
    });
  }
  function markerForEvent(event) {
    const rect = widget.getBoundingClientRect();
    if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
      return markerNodes[C.nearestIndex(timelineLayout.y, event.clientY - rect.top)];
    }
    return event.target.closest?.('.marker');
  }
  function paintActive() {
    for (const [key, row] of rowMap) {
      const active = key === activeKey; row.row.classList.toggle('is-active', active);
      if (active) row.go.setAttribute('aria-current', 'true'); else row.go.removeAttribute('aria-current');
    }
    groups.forEach((group, i) => {
      const active = group.some(item => item.key === activeKey);
      markerNodes[i]?.classList.toggle('is-active', active); markerNodes[i]?.classList.toggle('active', active);
      if (markerNodes[i]) markerNodes[i].tabIndex = active || (!activeKey && i === 0) ? 0 : -1;
      if (active) markerNodes[i]?.setAttribute('aria-current', 'true'); else markerNodes[i]?.removeAttribute('aria-current');
    });
  }
  function updateActive() {
    if (previewGuard?.blocked) return;
    if (!railItems.length || !scrollRoot) return;
    const anchor = referenceY();
    let current;
    if (railItems.some(item => !item.target?.isConnected)) {
      const viewportAnchor = A.viewportTop(scrollRoot) + anchor - A.scrollTop(scrollRoot);
      const live = items.filter(item => item.target?.isConnected);
      const candidate = live.filter(item => item.target.getBoundingClientRect().top <= viewportAnchor).at(-1) || live[0];
      current = candidate ? railItems.filter(item => item.ordinal <= candidate.ordinal).at(-1) || railItems[0] : null;
    } else current = railItems[C.activeIndex(positions, anchor)];

    if (!current || current.key === activeKey) return;
    activeKey = current.key; paintActive();
    if (panelOpen && !query && Date.now() > pausedFollowUntil && shadow.activeElement !== search && !panel.contains(shadow.activeElement)) {
      scrollListTo(current.key, false);
    }
  }
  function scrollListTo(key, force) {
    const row = rowMap.get(key)?.row;
    if (!row) return;
    const rect = row.getBoundingClientRect(), parent = list.getBoundingClientRect();
    if (force || rect.top < parent.top + 8 || rect.bottom > parent.bottom - 8) {
      list.scrollTop += rect.top - parent.top - list.clientHeight * .32;
    }
  }
  function requestPositionUpdate() {
    if (frame || destroyed || !settings.enabled) return;
    frame = requestAnimationFrame(() => { frame = 0; updateGeometry(); updateActive(); });
  }
  function findItem(key) { return items.find(item => item.key === key) || items.find(item => item.aliases?.includes(key)); }
  async function jump(key) {
    if (previewGuard?.check()) return;
    if (checkRoute()) { toast('会话正在切换，请稍后重新选择。'); return; }
    const item = findItem(key); if (!item) return;
    activity++; navigationKey = item.key; navigationName = describe(item);
    hidePreview(); cancelAnimationFrame(ringFrame); focusRing.hidden = true;
    const result = await navigator.jump(item.key);
    if (!result.ok || destroyed) return;
    // Only a real, revalidated message in the native chat is a successful jump.
    activeKey = result.item.key; paintActive(); scrollListTo(activeKey, false);
    toast('已定位到' + describe(result.item));

  }
  function step(delta) {
    if (!railItems.length) return;
    const index = railItems.findIndex(item => item.key === activeKey);
    jump(railItems[C.clamp(index < 0 ? 0 : index + delta, 0, railItems.length - 1)].key);
  }
  function hidePreview() {
    clearTimeout(previewTimer); cancelAnimationFrame(previewFrame); previewFrame = 0;
    tooltip.classList.remove('visible'); tooltip.hidden = true; tooltip.setAttribute('aria-hidden', 'true'); previewNode = null;
    markers.querySelectorAll('[aria-describedby]').forEach(node => node.removeAttribute('aria-describedby'));
  }
  function deferHidePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(hidePreview, 100); }
  function showPreview(node) {
    if (!settings.enabled || !settings.showPreview || previewGuard?.blocked) return;
    const item = groups[Number(node.dataset.group)]?.[0]; if (!item) return;
    clearTimeout(previewTimer); cancelAnimationFrame(previewFrame); previewNode = node;
    const rect = node.getBoundingClientRect(), gap = 8 + 4 + 4, pad = 8;
    const leftAvail = Math.max(0, rect.left - gap - pad), rightAvail = Math.max(0, innerWidth - rect.right - gap - pad);
    const placement = rightAvail > leftAvail ? 'right' : 'left';
    const available = Math.min(288, placement === 'left' ? leftAvail : rightAvail);
    const width = [280, 240, 200, 160].find(w => w <= available) || Math.max(40, Math.min(available, innerWidth - 16));
    const full = (starred(item) ? '★ ' : '') + C.normalizeText(item.text || item.preview);
    // Same single-text, max-three-line tooltip; no metadata header or footer.
    tooltipMeasure.style.width = width + 'px'; tooltipMeasure.textContent = full;
    let shown = full;
    if (tooltipMeasure.offsetHeight > 76) {
      // Measure rendered text rather than guessing the width of Chinese/emoji glyphs.
      const chars = Array.from(full); let lo = 0, hi = chars.length, best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        tooltipMeasure.textContent = chars.slice(0, mid).join('').trimEnd() + '…';
        if (tooltipMeasure.offsetHeight <= 76) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      shown = chars.slice(0, best).join('').trimEnd() + '…';
    }
    tooltipMeasure.textContent = shown;
    const height = Math.min(76, tooltipMeasure.offsetHeight || 40);
    tooltip.classList.remove('visible'); tooltip.textContent = shown; tooltip.hidden = false;
    tooltip.style.width = width + 'px'; tooltip.style.height = height + 'px';
    tooltip.dataset.placement = placement;
    tooltip.style.left = C.clamp(Math.round(placement === 'left' ? rect.left - gap - width : rect.right + gap), pad, Math.max(pad, innerWidth - width - pad)) + 'px';
    tooltip.style.top = C.clamp(Math.round(rect.top + rect.height / 2 - height / 2), pad, Math.max(pad, innerHeight - height - pad)) + 'px';
    tooltip.setAttribute('aria-hidden', 'false'); node.setAttribute('aria-describedby', tooltip.id);
    previewFrame = requestAnimationFrame(() => { previewFrame = 0; if (previewNode === node) tooltip.classList.add('visible'); });
  }
  function filterChanged() {
    activeKey = ''; renderSignature = ''; render(); list.scrollTop = 0; updateGeometry(); updateActive();
  }
  function cancelPress() { clearTimeout(pressTimer); pressTimer = 0; pressOrigin = null; pressedNode?.classList.remove('holding'); pressedNode = null; }
  previewGuard = globalThis.GTNextPreviewGuard.create({
    host, items: () => items, settings: () => settings, route: () => C.routeFromURL(location.href),
    enabled: () => settings.enabled && !destroyed,
    pause: () => {
      activity++; navigator.cancel('preview'); cancelPress(); hidePreview();
      navigationNotice.hidden = true; cancelAnimationFrame(ringFrame); focusRing.hidden = true;
    },
    resume: () => { lastScrollRoot = null; lastScrollPosition = null; renderSignature = ''; scheduleScan(0); }
  });

  on(shadow, 'click', event => {
    if (previewGuard?.check()) { event.preventDefault(); return; }
    let node = event.target.closest?.('button');
    if (widget.contains(event.target) && event.detail > 0) node = markerForEvent(event) || node;
    if (!node) return;
    const action = node.dataset.action;
    if (action === 'cancel-jump') { navigator.cancel('user'); navigationNotice.hidden = true; return; }
    if (action === 'retry-jump') { void jump(navigationKey); return; }

    if (action === 'marker' && Date.now() < suppressedClickUntil) { event.preventDefault(); return; }
    switch (action) {
      case 'toggle': openPanel(!panelOpen); break;
      case 'close': openPanel(false); break;
      case 'goto': jump(node.dataset.key); break;
      case 'marker': {
        const group = groups[Number(node.dataset.group)];
        if (group?.length > 1) { openPanel(true); scrollListTo(group[0].key, true); }
        if (group?.length) jump(group[0].key);
        break;
      }
      case 'star': void toggleStar(node.dataset.key); break;
      case 'previous': step(-1); break;
      case 'next': step(1); break;
      case 'first': if (filtered.length) jump(filtered[0].key); break;
      case 'last': if (filtered.length) jump(filtered.at(-1).key); break;
      case 'rescan': scanNow(); toast(`已识别 ${items.length} 条已加载消息`); break;
      case 'clear-search': search.value = ''; query = ''; clearSearch.hidden = true; filterChanged(); search.focus(); break;
      case 'filter-stars': starredOnly = !starredOnly; filterChanged(); break;
      case 'info': diagnosticsBox.hidden = !diagnosticsBox.hidden; infoButton.setAttribute('aria-expanded', String(!diagnosticsBox.hidden)); break;
    }
  });
  on(search, 'input', () => { query = search.value; clearSearch.hidden = !query; filterChanged(); });
  on(scopeSelect, 'change', () => { void saveSetting('includeAssistant', scopeSelect.value === 'all'); });
  on(list, 'wheel', () => { pausedFollowUntil = Date.now() + 4000; }, {passive: true});
  on(list, 'pointerdown', () => { pausedFollowUntil = Date.now() + 4000; }, {passive: true});
  on(markers, 'pointerover', event => { const node = event.target.closest?.('.marker'); if (node) showPreview(node); });
  on(markers, 'pointerleave', deferHidePreview);
  on(markers, 'focusin', event => { const node = event.target.closest?.('.marker'); if (node) showPreview(node); });
  on(markers, 'focusout', deferHidePreview);
  on(markers, 'contextmenu', event => {
    if (previewGuard?.check()) return;
    const node = markerForEvent(event), group = node && groups[Number(node.dataset.group)];
    if (group?.length === 1) { event.preventDefault(); cancelPress(); void toggleStar(group[0].key, true); }
  });
  on(markers, 'pointerdown', event => {
    if (previewGuard?.check()) return;
    if (event.button !== 0) return;
    const node = markerForEvent(event), group = node && groups[Number(node.dataset.group)];
    if (group?.length !== 1) return;
    cancelPress(); const epoch = renderEpoch; pressOrigin = {x: event.clientX, y: event.clientY};
    pressedNode = node; node.classList.add('holding');
    pressTimer = setTimeout(() => {
      if (epoch !== renderEpoch) { cancelPress(); return; }
      suppressedClickUntil = Date.now() + 800; cancelPress(); void toggleStar(group[0].key, true);
    }, 550);
  });
  on(window, 'pointerup', cancelPress, true); on(window, 'pointercancel', cancelPress, true);
  on(window, 'blur', () => { cancelPress(); hidePreview(); });
  on(window, 'pointermove', event => {
    if (pressOrigin && Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > 6) cancelPress();
  }, {passive: true});
  on(markers, 'pointermove', event => {
    const node = markerForEvent(event); if (node && node !== previewNode) showPreview(node);
  }, {passive: true});
  on(widget, 'wheel', event => {
    if (!scrollRoot || previewGuard?.check()) return;
    event.preventDefault(); navigator.cancel('user'); cancelPress(); hidePreview(); activity++;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (A.isDocumentScroller(scrollRoot) ? innerHeight : scrollRoot.clientHeight) : 1;
    const destination = A.scrollTop(scrollRoot) + event.deltaY * unit;
    if (A.isDocumentScroller(scrollRoot)) window.scrollTo({top: destination, behavior: 'instant'});
    else scrollRoot.scrollTo({top: destination, behavior: 'instant'});
    requestPositionUpdate();
  }, {passive: false});
  on(shadow, 'keydown', event => {
    if (previewGuard?.check()) return;
    // Do not let ChatGPT consume keystrokes typed in the directory's search input.
    event.stopPropagation();
    if (event.target.closest?.('.marker') && !event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const index = Number(event.target.dataset.group);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? markerNodes.length - 1 : C.clamp(index + (event.key === 'ArrowUp' ? -1 : 1), 0, markerNodes.length - 1);
      markerNodes[next]?.focus({preventScroll: true}); return;
    }
    if (settings.keyboard && !event.isComposing && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyT') { event.preventDefault(); openPanel(!panelOpen); }
    else if (settings.keyboard && !event.isComposing && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyF') { event.preventDefault(); openPanel(true, true); }
    else if (settings.keyboard && !event.isComposing && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && ['ArrowUp', 'ArrowDown'].includes(event.code) && !event.target.closest?.('input, textarea, select')) { event.preventDefault(); step(event.code === 'ArrowUp' ? -1 : 1); }
    else if (event.key === 'Escape') { event.preventDefault(); if (navigator.busy || !navigationNotice.hidden) { navigator.cancel('user'); navigationNotice.hidden = true; } else openPanel(false); }
    else if (event.key === 'Enter' && event.target === search && filtered.length) { event.preventDefault(); jump(filtered[0].key); }
    else if (event.key === 'ArrowDown' && event.target === search && filtered.length) { event.preventDefault(); rowMap.get(filtered[0].key)?.go.focus(); }
  });
  on(document, 'keydown', event => {
    if (previewGuard?.check() || !settings.enabled || !settings.keyboard || event.isComposing || event.repeat || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.composedPath().includes(host)) return;
    if (event.code === 'KeyT') { event.preventDefault(); event.stopPropagation(); openPanel(!panelOpen, !panelOpen); return; }
    if (event.code === 'KeyF') { event.preventDefault(); event.stopPropagation(); openPanel(true, true); return; }
    const target = event.composedPath()[0];
    if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); step(event.code === 'ArrowUp' ? -1 : 1); }
  }, true);
  on(window, 'scroll', event => { if (!previewGuard?.blocked && !event.composedPath().includes(host)) { observeScrollDirection(); hidePreview(); requestPositionUpdate(); scheduleScan(160); } }, {capture: true, passive: true});
  on(window, 'resize', () => { renderSignature = ''; scheduleScan(100); hidePreview(); });
  on(window, 'popstate', () => { checkRoute(); scheduleScan(80); });
  on(document, 'visibilitychange', () => { if (document.hidden) navigator.cancel('hidden'); if (!document.hidden) { checkRoute(); scheduleScan(80); } });
  on(document, 'load', event => { if (event.target instanceof HTMLImageElement) scheduleScan(100); }, true);
  on(darkPreference, 'change', updateTheme);

  const observer = new MutationObserver(records => {
    if (!settings.enabled || destroyed) return;
    if (records.some(record => record.type === 'attributes')) A.invalidateTextCache();
    if (records.some(record => record.target !== host && !host.contains(record.target))) { checkRoute(); scheduleScan(); }
  });
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-message-author-role', 'data-message-id', 'data-turn-key', 'data-turn', 'data-content-search-unit-key', 'data-chatgpt-search-unit-key', 'data-chatgpt-selection-message-id', 'data-chatgpt-search-message-ids', 'data-user-message-bubble', 'hidden', 'aria-hidden']});
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style']});
  if (document.body) themeObserver.observe(document.body, {attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style']});
  const resizeObserver = new ResizeObserver(() => { scheduleScan(160); });
  if (document.body) resizeObserver.observe(document.body);

  function storageChanged(changes, area) {
    if (area !== 'local' || destroyed) return;
    let changedSettings = false, changedStars = false;
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) delete data[key]; else data[key] = change.newValue;
      if (key.startsWith(C.SETTING_PREFIX)) changedSettings = true;
      if (key.startsWith(C.STAR_PREFIX)) changedStars = true;
    }
    if (changedStars) starRevision++;
    if (changedSettings) {
      settings = C.settingsFromStorage(data);
      renderSignature = ''; updateTheme(); updateVisibility();
      if (!settings.enabled) { activity++; navigator.reset(); previewGuard?.reset(); navigationNotice.hidden = true; loadedIndex.reset(); items = []; railItems = []; filtered = []; diagnostics = {...diagnostics, users: 0, assistants: 0}; cancelAnimationFrame(ringFrame); focusRing.hidden = true; render(); }
      else scanNow();
    } else if (changedStars) { render(); updateGeometry(); updateActive(); }
  }
  for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) on(document, name, event => {
    if (event.composedPath().includes(host)) return;
    // A navigation hotkey already handled above is not a second manual-scroll gesture.
    if (name === 'keydown' && event.defaultPrevented && event.altKey && event.shiftKey) return;
    if (name === 'keydown' && !['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    activity++; navigator.cancel('user');
  }, {capture: true, passive: true});
  chrome.storage.onChanged.addListener(storageChanged);
  function getStatus() {
    return {ok: true, version: C.VERSION, enabled: settings.enabled, loaded: items.length, users: diagnostics.users || 0,
      assistants: diagnostics.assistants || 0, visible: railItems.length, matched: filtered.length, adapter: diagnostics.adapter, theme: host.dataset.theme,
      persistentBookmarks: scope.persistent, storageError,
      history: {stage: 'observing', complete: false, indexed: items.length,
        mounted: items.filter(m => m.target?.isConnected).length, summary: historySummary(), mode: 'loaded-only'},
      navigation: navigator.status(),
      preview: previewGuard?.status(),
      diagnostics: {...diagnostics, scanCount, lastScanMs},
      limits: ['仅本次页面实际加载过的消息；刷新或切换会话后重新建立', '点击已加载节点时按需自动翻页定位；失败提示重试，不弹缓存正文', '每条正文最多120000字符；超出总缓存预算时仅保留摘要与节点'],
      // Deliberately no URL, conversation IDs, message IDs, search query or message text.
      panelOpen};
  }
  function messageListener(message, sender, respond) {
    if (sender.id !== chrome.runtime.id || destroyed || !message?.type?.startsWith('GTN_')) return;
    if (message.type === 'GTN_STATUS') { respond(getStatus()); return; }
    if (message.type === 'GTN_RESET_INDEX') { navigator.reset(); navigationNotice.hidden = true; loadedIndex.reset(); items = []; renderSignature = ''; scanNow(); respond(getStatus()); return; }
    if (message.type === 'GTN_RESCAN') { scanNow(); respond(getStatus()); return; }
    if (message.type === 'GTN_OPEN') { openPanel(true, true); respond({ok: true}); return; }
    if (message.type === 'GTN_STEP') { step(message.delta === -1 ? -1 : 1); respond({ok: true}); }
  }
  chrome.runtime.onMessage.addListener(messageListener);
  function destroy() {
    destroyed = true; activity++; previewGuard?.destroy(); navigator.destroy(); loadedIndex.reset(); observer.disconnect(); themeObserver.disconnect(); resizeObserver.disconnect();
    clearInterval(routeTimer); clearTimeout(scanTimer); clearTimeout(toastTimer); cancelPress(); hidePreview();
    cancelAnimationFrame(frame); cancelAnimationFrame(ringFrame); listeners.forEach(remove => remove());
    try { chrome.storage.onChanged.removeListener(storageChanged); chrome.runtime.onMessage.removeListener(messageListener); } catch { /* Context invalidated. */ }
    host.remove(); items = []; railItems = []; filtered = []; rowMap.clear(); data = {};
  }
  globalThis.__GTNextInstance = {destroy};
  // Idle route lifecycle and DOM rescans only. Navigation runs exclusively after a user jump.
  routeTimer = setInterval(() => {
    if (document.hidden || destroyed) return;
    try { if (!chrome.runtime.id) { destroy(); return; } } catch { destroy(); return; }
    checkRoute();
    if (Date.now() - lastSafetyScan > 7000) scheduleScan(100);
  }, 700);
  (async () => {
    try { data = await chrome.storage.local.get(null); settings = C.settingsFromStorage(data); }
    catch { storageError = true; toast('无法读取扩展设置。扩展更新后，请刷新页面。'); }
    if (destroyed) return;
    updateTheme(); updateVisibility(); if (settings.enabled) scanNow(); else render();
  })();
})();
