# 对话时间轴助手 · 1.8.1

适用于 ChatGPT 与 Gemini 网页版的非官方对话导航扩展。支持 `chatgpt.com`、`chat.openai.com` 和 `gemini.google.com`。固定高度、无滑条，顶部是本页已加载过的最旧消息，底部是最新消息；较旧节点会随消息数量增加逐渐压密。

仅观察页面已加载内容，不后台补全历史。点击已加载过的旧节点时，按需尝试恢复网页原生分页/虚拟列表并定位原消息；失败会给出提示，不用缓存正文窗口代替。

## 本次修复：目录入口位置

目录入口与时间轴轨道整体下移 64px，避开网页右上角的下载、全屏等原生操作。目录入口与轨道之间保留间距，轨道底部仍距视口 40px。更新扩展后刷新 ChatGPT 和 Gemini 页面即可生效。

## 1.8.0：界面语言切换

在扩展弹窗或独立设置页的「常用设置 → 界面语言」选择简体中文、繁体中文、English、日本語、한국어、Español、Français 或 Deutsch，也可跟随浏览器。语言保存在本地，已打开的 ChatGPT 与 Gemini 时间轴会即时更新，无需因切换语言刷新网页。

设置、消息目录、按钮、无障碍标签、状态提示及 Markdown 导出的说明文字一起切换。聊天正文、搜索词和回复章节原文保持原样，搜索、收藏、章节展开及阅读状态不因语言切换清空。翻译随扩展离线提供，不调用翻译服务、不增加权限。首次更新扩展后仍需刷新网站，加载新脚本。验证范围见 [语言支持说明](docs/LANGUAGE_SUPPORT.md)。

## 1.7.0：Gemini 时间轴

- 为 `gemini.google.com` 接入时间轴、消息目录、搜索、悬停预览、本地收藏、章节导航、密集节点选择、阅读返回和 Markdown 导出，继续只索引当前页面实际加载过的内容。
- Gemini 会话地址识别支持普通 `/app/<会话ID>`、Gem `/gem/<GemID>/<会话ID>` 与 `/share/<分享ID>`，兼容相应 `/u/<账号序号>/` 前缀。`/app` 等没有稳定会话 ID 的页面使用临时收藏。
- Gemini 与 ChatGPT 的收藏作用域隔离，ChatGPT 原有收藏键保持兼容；导入导出仍使用 v1 收藏备份格式。
- Gemini 适配读取页面 DOM，旧消息仅在主动选择后尝试通过原页面滚动恢复。React MAIN 定位助手仍仅在 ChatGPT 注入，不在 Gemini 运行。
- 设置连接状态显示当前平台，自动主题跟随当前网站。API 权限仍只有 `storage`，内容脚本站点访问范围新增 `gemini.google.com`。
- 已在登录后的真实 Gemini 页面临时加载并检查识别、搜索、章节跳转和阅读返回；全部 270 项本地测试通过。原生扩展安装持久化和所有灰度界面仍需使用验收，详情见 [Gemini 支持与验证边界](docs/GEMINI_SUPPORT.md)。

## 1.6.0：长对话实用工具

- **回复章节目录**：在回复下点击「查看章节」，按页面实际 h1–h6 标题定位；标题变更时提示并退回所在回复。每条回复最多显示 64 个标题。
- **密集节点精确选择**：鼠标单击间距不足的圆点区域，先展开附近 10 条消息，逐组选择。键盘聚焦节点后 Enter 仍可直接定位。开始搜索时自动回到完整的当前显示范围。
- **当前列表导出 Markdown**：目录底部「导出」保存当前显示、搜索、收藏或附近消息列表；保留常见标题、代码块、表格等结构。只包含已加载消息，未挂载内容使用纯文本缓存并注明，图片不下载原文件。
- 保持 Soft Utility 风格、storage 权限及 v1 收藏备份格式。正文只有用户主动导出时才写入下载文件。

## 1.5.0：Soft Utility 与阅读返回

- 按 [StyleKit 柔和工具风](https://www.stylekit.top/zh/styles/soft-utility) 统一时间轴、消息目录、悬浮预览、设置弹窗、独立设置页与隐私页。深青主色、雾绿底色、柔和状态色，支持深浅色与减少动态效果。
- 页面内新增可见的「目录」按钮；关闭目录后焦点返回入口。
- 搜索结果显示关键词附近的上下文并安全高亮，支持 ↑ / ↓ / Home / End 选择结果、Enter 定位。
- 新增「返回阅读处」，保存最近最多 20 次主动跳转前的消息与相对偏移。仅存当前标签页内存，切换会话、重建索引或关闭扩展后清空。
- 搜索筛选时复用时间轴节点，减少重建；Windows 生成的嵌入样式与独立 CSS 字节一致。
- 权限仍为 storage，收藏备份格式仍为 v1。

## 预览位置保护

原生图片/附件预览打开时，时间轴暂停交互并让出点击区域；关闭后保持预览前的实际阅读位置，不跳回上一次选择的节点。必要校正最长约 1 秒，新手动动作会终止校正。不后台补全历史；只有主动选择时间轴节点才启动跨页导航。

## 安装与迁移

无需编译。解压并在 Edge 的 edge://extensions/ 或 Chrome 的 chrome://extensions/ 开启开发者模式，选择「加载已解压的扩展程序」，选中包含 manifest.json 的本目录，再刷新 ChatGPT 或 Gemini。更新已有版本后，两平台已打开的标签页都需要刷新；浏览器可能要求确认新增 Gemini 站点访问。

本发布源移除了固定开发 ID 的 key，加载后可能成为新扩展。旧版请先导出收藏，再停用旧版、加载新版、导入收藏。不能承诺自动继承不同扩展 ID 下的数据；不要同时启用两个版本。内存索引刷新后重建。

## 文件与构建

运行时只需 manifest.json、src/、popup/、icons/、privacy.html、privacy.css、PRIVACY.md 与许可文件。

商店专用打包：`python tools/package_store.py --output store-upload.zip`。此 ZIP 的 manifest.json 在根目录，并按白名单排除测试和演示文件。安装不需要 Python；只有重新打包才需 Python 3.9+。共享配色维护在 `src/theme.css`，修改后运行 `npm run styles` 更新注入样式。

完整源码打包：`python tools/package.py`，不要将其替代商店上传包。

开发测试：`npm test`、`python tests/browser_test.py`、`python tests/loaded_browser_test.py`、`python tests/navigation_browser_test.py`、`python tests/preview_browser_test.py`、`python tests/gemini_browser_test.py`、`python tests/i18n_browser_test.py`。浏览器测试需 tests/requirements.txt 中的开发依赖以及可用 Chromium。

## 隐私与许可

正文只在当前标签页内存，本地存储仅保存设置及收藏指纹、收藏时间。会话路径和必要交互仅用于本地导航。详见 PRIVACY.md。

部分样式源自 Reborn14 的 MIT 项目；保留 LICENSE、THIRD_PARTY_NOTICES.md 与 vendor/reborn14/LICENSE。本项目不是 OpenAI、Google 或 Reborn14 官方版本。

## 验证边界

平台机制与已知限制见 docs/COMPATIBILITY.md，当前版本的验收范围以实际测试记录为准。docs/TEST_REPORT.md、docs/SOFT_UTILITY.md 与 docs/READING_TOOLS.md 分别保留历史版本记录。此前的本地模拟测试，以及查看已登录 Gemini 页面结构，都不能视为两平台全部真实场景已完成验收；网站结构和灰度差异可能影响识别及换页定位。

## 发布者与联系

公开发布者：GuanChanghao。支持与隐私联系：NikieRamamonjisoa@gmail.com。

[产品网站](https://644866730.github.io/conversation-timeline-helper/) · [隐私政策](https://644866730.github.io/conversation-timeline-helper/privacy.html) · [使用与支持](https://644866730.github.io/conversation-timeline-helper/support.html)。源码公开不代表已通过 Edge Add-ons 或 Chrome 网上应用店审核。
