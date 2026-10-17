#!/usr/bin/env python3
"""Real Chromium isolated/MAIN worlds, native scrolling & DOM virtualization.
Chrome storage/messaging and ChatGPT pages are LOCAL TEST FIXTURES, not a signed-in account.
Run: python tests/navigation_browser_test.py [--group all|navigation|cancel|native]
"""
from __future__ import annotations
import argparse,json,shutil,time,traceback,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/results'
def read(f):return (ROOT/f).read_text(encoding='utf-8')
HTML='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>v1.4 本地自动换页测试</title></head><body><header><b>对话时间轴助手 · v1.4.2</b><span>本地模拟页面 · 非真实账号截图</span></header><aside><p>不后台补全历史</p><p>点击节点 → 自动换页 → 原消息</p><button id="decoy">Load earlier messages</button></aside><div id="chat-scroll"><main><div id="load-zone"></div><div id="messages"></div></main></div></body></html>'''
CSS='''*{box-sizing:border-box}body{margin:0;font:15px/1.8 system-ui,"Noto Sans CJK SC",sans-serif;color:#20312d;background:#fff;overflow:hidden}header{height:70px;display:flex;align-items:center;justify-content:space-between;padding:0 38px;border-bottom:1px solid #e6ebe9}header span{font-size:11px;color:#7c8984}aside{position:fixed;left:24px;top:105px;width:190px;font-size:12px;color:#5c776b}#chat-scroll{position:absolute;top:70px;left:230px;right:100px;height:calc(100vh - 70px);overflow:auto;overflow-anchor:none}main{max-width:760px;margin:auto;padding:15px 14px 25px}article,section.message{padding:14px 25px;margin:0;min-height:150px}section.message.user{background:#f3f6f4;border-radius:14px;margin-left:50px}small{font-size:11px;color:#87968d}p{margin:12px 0}button{cursor:pointer;background:white;border:1px solid #d2dcd7;border-radius:7px;color:inherit;padding:6px 12px}#load-zone:empty{display:none}'''
FIXTURE=r'''(() => {
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
})();'''
class Harness:
 def __init__(self,context,modern=False,bridge=False,limit=None):
  self.page=context.new_page();self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
  self.page.set_content(HTML);self.page.add_style_tag(content=CSS);self.page.add_script_tag(content=FIXTURE)
  if modern:self.page.evaluate('NF.modern=true;NF.all()')
  self.cdp=context.new_cdp_session(self.page);frame=self.cdp.send('Page.getFrameTree')['frameTree']['frame']['id']
  self.world=self.cdp.send('Page.createIsolatedWorld',{'frameId':frame,'worldName':'gtn-real-isolated-test'})['executionContextId']
  for f in ['tests/browser-mock.js','src/core.js','src/loaded-index.js','src/adapter.js','src/navigation-core.js','src/navigation.js','src/preview-guard.js','src/styles.js']:
   source=read(f)
   if limit and f=='src/navigation-core.js':source=source.replace('timeout: 60000',f'timeout: {limit}').replace('stalled: 8000',f'stalled: {limit}')
   self.ev(source)
  self.ev("globalThis.__testLocation={href:'https://chatgpt.com/c/navigation'};chrome.storage.local.set({'gtn:setting:includeAssistant':true,'gtn:setting:smoothScroll':false})")
  self.ev('((location)=>{'+read('src/content.js')+'})(globalThis.__testLocation)')
  self.ui=self.page.locator('#gpt-timeline-next-root');expect(self.ui.locator('.marker')).to_have_count(120)
  if bridge:self.page.add_script_tag(content=read('src/page-navigation.js'))
  self.page.evaluate('NF.showPage(9);NF.auto=true');self.page.wait_for_timeout(450);self.scan()
 def ev(self,expression):
  r=self.cdp.send('Runtime.evaluate',{'expression':expression,'contextId':self.world,'returnByValue':True,'awaitPromise':True})
  if 'exceptionDetails'in r:raise AssertionError(r['exceptionDetails'])
  return r.get('result',{}).get('value')
 def status(self):return self.ev("GTNTest.send('GTN_STATUS')")
 def scan(self):return self.ev("GTNTest.send('GTN_RESCAN')")
 def click(self,i):
  self.ui.locator(f'[data-key="message:m-{i}:{"assistant" if i%2 else "user"}"]').first.focus();self.page.keyboard.press('Enter')
 def wait(self,stage='success',timeout=15000):
  end=time.monotonic()+timeout/1000
  while time.monotonic()<end:
   s=self.status()['navigation']
   if s['stage']==stage:return s
   if s['stage']=='failed' and stage!='failed':raise AssertionError(s)
   self.page.wait_for_timeout(90)
  raise AssertionError('Navigation did not reach '+stage+': '+str(self.status()['navigation']))
 def verified(self,i):
  s=self.wait();r=self.page.locator(f'[data-message-id="m-{i}"]').bounding_box();box=self.page.locator('#chat-scroll').bounding_box()
  assert r and r['y']<box['y']+box['height'] and r['y']+r['height']>box['y'],r
  expect(self.ui.locator(f'.marker[data-key="message:m-{i}:{"assistant" if i%2 else "user"}"]')).to_have_attribute('aria-current','true')
  assert self.ui.locator('.history-reader,.reader-text').count()==0
  return s
 def close(self):
  assert not self.errors,self.errors
  assert self.page.evaluate('NF.network')==0
  self.page.close()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--group',default='all');ap.add_argument('--chromium',default=shutil.which('chromium'));ap.add_argument('--match',default='');args=ap.parse_args()
 OUT.mkdir(parents=True,exist_ok=True);results=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1400,'height':900},reduced_motion='reduce');expect.set_options(timeout=4000)
  def run(group,name,fn,**kwargs):
   if args.group not in ['all',group] or (args.match and not re.search(args.match,name)):return
   h=None;t=time.perf_counter();print('START',name,flush=True)
   try:h=Harness(context,**kwargs);fn(h);h.close();result={'name':name,'status':'passed'};print('PASS',round(time.perf_counter()-t,2),name,flush=True)
   except Exception as e:
    result={'name':name,'status':'failed','error':str(e)};traceback.print_exc();print('FAIL',name,str(e),flush=True)
    if h and not h.page.is_closed():h.page.screenshot(path=str(OUT/f'failure-navigation-{len(results)}.png'));h.page.close()
   result['seconds']=round(time.perf_counter()-t,2);results.append(result);(OUT/f'navigation-{args.group}-partial.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  def idle(h):
   a=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(1200);assert h.page.evaluate('NF.scrollCalls')==a;assert h.page.evaluate('NF.nativeCalls.length')==0;assert h.status()['navigation']['stage']=='idle'
  run('navigation','Idle observation never navigates, paginates or calls the helper',idle,bridge=True)
  def direct(h):h.click(113);h.verified(113);assert h.page.evaluate('NF.transitions.length')==0
  run('navigation','Mounted node aligns its real native message directly',direct)
  def backward(h):
   h.click(24);s=h.verified(24);assert len(h.page.evaluate('NF.transitions'))>=7;assert s['steps']>0
   expect(h.ui.locator('.marker')).to_have_count(120)
  run('navigation','Clicking previously loaded old node automatically traverses seven native pages',backward)
  def forward(h):
   h.page.evaluate('NF.showPage(1)');h.page.wait_for_timeout(450);h.scan();h.click(98);h.verified(98);assert len(h.page.evaluate('NF.transitions'))>=7
  run('navigation','Clicking a later known node automatically traverses pages forward',forward)
  def modern_pages(h):h.click(27);h.verified(27);assert len(h.page.evaluate('NF.transitions'))>=7
  run('navigation','Chat/Work compound user/assistant turn remounts and selects exact assistant',modern_pages,modern=True)
  def delayed(h):h.page.evaluate('NF.delay=2300');h.click(105);h.verified(105);assert h.page.evaluate('NF.transitions.length')==1
  run('navigation','Slow 2.3-second native page loading waits instead of falsely declaring completion',delayed)
  def virtual(h):h.page.evaluate('NF.virtual()');h.page.wait_for_timeout(400);h.scan();h.click(18);h.verified(18)
  run('navigation','Unmounted variable-height virtual list seeks via checkpoint then verifies identity',virtual)
  def reverse(h):h.page.evaluate('NF.reverse=true;NF.virtual()');h.page.wait_for_timeout(400);h.scan();h.click(18);h.verified(18);assert h.page.evaluate('NF.root.scrollTop')<0
  run('navigation','Negative column-reverse native scroll coordinates are supported',reverse)
  def button(h):h.page.evaluate('NF.buttonOnly=true;NF.showPage(9)');h.page.wait_for_timeout(400);h.scan();h.click(105);h.verified(105);assert h.page.evaluate('NF.decoys')==0
  run('navigation','Only exact native Load-earlier-messages control is clicked, never sidebar decoy',button)
  def no_target(h):
   h.page.evaluate("NF.mode='frozen';NF.missing=24");h.click(24);h.wait('failed',6000);assert h.ui.locator('.history-reader').count()==0;expect(h.ui.locator('[data-action=retry-jump]')).to_be_visible();assert h.page.evaluate('NF.decoys')==0
   before=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(400);assert h.page.evaluate('NF.scrollCalls')==before
  run('navigation','Unavailable target terminates with retry notice, no false success or cached modal',no_target,limit=2200)
  def native(h):
   h.page.evaluate('NF.attachNative()');assert h.ev("Object.getOwnPropertyNames(document.querySelector('main')).some(k=>k.startsWith('__reactFiber'))") is False
   h.click(24);s=h.verified(24);assert s['method']=='native';assert h.page.evaluate('NF.nativeCalls')==[24];assert h.page.evaluate('NF.transitions.length')==0
  run('native','Real MAIN/ISOLATED boundary: exact-key helper restores target without sequential pages',native,bridge=True)
  def shifted(h):h.page.evaluate('NF.extra=7;NF.attachNative()');h.click(24);h.verified(24);assert h.page.evaluate('NF.nativeCalls')==[31]
  run('native','Current stable keys override stale ordinal/index after a prepend',shifted,bridge=True)
  def native_pair(h):h.page.evaluate('NF.attachNative()');h.click(27);h.verified(27);assert h.page.evaluate('NF.nativeCalls')==[13]
  run('native','Native compound turn seek lands on assistant within the correct shared turn',native_pair,modern=True,bridge=True)
  def wrong(h):h.page.evaluate('NF.wrongNative=true;NF.attachNative()');h.click(93);h.verified(93);assert h.page.evaluate('NF.nativeCalls.length')==1;assert h.page.evaluate('NF.transitions.length')>=2
  run('native','Misleading helper acknowledgement cannot fake success; directional fallback recovers exact ID',wrong,bridge=True)
  def no_privilege(h):
   h.page.evaluate('NF.attachNative()');h.click(24);h.verified(24);s=json.dumps(h.status(),ensure_ascii=False);assert 'm-24'not in s and '测试消息'not in s and 'https://'not in s
   store=h.ev('chrome.storage.local.get(null)');assert not any(k.startswith('m-')or'text'in k for k in store)
  run('native','DOM-verified success diagnostics/storage contain no message text or identifiers',no_privilege,bridge=True)
  def cancel_check(h,action):
   h.click(0);h.page.wait_for_timeout(500);action(h);h.wait('cancelled');a=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(500);assert h.page.evaluate('NF.scrollCalls')==a
  run('cancel','Manual wheel cancels further extension page movement',lambda h:cancel_check(h,lambda x:(x.page.mouse.move(650,350),x.page.mouse.wheel(0,160))))
  run('cancel','Escape cancels the active seek',lambda h:cancel_check(h,lambda x:x.page.keyboard.press('Escape')))
  run('cancel','Cancel button stops the active seek',lambda h:cancel_check(h,lambda x:x.ui.locator('[data-action=cancel-jump]').click()))
  def superseded(h):h.click(0);h.page.wait_for_timeout(300);h.click(114);h.verified(114);h.page.wait_for_timeout(450);assert h.status()['navigation']['stage']=='success'
  run('cancel','Rapid second click replaces first seek; old corrections cannot steal position',superseded)
  def route(h):
   h.click(0);h.page.wait_for_timeout(350);h.ev("__testLocation.href='https://chatgpt.com/c/different';window.dispatchEvent(new PopStateEvent('popstate'))")
   h.page.wait_for_timeout(250);a=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(700);assert h.page.evaluate('NF.scrollCalls')==a;assert h.status()['navigation']['stage']=='idle'
  run('cancel','Route transition cancels seek and clears old navigation checkpoints',route)
  def disabled(h):
   h.click(0);h.page.wait_for_timeout(350);h.ev("chrome.storage.local.set({'gtn:setting:enabled':false})");h.page.wait_for_timeout(250);a=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(500);assert h.page.evaluate('NF.scrollCalls')==a;assert not h.status()['enabled']
  run('cancel','Disabling the extension cancels pending positioning work',disabled)
  def cleanup(h):
   h.click(0);h.page.wait_for_timeout(350);h.ev('__GTNextInstance.destroy()');expect(h.ui).to_have_count(0);a=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(650);assert h.page.evaluate('NF.scrollCalls')==a
  run('cancel','Destroy during seek removes UI and aborts future moves',cleanup)
  def density(h):
   h.click(24);h.verified(24);dots=h.ui.locator('.marker');expect(dots).to_have_count(120)
   ps=dots.evaluate_all('a=>a.map(n=>parseFloat(n.style.top))');assert ps[0]==16 and ps[-1]==784 and ps[1]-ps[0]<ps[-1]-ps[-2]
   for css in ['.timeline-track','.timeline-track-content']:
    assert h.ui.locator(css).evaluate('e=>{e.scrollTop=100;return e.scrollTop}')==0
   assert h.ui.locator('[role=slider],.timeline-left-slider').count()==0
  run('navigation','Native pagination leaves fixed oldest/newest endpoints and zero rail scroll range',density)
  output={'mode':'Chromium real isolated/MAIN worlds, LOCAL DOM fixtures, MOCK Chrome APIs; not a live account','group':args.group,'browser':browser.version,'executedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'passed':sum(x['status']=='passed'for x in results),'failed':sum(x['status']=='failed'for x in results),'tests':results}
  (OUT/f'navigation-{args.group}-results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('RESULT',output['passed'],'passed,',output['failed'],'failed',flush=True);browser.close();return int(output['failed']>0)
if __name__=='__main__':raise SystemExit(main())
