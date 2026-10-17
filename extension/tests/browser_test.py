#!/usr/bin/env python3
"""Local Chromium DOM simulation. Chrome APIs are MOCKED, not native.
No network, server or extension installation. Unmodified content.js runs in a
wrapper with an injected location object to simulate SPA route transitions.
This is NOT proof of native installation, browser-restart persistence or a live
ChatGPT account. See docs/TEST_REPORT.md.
Setup: pip install -r tests/requirements.txt
Run: python tests/browser_test.py [--chromium /path/to/chromium] [--headed]
"""
from __future__ import annotations
import argparse, base64, json, re, shutil, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/results'
HOST='#gpt-timeline-next-root'
def read(name):return (ROOT/name).read_text(encoding='utf-8')
def html(name):return re.sub(r'<link\b[^>]*>','',re.sub(r'<script\b[^>]*>.*?</script>','',read(name),flags=re.S))
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',default=shutil.which('chromium') or shutil.which('chromium-browser'))
    parser.add_argument('--headed',action='store_true');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);results=[];errors=[]
    with sync_playwright() as p:
        opts={'headless':not args.headed,'args':['--no-sandbox']}
        if args.chromium:opts['executable_path']=args.chromium
        browser=p.chromium.launch(**opts)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html('demo/index.html'));page.add_style_tag(content=read('demo/demo.css'))
        for f in ['demo/fixture.js','tests/browser-mock.js','src/core.js','src/loaded-index.js','src/adapter.js','src/navigation-core.js','src/navigation.js','src/preview-guard.js','src/styles.js']:page.add_script_tag(content=read(f))
        page.evaluate("globalThis.__testLocation={href:'https://chatgpt.com/c/start'}")
        source='((location)=>{\n'+read('src/content.js')+'\n})(globalThis.__testLocation);'
        page.add_script_tag(content=source);expect.set_options(timeout=3500)
        ui=page.locator(HOST);rows=ui.locator('.message-row');counter=0
        def run(name,fn):
            start=time.perf_counter()
            try:fn();record={'name':name,'status':'passed'};print('PASS',name,flush=True)
            except Exception as e:
                record={'name':name,'status':'failed','error':str(e)};print('FAIL',name,str(e),flush=True);traceback.print_exc()
                page.screenshot(path=str(OUT/f'failure-{len(results)+1}.png'))
            record['seconds']=round(time.perf_counter()-start,3);results.append(record)
        def send(kind):return page.evaluate('(type)=>GTNTest.send(type)',kind)
        def scan():return send('GTN_RESCAN')
        def status():return send('GTN_STATUS')
        def setting(k,v):page.evaluate('([k,v])=>chrome.storage.local.set({["gtn:setting:"+k]:v})',[k,v])
        def count(n):expect(rows).to_have_count(n)
        def reset(layout='modern',n=8,thread=None,url=None,clear=True):
            nonlocal counter
            counter+=1;thread=thread or f'fixture-{counter}'
            if clear:
                page.evaluate('chrome.storage.local.clear()')
                page.evaluate("chrome.storage.local.set({'gtn:setting:includeAssistant':false})")
            page.set_viewport_size({'width':1440,'height':1000})
            page.evaluate("""({layout,n,thread,url})=>{document.body.style.overflow='';const s=document.querySelector('#sample-scroll');s.style.overflow='';s.style.height='';document.documentElement.dataset.theme='light';GTNFixture.setLayout(layout,n,thread);__testLocation.href=url||'https://chatgpt.com/c/'+thread;window.dispatchEvent(new PopStateEvent('popstate'));s.scrollTop=0;window.scrollTo(0,0);}""",{'layout':layout,'n':n,'thread':thread,'url':url})
            send('GTN_OPEN');ui.locator('.search-input').fill('')
            if ui.locator('.star-filter').get_attribute('aria-pressed')=='true':ui.locator('.star-filter').click()
            scan()
        def modern():
            reset();count(8);s=status();assert s['users']==s['assistants']==8 and s['adapter']=='Chat/Work'
        run('Chat/Work detection and deduplication',modern)
        def all_messages():reset();setting('includeAssistant',True);count(16);assert rows.nth(1).get_attribute('data-role')=='assistant'
        run('Include-assistant preference applies immediately',all_messages)
        def legacy():reset('legacy',5);count(5);assert status()['adapter']=='legacy'
        run('Legacy role-attribute layout',legacy)
        def section():reset('section',4);count(4);assert status()['adapter']=='data-turn'
        run('Section data-turn layout',section)
        def media():
            reset('section',1);setting('includeAssistant',True)
            page.evaluate("()=>{const n=document.createElement('section');n.dataset.turn='assistant';n.append(document.createElement('canvas'));document.querySelector('#messages').append(n);}")
            scan();count(3);expect(rows.nth(2)).to_contain_text('图片')
        run('Non-text assistant turn',media)
        def bubble():reset('bubble',3);count(3);assert status()['assistants']==0
        run('Bubble fallback without guessing assistant roles',bubble)
        def nested():
            reset(n=3);page.evaluate("()=>document.querySelectorAll('.sample-turn').forEach(n=>{const r=n.classList.contains('user')?'user':'assistant';n.dataset.turn=r;n.querySelector('.content').dataset.messageAuthorRole=r;})")
            scan();count(3);assert status()['loaded']==6
        run('Overlapping new and old role markers are deduplicated',nested)
        def compound():
            reset(n=1);setting('includeAssistant',True)
            page.evaluate("()=>{const b=document.querySelector('#messages'),a=[...b.querySelectorAll('.unit')],w=document.createElement('div');w.dataset.turnKey='compound';w.append(...a);b.replaceChildren(w);}")
            scan();count(2);assert page.evaluate('()=>{const a=GTNextAdapter.collect().items;return a[0].target!==a[1].target;}')
        run('Compound wrapper gets distinct user and assistant targets',compound)
        def unknown():
            reset(n=0);page.evaluate("()=>{const n=document.createElement('div');n.dataset.turnKey='unknown';n.textContent='Unlabelled turn';document.querySelector('#messages').append(n);}")
            scan();count(0);expect(ui.locator('.empty')).to_contain_text('还没有识别')
        run('Unknown role fails closed',unknown)
        def hidden():
            reset(n=2);page.evaluate("""()=>{const b=document.querySelector('#messages');for(const mode of ['hidden','style','aria']){const n=b.firstElementChild.cloneNode(true);if(mode==='hidden')n.hidden=true;else if(mode==='style')n.style.display='none';else n.setAttribute('aria-hidden','true');b.append(n);}const n=document.createElement('div');n.dataset.messageAuthorRole='user';n.textContent='UNSENT DRAFT';document.querySelector('form').append(n);}""")
            scan();count(2);assert 'UNSENT' not in ui.locator('.message-list').inner_text()
        run('Hidden branches and composer drafts are excluded',hidden)
        def safe_text():
            reset(n=1);setting('includeAssistant',True)
            page.evaluate('(s)=>document.querySelector("[data-user-message-bubble]").textContent=s','<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>')
            scan();expect(rows.nth(0)).to_contain_text('<img');assert ui.locator('.message-list img,.message-list script').count()==0
            assert not page.evaluate('Boolean(window.pwned)');assert '重新生成' not in rows.nth(1).inner_text()
        run('Preview text is not interpreted as HTML; action toolbar excluded',safe_text)
        def custom():
            reset(n=0);page.evaluate("()=>{for(const r of ['user','assistant']){const n=document.createElement('div');n.className='custom-'+r;n.textContent=r+' custom message';document.querySelector('#messages').append(n);}}")
            setting('customUserSelector','.custom-user');setting('customAssistantSelector','.custom-assistant');setting('includeAssistant',True);scan();count(2)
        run('Custom CSS selectors recover unknown layouts',custom)
        def invalid():reset(n=2);setting('customUserSelector','[');scan();count(2);assert status()['diagnostics']['errors']
        run('Invalid selector reports an error without disabling built-ins',invalid)
        def streaming():
            reset(n=2);setting('includeAssistant',True);key=rows.nth(3).locator('.message-link').get_attribute('data-key')
            page.evaluate("()=>{let i=0;const t=setInterval(()=>{document.querySelectorAll('.assistant .markdown')[1].append(document.createTextNode('stream '+i));if(++i===12)clearInterval(t);},20);}")
            page.wait_for_timeout(600);count(4);assert rows.nth(3).locator('.message-link').get_attribute('data-key')==key
        run('Streaming updates retain a single native message identity',streaming)
        def observer():reset(n=2);page.evaluate('GTNFixture.appendPair("Observer added")');count(3);expect(rows.nth(2)).to_contain_text('Observer added')
        run('MutationObserver indexes newly appended turns',observer)
        def search_test():
            reset();ui.locator('.search-input').fill('新版 页面');count(1);expect(rows.nth(0)).to_contain_text('新版页面结构')
            ui.locator('.clear-search').click();count(8);ui.locator('.search-input').fill('no-match-419');count(0)
        run('Chinese multi-term search, clear and no-result state',search_test)
        def nested_scroll():
            reset();ui.locator('.message-link').nth(5).click();page.wait_for_timeout(80)
            assert page.evaluate('document.querySelector("#sample-scroll").scrollTop')>500 and page.evaluate('window.scrollY')==0
        run('Nested scroll container navigation',nested_scroll)
        def doc_scroll():
            reset();page.evaluate("()=>{document.body.style.overflow='auto';const s=document.querySelector('#sample-scroll');s.style.height='auto';s.style.overflow='visible';}")
            scan();ui.locator('.message-link').nth(5).click();page.wait_for_timeout(80);assert page.evaluate('window.scrollY')>500
        run('Document-level scroll fallback',doc_scroll)
        def active():
            reset();ui.locator('.message-link').nth(5).click();page.wait_for_timeout(80)
            assert ui.locator('.message-link[aria-current=true]').get_attribute('data-key')==ui.locator('.message-link').nth(5).get_attribute('data-key')
            page.locator('.demo-notice').click();page.keyboard.press('Alt+Shift+ArrowUp');page.wait_for_timeout(80)
            assert ui.locator('.message-link[aria-current=true]').get_attribute('data-key')==ui.locator('.message-link').nth(4).get_attribute('data-key')
        run('Active reading marker and previous-message navigation',active)
        def restore():
            reset(thread='restore');rows.nth(2).locator('.star-button').click();expect(rows.nth(2).locator('.star-button')).to_have_attribute('aria-pressed','true')
            saved=page.evaluate('chrome.storage.local.get(null)');assert len([k for k in saved if k.startswith('gtn:star:')])==1;assert 'restore' not in json.dumps(saved)
            page.add_script_tag(content=source);send('GTN_OPEN');scan();expect(rows.nth(2).locator('.star-button')).to_have_attribute('aria-pressed','true')
        run('Bookmark restore after controller restart (MOCK storage)',restore)
        def isolation():
            reset(thread='thread-A');rows.nth(1).locator('.star-button').click();reset(thread='thread-B',clear=False);expect(ui.locator('.star-button[aria-pressed=true]')).to_have_count(0)
            reset(thread='thread-A',clear=False);expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','true')
        run('Bookmarks isolated by conversation',isolation)
        def star_filter():
            reset();rows.nth(1).locator('.star-button').click();rows.nth(3).locator('.star-button').click();ui.locator('.star-filter').click();count(2)
            ui.locator('.star-button').nth(0).click();count(1)
        run('Star filter responds to adding and removing bookmarks',star_filter)
        def failure():
            reset();page.evaluate('GTNTest.failNextWrite=true');rows.nth(1).locator('.star-button').click();expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','false')
            expect(ui.locator('.toast')).to_contain_text('保存失败')
        run('Storage failure rolls back optimistic state',failure)
        def ephemeral():
            reset(url='https://chatgpt.com/?temporary-chat=true');rows.nth(1).locator('.star-button').click();expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','true')
            assert not any(k.startswith('gtn:star:') for k in page.evaluate('chrome.storage.local.get(null)'))
            page.add_script_tag(content=source);send('GTN_OPEN');scan();expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','false')
        run('No stable conversation ID means memory-only bookmarks',ephemeral)
        def race():
            reset(thread='old');page.evaluate("__testLocation.href='https://chatgpt.com/c/new';window.dispatchEvent(new PopStateEvent('popstate'))")
            scan();count(0);page.evaluate("GTNFixture.setLayout('modern',3,'new')");scan();count(3)
        run('URL-before-DOM SPA race suppresses stale old turns',race)
        def reused():
            reset(n=2,thread='old-reused');page.evaluate("""()=>{__testLocation.href='https://chatgpt.com/c/new-reused';window.dispatchEvent(new PopStateEvent('popstate'));for(const n of document.querySelectorAll('[data-content-search-unit-key]'))n.dataset.contentSearchUnitKey=n.dataset.contentSearchUnitKey.replace('old-reused','new-reused');for(const n of document.querySelectorAll('[data-turn-key]'))n.dataset.turnKey=n.dataset.turnKey.replace('old-reused','new-reused');}""")
            scan();count(2);assert 'new-reused' in ui.locator('.message-link').nth(0).get_attribute('data-key')
        run('React-style reused nodes detected after identity replacement',reused)
        def dense():
            reset(n=400);count(400);assert ui.locator('.marker').count()==400 and ui.locator('.is-group').count()==0
            assert ui.locator('.timeline-track-content').evaluate('(e)=>e.clientHeight')==ui.locator('.widget').evaluate('(e)=>e.clientHeight')
            assert ui.locator('.timeline-left-slider,[role=slider]').count()==0
        run('400 prompts keep 400 nodes in one fixed viewport with no slider',dense)
        def shortcuts():
            reset();ui.locator('[data-action=close]').click();page.keyboard.press('Alt+Shift+T');expect(ui.locator('.panel')).to_be_visible()
            page.keyboard.press('Alt+Shift+T');expect(ui.locator('.panel')).to_be_hidden()
        run('Toggle shortcut works even with directory search focused',shortcuts)
        def editor():
            reset();page.locator('[contenteditable=true]').focus();before=page.evaluate('document.querySelector("#sample-scroll").scrollTop')
            page.keyboard.press('Alt+Shift+ArrowUp');page.wait_for_timeout(80);assert page.evaluate('document.querySelector("#sample-scroll").scrollTop')==before
            setting('keyboard',False);state=status()['panelOpen'];page.keyboard.press('Alt+Shift+T');assert status()['panelOpen']==state
        run('Composer not hijacked and keyboard preference respected',editor)
        def theme():
            reset();page.evaluate("document.documentElement.dataset.theme='dark'");expect(ui).to_have_attribute('data-theme','dark')
            setting('theme','light');expect(ui).to_have_attribute('data-theme','light');setting('side','left');assert ui.locator('.widget').bounding_box()['x']<20
            assert 'sans-serif' in page.evaluate("getComputedStyle(document.querySelector('#gpt-timeline-next-root')).fontFamily")
        run('Automatic theme, override, left dock and isolated font',theme)
        def preview():
            reset();ui.locator('.marker').nth(1).hover();expect(ui.locator('.tooltip')).to_be_visible();setting('showPreview',False);expect(ui.locator('.tooltip')).to_be_hidden()
        run('Hover preview and its disable preference',preview)
        def right_click():
            reset();ui.locator('.marker').nth(1).click(button='right');expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','true')
        run('Right-clicking a single rail node toggles its bookmark',right_click)
        def long_press():
            reset();ui.locator('.marker').nth(1).hover();page.mouse.down();page.wait_for_timeout(600);page.mouse.up()
            expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','true')
            assert page.evaluate('document.querySelector("#sample-scroll").scrollTop')==0
            page.wait_for_timeout(850)
        run('Long-press bookmarks without also triggering a jump',long_press)
        def scroll_reuse():
            reset();page.evaluate("globalThis.savedRow=document.querySelector('#gpt-timeline-next-root').shadowRoot.querySelector('.message-row');document.querySelector('#sample-scroll').scrollTop=900")
            page.wait_for_timeout(100);assert page.evaluate("savedRow===document.querySelector('#gpt-timeline-next-root').shadowRoot.querySelector('.message-row')")
        run('Scroll changes do not rebuild directory DOM',scroll_reuse)
        def recover():
            reset();page.evaluate("document.querySelector('#messages').lastElementChild.previousElementSibling.remove()");count(8)
            page.evaluate("document.querySelector('#gpt-timeline-next-root').remove()");expect(ui.locator('.widget')).to_be_visible()
            page.add_script_tag(content=source);send('GTN_OPEN');expect(page.locator(HOST)).to_have_count(1)
        run('Loaded-node retention, detached host and reinjection recovery',recover)
        def enabled():
            reset();setting('enabled',False);expect(ui.locator('.widget')).to_be_hidden();setting('enabled',True);expect(ui.locator('.widget')).to_be_visible();count(8)
        run('Enable/disable preference recovers cleanly',enabled)
        def narrow():
            reset();page.set_viewport_size({'width':350,'height':640});scan();b=ui.locator('.panel').bounding_box()
            assert b['x']>=0 and b['y']>=0 and b['x']+b['width']<=351 and b['y']+b['height']<=641
        run('350px viewport stays within screen bounds',narrow)
        def original_bar():
            reset();ui.locator('[data-action=close]').click();b=ui.locator('.widget').bounding_box()
            assert b == {'x':1401,'y':60,'width':24,'height':900}, b
            assert ui.locator('.widget').locator('button:not(.timeline-dot)').count()==0
            assert ui.locator('.rail-count,.toggle,.track:before').count()==0
            expect(ui.locator('.panel')).to_be_hidden()
        run('Original UI: 24px track at top60/right15, no toolbar or count',original_bar)
        def palette():
            reset();node=ui.locator('.marker').nth(1)
            a=node.evaluate("e=>{const c=getComputedStyle(e,'::after');return [c.width,c.height,c.backgroundColor,c.borderRadius]}")
            assert a==['12px','12px','rgb(209, 213, 219)','50%'],a
            page.wait_for_timeout(200)
            active=ui.locator('.marker.active').evaluate("e=>getComputedStyle(e,'::after').boxShadow")
            assert 'rgb(16, 163, 127)' in active and '3px' in active,active
            page.evaluate("document.documentElement.dataset.theme='dark'")
            expect(ui).to_have_attribute('data-theme','dark')
            assert node.evaluate("e=>getComputedStyle(e,'::after').backgroundColor")=='rgb(85, 85, 85)'
            page.wait_for_timeout(200)
            assert 'rgb(25, 195, 125)' in ui.locator('.marker.active').evaluate("e=>getComputedStyle(e,'::after').boxShadow")
        run('Original UI: 12px gray dots and exact light/dark green active rings',palette)
        def amber():
            reset();ui.locator('.marker').nth(1).click(button='right')
            expect(ui.locator('.marker').nth(1)).to_have_class(re.compile('starred'))
            assert ui.locator('.marker').nth(1).evaluate("e=>getComputedStyle(e,'::after').backgroundColor")=='rgb(245, 158, 11)'
            expect(ui.locator('.toast')).to_be_hidden()
        run('Original UI: amber dot fill, no extra star badge or success toast',amber)
        def tooltip_contract():
            reset(n=2);page.evaluate("document.querySelector('[data-user-message-bubble]').textContent='这是一条用来测试三行截断的长消息，含有中文、emoji🙂和 English words。'.repeat(20)")
            scan();ui.locator('[data-action=close]').click();ui.locator('.marker').first.hover();tip=ui.locator('.tooltip');expect(tip).to_be_visible()
            assert tip.locator('*').count()==0 and len(tip.inner_text())<200
            assert tip.inner_text().endswith('…'),tip.inner_text()
            b=tip.bounding_box();assert b['height']<=76 and b['width']==280,b
            c=tip.evaluate("e=>{const s=getComputedStyle(e);return [s.fontSize,s.lineHeight,s.borderRadius,s.paddingTop,s.paddingLeft]}")
            assert c==['12px','18px','12px','10px','12px'],c
        run('Original UI: plain-text 3-line tooltip, 12px type, no header/footer',tooltip_contract)
        def fixed_density():
            reset(n=400);values=ui.locator('.marker').evaluate_all("a=>a.map(e=>parseFloat(e.style.top))")
            assert len(values)==400 and abs(values[0]-16)<.01 and abs(values[-1]-884)<.01
            assert 0<values[1]-values[0]<values[-1]-values[-2]<24
            assert ui.locator('.timeline-left-slider').count()==0
        run('Fixed rail pins endpoints and compresses old top nodes more densely',fixed_density)
        def last_marker():
            reset(n=400);ui.locator('[data-action=close]').click();n=ui.locator('.marker').last
            # Keyboard selection remains exact despite physically overlapping dense dots.
            n.focus();page.keyboard.press('Enter');page.wait_for_timeout(150)
            assert page.evaluate('document.querySelector("#sample-scroll").scrollTop')>50000
            assert ui.locator('.timeline-track').evaluate('e=>e.scrollTop')==0
        run('Newest endpoint is directly keyboard-accessible without scrolling the rail',last_marker)
        def wheel_linked():
            reset(n=100);ui.locator('[data-action=close]').click();b=ui.locator('.widget').bounding_box()
            page.mouse.move(b['x']+12,b['y']+200);page.mouse.wheel(0,600);page.wait_for_timeout(150)
            assert page.evaluate('document.querySelector("#sample-scroll").scrollTop')>500
            assert ui.locator('.timeline-track').evaluate('e=>e.scrollTop')==0
        run('Original UI: wheel on timeline scrolls only the conversation, never the rail',wheel_linked)
        def hold_visual():
            reset();ui.locator('.marker').nth(1).hover();page.mouse.down();page.wait_for_timeout(300)
            expect(ui.locator('.marker').nth(1)).to_have_class(re.compile('holding'))
            expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','false')
            page.mouse.move(1100,500);page.mouse.up();page.wait_for_timeout(300)
            expect(rows.nth(1).locator('.star-button')).to_have_attribute('aria-pressed','false')
            assert ui.locator('.holding').count()==0
        run('Original UI: long-press progress and >6px movement cancellation',hold_visual)
        def empty_rail():
            reset(n=0);expect(ui.locator('.widget')).to_be_hidden();assert ui.locator('.timeline-left-slider').count()==0
            expect(ui.locator('.empty')).to_be_visible()
        run('Original UI: empty conversation has no decorative blank rail',empty_rail)
        def single_dot():
            reset(n=1);expect(ui.locator('.marker')).to_have_count(1)
            assert abs(float(ui.locator('.marker').evaluate('e=>e.style.top').replace('px',''))-16)<0.1
            assert ui.locator('.timeline-left-slider').count()==0
        run('Original UI: single dot starts at 16px track padding',single_dot)
        def theme_attribute():
            reset();page.evaluate("delete document.documentElement.dataset.theme;document.documentElement.dataset.colorMode='dark'")
            expect(ui).to_have_attribute('data-theme','dark');page.evaluate("delete document.documentElement.dataset.colorMode")
        run('Original UI: data-color-mode dark theme recognition',theme_attribute)
        def no_message_flash():
            reset();ui.locator('.marker').nth(1).click();expect(ui.locator('.focus-ring')).to_be_hidden()
            expect(ui.locator('.panel')).to_be_visible()
        run('Original UI: clicking a dot adds no non-upstream message outline',no_message_flash)
        def privacy():
            reset(thread='secret-thread');s=json.dumps(status(),ensure_ascii=False);assert 'secret-thread' not in s and '我想给' not in s and 'https://' not in s
        run('Diagnostic payload contains no conversation text or raw IDs',privacy)
        def cleanup():
            reset();page.evaluate('__GTNextInstance.destroy()');expect(page.locator(HOST)).to_have_count(0);page.evaluate('GTNFixture.appendPair()');page.wait_for_timeout(750)
            expect(page.locator(HOST)).to_have_count(0)
        run('Destroy removes observers, timers and host',cleanup)
        # Popup tests use their own explicit API double.
        pop=context.new_page();pop.on('pageerror',lambda e:errors.append(str(e)))
        icon=base64.b64encode((ROOT/'icons/icon48.png').read_bytes()).decode()
        pop.set_content(html('popup/popup.html').replace('../icons/icon48.png','data:image/png;base64,'+icon));pop.add_style_tag(content=read('popup/popup.css'))
        for f in ['tests/browser-mock.js','src/core.js']:pop.add_script_tag(content=read(f))
        pop.evaluate("GTNTest.popupStatus={ok:true,version:'1.4.2',enabled:true,users:8,assistants:8,adapter:'Chat/Work',diagnostics:{users:8,assistants:8}}")
        pop.add_script_tag(content=read('popup/popup.js'))
        def popup_settings():
            expect(pop.locator('#role-count')).to_contain_text('8 条提问');pop.locator('#theme').select_option('dark');assert pop.evaluate('chrome.storage.local.get(null)')['gtn:setting:theme']=='dark'
        run('Popup status and individual settings keys (MOCK API)',popup_settings)
        def popup_selectors():
            pop.locator('#tab-advanced').click();pop.locator('#diagnostic-details summary').click();pop.locator('#customUserSelector').fill('[');pop.locator('#save-selectors').click();expect(pop.locator('#notice')).to_contain_text('语法无效')
            assert 'gtn:setting:customUserSelector' not in pop.evaluate('chrome.storage.local.get(null)')
            pop.locator('#customUserSelector').fill('[data-turn="user"]');pop.locator('#save-selectors').click()
            assert pop.evaluate('chrome.storage.local.get(null)')['gtn:setting:customUserSelector']=='[data-turn="user"]'
        run('Popup selector validation prevents invalid persistence',popup_selectors)
        def popup_clear():
            pop.evaluate("()=>{window.confirm=()=>false;globalThis.sk=GTNextCore.starKey(GTNextCore.scopeFromURL('https://chatgpt.com/c/a'),'m');return chrome.storage.local.set({[sk]:{version:1,savedAt:123}});}")
            pop.locator('summary').nth(1).click();pop.locator('#clear-bookmarks').click();assert pop.evaluate('chrome.storage.local.get(null)')[pop.evaluate('sk')]
            pop.evaluate('window.confirm=()=>true');pop.locator('#clear-bookmarks').click();d=pop.evaluate('chrome.storage.local.get(null)')
            assert not any(k.startswith('gtn:star:') for k in d) and d['gtn:setting:theme']=='dark'
        run('Popup destructive clear asks confirmation and preserves settings',popup_clear)
        def popup_export():
            pop.evaluate("()=>{const create=URL.createObjectURL.bind(URL);GTNTest.blobs=new Map();URL.createObjectURL=b=>{const u=create(b);GTNTest.blobs.set(u,b);return u;};HTMLAnchorElement.prototype.click=function(){GTNTest.download={url:this.href,name:this.download};};}")
            pop.locator('#export-bookmarks').click();d=pop.evaluate('async()=>JSON.parse(await GTNTest.blobs.get(GTNTest.download.url).text())');assert d['format']=='gpt-timeline-next-bookmarks'
            pop.locator('#export-diagnostics').click();d=pop.evaluate('async()=>JSON.parse(await GTNTest.blobs.get(GTNTest.download.url).text())');assert 'customUserSelector' not in d['settings']
        run('Popup safe JSON serialization (actual downloads not attempted)',popup_export)
        def popup_offline():
            pop.evaluate('GTNTest.unsupported=true');pop.locator('#tab-general').click();expect(pop.locator('#coverage')).to_contain_text('未连接')
            pop.locator('#side').select_option('left');assert pop.evaluate('chrome.storage.local.get(null)')['gtn:setting:side']=='left'
        run('Popup remains configurable when no content script is connected',popup_offline)
        # Clearly labelled local demonstration screenshots.
        page.add_script_tag(content=source);reset(thread='preview');rows.nth(2).locator('.star-button').click();ui.locator('.message-link').nth(0).click();ui.locator('[data-action=close]').click()
        page.wait_for_timeout(3100);ui.locator('.marker').nth(2).hover();page.wait_for_timeout(150);page.screenshot(path=str(ROOT/'docs/preview-light.png'))
        page.evaluate("document.documentElement.dataset.theme='dark'");page.wait_for_timeout(350);page.screenshot(path=str(ROOT/'docs/preview-dark.png'))
        for d in pop.locator('details').all():d.evaluate('(e)=>e.open=false')
        pop.set_viewport_size({'width':400,'height':592});pop.screenshot(path=str(ROOT/'docs/preview-settings.png'))
        def no_errors():assert not errors,errors
        run('No uncaught page exceptions',no_errors)
        result={'mode':'Local DOM simulation; chrome APIs mocked; location injected','browser':browser.version,'executedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'passed':sum(r['status']=='passed' for r in results),'failed':sum(r['status']=='failed' for r in results),'notValidated':['Native extension installation/runtime','Real logged-in ChatGPT UI','Account-specific rollout variants','Real storage persistence across browser restart'],'pageErrors':errors,'tests':results}
        (OUT/'browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('RESULT',result['passed'],'passed,',result['failed'],'failed; Chromium',browser.version,flush=True)
        browser.close();return int(result['failed']>0)
if __name__=='__main__':sys.exit(main())
