# v1.5.0 · Soft Utility 界面更新

本文记录 v1.5.0；后续 v1.6.0 新增的章节、密集节点选择和 Markdown 导出见 [长对话实用工具](READING_TOOLS.md)。

日期：2026-11-16。

视觉参考：[StyleKit 柔和工具风](https://www.stylekit.top/zh/styles/soft-utility)。本次采用其深青 #2d5b63、雾绿 #f4f8f6、墨青 #203b40、薄荷 #a9d8cc，以及 12–16px 圆角、最高 600 字重、约 200ms 颜色过渡。深色模式为本项目的适配；没有加载远程字体或增加运行时依赖。

## 实际完成

- 时间轴、目录、搜索结果、收藏状态、提示、预览、设置弹窗、独立设置页、隐私与安装说明采用统一风格。
- 新增页面内带文字的「目录」入口和焦点恢复。
- 搜索显示命中词附近片段，安全高亮多个关键词；方向键选择、Enter 定位。
- 主动跳转后可返回阅读处，最多保存 20 个临时锚点，保留消息内偏移，切换会话与停用后清空。
- 搜索筛选不再重建整条轨道；Windows 样式生成保证嵌入 CSS 与独立 CSS 完全一致。
- 常用设置在 400 × 592px 弹窗内可见，独立设置页适应窄窗口。

维持 storage 权限及 v1 收藏备份格式。跨会话收藏库、回复内标题和章节整理保留在后续建议中，没有计入本次完成项。

## 维护入口

共享配色在 `src/theme.css`；内容脚本的结构样式在 `src/shell.css` 与 `src/extras.css`；弹窗和独立设置页共用 `popup/popup.css`。

修改注入样式后执行 `python tools/sync_styles.py`。`vendor/reborn14/` 是原始许可和参考快照，保持原样。

## 实际验证

| 测试组 | 通过 | 失败 |
| --- | ---: | ---: |
| Node 核心、几何、索引、清单、搜索片段 | 95 | 0 |
| 通用浏览器回归与新增交互 | 61 | 0 |
| 被动加载与密集节点 | 24 | 0 |
| 真实隔离世界边界下的本地分页与取消 | 23 | 0 |
| 图片 / 附件预览保护 | 27 | 0 |
| 合计 | 230 | 0 |

测试浏览器：Chromium 153.0.8010.12。测试使用本地 DOM 模拟与 Chrome API mock；分页测试覆盖 MAIN/ISOLATED 世界边界，没有使用登录后的真实 ChatGPT 账号。新增阅读返回测试验证嵌套滚动容器的相对位置恢复，容差 3px。

各组详细记录在 `tests/results/` 中。`docs/TEST_REPORT.md` 保留为 v1.4.2 的历史说明；本版结论以本文和最新测试记录为准。

可复现命令（浏览器测试需安装开发依赖）：

```text
npm test
python -X utf8 tests/browser_test.py --chromium <Chromium 路径>
python -X utf8 tests/loaded_browser_test.py --chromium <Chromium 路径>
python -X utf8 tests/navigation_browser_test.py --chromium <Chromium 路径>
python -X utf8 tests/preview_browser_test.py --chromium <Chromium 路径>
```

本次已通过 ego-browser 查看用户指定的设计参考与本地演示；它提示有可用的 Ego Lite 更新，本次未升级浏览器。
