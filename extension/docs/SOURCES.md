# 来源与依据

## 用户指定参考

Reborn14 / ChatGPT Conversation Timeline：
https://github.com/Reborn14/chatgpt-conversation-timeline

上游样式：
https://github.com/Reborn14/chatgpt-conversation-timeline/blob/main/extension/styles-chatgpt.css

上游许可：
https://github.com/Reborn14/chatgpt-conversation-timeline/blob/main/LICENSE

本地有效样式快照从此前交付工程继承；本轮 2026-10-16 重新查看仓库。未核实固定 Git commit，不声明快照与当前文件逐字节一致。新固定密度布局与被动索引在本工程编写，不是上游提供的新版本。

## 官方浏览器资料

Chrome 内容脚本与隔离执行环境（本轮查阅）：
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

Chrome 本地安装与重载流程：
https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world

Chrome storage API：
https://developer.chrome.com/docs/extensions/reference/api/storage

Microsoft Edge 本地加载扩展：
https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading

## 继承的 DOM 研究记录

此前 v1.0–v1.2 的 DOM 识别器研究曾参考以下开发者的一手页面观察；本轮没有把这些记录当作真实账号验收，也不声明站点提供稳定接口：
https://github.com/steipete/oracle/issues/517
https://github.com/steipete/oracle/pull/525/files
https://github.com/mauriziofonte/chat-dump-bookmarklet
https://github.com/bujue3709/GPT-Conversation-Toolkit

v1.4 没有恢复 v1.2 历史请求桥接。新增的 page-navigation.js 只用于明确点击后的虚拟列表定位，不读取完整会话。上述链接均不是运行时依赖。

## 本轮（2026-10-17）

重新查看原仓库、Chrome 内容脚本隔离与消息通信文档、官方本地安装说明，以及 Oracle #517 / #525 的一手 DOM 观察。未登录 ChatGPT 实測，不把开源观察当作网站兼容保证。可选私有列表定位为本工程启发式实现。
