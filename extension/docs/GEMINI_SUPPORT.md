# v1.7.0 · ChatGPT 与 Gemini 双平台时间轴

日期：2026-11-16。

## 功能

同一扩展在 `gemini.google.com` 提供与 ChatGPT 相同的固定高度时间轴、消息目录、悬停预览、已加载内容搜索、本地收藏、回复章节导航、密集节点选择、返回阅读处和当前列表 Markdown 导出。继续使用 Soft Utility 风格，跟随 Gemini 的浅色/深色主题。

原 ChatGPT 功能继续保留，ChatGPT 的已有收藏键和 v1 备份格式没有迁移要求。Gemini 与 ChatGPT 的收藏作用域隔离。显示范围、位置、主题和快捷键设置由同一扩展共用。

## Gemini 适配依据

本次通过 ego-browser 检查已登录 Gemini 的真实 DOM，观察到：

- 每轮 `.conversation-container[id]` 包含独立的 `user-query` 和 `model-response`。
- 提问正文在 `.query-text`，助手正文在 `message-content` 或 `.markdown-main-panel`。
- 真正滚动的区域是 `infinite-scroller[data-test-id="chat-history-container"]`；外侧 `#chat-history` 可能只是 overflow:hidden 容器。
- `body.light-theme` 和 `body.dark-theme` 表示当前主题。
- `user-query-content-N` 是局部编号，不能作为持久身份。稳定轮次容器 ID 与角色用于区分提问和回复。
- `.cdk-visually-hidden.screen-reader-user-query-label` 包含一份提问副本，需要从正文、章节和导出中过滤。

还参考了 [Reborn14 的 Gemini 适配脚本](https://github.com/Reborn14/chatgpt-conversation-timeline/blob/main/extension/content-gemini.js) 中公开的气泡和滚动容器选择器；现有工程对上游的许可声明继续保留。此次没有把该项目的完整运行脚本另行注入，也没有增加第三方运行依赖。

## 导航和生命周期

Gemini 只运行 ISOLATED DOM 脚本。ChatGPT 的 React MAIN 定位助手仍仅匹配 ChatGPT 的两个域名，Gemini 不发送 MAIN seek 请求。

消息已挂载时直接在内部滚动区定位；已观察旧消息暂时卸载时，仅在用户主动选择后按实际顺序滚动，等待网站原生加载并核对目标。页面没有加载过的历史不会在空闲时补齐，无法恢复时显示可取消/重试提示。

新对话从 `/app` 获得 `/app/<id>`，或从 `/gem/<GemId>` 获得完整会话路径时，允许已经挂载的首条提问继续建立索引。稳定会话之间切换仍会抑制旧 DOM，避免把上个会话内容混入新会话。

普通会话、Gem 会话和分享地址均可识别稳定作用域，兼容 `/u/<数字>/` 前缀；地址识别不等于所有分享页/地区/账号灰度布局均完成真机验收。

## 实际验证边界

真实已登录 Gemini 页面进行了**临时隔离世界加载**验证：

- 正确识别一条提问、一条回复和五个真实章节，问答目标独立。
- 正确选择内部 infinite-scroller。
- 点击真实回复章节后滚动到对应位置；返回后恢复原阅读 scrollTop，实测误差不超过 3px。
- 搜索已加载正文得到对应命中，并显示高亮。
- 修正后的提问文本与实际可见 `.query-text-line` 一致，没有屏幕阅读器副本。

这一验证使用内存中的 Chrome API mock，没有在用户浏览器持久安装签名扩展，也没有发送新消息或修改原聊天。真实收藏的浏览器重启持久化、所有账号灰度、Gem/分享页面、未知媒体预览器和完整超长历史恢复仍需实际使用验收。

本地测试环境为 Chromium 153.0.8010.12。全部 270 项通过：

| 测试组 | 通过 | 失败 |
| --- | ---: | ---: |
| Node 核心、平台与作用域、安全边界、清单等 | 104 | 0 |
| 通用浏览器与设置平台状态 | 66 | 0 |
| 已加载索引与密集轨道 | 24 | 0 |
| 原生分页 / MAIN 与 ISOLATED 隔离边界 | 25 | 0 |
| 图片和附件预览保护 | 27 | 0 |
| Gemini 专项 | 24 | 0 |
| 合计 | 270 | 0 |

Gemini 专项覆盖消息识别、排除侧栏/草稿/工具栏/屏幕阅读器副本、流式生成、Angular 节点重用、收藏隔离、主题、嵌套滚动与返回、章节、Markdown 下载、原生 dialog 预览及普通菜单。新增检查同 DOM 的首次会话地址升级，以及已加载旧消息卸载后通过顶部主动滚动重新挂载，确认不会调用 MAIN 助手。详细记录见 `tests/results/gemini-browser-results.json`。

`demo/gemini.html` 使用纯合成内容展示 Gemini 类似结构。`docs/gemini-demo-panel.png` 也仅含合成示例，没有真实账号聊天正文。350px 宽窗口检查中目录位于屏幕内，没有横向溢出。

## 安装与检查

1. 使用新版安装包，或在扩展管理页重新加载原来的源码目录。
2. 如浏览器要求新增站点访问，启用 `gemini.google.com`。
3. 刷新 Gemini，页面边缘的「目录」打开消息导航。

API 权限仍只有 `storage`；站点范围明确增加 Gemini。没有增加 Cookie、history、debugger 或全站访问权限。更新后同时刷新已有 ChatGPT 标签页。

维护入口：`src/adapter.js` 管理平台 DOM，`src/core.js` 管理平台与作用域，`src/navigation.js` 保持主动导航和取消边界，`src/preview-guard.js` 复用同一消息选择器。Gemini 测试可通过 `npm run test:gemini -- --chromium <路径>` 运行。
