# 测试结果说明

当前 v1.8.0 的成功结果为：`node-results.txt`、`browser-results.json`、`loaded-browser-results.json`、`navigation-all-results.json`、`preview-results.json`、`gemini-browser-results.json`、`i18n-browser-results.json`。共 300 项，范围和限制见 `../../docs/LANGUAGE_SUPPORT.md`。

浏览器测试使用真实 Chromium 渲染和本地 DOM/Chrome API 模拟。当前运行时源文件与已验收 1.8.0 保持一致，本次仓库同步另外在克隆目录重跑了 116 项 Node 检查；没有把已有浏览器结果描述为本次在 Edge 原生重新安装后的验收。

本目录中保留的 `navigation-all-partial.json`、`preview-baseline-results.json`、`store-package-results.json` 是仓库既有的历史/基线或旧包记录，不代表 1.8.0 追加验收，不应累加。失败截图不是发布资料；本次没有从开发目录复制它们。
