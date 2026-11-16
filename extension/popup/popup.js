(function () {
  'use strict';
  const C = globalThis.GTNextCore, I = globalThis.GTNextI18n, $ = id => document.getElementById(id);
  let data = {}, settings = {...C.DEFAULTS}, lastStatus = null, noticeTimer = 0, savingTimer = 0, statusBusy = false;
  let connected = null, saveState = '更改自动保存', currentNotice = null;
  const dirtySelectors = new Set();
  const backupErrors = ['不是有效的 对话时间轴助手 收藏备份。', '备份条目超过 20,000 条限制。', '备份中存在无效的收藏记录，未导入。'];
  const t = (key, values = {}) => I.t(key, values, settings.language || 'auto');
  function renderNotice() {
    if (!currentNotice) return;
    const values = {...currentNotice.values};
    if (currentNotice.key === '导入失败：{error}') values.error = t(values.error);
    $('notice').textContent = t(currentNotice.key, values);
  }
  function notify(key, sticky = false, values = {}) {
    currentNotice = {key, values}; renderNotice(); $('notice').hidden = false;
    clearTimeout(noticeTimer); if (!sticky) noticeTimer = setTimeout(() => { $('notice').hidden = true; currentNotice = null; }, 4500);
  }
  function translate() {
    document.documentElement.lang = I.resolve(settings.language || 'auto');
    for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const [dataName, attribute] of [['i18nTitle','title'],['i18nAria','aria-label'],['i18nPlaceholder','placeholder']]) {
      for (const node of document.querySelectorAll('[data-' + dataName.replace(/[A-Z]/g, char => '-' + char.toLowerCase()) + ']')) node.setAttribute(attribute, t(node.dataset[dataName]));
    }
    $('language').options[0].textContent = t('跟随浏览器');
    $('saved-state').textContent = t(saveState);
    $('bookmark-count').textContent = t('{count} 条', {count:Object.keys(data).filter(C.isStarKey).length});
    renderStatus(); renderNotice();
  }
  for (const language of I.LANGUAGES) {
    const option = document.createElement('option'); option.value = language.value; option.textContent = language.label; $('language').append(option);
  }
  function populate() {
    settings = C.settingsFromStorage(data);
    for (const key of Object.keys(C.DEFAULTS)) {
      const field = $(key); if (!field) continue;
      if (key.startsWith('custom') && (document.activeElement === field || dirtySelectors.has(key))) continue;
      if (field.type === 'checkbox') field.checked = settings[key]; else field.value = String(settings[key]);
    }
    applyTheme(); translate();
  }
  function applyTheme() {
    const theme = settings.theme === 'auto' ? lastStatus?.theme : settings.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }
  function renderStatus() {
    if (connected === null) {
      $('status-title').textContent = t('正在连接页面'); $('coverage').textContent = t('连接中');
      $('role-count').textContent = t('等待当前对话'); $('mounted-count').textContent = t('本页已加载索引');
      $('status-detail').textContent = t('只记录你实际加载过的消息，不自动补全历史。');
      $('diagnostics').textContent = t('暂无页面诊断'); return;
    }
    if (connected && lastStatus) {
      const status = lastStatus, h = status.history || {};
      const platformName = ['ChatGPT', 'Gemini'].includes(status.platformName) ? status.platformName : C.platformName(status.platform);
      $('status-dot').classList.add('connected');
      $('status-title').textContent = status.enabled
        ? t(platformName === '当前页面' ? '当前对话已就绪' : '{platform} 对话已就绪', {platform:platformName})
        : t(platformName === '当前页面' ? '时间轴已关闭' : '{platform} 时间轴已关闭', {platform:platformName});
      $('total-count').textContent = (h.indexed ?? status.loaded ?? 0).toLocaleString(I.resolve(settings.language || 'auto'));
      $('role-count').textContent = t('{users} 条提问 · {assistants} 条回复', {users:status.users || 0, assistants:status.assistants || 0});
      $('mounted-count').textContent = t('仅当前对话 · 本地处理');
      $('coverage').textContent = t(status.enabled ? '随页更新' : '已关闭'); $('coverage').dataset.state = status.enabled ? 'ready' : '';
      $('status-detail').textContent = t(status.enabled ? '搜索已加载内容，点击旧节点按需定位。' : '打开右上角开关，恢复对话导航。');
      // Diagnostic field names are stable machine-readable keys, not translated values.
      $('diagnostics').textContent = JSON.stringify({...status.diagnostics, history:h, navigation:status.navigation}, null, 2);
      for (const id of ['open-directory', 'rescan', 'rescan-main', 'reset-index']) $(id).disabled = !status.enabled;
    } else {
      $('status-dot').classList.remove('connected'); $('status-title').textContent = t('等待连接对话页面'); $('total-count').textContent = '—';
      $('role-count').textContent = t('设置仍可保存'); $('mounted-count').textContent = t('自动应用到对话页面');
      $('coverage').textContent = t('未连接'); $('coverage').dataset.state = '';
      $('status-detail').textContent = t('请打开 ChatGPT 或 Gemini，更新后刷新对话。');
      $('diagnostics').textContent = t('尚未连接到 ChatGPT 或 Gemini 内容脚本。设置仍可保存。');
      for (const id of ['open-directory', 'rescan', 'rescan-main', 'reset-index']) $(id).disabled = true;
    }
  }
  function selectTab(name, focus = false) {
    for (const id of ['general', 'advanced']) {
      const tab = $('tab-' + id), selected = id === name;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; $(id).hidden = !selected;
    }
    document.querySelector('main').scrollTop = 0;
    if (focus) $('tab-' + name).focus();
  }
  for (const name of ['general', 'advanced']) {
    $('tab-' + name).addEventListener('click', () => selectTab(name));
    $('tab-' + name).addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); selectTab(event.key === 'Home' ? 'general' : event.key === 'End' ? 'advanced' : name === 'general' ? 'advanced' : 'general', true);
      }
    });
  }
  async function send(type) {
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    if (!tab?.id) throw new Error(t('没有可用的标签页。'));
    return await chrome.tabs.sendMessage(tab.id, {type});
  }
  async function updateStatus(type = 'GTN_STATUS') {
    if (statusBusy && type === 'GTN_STATUS') return;
    statusBusy = true;
    try { const status = await send(type); if (!status?.ok) throw new Error('not ready'); lastStatus = status; connected = true; }
    catch { lastStatus = null; connected = false; }
    finally { statusBusy = false; renderStatus(); applyTheme(); }
  }
  async function save(key, value) {
    const safe = C.normalizeSettings({...settings, [key]:value})[key];
    try {
      saveState = '正在保存…'; $('saved-state').textContent = t(saveState);
      await chrome.storage.local.set({[C.SETTING_PREFIX + key]:safe});
      data[C.SETTING_PREFIX + key] = safe; populate();
      saveState = '已保存'; $('saved-state').textContent = t(saveState); clearTimeout(savingTimer);
      savingTimer = setTimeout(() => { saveState = '更改自动保存'; $('saved-state').textContent = t(saveState); }, 1800);
      setTimeout(() => void updateStatus(), 180);
    } catch { saveState = '更改自动保存'; populate(); notify('保存失败，请重开设置面板，或检查扩展存储空间。', true); }
  }
  for (const key of ['enabled', 'showPreview', 'smoothScroll', 'keyboard']) $(key).addEventListener('change', event => void save(key, event.target.checked));
  for (const key of ['theme', 'side', 'language']) $(key).addEventListener('change', event => void save(key, event.target.value));
  for (const key of ['customUserSelector', 'customAssistantSelector']) $(key).addEventListener('input', () => dirtySelectors.add(key));
  $('includeAssistant').addEventListener('change', event => void save('includeAssistant', event.target.value === 'true'));
  $('open-directory').addEventListener('click', async () => {
    try { await send('GTN_OPEN'); window.close(); } catch { notify('请刷新当前 ChatGPT 或 Gemini 页面后重试。'); }
  });
  $('rescan-main').addEventListener('click', () => void updateStatus('GTN_RESCAN'));
  $('reset-index').addEventListener('click', () => {
    if (confirm(t('清空本页内存索引，只重新记录网页当前挂载的消息？不会删除聊天或收藏。'))) void updateStatus('GTN_RESET_INDEX');
  });
  $('open-settings-page').addEventListener('click', () => {
    try { chrome.runtime.openOptionsPage(); } catch { notify('请在浏览器扩展管理页面打开“扩展选项”。'); }
  });
  if (document.documentElement.dataset.view === 'page') $('open-settings-page').hidden = true;
  $('rescan').addEventListener('click', () => void updateStatus('GTN_RESCAN'));
  $('save-selectors').addEventListener('click', async () => {
    const pairs = {};
    for (const key of ['customUserSelector', 'customAssistantSelector']) {
      const selector = $(key).value.trim();
      try { if (selector) document.createDocumentFragment().querySelector(selector); }
      catch { notify(key === 'customUserSelector' ? '用户消息选择器语法无效，未保存。' : '助手消息选择器语法无效，未保存。', true); $(key).focus(); return; }
      pairs[C.SETTING_PREFIX + key] = selector;
    }
    try { await chrome.storage.local.set(pairs); Object.assign(data, pairs); dirtySelectors.clear(); populate(); notify('选择器已保存。'); setTimeout(() => void updateStatus('GTN_RESCAN'), 200); }
    catch { notify('选择器保存失败。', true); }
  });
  function downloadJSON(name, object) {
    const blob = new Blob([JSON.stringify(object, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  const dateStamp = () => new Date().toISOString().slice(0, 10);
  $('export-diagnostics').addEventListener('click', () => {
    const safeSettings = {...settings}; delete safeSettings.customUserSelector; delete safeSettings.customAssistantSelector;
    downloadJSON('conversation-timeline-diagnostics-' + dateStamp() + '.json', {
      format:'gpt-timeline-next-diagnostics', version:C.VERSION, createdAt:new Date().toISOString(),
      settings:safeSettings, hasCustomUserSelector:!!settings.customUserSelector, hasCustomAssistantSelector:!!settings.customAssistantSelector,
      page:lastStatus, privacy:t('不含对话正文、搜索词、会话URL或消息ID。')
    }); notify('诊断已导出，不含聊天正文或会话编号。');
  });
  $('export-bookmarks').addEventListener('click', async () => {
    try {
      const latest = await chrome.storage.local.get(null);
      const entries = Object.entries(latest).filter(([key, value]) => C.isStarKey(key) && value && Number.isFinite(value.savedAt));
      downloadJSON('conversation-timeline-bookmarks-' + dateStamp() + '.json', {format:'gpt-timeline-next-bookmarks', version:1, createdAt:new Date().toISOString(), entries});
      notify('已导出 {count} 条收藏标记，不含消息正文。', false, {count:entries.length});
    } catch { notify('收藏导出失败。', true); }
  });
  $('import-bookmarks').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能大于 5 MB。');
      const entries = C.validateBackup(JSON.parse(await file.text()), settings.language), count = Object.keys(entries).length;
      if (!confirm(t('将合并 {count} 条收藏标记，不删除已有收藏。是否继续？', {count}))) return;
      await chrome.storage.local.set(entries); notify('已导入 {count} 条收藏标记。', false, {count});
    } catch (error) {
      const key = error instanceof SyntaxError ? 'JSON 文件格式无效。' : backupErrors.find(key => t(key) === error.message) || error.message;
      notify('导入失败：{error}', true, {error:key});
    }
    finally { event.target.value = ''; }
  });
  $('clear-bookmarks').addEventListener('click', async () => {
    if (!confirm(t('确定清空此扩展在当前浏览器中的所有收藏吗？建议先导出备份。此操作不删除聊天，也不影响设置。'))) return;
    try {
      const latest = await chrome.storage.local.get(null), keys = Object.keys(latest).filter(C.isStarKey);
      if (keys.length) await chrome.storage.local.remove(keys);
      notify('所有持久收藏标记已清空；临时会话的内存收藏在关闭页面后消失。');
    } catch { notify('清空收藏失败。', true); }
  });
  $('reset-settings').addEventListener('click', async () => {
    if (!confirm(t('恢复默认设置？不会删除收藏。'))) return;
    try {
      const defaults = C.settingsToStorage(C.DEFAULTS); await chrome.storage.local.set(defaults);
      Object.assign(data, defaults); dirtySelectors.clear(); populate(); notify('已恢复默认设置，收藏未受影响。'); setTimeout(() => void updateStatus(), 200);
    }
    catch { notify('恢复设置失败。', true); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) { if (change.newValue === undefined) delete data[key]; else data[key] = change.newValue; }
    populate();
  });
  (async () => {
    $('version').textContent = 'v' + C.VERSION;
    try { data = await chrome.storage.local.get(null); populate(); }
    catch { translate(); notify('无法读取扩展存储。', true); }
    await updateStatus();
  })();
  const polling = setInterval(() => { if (!document.hidden) void updateStatus(); }, 1000);
  window.addEventListener('languagechange', () => { if (settings.language === 'auto') translate(); });
  window.addEventListener('pagehide', () => { clearInterval(polling); clearTimeout(noticeTimer); clearTimeout(savingTimer); });
})();
