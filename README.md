# ChatGPT-Auto-Save
既然是基于开源项目改版，在 README 中明确致谢并保留原作者的版权声明是非常重要的开源礼仪，同时也符合 MIT 协议的要求。

我已经修改了 README 文件，在显眼位置添加了致谢声明，并调整了部分措辞以体现你的改版工作。你可以直接复制使用。

🤖 ChatGPT Auto Backup & Exporter (Beta)

![alt text](https://img.shields.io/badge/version-2025.12.12-blue)
![alt text](https://img.shields.io/badge/Manifest-V3-green)
![alt text](https://img.shields.io/badge/license-MIT-orange)

Power By Raymond
这是一个基于 Chrome Extension V3 架构的增强版插件，用于自动备份、导出和恢复 ChatGPT 对话记录。

![alt text](screenshots/preview.png)


🤝 致谢与声明 (Credits)

本项目基于 ChatGPT_Exporter (Author: zjt666666zjt) 进行二次开发与改版。

遵循 MIT License 开源协议，本项目在原版基础上进行了以下改进：


自动备份重写：增加了基于 time.is 的网络时间校准和后台静默备份逻辑。

导入功能：新增了实验性的对话恢复/导入功能。

交互优化：增加了页面悬浮窗状态显示、防误触关闭保护等。

感谢原作者提供的优秀基础代码！

✨ 核心功能 (Features)

📤 多格式导出：支持一键导出对话为 JSON (兼容官方格式), Markdown, HTML。

🔄 智能自动备份：

支持自定义备份间隔（1分钟 - 7天）。

精准计时：引入网络时间校准，避免本地系统时间错误导致备份混乱。

静默运行：仅在打开 ChatGPT 页面时触发，不占用后台资源。

📥 实验性导入/恢复：

支持将备份的 JSON/MD/HTML 文件重新“导入”回 ChatGPT。

原理：自动创建新对话并以文件形式上传上下文，模拟人类操作。

🏢 Team 团队版支持：支持指定 Workspace ID，完美适配 ChatGPT Team 账号。

🛡️ 安全与防护：

防手滑机制：可开启“关闭页面前提醒”，防止长对话生成中断或数据未保存。

本地存储：所有进度、设置和 Token 处理均在本地浏览器完成，不上传服务器。

🎨 沉浸式 UI：带有流光背景的 Popup 面板及页面右下角的状态悬浮窗。


📖 使用说明 (Usage)
1. 手动导出

打开 ChatGPT 网页。

点击浏览器右上角的插件图标。

选择 导出 (Export) 面板。

选择需要的格式 (JSON/MD/HTML) 和范围 (全部/最近 N 条)。

点击 "开始导出"。

2. 配置自动备份

在插件 Popup 界面底部，开启 "自动备份" 开关。

点击 "设置" (Settings) 选择备份间隔（例如：每 1 天）。

当你在浏览器中打开 ChatGPT 时，插件会自动检查上次备份时间，并在后台静默执行备份。

页面右下角会出现一个 悬浮窗，显示下次计划备份的时间。

3. 导入对话 (恢复)

切换到 导入 (Import) 面板。

点击区域选择文件（支持批量）。

点击 "开始导入"。

⚠️ 重要提示：导入过程通过模拟用户点击完成，脚本会自动操作输入框和发送按钮。请保持网页在前台，且不要操作鼠标，直到提示“全部完成”。

🛠️ 项目结构

manifest.json: V3 配置文件。

popup.html / popup.js: 插件主界面（毛玻璃 UI）。

background.js: 后台服务 worker，负责定时任务调度。

content.js: 消息中转站。

injected.js: 核心逻辑。注入页面环境，负责拦截 Token、DOM 操作及数据获取。

ui.js: 页面内的悬浮状态窗代码。

jszip.min.js: 用于打包 ZIP 文件。

⚠️ 免责声明 (Disclaimer)

数据隐私：本插件运行在您的本地浏览器中，不会将您的对话数据或 Token 发送到任何第三方服务器。

使用风险：

导入功能涉及模拟用户操作，频繁使用可能会触发 OpenAI 的速率限制 (429)。

请勿过度使用自动备份功能（如设置为每1分钟），以免对服务器造成不必要的负担。

责任限制：开发者不对因使用本工具导致的账号限制或数据丢失承担责任。请遵守 OpenAI 的服务条款。

📄 许可证 (License)

本项目遵循 MIT License。

这意味着您可以自由地使用、复制、修改和分发本项目，但必须保留原作者的版权声明和许可声明。

Original Project: ChatGPT_Exporter © zjt666666zjt
Modifications: © 2025 Raymond

(English Summary)

🤖 ChatGPT Auto Backup & Exporter

An enhanced version based on ChatGPT_Exporter.

Enhancements

Redesigned UI: Glassmorphism style.

Auto-Backup: Silent background backups with network time synchronization (time.is).

Restore/Import: Experimental feature to re-upload chats.

Safety: Prevent accidental tab closing.

License

MIT License.
Based on work by zjt666666zjt. Modified by Raymond.
