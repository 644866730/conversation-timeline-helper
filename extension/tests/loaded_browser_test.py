#!/usr/bin/env python3
"""v1.4 loaded-history regression tests. Local DOM, MOCK Chrome APIs, no account access.
Run: python tests/loaded_browser_test.py [--chromium /path/to/chromium]
"""
from __future__ import annotations
import argparse, base64, json, re, shutil, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/results'
def read(name): return (ROOT/name).read_text(encoding='utf-8')
def clean_html(name): return re.sub(r'<link\b[^>]*>', '', re.sub(r'<script\b[^>]*>.*?</script>', '', read(name), flags=re.S))
HTML='''<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"></head><body>
<header><span>CONVERSATION TIMELINE HELPER / 1.4.2</span><strong>只跟随你已加载的消息</strong><small>本地模拟页面 · 非真实账号截图</small></header>
<aside><b>固定高度 · 无滑条</b><p>顶部：已加载的最旧消息</p><p>底部：已加载的最新消息</p><p>旧节点逐渐变密，最近消息相对疏朗。</p><button id="older">手动加载更早 20 条</button><button id="newer">添加新消息</button></aside>
<div id="chat-scroll"><main><div id="messages"></div></main></div></body></html>'''
CSS='''*{box-sizing:border-box}body{margin:0;background:#fff;color:#202a2c;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC",sans-serif;overflow:hidden}header{height:70px;display:flex;align-items:center;padding:0 34px;gap:22px;border-bottom:1px solid #e7ebeb}header span{font-size:11px;letter-spacing:1px;color:#17796c}header strong{font-size:18px}header small{margin-left:auto;color:#8a9394}aside{position:fixed;left:28px;top:115px;width:205px;font-size:12px;color:#778184}aside b{font-size:15px;color:#17796c}aside p{margin:13px 0}button{border:1px solid #dbe4e2;border-radius:8px;background:#fff;color:inherit;padding:7px 11px;margin-top:8px;cursor:pointer}#chat-scroll{height:calc(100vh - 70px);overflow:auto;padding:25px 180px 65px 260px}main{max-width:750px;margin:auto}.msg{min-height:145px;padding:20px 5px;margin:0 0 12px}.msg small{color:#8a9394;font-size:11px;letter-spacing:.8px}.msg p{margin:10px 0}.user{background:#f1f5f4;border-radius:18px;padding:20px 24px;margin-left:65px}.assistant{padding:20px 24px}.assistant strong{color:#157463}.dark body,[data-theme=dark] body{background:#212727;color:#e7eeee}[data-theme=dark] header{border-color:#3a4545}[data-theme=dark] .user{background:#303a39}[data-theme=dark] button{background:#293434;border-color:#445451}[data-theme=dark] .assistant strong{color:#5acbae}'''
FIXTURE='''(()=>{
 let thread='loaded',min=80,max=99;
 const root=document.querySelector('#chat-scroll'),list=document.querySelector('#messages');
 function message(i){
  const n=document.createElement('article');n.className='msg '+(i%2?'assistant':'user');n.dataset.testid='conversation-turn-'+i;
  const body=document.createElement('section');body.dataset.messageAuthorRole=i%2?'assistant':'user';body.dataset.messageId=thread+'-'+i;
  const label=document.createElement('small');label.textContent=(i%2?'GPT · 回复':'YOU · 提问')+' / '+String(i).padStart(3,'0');
  const p=document.createElement('p');p.textContent=i%2?'消息 '+i+'：时间轴只观察页面已经加载的内容。新消息排在底部，向上翻页加载的早期消息排到上方；无需拉长轨道，也不会自动读取全部历史。':'消息 '+i+'：保持固定高度，只根据我加载的消息更新右侧时间轴。';
  body.append(label,p);n.append(body);return n;
 }
 function range(a,b){const f=document.createDocumentFragment();for(let i=a;i<=b;i++)f.append(message(i));return f;}
 function reset(a=80,b=99,t='loaded'){thread=t;min=a;max=b;list.replaceChildren(range(a,b));root.scrollTop=0;}
 function older(){const oldHeight=root.scrollHeight;list.prepend(range(min-20,min-1));min-=20;root.scrollTop+=root.scrollHeight-oldHeight;}
 function append(){list.append(message(++max));}
 function mount(a,b){list.replaceChildren(range(a,b));}
 document.querySelector('#older').onclick=older;document.querySelector('#newer').onclick=append;
 globalThis.PassiveFixture={reset,older,append,mount,range,root};reset();
})();'''
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--chromium',default=shutil.which('chromium'));args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);results=[];errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1400,'height':900},reduced_motion='reduce',locale='zh-CN')
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML);page.add_style_tag(content=CSS)
        page.add_script_tag(content=FIXTURE);page.add_script_tag(content=read('tests/browser-mock.js'))
        page.evaluate("chrome.storage.local.set({'gtn:setting:autoLoadHistory':true,'gtn:setting:scrollFallback':true})")
        page.evaluate('''()=>{globalThis.networkCalls=0;globalThis.scrollCalls=0;globalThis.fetch=()=>{networkCalls++;throw Error('Network must not be used');};const native=Element.prototype.scrollTo;Element.prototype.scrollTo=function(...args){scrollCalls++;return native.apply(this,args);};const win=window.scrollTo;window.scrollTo=(...args)=>{scrollCalls++;return win(...args);};globalThis.__testLocation={href:'https://chatgpt.com/c/passive'};}''')
        for f in ['src/i18n.js','src/core.js','src/loaded-index.js','src/adapter.js','src/navigation-core.js','src/navigation.js','src/preview-guard.js','src/styles.js']:page.add_script_tag(content=read(f))
        source='((location)=>{'+read('src/content.js')+'})(globalThis.__testLocation);';page.add_script_tag(content=source)
        host=page.locator('#gpt-timeline-next-root');nodes=host.locator('.marker');expect.set_options(timeout=3500)
        def send(kind='GTN_STATUS'):return page.evaluate('(t)=>GTNTest.send(t)',kind)
        def scan():return send('GTN_RESCAN')
        def positions():return nodes.evaluate_all('a=>a.map(n=>parseFloat(n.style.top))')
        def ids():return nodes.evaluate_all('a=>a.map(n=>n.dataset.key)')
        def endpoints(first,last):
            expect(nodes.first).to_have_attribute('data-key',re.compile('-'+str(first)+':'))
            expect(nodes.last).to_have_attribute('data-key',re.compile('-'+str(last)+':'))
            ps=positions();assert abs(ps[0]-16)<.01 and abs(ps[-1]-720)<.01
        def run(name,fn):
            t=time.perf_counter()
            try:fn();rec={'name':name,'status':'passed'};print('PASS',name,flush=True)
            except Exception as e:rec={'name':name,'status':'failed','error':str(e)};print('FAIL',name,e,flush=True);traceback.print_exc();page.screenshot(path=str(OUT/f'failure-loaded-{len(results)}.png'))
            rec['seconds']=round(time.perf_counter()-t,3);results.append(rec)
        def initial():expect(nodes).to_have_count(20);endpoints(80,99);assert send()['history']['mode']=='loaded-only'
        run('Only the 20 initially loaded messages are indexed',initial)
        def idle():
            before=page.evaluate('PassiveFixture.root.scrollTop');calls=page.evaluate('scrollCalls');page.wait_for_timeout(1800)
            assert page.evaluate('networkCalls')==0 and page.evaluate('scrollCalls')==calls
            assert page.evaluate('PassiveFixture.root.scrollTop')==before;expect(nodes).to_have_count(20)
        run('Legacy auto-load=true cannot trigger network requests or automatic scrolling',idle)
        def manual_prepend():page.locator('#older').click();expect(nodes).to_have_count(40);endpoints(60,99)
        run('Manual older-page loading prepends messages to the top in order',manual_prepend)
        def append():page.locator('#newer').click();expect(nodes).to_have_count(41);endpoints(60,100)
        run('New messages append at the bottom without changing rail height',append)
        def repeated():
            for _ in range(2):page.locator('#older').click();page.wait_for_timeout(380)
            expect(nodes).to_have_count(81);endpoints(20,100)
            assert ids()==['message:loaded-'+str(i)+(':'+('assistant'if i%2 else'user')) for i in range(20,101)]
        run('Repeated prepend and append maintain exact chronological order',repeated)
        def evict():
            page.evaluate('PassiveFixture.mount(95,100)');page.wait_for_timeout(450);expect(nodes).to_have_count(81);endpoints(20,100)
            assert send()['history']['mounted']==6
        run('Virtualized unmount keeps all 81 observed nodes; mounted count drops to six',evict)
        def unavailable():
            host.locator('.marker').first.focus();page.keyboard.press('Enter');expect(host.locator('.navigation-notice')).to_be_visible()
            assert host.locator('.history-reader').count()==0
            host.locator('[data-action=cancel-jump]').click();assert send()['navigation']['stage']=='cancelled'
            assert page.evaluate('networkCalls')==0
        run('Unmounted-node click starts cancellable page navigation, never opens cached正文',unavailable)
        def remount():page.evaluate('PassiveFixture.mount(20,40)');page.wait_for_timeout(450);expect(nodes).to_have_count(81);endpoints(20,100)
        run('Previously seen old messages remount without duplicate nodes',remount)
        def positions_stable():
            before=positions();page.evaluate('PassiveFixture.root.scrollTop=700');page.wait_for_timeout(450);assert positions()==before
            page.evaluate('PassiveFixture.mount(95,100)');page.wait_for_timeout(450);assert positions()==before
        run('Scrolling and virtualization do not move chronological rail coordinates',positions_stable)
        def search():
            send('GTN_OPEN');host.locator('.search-input').fill('20：保持');expect(host.locator('.message-row')).to_have_count(1)
            expect(nodes).to_have_count(81);endpoints(20,100);host.locator('[data-action=close]').click()
        run('Search uses cached messages but never replaces the fixed rail endpoints',search)
        def cache_empty():
            page.evaluate('PassiveFixture.mount(1,0)');page.wait_for_timeout(450);expect(nodes).to_have_count(81);assert send()['history']['mounted']==0
            endpoints(20,100)
        run('A temporarily empty mounted viewport cannot erase observed history',cache_empty)
        def reset_index():
            page.evaluate('PassiveFixture.mount(90,100)');send('GTN_RESET_INDEX');expect(nodes).to_have_count(11);endpoints(90,100)
        run('Explicit index rebuild scans only currently mounted messages',reset_index)
        def changed_route():
            page.evaluate("__testLocation.href='https://chatgpt.com/c/another';window.dispatchEvent(new PopStateEvent('popstate'))")
            scan();expect(nodes).to_have_count(0)
            page.evaluate("PassiveFixture.reset(0,9,'another')");scan();expect(nodes).to_have_count(10);endpoints(0,9)
        run('Route change clears old cached history and suppresses old DOM during transition',changed_route)
        def full_density():
            page.evaluate("PassiveFixture.reset(0,199,'another')");scan();expect(nodes).to_have_count(200);endpoints(0,199)
            ps=positions();assert ps[1]-ps[0]<(ps[-1]-ps[-2])/5
            assert host.locator('[role=slider],.timeline-left-slider,.timeline-left-handle').count()==0
        run('200 dots occupy the same fixed rail with a denser older-message region',full_density)
        def no_scrolling():
            for name in ['.timeline-track','.timeline-track-content']:
                a=host.locator(name).evaluate("e=>{e.scrollTop=500;return {scroll:e.scrollTop,client:e.clientHeight,height:e.scrollHeight,overflow:getComputedStyle(e).overflowY}}")
                assert a['scroll']==0 and a['height']==a['client'] and a['overflow']=='clip',a
        run('Rail has no scroll range even when scrollTop is assigned programmatically',no_scrolling)
        def dense_pick():
            # Deliberately use a real pointer, not the DOM button whose hit box overlays it.
            n=50;ps=positions();box=host.locator('.widget').bounding_box();y=box['y']+ps[n]
            page.mouse.move(box['x']+12,y);page.wait_for_timeout(180)
            tip=host.locator('.tooltip');expect(tip).to_be_visible()
            picked=page.evaluate('([ps,y])=>GTNextCore.nearestIndex(ps,y)',[ps,y-box['y']])
            expect(tip).to_contain_text('消息 '+str(picked))
        run('Pointer hover resolves the nearest dense node rather than an overlapping hit box',dense_pick)
        def keyboard_dense():
            nodes.nth(40).focus();page.keyboard.press('ArrowDown')
            assert page.evaluate("document.querySelector('#gpt-timeline-next-root').shadowRoot.activeElement.dataset.group")=='41'
            page.keyboard.press('Home');assert page.evaluate("document.querySelector('#gpt-timeline-next-root').shadowRoot.activeElement.dataset.group")=='0'
            page.keyboard.press('End');assert page.evaluate("document.querySelector('#gpt-timeline-next-root').shadowRoot.activeElement.dataset.group")=='199'
        run('Every dense node remains individually accessible with arrows/Home/End',keyboard_dense)
        def unmounted_stream():
            page.evaluate("document.querySelectorAll('[data-message-author-role]')[199].querySelector('p').append(' 流式追加文本')")
            page.wait_for_timeout(450);expect(nodes).to_have_count(200)
            page.evaluate('PassiveFixture.mount(0,10)');page.wait_for_timeout(450);send('GTN_OPEN')
            host.locator('.search-input').fill('流式追加文本');expect(host.locator('.message-row')).to_have_count(1)
            host.locator('[data-action=close]').click()
        run('Latest streamed body remains searchable after unmount without a cached-message modal',unmounted_stream)
        def resizing():
            page.set_viewport_size({'width':1200,'height':650});scan();ps=positions();assert ps[0]==16 and ps[-1]==470
            assert host.locator('.widget').bounding_box()['height']==486
            page.set_viewport_size({'width':1400,'height':900});scan();endpoints(0,199)
        run('Window resize keeps first/last nodes pinned to the new fixed-height rail',resizing)
        def no_leaks():
            s=json.dumps(send(),ensure_ascii=False);assert '消息 199'not in s and 'https://'not in s and 'message:another'not in s
            assert not any('text'in str(v) for v in page.evaluate('chrome.storage.local.get(null)').values())
        run('Diagnostics/storage do not persist conversation bodies or raw IDs',no_leaks)
        def streaming_search():
            page.evaluate('PassiveFixture.mount(180,199)');scan();send('GTN_OPEN')
            host.locator('.search-input').fill('UniqueTailTerm999');expect(host.locator('.message-row')).to_have_count(0)
            page.evaluate("document.querySelectorAll('[data-message-author-role]')[19].querySelector('p').append(' UniqueTailTerm999')")
            page.wait_for_timeout(450);expect(host.locator('.message-row')).to_have_count(1);expect(nodes).to_have_count(200)
            host.locator('[data-action=close]').click()
        run('Streaming match beyond preview length updates search without shifting rail endpoints',streaming_search)
        # Settings use the same local mocked status as the running controller.
        pop=context.new_page();pop.on('pageerror',lambda e:errors.append(str(e)))
        icon=base64.b64encode((ROOT/'icons/icon48.png').read_bytes()).decode()
        pop.set_viewport_size({'width':400,'height':592});pop.set_content(clean_html('popup/popup.html').replace('../icons/icon48.png','data:image/png;base64,'+icon));pop.add_style_tag(content=read('src/theme.css'));pop.add_style_tag(content=read('popup/popup.css'))
        for f in ['tests/browser-mock.js','src/i18n.js','popup/i18n.js','src/core.js']:pop.add_script_tag(content=read(f))
        pop.evaluate('(s)=>GTNTest.popupStatus=s',send());pop.add_script_tag(content=read('popup/popup.js'))
        def clean_settings():
            expect(pop.locator('#coverage')).to_have_text('随页更新')
            assert pop.locator('#autoLoadHistory,#scrollFallback,#load-history,#scroll-history,#cancel-history').count()==0
            assert pop.evaluate('document.body.scrollWidth')==400
            assert pop.locator('#showPreview').bounding_box()['y']+19<=pop.locator('main').bounding_box()['y']+pop.locator('main').bounding_box()['height']
        run('Settings remove every automatic-history control and retain 400px layout',clean_settings)
        def scrollless_settings():
            pop.locator('#tab-advanced').click();expect(pop.locator('#reset-index')).to_be_hidden();pop.locator('#diagnostic-details summary').click();expect(pop.locator('#reset-index')).to_be_visible()
            assert pop.locator('#scroll-history').count()==0
            pop.locator('#tab-general').click()
        run('Advanced settings provide manual local rebuild, never a scroll-to-load action',scrollless_settings)
        # New release screenshots; all display a local test/demo label.
        pop.screenshot(path=str(ROOT/'docs/settings-light.png'))
        pop.locator('#theme').select_option('dark');pop.screenshot(path=str(ROOT/'docs/settings-dark.png'))
        pop.close();page.bring_to_front();page.evaluate('PassiveFixture.mount(180,199)');scan()
        page.evaluate('PassiveFixture.root.scrollTop=PassiveFixture.root.scrollHeight');page.wait_for_timeout(500)
        page.mouse.move(450,90);page.wait_for_timeout(3300);page.screenshot(path=str(ROOT/'docs/preview-density-light.png'))
        page.evaluate("document.documentElement.dataset.theme='dark'");page.wait_for_timeout(400);page.screenshot(path=str(ROOT/'docs/preview-density-dark.png'))
        def errors_check():assert not errors,errors;assert page.evaluate('networkCalls')==0
        run('No uncaught errors or network requests during the complete passive regression',errors_check)
        result={'mode':'Local Chromium DOM simulation; mocked chrome APIs; no live ChatGPT account', 'browser':browser.version,'executedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'passed':sum(r['status']=='passed'for r in results),'failed':sum(r['status']=='failed'for r in results),'pageErrors':errors,'tests':results}
        (OUT/'loaded-browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print('RESULT',result['passed'],'passed,',result['failed'],'failed',flush=True);browser.close();return int(result['failed']>0)
if __name__=='__main__':raise SystemExit(main())
