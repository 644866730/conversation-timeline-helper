#!/usr/bin/env python3
"""LOCAL Chromium preview regression tests, with mocked Chrome APIs.
Use --baseline PATH to reproduce against the earlier source tree.
"""
from __future__ import annotations
import argparse,json,shutil,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import navigation_browser_test as nb
ROOT=Path(__file__).resolve().parents[1]
FIXTURE=r'''(() => {
 NF.all();NF.auto=false;
 const stale=document.createElement('button');stale.id='stale-focus';stale.textContent='old attachment';document.querySelector('[data-message-id="m-4"]').append(stale);
 const opener=document.createElement('button');opener.id='open-image';opener.textContent='image128.png · 图片预览';document.querySelector('[data-message-id="m-80"]').append(opener);
 const f=globalThis.PF={closed:0,opens:0,reset:false,delay:0,lock:false,overlap:true,replace:false,shift:false,modal:null};
 Object.defineProperty(f,'root',{get:()=>document.querySelector('#chat-scroll')});
 f.open=function(native=false){
  f.opens++;const modal=document.createElement(native?'dialog':'div');modal.id='native-preview';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  Object.assign(modal.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',maxWidth:'none',maxHeight:'none',margin:'0',border:'0',zIndex:'1000',background:'#263337ee'});
  const text=document.createElement('p');text.textContent='本地图片预览模拟 · 关闭后保持阅读位置';Object.assign(text.style,{color:'#fff',position:'absolute',top:'40%',left:'30%'});
  const close=document.createElement('button');close.id='close-image';close.textContent='×';close.setAttribute('aria-label','关闭图片预览');
  Object.assign(close.style,{position:'fixed',top:'92px',right:f.overlap?'8px':'250px',width:'40px',height:'40px',zIndex:'1'});
  close.addEventListener('click',()=>f.close());modal.addEventListener('click',e=>{if(e.target===modal)f.close()});modal.append(text,close);document.body.append(modal);f.modal=modal;
  if(native){modal.addEventListener('cancel',e=>{e.preventDefault();f.close()});modal.showModal()}
  if(f.lock){document.body.setAttribute('data-scroll-locked','1');f.root.style.overflowY='hidden';document.querySelector('main').setAttribute('aria-hidden','true')}
 };
 f.close=function(){
  f.closed++;if(f.modal?.open)f.modal.close();f.modal?.remove();f.modal=null;document.body.removeAttribute('data-scroll-locked');f.root.style.overflowY='';document.querySelector('main').removeAttribute('aria-hidden');
  if(f.replace){const old=f.root,copy=old.cloneNode(true);old.replaceWith(copy)}
  if(f.shift){document.querySelector('[data-message-id="m-10"]').style.height='390px'}
  if(f.reset)setTimeout(()=>document.querySelector('#stale-focus').focus(),f.delay);
 };
 opener.addEventListener('click',()=>f.open());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&f.modal)f.close()});
 f.root.scrollTop=document.querySelector('[data-message-id="m-80"]').getBoundingClientRect().top-f.root.getBoundingClientRect().top+f.root.scrollTop-170;
})();'''
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--baseline',type=Path);ap.add_argument('--match',default='');args=ap.parse_args();baseline=args.baseline is not None
 if baseline:
  oldread=nb.read;nb.read=lambda f:(args.baseline/f).read_text(encoding='utf-8') if (args.baseline/f).exists() else ('' if f=='src/preview-guard.js' else oldread(f))
 results=[];out=ROOT/'tests/results';out.mkdir(exist_ok=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1400,'height':900},reduced_motion='reduce');expect.set_options(timeout=4000)
  def prepare():
   h=nb.Harness(context,bridge=True);h.page.add_script_tag(content=FIXTURE);h.page.wait_for_timeout(350);h.scan();return h
  def top(h):return h.page.evaluate('PF.root.scrollTop')
  def offset(h):return h.page.evaluate("document.querySelector('[data-message-id=\"m-80\"]').getBoundingClientRect().top-PF.root.getBoundingClientRect().top")
  def show(h,**opts):h.page.evaluate('(o)=>Object.assign(PF,o)',opts);h.page.locator('#open-image').click();h.page.wait_for_timeout(120)
  def done(h):h.page.wait_for_timeout(1300)
  def click_close(h):h.page.locator('#close-image').click(force=True);done(h)
  def same(h,before):assert abs(top(h)-before)<=2,{'before':before,'after':top(h),'status':h.status()}
  def idle(h):assert h.status()['navigation']['stage']=='idle',h.status()
  def run(name,fn):
   if args.match and args.match not in name:return
   h=None;t=time.perf_counter();print('START',name,flush=True)
   try:h=prepare();fn(h);h.close();r={'name':name,'status':'passed'};print('PASS',name,flush=True)
   except Exception as e:
    r={'name':name,'status':'failed','error':str(e)};traceback.print_exc();print('FAIL',name,str(e),flush=True)
    if h and not h.page.is_closed():h.page.screenshot(path=str(out/f'preview-failure-{len(results)+1}.png'));h.page.close()
   r['seconds']=round(time.perf_counter()-t,2);results.append(r)
  def collision(h):
   before=top(h);show(h);h.page.mouse.click(1372,112);done(h);assert h.page.evaluate('PF.closed')==1,'Close button was intercepted by the timeline';same(h,before);idle(h)
  run('Close button overlapping upper timeline dots reaches preview, not early message',collision)
  def focus_restore(h):
   before=top(h);show(h,reset=True,overlap=False);click_close(h);same(h,before);idle(h)
  run('Immediate native autofocus to stale old attachment is corrected to actual viewport',focus_restore)
  if not baseline:
   def delayed(h):
    before=top(h);show(h,reset=True,delay=480,overlap=False);h.page.keyboard.press('Escape');done(h);same(h,before);idle(h)
   run('Escape close with delayed autofocus preserves reading position',delayed)
   def backdrop(h):
    before=top(h);show(h,reset=True,overlap=False);h.page.mouse.click(900,420);done(h);same(h,before)
   run('Backdrop close preserves reading position',backdrop)
   def no_drift(h):
    before=top(h);calls=h.page.evaluate('NF.scrollCalls');show(h);click_close(h);same(h,before);assert h.page.evaluate('NF.scrollCalls')==calls,'Unnecessary extension scroll when position was already correct'
   run('Already correct close performs zero extension scroll writes',no_drift)
   def index_lock(h):
    before=top(h);count=h.status()['loaded'];show(h,lock=True,reset=True,overlap=False)
    assert h.ui.get_attribute('data-preview-blocked') is not None;assert h.ui.evaluate('n=>n.inert') is True
    h.page.evaluate('NF.root.scrollTop=0');h.scan();assert h.status()['loaded']==count;assert h.status()['preview']['stage']=='open'
    h.page.wait_for_timeout(250);click_close(h);same(h,before);assert h.status()['loaded']==count
   run('Inert aria-hidden and scroll-lock do not erase index or overwrite checkpoint',index_lock)
   def modal_idle(h):
    show(h);calls=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(1500);assert h.page.evaluate('NF.scrollCalls')==calls
    h.page.keyboard.press('Alt+Shift+ArrowUp');h.page.wait_for_timeout(250);assert h.page.evaluate('NF.scrollCalls')==calls;idle(h);click_close(h)
   run('Preview open pauses timeline hotkeys and makes no background navigation',modal_idle)
   def content_copies(h):
    n=h.status()['loaded'];show(h);h.page.evaluate("PF.modal.append(document.querySelector('[data-message-id=\"m-80\"]').cloneNode(true))");h.scan();assert h.status()['loaded']==n;click_close(h);assert h.status()['loaded']==n
   run('Preview DOM copies are never indexed as new conversation messages',content_copies)
   def shift(h):
    before=offset(h);show(h,shift=True,reset=True,overlap=False);click_close(h);assert abs(offset(h)-before)<=2,(before,offset(h))
   run('Layout height change restores message offset, not stale absolute scrollTop',shift)
   def replaced(h):
    before=offset(h);show(h,replace=True,reset=True,overlap=False);click_close(h);assert abs(offset(h)-before)<=2,(before,offset(h))
   run('Replaced scroller resolves stable message identity on close',replaced)
   def route_change(h):
    show(h,reset=True,overlap=False);h.ev("__testLocation.href='https://chatgpt.com/c/other-conversation';window.dispatchEvent(new PopStateEvent('popstate'))");h.page.wait_for_timeout(200);click_close(h);assert top(h)<2000,'Old route checkpoint restored into new conversation'
   run('Conversation change discards preview checkpoint',route_change)
   def user_wheel(h):
    show(h,reset=True,overlap=False);h.page.locator('#close-image').click(force=True);h.page.wait_for_timeout(180);h.page.mouse.move(720,500);h.page.mouse.wheel(0,320);h.page.wait_for_timeout(250);now=top(h);h.page.wait_for_timeout(1100);same(h,now);assert h.status()['preview']['outcome']=='user'
   run('New manual scrolling after close cancels remaining correction window',user_wheel)
   def pointer(h):
    show(h,overlap=False);h.page.locator('#close-image').click(force=True);h.page.wait_for_timeout(90);h.page.mouse.click(650,430);h.page.evaluate('PF.root.scrollTop=777');done(h);same(h,777)
   run('New pointer action after close is not dragged back',pointer)
   def nested(h):
    before=top(h);show(h,reset=True,overlap=False);h.page.evaluate("{const m=PF.modal.cloneNode(true);m.id='second-dialog';document.body.append(m)}");h.page.evaluate('PF.close()');h.page.wait_for_timeout(300);assert h.status()['preview']['stage']=='open';h.page.evaluate("document.querySelector('#second-dialog').remove()");done(h);same(h,before)
   run('Nested previews resume only when final overlay is closed',nested)
   def native_dialog(h):
    before=top(h);h.page.evaluate('PF.open(true)');h.page.wait_for_timeout(250);assert h.status()['preview']['stage']=='open';h.page.keyboard.press('Escape');done(h);same(h,before)
   run('Native dialog showModal and Escape keep viewport',native_dialog)
   def normal(h):
    before=top(h);h.page.mouse.click(700,330);h.page.wait_for_timeout(1100);same(h,before);assert h.status()['preview']['stage']=='idle';idle(h)
   run('Ordinary conversation clicks do not activate restoration',normal)
   def working_nav(h):show(h);click_close(h);h.click(24);h.verified(24)
   run('Explicit old timeline navigation still works after preview closes',working_nav)
   def pending_seek(h):
    h.page.evaluate('NF.showPage(9);NF.auto=true');h.page.wait_for_timeout(400);h.scan();h.click(0);h.page.wait_for_timeout(130);h.page.evaluate('PF.open()');h.page.wait_for_timeout(200);assert h.status()['navigation']['stage']=='cancelled';calls=h.page.evaluate('NF.scrollCalls');h.page.wait_for_timeout(450);assert h.page.evaluate('NF.scrollCalls')==calls
   run('Programmatic preview cancels in-flight page navigation',pending_seek)
   def reopen(h):
    before=top(h);show(h,reset=True,overlap=False);h.page.evaluate('PF.close()');h.page.wait_for_timeout(160);h.page.evaluate('PF.open()');h.page.wait_for_timeout(160);click_close(h);same(h,before)
   run('Rapid close and reopen retains original checkpoint',reopen)
   def cleanup(h):
    show(h,overlap=False);h.page.evaluate('PF.close()');h.page.wait_for_timeout(100);h.ev('__GTNextInstance.destroy()');h.page.evaluate('PF.root.scrollTop=123');done(h);same(h,123);assert h.ui.count()==0
   run('Teardown removes all pending restoration work',cleanup)
   def disabled(h):
    show(h,overlap=False);h.ev("chrome.storage.local.set({'gtn:setting:enabled':false})");h.page.evaluate('PF.close();PF.root.scrollTop=321');done(h);same(h,321);assert not h.status()['enabled']
   run('Disabling while preview open discards checkpoint',disabled)
   def privacy(h):
    before=h.ev('chrome.storage.local.get(null)');show(h,reset=True,overlap=False);click_close(h);assert before==h.ev('chrome.storage.local.get(null)');status=json.dumps(h.status()['preview']);assert 'm-80' not in status and 'top' not in status;assert h.page.evaluate('NF.nativeCalls.length')==0
   run('Guard persists no reading data and sends no native seek',privacy)
   def document_root(h):
    h.page.evaluate("document.body.style.overflow='auto';PF.root.style.position='static';PF.root.style.height='auto';PF.root.style.overflow='visible';document.querySelector('main').style.marginLeft='230px';window.scrollTo(0,document.querySelector('[data-message-id=\"m-80\"]').getBoundingClientRect().top+scrollY-200)")
    h.page.wait_for_timeout(250);h.scan();before=h.page.evaluate('scrollY');show(h,reset=True,overlap=False);click_close(h);assert abs(h.page.evaluate('scrollY')-before)<=2,(before,h.page.evaluate('scrollY'))
   run('Document scrolling restores exact viewport after focus reset',document_root)
   def hidden_main(h):
    h.page.evaluate("{const m=document.createElement('main');m.setAttribute('aria-hidden','true');m.style.position='fixed';m.style.left='-3000px';m.append(document.querySelector('[data-message-id=\"m-4\"]').cloneNode(true));document.body.append(m)}")
    h.page.wait_for_timeout(200);h.scan();assert h.status()['preview']['stage']=='idle';h.click(24);h.verified(24)
   run('Hidden unrelated main does not suspend active conversation',hidden_main)
   def quick_hotkey(h):
    show(h,overlap=False);h.page.evaluate('PF.close()');h.page.wait_for_timeout(140);h.page.keyboard.press('Alt+Shift+ArrowUp');h.wait('success');assert h.status()['preview']['stage']=='idle'
   run('Fresh timeline shortcut during close cleanup overrides restoration',quick_hotkey)
   def virtual_window(h):
    h.page.evaluate("NF.virtual()");h.page.wait_for_timeout(220);h.page.evaluate("const b=document.createElement('button');b.id='open-image';b.textContent='preview';b.onclick=()=>PF.open();document.querySelector('[data-message-id=\"m-118\"]').append(b)")
    h.page.wait_for_timeout(250);h.scan();before=top(h);show(h,overlap=False)
    h.page.evaluate('PF.root.scrollTop=0');h.page.wait_for_timeout(160);assert h.page.locator('[data-message-id="m-118"]').count()==0
    click_close(h);same(h,before);assert h.page.locator('[data-message-id="m-118"]').count()==1
   run('Virtualized original viewport returns without invoking timeline navigation',virtual_window)
   def reverse_root(h):
    h.page.evaluate("NF.reverse=true;NF.virtual()");h.page.wait_for_timeout(220);h.page.evaluate("const b=document.createElement('button');b.id='open-image';b.textContent='preview';b.onclick=()=>PF.open();document.querySelector('[data-message-id=\"m-118\"]').append(b)")
    h.page.wait_for_timeout(250);h.scan();before=top(h);show(h,overlap=False);h.page.evaluate('PF.root.scrollTop=-5000');h.page.wait_for_timeout(160);click_close(h);same(h,before)
   run('Column reverse negative scroll frame is restored after preview',reverse_root)
  report={'mode':'LOCAL Chromium fixtures; real isolated worlds; mocked Chrome APIs; not a live account','version':'1.4.1 baseline' if baseline else '1.4.2','browser':browser.version,'passed':sum(t['status']=='passed' for t in results),'failed':sum(t['status']=='failed' for t in results),'tests':results}
  (out/('preview-baseline-results.json' if baseline else 'preview-results.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('RESULT',report['passed'],'passed',report['failed'],'failed',flush=True);browser.close();return int(report['failed']>0)
if __name__=='__main__':raise SystemExit(main())
