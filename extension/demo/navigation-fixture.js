/* DEMO ONLY: artificial pages and simulated message content. Not in manifest. */
(() => {
 const root=document.querySelector('#chat-scroll'),main=document.querySelector('main'),list=document.querySelector('#messages');
 const f=globalThis.NF={total:120,page:9,size:12,auto:false,busy:false,delay:260,mode:'pages',modern:false,nativeCalls:[],scrollCalls:0,transitions:[],network:0,decoys:0,buttonOnly:false,wrongNative:false,extra:0,missing:-1,epoch:0};
 const native=Element.prototype.scrollTo;Element.prototype.scrollTo=function(...args){if(this===root)f.scrollCalls++;return native.apply(this,args);};
 globalThis.fetch=()=>{f.network++;throw Error('NO extension data requests allowed');};
 document.querySelector('#decoy').onclick=()=>f.decoys++;
 let lastPos=0;
 const height=i=>150+(i%4)*17;
 function message(i){
  const n=document.createElement('section');n.className='message '+(i%2?'assistant':'user');n.style.height=height(i)+'px';
  n.dataset.messageId='m-'+i;n.dataset.messageAuthorRole=i%2?'assistant':'user';
  if(f.modern){delete n.dataset.messageAuthorRole;n.dataset.contentSearchUnitKey='turn-'+Math.floor(i/2)+':'+i%2+':'+(i%2?'assistant':'user');n.dataset.chatgptSelectionMessageId='m-'+i;}
  const small=document.createElement('small');small.textContent=(i%2?'GPT 回复':'YOU 提问')+' · 消息 '+i;
  const p=document.createElement('p');p.textContent='测试消息 '+i+'。这条消息在原网页中重新挂载；不是缓存阅读弹窗。时间轴顶部最旧，底部最新，点击才自动换页。';
  n.append(small,p);return n;
 }
 function range(a,b){const frag=document.createDocumentFragment();for(let i=a;i<=b;i++){
  if(i===f.missing)continue;
  const n=message(i);
  if(f.modern){let turn=frag.lastElementChild;if(!turn||turn.dataset.turnKey!=='turn-'+Math.floor(i/2)){turn=document.createElement('div');turn.dataset.turnKey='turn-'+Math.floor(i/2);turn.dataset.index=String(Math.floor(i/2));frag.append(turn);}turn.append(n);}
  else{const turn=document.createElement('article');turn.style.padding='0';turn.dataset.testid='conversation-turn-'+i;turn.dataset.index=String(i);turn.append(n);frag.append(turn);}
 }return frag;}
 function loadButton(){const z=document.querySelector('#load-zone');z.replaceChildren();if(f.buttonOnly&&f.page>0){const b=document.createElement('button');b.textContent='Load earlier messages';b.onclick=()=>transition(-1);z.append(b);}}
 function showPage(p,sign=0){
  f.page=Math.max(0,Math.min(9,p));f.busy=true;
  list.replaceChildren(range(f.page*f.size,(f.page+1)*f.size-1));loadButton();
  root.scrollTop=sign>0?55:root.scrollHeight-root.clientHeight-(sign<0?55:1);lastPos=root.scrollTop;
  const e=++f.epoch;setTimeout(()=>{if(e===f.epoch){f.busy=false;lastPos=root.scrollTop;}},80);
 }
 function transition(sign){if(f.busy||f.page+sign<0||f.page+sign>9)return;f.busy=true;const e=f.epoch;setTimeout(()=>{if(e!==f.epoch)return;f.transitions.push([f.page,f.page+sign]);showPage(f.page+sign,sign);},f.delay);}
 root.addEventListener('scroll',()=>{const pos=root.scrollTop,delta=pos-lastPos;lastPos=pos;if(!f.auto||f.busy||f.mode!=='pages')return;
  if(delta<0&&pos<3&&!f.buttonOnly)transition(-1);
  else if(delta>0&&pos>=root.scrollHeight-root.clientHeight-3)transition(1);
 });
 function all(){f.auto=false;f.busy=false;f.epoch++;list.replaceChildren(range(0,f.total-1));root.scrollTop=0;lastPos=0;}
 function virtual(){
  f.mode='virtual';f.auto=true;
  const offsets=[0];for(let i=0;i<f.total;i++)offsets.push(offsets.at(-1)+height(i));
  main.style.padding='0';list.style.position='relative';list.style.height=offsets.at(-1)+'px';
  function paint(){const y=root.scrollTop+(f.reverse?offsets.at(-1)-root.clientHeight:0);let first=offsets.findIndex((n,i)=>i<f.total&&offsets[i+1]>y)-1;first=Math.max(0,first);const last=Math.min(f.total-1,first+7);list.replaceChildren();for(let i=first;i<=last;i++){const n=message(i);n.style.position='absolute';n.style.top=offsets[i]+'px';n.style.left='0';n.style.right='0';n.dataset.testid='conversation-turn-'+i;list.append(n);}}
  root.addEventListener('scroll',paint);if(f.reverse){root.style.display='flex';root.style.flexDirection='column-reverse';main.style.flex='0 0 auto';main.style.width='100%';root.scrollTop=0;}else root.scrollTop=offsets.at(-1)-root.clientHeight;
  paint();
 }
 function attachNative(){
  const o={scrollElement:root,options:{get count(){return (f.modern?f.total/2:f.total)+f.extra;},getItemKey:i=>i<f.extra?'unused-'+i:(f.modern?'turn-':'m-')+(i-f.extra)},getVirtualItems:()=>[],scrollToIndex(i){f.nativeCalls.push(i);const n=(i-f.extra)*(f.modern?2:1);showPage(f.wrongNative?9:Math.floor(n/f.size));}};
  // The production helper intentionally reads value descriptors only.
  Object.defineProperty(o.options,'count',{value:(f.modern?f.total/2:f.total)+f.extra,configurable:true});
  main.__reactFiber$fixture={memoizedState:{next:{memoizedState:{current:o}}}};
 }
 Object.assign(f,{root,main,all,showPage,virtual,attachNative});all();
})();