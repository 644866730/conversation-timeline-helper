#!/usr/bin/env python3
"""Gemini DOM regression. LOCAL fixtures and MOCK Chrome APIs, not a live account.

The fixture mirrors observed Gemini custom elements and its inner infinite-scroller.
Run: python -X utf8 tests/gemini_browser_test.py --chromium /path/to/chrome
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
import traceback
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/results'
HOST = '#gpt-timeline-next-root'

HTML = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Gemini 本地适配测试</title></head>
<body class="light-theme"><header>Gemini · 本地模拟页面，非真实账号截图</header>
<aside><nav aria-label="侧栏"><user-query>SIDEBAR_SECRET_USER</user-query><model-response>SIDEBAR_SECRET_REPLY</model-response></nav></aside>
<main class="chat-app"><chat-window><chat-window-content><div id="chat-history" class="chat-history-scroll-container">
<infinite-scroller class="chat-history" data-test-id="chat-history-container"></infinite-scroller>
</div></chat-window-content><input-container><form><rich-textarea><div contenteditable="true" role="textbox" aria-label="为 Gemini 输入提示">UNSENT_GEMINI_DRAFT</div></rich-textarea></form></input-container></chat-window></main>
</body></html>'''

CSS = '''*{box-sizing:border-box}body{margin:0;overflow:hidden;font:15px/1.7 system-ui;color:#203b40;background:#fff}
header{height:70px;padding:20px;border-bottom:1px solid #dae5e0}aside{position:absolute;top:70px;left:0;width:210px;padding:20px}
main{margin-left:230px;margin-right:95px}chat-window,chat-window-content,infinite-scroller,user-query,user-query-content,model-response,response-container,model-response-content,message-content,input-container,rich-textarea{display:block}
#chat-history{overflow:hidden}infinite-scroller.chat-history{height:700px;overflow-y:scroll;overflow-anchor:none;padding:20px}
.conversation-container{margin:0 0 26px;min-height:300px}.query-text{padding:18px;background:#eef5f1;border-radius:14px;margin:0 0 14px 80px;min-height:75px}
.markdown{padding:16px;min-height:200px}h2{font-size:21px;margin:8px 0 12px}p{margin:12px 0}input-container{padding:12px}form [contenteditable]{padding:10px;border:1px solid #d8e3df;border-radius:10px}
button{font:inherit;cursor:pointer}dialog{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;border:0;background:#263337ee;color:white}dialog button{position:absolute;right:15px;top:75px}
.dark-theme{background:#17292d;color:#e5f0ed}.dark-theme .query-text{background:#294449}'''

FIXTURE = r'''(() => {
  const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const f=globalThis.GF={thread:'fixture',count:0,seekMessages:0,scrollCalls:0,preview:null};
  Object.defineProperty(f,'root',{get:()=>document.querySelector('infinite-scroller[data-test-id="chat-history-container"]')});
  const native=f.root.scrollTo.bind(f.root);
  f.root.scrollTo=function(...args){f.scrollCalls++;return native(...args);};
  window.addEventListener('message',event=>{if(event.data?.bus==='gtn-navigation-v1'&&event.data.type==='seek')f.seekMessages++;});
  function pair(index){
    const turn=make('div');turn.className='conversation-container';turn.id=f.thread+'-turn-'+index;
    const user=make('user-query'),userContent=make('user-query-content'),bubble=make('div'),query=make('div'),line=make('p');
    bubble.className='user-query-bubble-with-background';query.className='query-text';line.className='query-text-line';
    line.textContent=f.thread+' Gemini 问题 '+index+'：如何清晰导航长对话？';
    const sr=make('h5','你说'+line.textContent);sr.className='cdk-visually-hidden screen-reader-user-query-label';
    Object.assign(sr.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clipPath:'inset(50%)'});
    query.append(sr,line);bubble.append(query);userContent.append(bubble);user.append(userContent);
    const userToolbar=make('button','USER_TOOLBAR_ONLY');user.append(userToolbar);
    if(index===0){const old=make('button','旧附件焦点');old.id='old-attachment';user.append(old);}
    const model=make('model-response'),response=make('response-container'),modelContent=make('model-response-content'),message=make('message-content'),body=make('div');
    message.id='model-response-message-content_r_'+turn.id;body.className='markdown markdown-main-panel';
    body.append(make('h2','Gemini 章节 '+index),make('p',f.thread+' Gemini 回复 '+index+'：内容只在当前页面处理。'),make('p','检索已加载内容，然后回到原来的阅读处。'));
    message.append(body);modelContent.append(message);response.append(modelContent);model.append(response);
    const tools=make('div');tools.setAttribute('role','toolbar');tools.append(make('button','COPY_REPLY_TOOLBAR'),make('mat-icon','more_vert'));model.append(tools);
    turn.append(user,model);return turn;
  }
  f.render=function(count=8,thread='fixture'){
    f.count=count;f.thread=thread;f.root.replaceChildren();
    for(let i=0;i<count;i++)f.root.append(pair(i));
    f.root.scrollTop=0;
  };
  f.hidden=function(){const copy=pair(99);copy.hidden=true;f.root.append(copy);};
  f.openPreview=function(restoreFocus=true){
    const dialog=make('dialog'),close=make('button','关闭图片预览');close.id='close-gemini-preview';
    const finish=()=>{dialog.close();dialog.remove();f.preview=null;if(restoreFocus)setTimeout(()=>document.querySelector('#old-attachment').focus(),40);};
    close.addEventListener('click',finish);dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
    dialog.append(make('p','本地 Gemini 图片预览模拟'),close);document.body.append(dialog);f.preview=dialog;dialog.showModal();
  };
  f.render();
})();'''


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


class Harness:
    def __init__(self, context, count=8, thread='fixture'):
        self.page = context.new_page()
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request.url) if request.url.startswith(('http:', 'https:')) else None)
        self.page.set_content(HTML)
        self.page.add_style_tag(content=CSS)
        self.page.add_script_tag(content=FIXTURE)
        self.page.evaluate('([count,thread])=>GF.render(count,thread)', [count, thread])
        for name in ['tests/browser-mock.js', 'src/i18n.js','src/core.js', 'src/loaded-index.js', 'src/adapter.js', 'src/navigation-core.js', 'src/navigation.js', 'src/preview-guard.js', 'src/styles.js']:
            self.page.add_script_tag(content=read(name))
        self.page.evaluate("globalThis.__geminiLocation={href:'https://gemini.google.com/app/'+GF.thread};chrome.storage.local.set({'gtn:setting:includeAssistant':true,'gtn:setting:smoothScroll':false})")
        self.source = '((location)=>{\n' + read('src/content.js') + '\n})(globalThis.__geminiLocation);'
        self.page.add_script_tag(content=self.source)
        self.ui = self.page.locator(HOST)
        self.rows = self.ui.locator('.message-row')
        self.send('GTN_OPEN')
        self.scan()
        expect(self.rows).to_have_count(count * 2)

    def send(self, kind='GTN_STATUS'):
        return self.page.evaluate('(kind)=>GTNTest.send(kind)', kind)

    def scan(self):
        return self.send('GTN_RESCAN')

    def setting(self, key, value):
        self.page.evaluate('([key,value])=>chrome.storage.local.set({["gtn:setting:"+key]:value})', [key, value])

    def top(self):
        return self.page.evaluate('GF.root.scrollTop')

    def wait_success(self):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            status = self.send()['navigation']
            if status['stage'] == 'success':
                return status
            if status['stage'] == 'failed':
                raise AssertionError(status)
            self.page.wait_for_timeout(80)
        raise AssertionError('Gemini navigation did not complete: ' + str(self.send()['navigation']))

    def route(self, thread, count=8, url=None):
        self.page.evaluate("""({thread,count,url})=>{__geminiLocation.href=url||'https://gemini.google.com/app/'+thread;window.dispatchEvent(new PopStateEvent('popstate'));GF.render(count,thread);}""", {'thread': thread, 'count': count, 'url': url})
        self.scan()
        self.send('GTN_OPEN')
        expect(self.rows).to_have_count(count * 2)

    def close(self):
        assert not self.errors, self.errors
        assert not self.requests, self.requests
        self.page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=shutil.which('chromium') or shutil.which('chromium-browser'))
    parser.add_argument('--headed', action='store_true')
    parser.add_argument('--match', default='')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        options = {'headless': not args.headed, 'args': ['--no-sandbox']}
        if args.chromium:
            options['executable_path'] = args.chromium
        browser = playwright.chromium.launch(**options)
        context = browser.new_context(viewport={'width': 1440, 'height': 950}, reduced_motion='reduce',locale='zh-CN')
        expect.set_options(timeout=4000)

        def run(name, function, **kwargs):
            if args.match and args.match not in name:
                return
            harness = None
            started = time.perf_counter()
            print('START', name, flush=True)
            try:
                harness = Harness(context, **kwargs)
                function(harness)
                harness.close()
                result = {'name': name, 'status': 'passed'}
                print('PASS', name, flush=True)
            except Exception as error:
                result = {'name': name, 'status': 'failed', 'error': str(error)}
                traceback.print_exc()
                print('FAIL', name, str(error), flush=True)
                if harness and not harness.page.is_closed():
                    harness.page.screenshot(path=str(OUT / f'gemini-failure-{len(results) + 1}.png'))
                    harness.page.close()
            result['seconds'] = round(time.perf_counter() - started, 3)
            results.append(result)

        def roles(h):
            status = h.send()
            assert status['users'] == status['assistants'] == 8
            assert 'gemini' in status['adapter'].lower(), status
            assert h.page.evaluate('()=>{const items=GTNextAdapter.collect().items;return items[0].target!==items[1].target;}')
            assert 'Gemini' in h.ui.locator('.widget').get_attribute('aria-label')
        run('Gemini custom elements produce separate user and assistant targets', roles)

        def excluded(h):
            text = h.ui.locator('.message-list').inner_text()
            for secret in ['SIDEBAR_SECRET', 'UNSENT_GEMINI_DRAFT', 'COPY_REPLY_TOOLBAR', 'USER_TOOLBAR_ONLY', 'more_vert']:
                assert secret not in text, text
        run('Sidebar, unsent draft and message toolbars stay outside the index', excluded)

        def screen_reader_copy(h):
            items = h.page.evaluate("""()=>GTNextAdapter.collect().items.filter(item=>item.role==='user').map(item=>({text:item.text,outline:item.outline,headings:GTNextAdapter.outlineNodes(item.content).length}))""")
            assert len(items) == 8
            for index, item in enumerate(items):
                prompt = f'fixture Gemini 问题 {index}：如何清晰导航长对话？'
                assert item['text'].count(prompt) == 1, item
                assert '你说' not in item['text'] and not item['outline'] and item['headings'] == 0, item
            h.ui.locator('.scope-select').select_option('user')
            h.ui.locator('.search-input').fill('fixture Gemini 问题 0')
            expect(h.rows).to_have_count(1)
            expect(h.rows.locator('.outline-toggle')).to_have_count(0)
            with h.page.expect_download() as pending:
                h.ui.locator('[data-action=export-markdown]').click()
            text = Path(pending.value.path()).read_text(encoding='utf-8')
            assert text.count('fixture Gemini 问题 0：如何清晰导航长对话？') == 1, text
            assert '你说' not in text
        run('Screen-reader duplicate prompt labels are excluded from text, outline and export', screen_reader_copy)

        def hidden(h):
            h.page.evaluate('GF.hidden()')
            h.scan()
            expect(h.rows).to_have_count(16)
        run('Hidden Gemini branches are not indexed', hidden)

        def idle(h):
            before = h.top()
            moves = h.page.evaluate('GF.scrollCalls')
            h.page.wait_for_timeout(1100)
            assert h.top() == before and h.page.evaluate('GF.scrollCalls') == moves
            assert h.page.evaluate('GF.seekMessages') == 0
            assert h.send()['navigation']['stage'] == 'idle'
        run('Idle observation makes no scroll writes, requests or MAIN seek messages', idle)

        def user_only(h):
            h.ui.locator('.scope-select').select_option('user')
            expect(h.rows).to_have_count(8)
            assert h.rows.evaluate_all('rows=>rows.every(row=>row.dataset.role==="user")')
        run('Prompt-only preference works on Gemini', user_only)

        def theme(h):
            h.page.evaluate("document.body.className='dark-theme'")
            expect(h.ui).to_have_attribute('data-theme', 'dark')
            h.page.evaluate("document.body.className='light-theme'")
            expect(h.ui).to_have_attribute('data-theme', 'light')
        run('Gemini body light-theme and dark-theme are followed', theme)

        def mounted(h):
            h.rows.last.locator('.message-link').click()
            h.wait_success()
            assert h.top() > 1000
            assert h.page.evaluate('window.scrollY') == 0
            assert h.page.evaluate('GF.seekMessages') == 0
        run('Mounted message navigation uses the inner Gemini scroller without React helper', mounted)

        def restore_old_node(h):
            old_key = h.rows.first.locator('.message-link').get_attribute('data-key')
            h.page.evaluate("""()=>{GF.oldPrompt=document.querySelector('main user-query');for(const turn of Array.from(GF.root.querySelectorAll('.conversation-container')).slice(0,4))turn.remove();GF.root.scrollTop=GF.root.scrollHeight;}""")
            h.page.wait_for_timeout(180)
            h.scan()
            expect(h.rows).to_have_count(16)
            assert not h.page.evaluate('GF.oldPrompt.isConnected')
            assert h.rows.first.locator('.message-link').get_attribute('data-key') == old_key
            h.page.evaluate("""()=>{GF.restoredOlder=false;const restore=()=>{if(GF.root.scrollTop>20)return;GF.root.removeEventListener('scroll',restore);GF.render(8,'fixture');GF.restoredOlder=true;};GF.root.addEventListener('scroll',restore);}""")
            h.rows.first.locator('.message-link').click()
            status = h.wait_success()
            assert status['method'] == 'scroll', status
            assert h.page.evaluate("GF.restoredOlder && !GF.oldPrompt.isConnected && document.querySelector('main user-query')!==GF.oldPrompt")
            expect(h.rows.first.locator('.message-link')).to_have_attribute('aria-current', 'true')
            assert h.rows.first.locator('.message-link').get_attribute('data-key') == old_key
            assert h.page.evaluate('GF.seekMessages') == 0
        run('Observed unmounted Gemini messages recover through active scrolling with stable IDs and no MAIN seek', restore_old_node)

        def return_reading(h):
            h.page.evaluate('GF.root.scrollTop=650')
            h.scan()
            before = h.top()
            h.rows.last.locator('.message-link').click()
            expect(h.ui.locator('.return-reading')).to_be_enabled(timeout=7000)
            h.ui.locator('.return-reading').click()
            expect(h.ui.locator('.toast')).to_contain_text('已返回刚才的阅读位置', timeout=7000)
            assert abs(h.top() - before) <= 3, (before, h.top())
        run('Return restores the Gemini reading offset', return_reading)

        def streaming(h):
            key = h.rows.nth(1).locator('.message-link').get_attribute('data-key')
            h.ui.locator('.search-input').fill('StreamingUniqueGeminiTail')
            expect(h.rows).to_have_count(0)
            h.page.evaluate("document.querySelector('model-response .markdown').append(document.createTextNode(' StreamingUniqueGeminiTail'))")
            expect(h.rows).to_have_count(1)
            assert h.rows.first.locator('.message-link').get_attribute('data-key') == key
            expect(h.ui.locator('.marker')).to_have_count(16)
        run('Streaming reply tails become searchable without duplicate nodes', streaming)

        def recycled(h):
            old = h.rows.first.locator('.message-link').get_attribute('data-key')
            h.page.evaluate("document.querySelector('.conversation-container').id='recycled-angular-turn'")
            h.scan()
            new = h.page.evaluate('GTNextAdapter.collect().items[0].key')
            assert old != new, (old, new)
            assert h.send()['loaded'] > 16
        run('Angular parent-turn identity replacement is not mistaken for streaming text', recycled)

        def bookmark_restore(h):
            h.rows.nth(2).locator('.star-button').click()
            expect(h.rows.nth(2).locator('.star-button')).to_have_attribute('aria-pressed', 'true')
            assert h.send()['persistentBookmarks']
            saved = h.page.evaluate('chrome.storage.local.get(null)')
            assert len([key for key in saved if key.startswith('gtn:star:')]) == 1
            assert 'Gemini 问题' not in json.dumps(saved, ensure_ascii=False)
            h.page.add_script_tag(content=h.source)
            h.send('GTN_OPEN')
            expect(h.rows.nth(2).locator('.star-button')).to_have_attribute('aria-pressed', 'true')
        run('Stable Gemini bookmarks restore after controller restart without storing text', bookmark_restore)

        def bookmark_isolation(h):
            h.rows.first.locator('.star-button').click()
            expect(h.rows.first.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
            h.route('different-gemini-chat')
            expect(h.ui.locator('.star-button[aria-pressed=true]')).to_have_count(0)
            h.route('fixture')
            expect(h.rows.first.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
        run('Gemini bookmarks remain isolated between conversations', bookmark_isolation)

        def ephemeral(h):
            h.route('new-chat', url='https://gemini.google.com/app')
            assert not h.send()['persistentBookmarks']
            h.rows.first.locator('.star-button').click()
            expect(h.rows.first.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
            assert not any(key.startswith('gtn:star:') for key in h.page.evaluate('chrome.storage.local.get(null)'))
            h.page.add_script_tag(content=h.source)
            h.send('GTN_OPEN')
            expect(h.rows.first.locator('.star-button')).to_have_attribute('aria-pressed', 'false')
        run('Gemini new-chat route uses memory-only bookmarks', ephemeral)

        def promote_first_prompt(h, temporary, stable):
            h.route('first-prompt', count=1, url=temporary)
            assert not h.send()['persistentBookmarks']
            initial_key = h.rows.first.locator('.message-link').get_attribute('data-key')
            h.page.evaluate("""()=>{GF.firstPrompt=document.querySelector('main user-query');GF.firstParent=GF.firstPrompt.closest('.conversation-container');GF.firstText=GF.firstPrompt.textContent;}""")
            h.page.evaluate("""url=>{__geminiLocation.href=url;window.dispatchEvent(new PopStateEvent('popstate'));}""", stable)
            h.scan()
            expect(h.rows).to_have_count(2)
            assert h.send()['persistentBookmarks'] and h.send()['loaded'] == 2
            assert h.page.evaluate("GF.firstPrompt===document.querySelector('main user-query') && GF.firstParent===GF.firstPrompt.closest('.conversation-container') && GF.firstText===GF.firstPrompt.textContent")
            assert h.rows.first.locator('.message-link').get_attribute('data-key') == initial_key
            h.rows.first.locator('.star-button').click()
            expect(h.rows.first.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
            assert len([key for key in h.page.evaluate('chrome.storage.local.get(null)') if key.startswith('gtn:star:')]) == 1
        run('Gemini app route promotion retains the same first prompt DOM and enables persistent bookmarks',
            lambda h: promote_first_prompt(h, 'https://gemini.google.com/app', 'https://gemini.google.com/app/first-chat-id'))
        run('Gemini account-prefixed Gem route promotion retains the same first prompt DOM and stable scope',
            lambda h: promote_first_prompt(h, 'https://gemini.google.com/u/1/gem/custom-gem', 'https://gemini.google.com/u/1/gem/custom-gem/first-gem-chat-id'))

        def chapter(h):
            h.page.evaluate("""()=>{const body=document.querySelector('model-response .markdown'),space=document.createElement('div'),heading=document.createElement('h3'),tail=document.createElement('div');space.style.height='1000px';heading.id='gemini-chapter-target';heading.textContent='Gemini 长回复子章节';tail.style.height='900px';body.append(space,heading,tail);}""")
            h.scan()
            h.ui.locator('.outline-toggle').first.click()
            h.ui.locator('.heading-link').nth(1).click()
            expect(h.ui.locator('.toast')).to_contain_text('已定位章节：Gemini 长回复子章节', timeout=7000)
            box = h.page.locator('#gemini-chapter-target').bounding_box()
            root = h.page.locator('infinite-scroller[data-test-id="chat-history-container"]').bounding_box()
            assert root['y'] <= box['y'] < root['y'] + 100, (box, root)
            assert h.page.evaluate('GF.seekMessages') == 0
        run('Long Gemini replies support exact chapter navigation', chapter)

        def export(h):
            h.page.evaluate("""()=>{const body=document.querySelector('model-response .markdown'),pre=document.createElement('pre'),code=document.createElement('code');body.append(document.createTextNode(' OnlyGeminiExport123'));code.className='language-js';code.textContent='console.log("Gemini");\\nconst answer = 42;';pre.append(code);body.append(pre);}""")
            h.scan()
            h.ui.locator('.search-input').fill('OnlyGeminiExport123')
            expect(h.rows).to_have_count(1)
            with h.page.expect_download() as pending:
                h.ui.locator('[data-action=export-markdown]').click()
            download = pending.value
            text = Path(download.path()).read_text(encoding='utf-8')
            assert download.suggested_filename.lower().startswith('gemini-'), download.suggested_filename
            assert '搜索结果，1 条已加载消息' in text and 'OnlyGeminiExport123' in text
            assert '```js\nconsole.log("Gemini");\nconst answer = 42;\n```' in text
            assert '## 提问' not in text
        run('Filtered Gemini Markdown export uses platform filename and preserves code', export)

        def preview(h):
            h.page.evaluate('GF.root.scrollTop=1000')
            h.scan()
            before = h.top()
            h.page.evaluate('GF.openPreview(true)')
            expect(h.ui).to_have_attribute('data-preview-blocked', '')
            h.page.keyboard.press('Escape')
            h.page.wait_for_timeout(1300)
            assert h.ui.get_attribute('data-preview-blocked') is None
            assert abs(h.top() - before) <= 3, (before, h.top())
        run('Native Gemini dialog close preserves the reading position after focus reset', preview)

        def menu(h):
            before = h.top()
            h.page.evaluate("""()=>{const menu=document.createElement('div');menu.setAttribute('role','menu');menu.className='cdk-overlay-pane';menu.textContent='普通菜单';Object.assign(menu.style,{position:'fixed',right:'120px',top:'100px',width:'180px',height:'100px'});document.body.append(menu);}""")
            h.scan()
            h.page.wait_for_timeout(180)
            assert h.ui.get_attribute('data-preview-blocked') is None
            assert h.top() == before
        run('Ordinary Gemini CDK menus do not trigger media preview protection', menu)

        def route_reset(h):
            old = set(h.ui.locator('.marker').evaluate_all('nodes=>nodes.map(node=>node.dataset.key)'))
            h.route('new-angular-route', count=3)
            assert not old.intersection(h.ui.locator('.marker').evaluate_all('nodes=>nodes.map(node=>node.dataset.key)'))
            assert h.send()['loaded'] == 6
        run('Gemini SPA route replacement clears the previous conversation index', route_reset)

        def composer(h):
            h.page.evaluate('GF.root.scrollTop=500')
            h.page.locator('[contenteditable=true]').focus()
            before = h.top()
            h.page.keyboard.press('Alt+Shift+ArrowUp')
            h.page.wait_for_timeout(180)
            assert h.top() == before and h.send()['navigation']['stage'] == 'idle'
        run('Gemini prompt editing is not hijacked by message-navigation keys', composer)

        def empty(h):
            expect(h.ui.locator('.widget')).to_be_hidden()
            expect(h.ui.locator('.directory-launcher')).to_be_visible()
            expect(h.ui.locator('.empty')).to_be_visible()
            assert h.send()['loaded'] == 0 and h.page.evaluate('GF.seekMessages') == 0
        run('Empty Gemini conversation has no fabricated messages or decorative rail', empty, count=0)

        result = {'mode': 'Gemini LOCAL DOM fixtures and MOCK Chrome APIs; not a live account', 'browser': browser.version,
                  'executedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'passed': sum(row['status'] == 'passed' for row in results),
                  'failed': sum(row['status'] == 'failed' for row in results), 'tests': results}
        suffix = '-filtered' if args.match else ''
        (OUT / ('gemini-browser-results' + suffix + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('RESULT', result['passed'], 'passed,', result['failed'], 'failed', flush=True)
        browser.close()
        return int(result['failed'] > 0)


if __name__ == '__main__':
    raise SystemExit(main())
