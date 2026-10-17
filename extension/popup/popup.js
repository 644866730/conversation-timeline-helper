(function () {
  'use strict';
  const C = globalThis.GTNextCore, $ = id => document.getElementById(id);
  let data = {}, settings = {...C.DEFAULTS}, lastStatus = null, noticeTimer = 0, savingTimer = 0, statusBusy = false;
  function notify(text, sticky = false) {
    $('notice').textContent = text; $('notice').hidden = false;
    clearTimeout(noticeTimer); if (!sticky) noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4500);
  }
  function populate() {
    settings = C.settingsFromStorage(data);
    for (const key of Object.keys(C.DEFAULTS)) {
      const field = $(key); if (!field) continue;
      // Do not overwrite an in-progress edit to a custom selector.
      if (key.startsWith('custom') && document.activeElement === field) continue;
      if (field.type === 'checkbox') field.checked = settings[key]; else field.value = String(settings[key]);
    }

    applyTheme();
    $('bookmark-count').textContent = Object.keys(data).filter(C.isStarKey).length + ' 条';
  }
  function applyTheme() {
    const theme = settings.theme === 'auto' ? lastStatus?.theme : settings.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
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
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error('没有可用的标签页。');
    // tabs permission is not needed: we only use the active tab ID, never its URL or title.
    return await chrome.tabs.sendMessage(tab.id, {type});
  }
  async function updateStatus(type = 'GTN_STATUS') {
    if (statusBusy && type === 'GTN_STATUS') return;
    statusBusy = true;
    try {
      const status = await send(type); if (!status?.ok) throw new Error('not ready'); lastStatus = status;
      const h = status.history || {};
      $('status-dot').classList.add('connected');
      $('status-title').textContent = status.enabled ? '已加载消息已同步' : '时间轴已关闭';
      $('total-count').textContent = (h.indexed ?? status.loaded ?? 0).toLocaleString('zh-CN');
      $('role-count').textContent = `${status.users || 0} 条提问 · ${status.assistants || 0} 条回复`;
      $('mounted-count').textContent = `网页当前挂载 ${h.mounted ?? status.loaded ?? 0} 条`;
      $('coverage').textContent = status.enabled ? '随页更新' : '已关闭';
      $('coverage').dataset.state = status.enabled ? 'ready' : '';
      $('status-detail').textContent = status.enabled
        ? '不后台补全；点击已加载节点时自动换页定位。'
        : '打开右上角开关，恢复对话导航。';
      $('diagnostics').textContent = JSON.stringify({...status.diagnostics, history: h, navigation: status.navigation}, null, 2);
      for (const id of ['open-directory', 'rescan', 'rescan-main', 'reset-index']) $(id).disabled = !status.enabled;
      applyTheme();
    } catch {
      lastStatus = null; $('status-dot').classList.remove('connected');
      $('status-title').textContent = '等待连接 ChatGPT'; $('total-count').textContent = '—';
      $('role-count').textContent = '设置仍可保存'; $('mounted-count').textContent = '自动应用到对话页面';
      $('coverage').textContent = '未连接'; $('coverage').dataset.state = '';
      $('status-detail').textContent = '切换到 ChatGPT。首次安装或更新后，请刷新已打开的对话页面。';
      $('diagnostics').textContent = '尚未连接到 ChatGPT 内容脚本。设置仍可保存。';
      for (const id of ['open-directory', 'rescan', 'rescan-main', 'reset-index']) $(id).disabled = true;
    } finally { statusBusy = false; }
  }
  async function save(key, value) {
    const safe = C.normalizeSettings({...settings, [key]: value})[key];
    try {
      $('saved-state').textContent = '正在保存…';
      await chrome.storage.local.set({[C.SETTING_PREFIX + key]: safe});
      $('saved-state').textContent = '已保存'; clearTimeout(savingTimer);
      savingTimer = setTimeout(() => { $('saved-state').textContent = '更改自动保存'; }, 1800);
      setTimeout(() => void updateStatus(), 180);
    }
    catch { notify('保存失败，请重开设置面板，或检查扩展存储空间。', true); }
  }
  for (const key of ['enabled', 'showPreview', 'smoothScroll', 'keyboard']) $(key).addEventListener('change', event => void save(key, event.target.checked));
  for (const key of ['theme', 'side']) $(key).addEventListener('change', event => void save(key, event.target.value));
  $('includeAssistant').addEventListener('change', event => void save('includeAssistant', event.target.value === 'true'));


  $('open-directory').addEventListener('click', async () => {
    try { await send('GTN_OPEN'); window.close(); } catch { notify('请刷新 ChatGPT 页面后重试。'); }
  });
  $('rescan-main').addEventListener('click', () => void updateStatus('GTN_RESCAN'));
  $('reset-index').addEventListener('click', () => {
    if (confirm('清空本页内存索引，只重新记录网页当前挂载的消息？不会删除聊天或收藏。')) void updateStatus('GTN_RESET_INDEX');
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
      catch { notify((key === 'customUserSelector' ? '用户' : '助手') + '消息选择器语法无效，未保存。', true); $(key).focus(); return; }
      pairs[C.SETTING_PREFIX + key] = selector;
    }
    try { await chrome.storage.local.set(pairs); notify('选择器已保存。'); setTimeout(() => void updateStatus('GTN_RESCAN'), 200); }
    catch { notify('选择器保存失败。', true); }
  });
  function downloadJSON(name, object) {
    const blob = new Blob([JSON.stringify(object, null, 2)], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  const dateStamp = () => new Date().toISOString().slice(0, 10);
  $('export-diagnostics').addEventListener('click', () => {
    const safeSettings = {...settings}; delete safeSettings.customUserSelector; delete safeSettings.customAssistantSelector;
    downloadJSON('conversation-timeline-diagnostics-' + dateStamp() + '.json', {
      format: 'gpt-timeline-next-diagnostics', version: C.VERSION, createdAt: new Date().toISOString(),
      settings: safeSettings, hasCustomUserSelector: !!settings.customUserSelector, hasCustomAssistantSelector: !!settings.customAssistantSelector,
      page: lastStatus, privacy: '不含对话正文、搜索词、会话URL或消息ID。'
    }); notify('诊断已导出，不含聊天正文或会话编号。');
  });
  $('export-bookmarks').addEventListener('click', async () => {
    try {
      const latest = await chrome.storage.local.get(null);
      const entries = Object.entries(latest).filter(([key, value]) => C.isStarKey(key) && value && Number.isFinite(value.savedAt));
      downloadJSON('conversation-timeline-bookmarks-' + dateStamp() + '.json', {format: 'gpt-timeline-next-bookmarks', version: 1, createdAt: new Date().toISOString(), entries});
      notify(`已导出 ${entries.length} 条收藏标记，不含消息正文。`);
    } catch { notify('收藏导出失败。', true); }
  });
  $('import-bookmarks').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能大于 5 MB。');
      const entries = C.validateBackup(JSON.parse(await file.text())), count = Object.keys(entries).length;
      if (!confirm(`将合并 ${count} 条收藏标记，不删除已有收藏。是否继续？`)) return;
      await chrome.storage.local.set(entries); notify(`已导入 ${count} 条收藏标记。`);
    } catch (error) { notify('导入失败：' + (error instanceof SyntaxError ? 'JSON 文件格式无效。' : error.message), true); }
    finally { event.target.value = ''; }
  });
  $('clear-bookmarks').addEventListener('click', async () => {
    if (!confirm('确定清空此扩展在当前浏览器中的所有收藏吗？建议先导出备份。此操作不删除聊天，也不影响设置。')) return;
    try {
      const latest = await chrome.storage.local.get(null), keys = Object.keys(latest).filter(C.isStarKey);
      if (keys.length) await chrome.storage.local.remove(keys);
      notify('所有持久收藏标记已清空；临时会话的内存收藏在关闭页面后消失。');
    } catch { notify('清空收藏失败。', true); }
  });
  $('reset-settings').addEventListener('click', async () => {
    if (!confirm('恢复默认设置？不会删除收藏。')) return;
    try { await chrome.storage.local.set(C.settingsToStorage(C.DEFAULTS)); notify('已恢复默认设置，收藏未受影响。'); setTimeout(() => void updateStatus(), 200); }
    catch { notify('恢复设置失败。', true); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) delete data[key]; else data[key] = change.newValue;
    }
    populate();
  });
  (async () => {
    $('version').textContent = 'v' + C.VERSION;
    try { data = await chrome.storage.local.get(null); populate(); }
    catch { notify('无法读取扩展存储。', true); }
    await updateStatus();
  })();
  const polling = setInterval(() => { if (!document.hidden) void updateStatus(); }, 1000);
  window.addEventListener('pagehide', () => { clearInterval(polling); clearTimeout(noticeTimer); clearTimeout(savingTimer); });
})();
