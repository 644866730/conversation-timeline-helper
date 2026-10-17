# 第三方代码与致谢

## Reborn14 / ChatGPT Conversation Timeline

项目：https://github.com/Reborn14/chatgpt-conversation-timeline

Copyright (c) 2025 Reborn14。许可：MIT。完整许可保留在 `vendor/reborn14/LICENSE`。

v1.1 起采用上游 `extension/styles-chatgpt.css` 的有效样式规则，整理了注释与空白并将页面主题选择器转换为 Shadow DOM 的 :host。三行预览、圆点状态和长按交互沿用/改编自该项目。快照不声明固定在一个未核实的 Git commit。

v1.3.0 根据用户新要求，撤销了上游的长画布、最小节点间距和外部滑块行为，用新的固定高度、按顺序压缩布局替换。上游样式基准未被修改，运行时在 `src/extras.css` 添加覆盖规则。

本项目不是上游官方升级版，也不是 OpenAI 官方产品；不复用上游图标，不声明双方认可。

## 其他实现和开发依赖

被动 DOM 索引、设置页面、搜索目录和本工程图标由本工程维护，运行时只使用原生 JavaScript/CSS/浏览器 API，无第三方运行库、遥测或字体文件。

开发测试可选使用 Node.js、Python、Playwright 与 Chromium，不随扩展分发其运行库或二进制文件。

之前 v1.2 的网页接口研究曾参考 bujue3709 / GPT-Conversation-Toolkit 的公开实现；已删除该旧版的完整历史读取桥接。本版 MAIN 世界脚本仅承担用户触发的节点定位，不包含完整历史读取逻辑；DOM 选择器相关知识延续使用。参考资料见 `docs/SOURCES.md`，不作为运行依赖。

## 1.4.1 分发名称

本版本的产品名称为「对话时间轴助手」。为兼容旧收藏，内部 gtn 标识及 JSON 备份格式名保持不变。根 LICENSE 中既有版权声明原样保留，不代表继续以其旧工程名对外宣传。
