/* Synthetic Gemini structure. No account data, requests or persistent storage. */
(() => {
  const root=document.querySelector('[data-test-id="chat-history-container"]');
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const topics=[
    ['怎样给 Gemini 长对话增加时间轴？','按消息浏览','提问与回复各有独立节点，点击后定位原消息。页面结构识别只处理已加载的内容。','搜索与收藏','在目录中输入关键词，或将重要消息标记为收藏。设置和收藏保持本地处理。'],
    ['长答案有很多小节，怎样直接找到其中一节？','回复章节目录','展开「查看章节」，可以选择回复中实际存在的标题，直接定位到该段。','保持阅读位置','查阅旧内容或某个章节之后，使用「返回阅读处」回到之前的位置。'],
    ['消息很多时，圆点挤在一起怎么办？','精确选择附近消息','点击密集区域会先打开附近消息列表，每组十条，不会立即跳走。','完整搜索范围','在搜索框输入关键词会退出附近模式，恢复搜索全部已加载且符合显示范围的消息。'],
    ['可以只导出搜索结果吗？','导出当前列表','目录下方「导出」会生成 Markdown，范围遵循当前搜索、收藏和附近消息筛选。','保留常见格式','正文中的代码块、标题与表格会尽量保留；未挂载的内容使用带说明的纯文本缓存。']
  ];
  function render(count=6){
    root.replaceChildren();
    for(let i=0;i<count;i++){
      const topic=topics[i%topics.length],turn=node('div');turn.className='conversation-container';turn.id='demo-gemini-'+i;
      const user=node('user-query'),userContent=node('user-query-content'),query=node('div',topic[0]);query.className='query-text';userContent.append(query);user.append(userContent);
      const reply=node('model-response'),content=node('model-response-content'),message=node('message-content'),markdown=node('div');
      message.id='message-content-id-demo-'+i;markdown.className='markdown markdown-main-panel';
      markdown.append(node('h2',topic[1]),node('p',topic[2]),node('h3',topic[3]),node('p',topic[4]));
      if(i===3){const pre=node('pre'),code=node('code','npm test\npython tools/sync_styles.py');code.className='language-shell';pre.append(code);markdown.append(pre);}
      message.append(markdown);content.append(message);reply.append(content);
      const toolbar=node('div');toolbar.className='toolbar';toolbar.setAttribute('role','toolbar');toolbar.append(node('button','复制'),node('button','更多'));reply.append(toolbar);
      turn.append(user,reply);root.append(turn);
    }
    root.scrollTop=0;
  }
  document.getElementById('demo-theme').addEventListener('click',()=>{
    const dark=!document.body.classList.contains('dark-theme');document.body.classList.toggle('dark-theme',dark);document.body.classList.toggle('light-theme',!dark);document.documentElement.dataset.theme=dark?'dark':'light';
  });
  document.getElementById('demo-many').addEventListener('click',()=>render(100));
  render();
})();
