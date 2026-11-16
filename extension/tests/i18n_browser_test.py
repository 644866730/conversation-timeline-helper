#!/usr/bin/env python3
"""Offline language-switch regression using real UI scripts and mocked Chrome APIs.

Both pages share a localStorage-backed storage double so native cross-tab storage
events exercise chrome.storage.onChanged. All HTTPS routes are fulfilled locally;
no account, translation API, extension installation or remote page is involved.
Run: python -X utf8 tests/i18n_browser_test.py --chromium /path/to/chrome
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import time
import traceback
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/results'
HOST = '#gpt-timeline-next-root'
LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de']
STORAGE_MOCK = r'''(() => {
  const KEY='gtn-i18n-fixture-store',listeners=new Set(),receivers=new Set();
  const read=()=>JSON.parse(localStorage.getItem(KEY)||'{}');
  const clone=value=>value===undefined?undefined:structuredClone(value);
  const diff=(before,after)=>{const changes={};for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(JSON.stringify(before[key])!==JSON.stringify(after[key]))changes[key]={oldValue:clone(before[key]),newValue:clone(after[key])};return changes;};
  const emit=changes=>queueMicrotask(()=>{for(const listener of listeners)listener(clone(changes),'local');});
  const write=next=>{const changes=diff(read(),next);localStorage.setItem(KEY,JSON.stringify(next));emit(changes);};
  window.addEventListener('storage',event=>{if(event.key===KEY)emit(diff(JSON.parse(event.oldValue||'{}'),JSON.parse(event.newValue||'{}')));});
  const T=globalThis.GTNTest={popupStatus:null,unsupported:false,writes:[]};
  const runtime={id:'gtn-i18n-test',onMessage:{addListener:listener=>receivers.add(listener),removeListener:listener=>receivers.delete(listener)},openOptionsPage:()=>{}};
  T.send=async type=>{
    if(T.unsupported)throw Error('mock: no receiver');
    if(T.popupStatus)return clone(T.popupStatus);
    return new Promise((resolve,reject)=>{let replied=false;for(const receiver of receivers)receiver({type},{id:runtime.id},value=>{replied=true;resolve(clone(value));});if(!replied)reject(Error('mock: no receiver'));});
  };
  globalThis.chrome={runtime,tabs:{query:async()=>[{id:1}],sendMessage:async(_id,message)=>T.send(message.type)},storage:{
    local:{get:async keys=>{const data=read();return keys===null?clone(data):Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>key in data).map(key=>[key,clone(data[key])]));},
      set:async entries=>{T.writes.push(clone(entries));write({...read(),...clone(entries)});},
      remove:async keys=>{const data=read();for(const key of Array.isArray(keys)?keys:[keys])delete data[key];write(data);},clear:async()=>write({})},
    onChanged:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener)}}};
})();'''


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


def html(name):
    return re.sub(r'<link\b[^>]*>', '', re.sub(r'<script\b[^>]*>.*?</script>', '', read(name), flags=re.S))


class Harness:
    def __init__(self, browser, locale='zh-CN', initial=None, platform='chatgpt'):
        self.context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', locale=locale)
        self.context.route('https://timeline.local/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<!doctype html><html><body></body></html>'))
        self.errors = []
        self.pages = []
        self.page = self.new_page('content')
        self.page.set_content(html('demo/gemini.html' if platform == 'gemini' else 'demo/index.html'))
        self.page.add_script_tag(content=STORAGE_MOCK)
        if initial:
            self.page.evaluate('(data)=>chrome.storage.local.set(data)', initial)
        self.page.add_style_tag(content=read('demo/gemini.css' if platform == 'gemini' else 'demo/demo.css'))
        self.page.add_script_tag(content=read('demo/gemini-fixture.js' if platform == 'gemini' else 'demo/fixture.js'))
        if platform != 'gemini':
            self.page.evaluate("GTNFixture.setLayout('modern',4,'i18n-thread')")
        self.source = '((location)=>{\n' + read('src/content.js') + '\n})(globalThis.__testLocation);'
        for name in ['src/i18n.js', 'src/core.js', 'src/loaded-index.js', 'src/adapter.js', 'src/navigation-core.js', 'src/navigation.js', 'src/preview-guard.js', 'src/styles.js']:
            self.page.add_script_tag(content=read(name))
        self.page.evaluate('(platform)=>globalThis.__testLocation={href:platform==="gemini"?"https://gemini.google.com/app/i18n-thread":"https://chatgpt.com/c/i18n-thread"}', platform)
        self.page.add_script_tag(content=self.source)
        self.ui = self.page.locator(HOST)
        self.send('GTN_OPEN')
        expect(self.ui.locator('.message-row')).to_have_count(12 if platform == 'gemini' else 8)
        self.original_body = self.page.locator('#chat-history' if platform == 'gemini' else '#messages').inner_text()
        self.popup = self.new_page('popup')
        self.popup.set_viewport_size({'width': 400, 'height': 592})
        self.popup.set_content(html('popup/popup.html'))
        self.popup.add_script_tag(content=STORAGE_MOCK)
        self.popup.add_style_tag(content=read('src/theme.css'))
        self.popup.add_style_tag(content=read('popup/popup.css'))
        for name in ['src/i18n.js', 'popup/i18n.js', 'src/core.js']:
            self.popup.add_script_tag(content=read(name))
        self.popup.evaluate('(status)=>GTNTest.popupStatus=status', self.send())
        self.popup.add_script_tag(content=read('popup/popup.js'))
        expect(self.popup.locator('#language')).to_be_visible()

    def new_page(self, suffix):
        page = self.context.new_page()
        self.pages.append(page)
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.goto('https://timeline.local/' + suffix)
        return page

    def send(self, kind='GTN_STATUS'):
        return self.page.evaluate('(kind)=>GTNTest.send(kind)', kind)

    def set_language(self, value):
        self.popup.locator('#language').select_option(value)
        expect(self.popup.locator('#language')).to_have_value(value)
        self.page.wait_for_function('(value)=>chrome.storage.local.get(null).then(data=>data["gtn:setting:language"]===value)', arg=value)

    def translate(self, page, key, language):
        return page.evaluate('([key,language])=>GTNextI18n.t(key,{},language)', [key, language])

    def close(self):
        assert not self.errors, self.errors
        self.context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=shutil.which('chromium') or shutil.which('chromium-browser'))
    parser.add_argument('--headed', action='store_true')
    parser.add_argument('--match', default='')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        launch = {'headless': not args.headed, 'args': ['--no-sandbox']}
        if args.chromium:
            launch['executable_path'] = args.chromium
        browser = playwright.chromium.launch(**launch)
        expect.set_options(timeout=5000)

        def run(name, function, **kwargs):
            if args.match and not re.search(args.match, name):
                return
            harness = None
            start = time.perf_counter()
            try:
                harness = Harness(browser, **kwargs)
                function(harness)
                harness.close()
                record = {'name': name, 'status': 'passed'}
                print('PASS', name, flush=True)
            except Exception as error:
                traceback.print_exc()
                record = {'name': name, 'status': 'failed', 'error': str(error)}
                print('FAIL', name, str(error), flush=True)
                if harness:
                    for index, page in enumerate(harness.pages):
                        if not page.is_closed():
                            page.screenshot(path=str(OUT / f'i18n-failure-{len(results)+1}-{index}.png'))
                    harness.context.close()
            record['seconds'] = round(time.perf_counter() - start, 3)
            results.append(record)

        def options(h):
            values = h.popup.locator('#language option').evaluate_all('nodes=>nodes.map(node=>node.value)')
            assert values == ['auto', *LANGUAGES], values
            native = h.popup.locator('#language option').all_text_contents()
            assert all(native) and len(set(native)) == 9
        run('Language selector offers auto and all eight native language names', options)

        def simultaneous(h):
            popup_labels = set()
            content_labels = set()
            for language in LANGUAGES:
                h.set_language(language)
                expected = h.translate(h.popup, '常用设置', language)
                expect(h.popup.locator('#tab-general')).to_have_text(expected)
                popup_labels.add(expected)
                expected_content = h.translate(h.page, '对话导航', language)
                expect(h.ui.locator('.title')).to_have_text(expected_content)
                content_labels.add(expected_content)
                assert h.page.locator('#messages').inner_text() == h.original_body
                assert h.send()['panelOpen']
            # English and Spanish both correctly use "General"; every locale
            # has already been checked against its own catalog above.
            assert len(popup_labels) >= 7 and len(content_labels) >= 7, (popup_labels, content_labels)
        run('Changing the popup language updates content through cross-tab storage events without translating the conversation', simultaneous)

        def gemini_simultaneous(h):
            assert h.send()['platform'] == 'gemini'
            rows = h.ui.locator('.message-row')
            rows.nth(2).locator('.star-button').click()
            key = rows.nth(2).locator('.message-link').get_attribute('data-key')
            for language in LANGUAGES:
                h.set_language(language)
                expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', language))
                expect(h.popup.locator('#tab-general')).to_have_text(h.translate(h.popup, '常用设置', language))
                expect(rows).to_have_count(12)
                row = h.ui.locator(f'.message-row:has(.message-link[data-key="{key}"])')
                expect(row.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
                assert h.page.locator('#chat-history').inner_text() == h.original_body
                status = h.send()
                assert status['language'] == language and status['panelOpen']
        run('Gemini applies all eight languages immediately while preserving conversation text and bookmarks', gemini_simultaneous, platform='gemini')

        def invalid_selector_language(h):
            h.popup.evaluate("chrome.storage.local.set({'gtn:setting:customUserSelector':'['})")
            for language in LANGUAGES:
                h.set_language(language)
                expected = h.translate(h.page, 'CSS 选择器语法无效', language)
                if language != 'zh-CN':
                    assert expected != 'CSS 选择器语法无效', (language, expected)
                expect(h.ui.locator('.diagnostics')).to_contain_text('custom-user: ' + expected)
                assert 'custom-user: ' + expected in h.send()['diagnostics']['errors']
                expect(h.ui.locator('.message-row')).to_have_count(8)
                assert h.page.locator('#messages').inner_text() == h.original_body
        run('Invalid custom selector diagnostics follow each selected language without breaking the built-in adapter', invalid_selector_language)

        def preserve(h):
            h.set_language('zh-CN')
            h.ui.locator('.message-row').nth(2).locator('.star-button').click()
            key = h.ui.locator('.message-row').nth(2).locator('.message-link').get_attribute('data-key')
            h.ui.locator('.search-input').fill('新版')
            expect(h.ui.locator('.message-row')).to_have_count(1)
            h.ui.locator('.search-input').focus()
            h.popup.evaluate("chrome.storage.local.set({'gtn:setting:language':'en'})")
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'en'))
            expect(h.ui.locator('.search-input')).to_have_value('新版')
            expect(h.ui.locator('.search-input')).to_be_focused()
            expect(h.ui.locator('.message-row')).to_have_count(1)
            assert h.send()['panelOpen']
            h.ui.locator('.search-input').fill('')
            row = h.ui.locator(f'.message-row:has(.message-link[data-key="{key}"])')
            expect(row.locator('.star-button')).to_have_attribute('aria-pressed', 'true')
        run('Language switching preserves search text, content focus, bookmark and open directory state', preserve)

        def restart(h):
            h.set_language('ja')
            h.page.add_script_tag(content=h.source)
            h.send('GTN_OPEN')
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'ja'))
            assert h.page.evaluate("chrome.storage.local.get(null).then(data=>data['gtn:setting:language'])") == 'ja'
        run('A controller restart reuses the saved language preference', restart)

        def content_layout(h):
            h.page.set_viewport_size({'width': 350, 'height': 700})
            for language in LANGUAGES:
                h.set_language(language)
                expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', language))
                geometry = h.ui.locator('.panel').evaluate('node=>{const rect=node.getBoundingClientRect();return {x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,overflow:node.scrollWidth>node.clientWidth+1};}')
                assert geometry['x'] >= 0 and geometry['y'] >= 0 and geometry['right'] <= 351 and geometry['bottom'] <= 701 and not geometry['overflow'], (language, geometry)
                for selector in ['.panel-header', '.filter-row', '.reading-actions', '.footer-actions']:
                    area = h.ui.locator(selector)
                    assert area.evaluate('node=>node.scrollWidth<=node.clientWidth+1'), (language, selector)
        run('All eight content languages fit a 350px directory without horizontal overflow', content_layout)

        def popup_layout(h):
            for unsupported in [False, True]:
                h.popup.evaluate('(value)=>GTNTest.unsupported=value', unsupported)
                for language in LANGUAGES:
                    h.set_language(language)
                    expect(h.popup.locator('#tab-general')).to_have_text(h.translate(h.popup, '常用设置', language))
                    expect(h.popup.locator('#coverage')).to_have_text(h.translate(h.popup, '未连接' if unsupported else '随页更新', language))
                    assert h.popup.evaluate('document.body.scrollWidth') == 400
                    main = h.popup.locator('main').bounding_box()
                    for selector in ['#language', '#includeAssistant', '#theme', '#side', '#showPreview']:
                        box = h.popup.locator(selector).bounding_box()
                        assert box and box['y'] >= main['y'] - 1 and box['y'] + box['height'] <= main['y'] + main['height'] + 1, (language, unsupported, selector, box, main)
                    assert h.popup.locator('.header').evaluate('node=>node.scrollWidth<=node.clientWidth+1'), (language, unsupported)
                    assert h.popup.locator('.status-actions').evaluate('node=>node.scrollWidth<=node.clientWidth+1'), (language, unsupported)
        run('All eight languages keep common settings within the native 400x592 popup when connected or disconnected', popup_layout)

        def accessible(h):
            h.set_language('zh-CN')
            before = {'placeholder': h.ui.locator('.search-input').get_attribute('placeholder'),
                      'aria': h.ui.locator('.search-input').get_attribute('aria-label'),
                      'title': h.ui.locator('.return-reading').get_attribute('title')}
            h.set_language('de')
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'de'))
            after = {'placeholder': h.ui.locator('.search-input').get_attribute('placeholder'),
                     'aria': h.ui.locator('.search-input').get_attribute('aria-label'),
                     'title': h.ui.locator('.return-reading').get_attribute('title')}
            assert all(after.values()) and all(after[key] != before[key] for key in before), (before, after)
            assert h.popup.locator('html').get_attribute('lang') == 'de'
        run('Search placeholder, accessible label and button tooltip follow the chosen language', accessible)

        def safe_text(h):
            text = '<img src=x onerror="window.pwned=1"> 对话导航 Language <script>window.pwned=2</script>'
            h.page.evaluate('(text)=>document.querySelector("[data-user-message-bubble]").textContent=text', text)
            h.send('GTN_RESCAN')
            h.set_language('fr')
            expect(h.ui.locator('.message-row').first.locator('.row-preview')).to_contain_text('<img src=x')
            assert h.page.locator('[data-user-message-bubble]').first.text_content() == text
            assert h.ui.locator('.message-list img,.message-list script').count() == 0
            assert not h.page.evaluate('Boolean(window.pwned)')
        run('Localized UI never treats conversation text or HTML-looking user content as translation markup', safe_text)

        def invalid(h):
            h.popup.evaluate("chrome.storage.local.set({'gtn:setting:language':'not-a-language'})")
            expect(h.popup.locator('#language')).to_have_value('auto')
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'zh-CN'))
            assert h.page.evaluate("GTNextCore.settingsFromStorage({'gtn:setting:language':'not-a-language'}).language") == 'auto'
        run('Invalid stored language safely normalizes to auto without breaking either page', invalid)

        def options_page(h):
            options = h.new_page('options')
            options.set_content(html('popup/options.html'))
            options.add_script_tag(content=STORAGE_MOCK)
            options.add_style_tag(content=read('src/theme.css'))
            options.add_style_tag(content=read('popup/popup.css'))
            for name in ['src/i18n.js', 'popup/i18n.js', 'src/core.js']:
                options.add_script_tag(content=read(name))
            options.evaluate('(status)=>GTNTest.popupStatus=status', h.send())
            options.add_script_tag(content=read('popup/popup.js'))
            expect(options.locator('#language')).to_be_visible()
            options.locator('#tab-advanced').click()
            options.locator('#diagnostic-details summary').click()
            options.locator('#customUserSelector').fill('[data-user-pending]')
            options.locator('#customUserSelector').focus()
            h.popup.evaluate("chrome.storage.local.set({'gtn:setting:language':'de'})")
            expect(options.locator('html')).to_have_attribute('lang', 'de')
            expect(options.locator('#tab-advanced')).to_have_text(h.translate(options, '高级与数据', 'de'))
            expect(options.locator('#advanced')).to_be_visible()
            expect(options.locator('#customUserSelector')).to_have_value('[data-user-pending]')
            expect(options.locator('#customUserSelector')).to_be_focused()
            assert options.evaluate('document.body.scrollWidth<=innerWidth'), 'Options page horizontal overflow'
        run('The standalone options page switches language without closing its active tab or overwriting selector edits', options_page)

        def change_browser_language(h, locale):
            for page in [h.page, h.popup]:
                page.evaluate('''locale=>{
                    Object.defineProperty(navigator,'languages',{configurable:true,value:[locale]});
                    Object.defineProperty(navigator,'language',{configurable:true,value:locale});
                    window.dispatchEvent(new Event('languagechange'));
                }''', locale)

        def dynamic_auto(h):
            expect(h.popup.locator('#language')).to_have_value('auto')
            change_browser_language(h, 'ja-JP')
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'ja'))
            expect(h.popup.locator('html')).to_have_attribute('lang', 'ja')
            expect(h.popup.locator('#tab-general')).to_have_text(h.translate(h.popup, '常用设置', 'ja'))
            expect(h.popup.locator('#language')).to_have_value('auto')
        run('Auto language refreshes the open timeline and popup when the browser language changes', dynamic_auto)

        def dynamic_fixed(h):
            h.set_language('en')
            change_browser_language(h, 'ko-KR')
            expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', 'en'))
            expect(h.popup.locator('html')).to_have_attribute('lang', 'en')
            expect(h.popup.locator('#language')).to_have_value('en')
        run('An explicit language preference stays fixed when the browser language changes', dynamic_fixed)

        for browser_locale, expected in [('en-US', 'en'), ('ja-JP', 'ja'), ('zh-HK', 'zh-TW'), ('pt-BR', 'en')]:
            def automatic(h, expected=expected):
                expect(h.popup.locator('#language')).to_have_value('auto')
                expect(h.ui.locator('.title')).to_have_text(h.translate(h.page, '对话导航', expected))
                expect(h.popup.locator('#tab-general')).to_have_text(h.translate(h.popup, '常用设置', expected))
                assert h.page.evaluate('GTNextI18n.resolve("auto")') == expected
            run('Auto language resolves browser locale ' + browser_locale + ' to ' + expected, automatic, locale=browser_locale)

        result = {'mode': 'Offline local DOM fixtures and shared Chrome storage mock; not a native extension install',
                  'browser': browser.version, 'executedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'passed': sum(row['status'] == 'passed' for row in results),
                  'failed': sum(row['status'] == 'failed' for row in results), 'tests': results}
        suffix = '-filtered' if args.match else ''
        (OUT / ('i18n-browser-results' + suffix + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('RESULT', result['passed'], 'passed,', result['failed'], 'failed', flush=True)
        browser.close()
        return int(result['failed'] > 0)


if __name__ == '__main__':
    raise SystemExit(main())
