(function () {
  'use strict';
  const prompts = [
    '我想给 ChatGPT 加一个对话时间轴，怎样让长对话更容易阅读？',
    '先帮我拆解一下需求：哪些功能应该优先做？',
    '新版页面结构变化很大，应该怎样识别消息？',
    '加入消息收藏和搜索功能，但不要把聊天上传到服务器。',
    '对话很多时，能否保持整条时间轴无滑条，并让较旧的节点更密？',
    '请继续完善键盘导航和深色模式。',
    '最后整理一个测试清单，覆盖会话切换和流式回复。',
    '很好，把整个工程打包成可直接加载的浏览器扩展。'
  ];
  const answers = [
    ['让每个问题都有一个落点', '从「不断滚动」变成「按问题导航」。在页面右侧放置一条安静的时间轴，每个节点对应一次提问，悬停查看摘要，点击直接回到原文。', '界面不需要抢走注意力。默认只显示一条细轨道，需要搜索和浏览目录时再展开侧栏，保持原来的阅读节奏。'],
    ['先把阅读路径做好', '第一层是定位：提问节点、当前阅读位置和上一条／下一条。第二层是整理：搜索、收藏和消息范围筛选。最后再补充主题、位置和诊断配置。', '这些功能都可以在浏览器中完成，不必依赖外部服务，也不用修改原始对话。'],
    ['用多层识别代替单一选择器', '较新的布局可以使用 data-turn-key 与 data-content-search-unit-key。其他页面可能仍然保留 data-turn 或 data-message-author-role。', '识别器应对这些标记统一去重，只将确实存在于页面中的消息加入目录。遇到未知结构时显示诊断，而不是猜测用户和助手的交替顺序。'],
    ['收藏位置，不保存整段对话', '搜索所需的正文只保留在标签页内存。持久收藏只保存会话和消息的标识指纹以及收藏时间，刷新后再从当前页面恢复对应位置。', '注意指纹不是加密。临时会话没有稳定编号时，收藏只在本页有效；关闭页面之后就会清除。'],
    ['固定高度，旧节点逐渐变密', '顶部始终代表本页已加载的最旧消息，底部代表最新消息。消息越多，较旧节点越紧密，轨道不会变长，也没有滑条。每条消息保留独立节点，目录可以精确选择。', '时间轴表达的是当前分支中已加载消息的顺序，而不是精确的发送时间。没有时间信息时，不应该编造一个时间标签。'],
    ['让键盘和鼠标一样顺手', '按 Alt+Shift+T 打开目录，使用 Alt+Shift+↑ 或 ↓ 跳转相邻消息。搜索框输入关键词后，按 Enter 跳到第一条结果。', '自动主题读取页面的主题标记。用户启用减少动态效果时，平滑滚动也应停用；设置面板仍允许手动选择主题。'],
    ['验证生命周期，而不只是验证截图', '检查切换会话后是否残留旧目录、流式回复是否重复生成节点、收藏能否在刷新后恢复，以及嵌套滚动区域能否正确定位。', '使用模拟 DOM 的自动化测试覆盖新旧结构，再在真实登录账号中做人工验收。模拟测试通过不等于所有灰度界面都已验证。'],
    ['交付可以直接读取的源代码', '保留 manifest.json、内容脚本、设置页面、图标和中文文档。无需下载依赖或进行构建，解压后就能通过浏览器扩展管理页加载。', '同时附上测试脚本、适配说明和已知限制，让后续维护也有清晰的路径。']
  ];
  let layout = 'modern', total = 0, thread = 'demo-thread';
  function node(tag, text) { const out = document.createElement(tag); if (text !== undefined) out.textContent = text; return out; }
  function message(role, index, text) {
    const wrap = node(layout === 'legacy' ? 'article' : layout === 'section' ? 'section' : 'div');
    wrap.className = 'sample-turn ' + role;
    const unit = node('div'); unit.className = 'unit';
    const content = node('div'); content.className = 'content ' + (role === 'assistant' ? 'markdown' : 'whitespace-pre-wrap');
    if (layout === 'modern') { wrap.dataset.turnKey = thread + '-' + index + '-' + role; unit.dataset.contentSearchUnitKey = `${thread}:${index}:${role}`; if (role === 'user') content.dataset.userMessageBubble = 'true'; }
    if (layout === 'legacy') { wrap.dataset.testid = 'conversation-turn-' + (index * 2 + (role === 'assistant' ? 1 : 0)); unit.dataset.messageAuthorRole = role; unit.dataset.messageId = `${thread}-${index}-${role}`; }
    if (layout === 'section') { wrap.dataset.turn = role; wrap.dataset.testid = 'conversation-turn-' + (index * 2 + (role === 'assistant' ? 1 : 0)); }
    if (layout === 'bubble' && role === 'user') content.dataset.userMessageBubble = 'true';
    if (role === 'user') content.textContent = text;
    else {
      const answer = answers[index % answers.length];
      content.append(node('div', 'GPT / RESPONSE'), node('h3', answer[0]), node('p', answer[1]), node('p', answer[2]));
      content.firstElementChild.className = 'label';
    }
    unit.append(content);
    if (role === 'assistant') { const toolbar = node('div'); toolbar.className = 'toolbar'; toolbar.setAttribute('role', 'toolbar'); toolbar.append(node('button', '复制'), node('button', '重新生成')); unit.append(toolbar); }
    wrap.append(unit); return wrap;
  }
  function appendPair(prompt) {
    const index = total++;
    document.getElementById('messages').append(message('user', index, prompt || prompts[index % prompts.length]), message('assistant', index));
  }
  function setLayout(nextLayout = 'modern', count = 8, nextThread = 'demo-thread') {
    layout = nextLayout; total = 0; thread = nextThread;
    document.getElementById('messages').replaceChildren();
    for (let i = 0; i < count; i++) appendPair();
    document.getElementById('demo-layout').value = layout;
  }
  document.getElementById('demo-layout').addEventListener('change', event => setLayout(event.target.value));
  document.getElementById('demo-theme').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; });
  document.getElementById('demo-add').addEventListener('click', () => appendPair());
  document.getElementById('demo-long-answer').addEventListener('click', () => {
    const content = document.querySelector('.assistant .content');
    if (!content || content.querySelector('[data-long-demo]')) return;
    const section = node('section'); section.dataset.longDemo = 'true';
    section.append(node('h2','安装与验证'),node('p','先在浏览器的扩展管理页面重新加载扩展，再刷新 ChatGPT。打开目录，可以展开这条回复中的章节。'));
    const pre = node('pre'), code = node('code','npm test\npython tools/sync_styles.py'); code.className = 'language-shell'; pre.append(code); section.append(pre);
    section.append(node('h2','常见问题排查'),node('p','遇到未加载的旧消息，点击目录项会按需恢复原网页内容。跳转完成后可以返回阅读处。'));
    section.append(node('h3','导出当前列表'),node('p','搜索关键词或只看收藏后，点击目录底部的导出，保存当前列表中的消息。代码块和标题会尽量保留。'));
    content.append(section);
  });
  globalThis.GTNFixture = {setLayout, appendPair, message};
  setLayout();
})();
