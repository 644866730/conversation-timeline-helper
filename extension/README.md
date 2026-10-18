# 对话时间轴助手 · 1.4.2

项目介绍、界面预览、贡献流程及完整开发命令见 [仓库首页](../README.md)。

面向最新版 ChatGPT 网页持续适配与更新的非官方对话导航扩展。固定高度、无滑条，顶部是本页已加载过的最旧消息，底部是最新消息；较旧节点会随消息数量增加逐渐压密。

仅观察页面已加载内容，不后台补全历史。点击已加载过的旧节点时，按需尝试恢复网页原生分页/虚拟列表并定位原消息；失败会给出提示，不用缓存正文窗口代替。

## 本次修复

原生图片/附件预览打开时，时间轴暂停交互并让出点击区域；关闭后保持预览前的实际阅读位置，不跳回上一次选择的节点。必要校正最长约 1 秒，新手动动作会终止校正。不后台补全历史；只有主动选择时间轴节点才启动跨页导航。

## 安装与迁移

无需编译。解压并在 chrome://extensions/ 开启开发者模式，选择「加载已解压的扩展程序」，选中包含 manifest.json 的本目录，再刷新 ChatGPT。

本发布源移除了固定开发 ID 的 key，加载后可能成为新扩展。旧版请先导出收藏，再停用旧版、加载新版、导入收藏。不能承诺自动继承不同扩展 ID 下的数据；不要同时启用两个版本。内存索引刷新后重建。

## 文件与构建

运行时只需 manifest.json、src/、popup/、icons/、privacy.html、privacy.css、PRIVACY.md 与许可文件。

商店专用打包：`python tools/package_store.py --output store-upload.zip`。此 ZIP 的 manifest.json 在根目录，并按白名单排除测试和演示文件。安装不需要 Python；只有重新打包才需 Python 3.9+。

完整源码打包：`python tools/package.py`，不要将其替代商店上传包。

开发测试：`npm test`、`python tests/browser_test.py`、`python tests/loaded_browser_test.py`、`python tests/navigation_browser_test.py`、`python tests/preview_browser_test.py`。浏览器测试需 tests/requirements.txt 中的开发依赖以及可用 Chromium。

## 隐私与许可

正文只在当前标签页内存，本地存储仅保存设置及收藏指纹、收藏时间。会话路径和必要交互仅用于本地导航。详见 PRIVACY.md。

部分样式源自 Reborn14 的 MIT 项目；保留 LICENSE、THIRD_PARTY_NOTICES.md 与 vendor/reborn14/LICENSE。本项目不是 OpenAI 或 Reborn14 官方版本。

## 验证边界

本版测试见 docs/TEST_REPORT.md。此前的模拟测试不代表登录后的 ChatGPT 实测。网站结构和灰度差异可能影响识别及换页定位。
