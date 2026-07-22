# CURRENT_TASK.md — 当前任务

> 【交接铁律】每完成一步，必须更新 `TASKLOG.md`、`CHANGELOG.md`、`CURRENT_TASK.md`、`NEXT_STEP.md`、`DECISIONS.md`、`CURRENT_PROGRESS_AUDIT.md`，再 commit + push。换对话框时，新对话框先读 `EXECUTION_PROTOCOL.md` + 这些文件 + 桌面 Handoff 文件即可接手。

> 最新更新：2026-07-22

## 当前阶段：让工作台从“只会指路”变成“真会干活”

## 上线硬骨头

- [x] 硬骨头1：陌生机器不崩。启动路径改为缺依赖降级，config/data/logs/evidence 首次运行自动创建，18800/Hermes/OpenClaw/端口异常统一返回中文未就绪状态；自动验收证据见 `verification/clean-machine/summary.json`。
- [x] 硬骨头2：共享 key 落地。18800 网关支持共享托管 key 兜底，员工和前端只使用本机占位 token；验收证据见 `verification/shared-key/summary.json`。
- [ ] 硬骨头3：能下载能安装。3A 已生成候选包但预验收未通过；修复后重跑 3A，3A 通过并经产品负责人批准后才进入 3B：GitHub Release 正式发布并生成唯一下载链接。

## 当前口径校准

- `TASKLOG.md` 已作为任务总账本补齐，后续任务必须同步更新。
- `EXECUTION_PROTOCOL.md` 已作为 GPT / Codex / Claude / 其他执行助手的强制必读协议补齐，所有大任务必须单一主线、分段执行、真实验收、失败也留痕。
- `verification/model-router/summary.json` 当前不存在，也不应补假文件；它对应尚未执行的“模型分层/模型路由”任务。
- 统一模型入口的真实验收产物是 `verification/unified-model-proxy/summary.json`。
- 模型分层、手机端、情报流水线暂不抢跑，等上线最小集前三条稳定后继续。
- 3A-R1 最新结论：failed。安装器 `/S /currentuser` 只复制自身到 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe`，没有创建真实安装目录、卸载器或卸载注册表项。
- 3A-R1.2 最新结论：local passed / Actions failed。已确认安装包 payload 有效，根因是默认 per-user 安装目录在当前中文用户名环境下没有稳定落盘；已通过 `build/installer.nsh` 固定默认安装目录为 `%LOCALAPPDATA%\Programs\AIWorkbench`，并新增 `scripts/verify-nsis-install.mjs`。本地 `npm.cmd run verify:install-release` 已通过，证据见 `verification/install-release/repair1-2-summary.json` 和 `verification/install-release/preflight-summary.json`。GitHub Actions Run `29920336923` 已真正执行 preflight，但最终仍 failure；当前 `gh` token invalid，日志 403、artifact 下载 401，无法读取云端失败详情。
- 3A-R1.3 最新结论：pending。GitHub CLI 已恢复并读取 Run `29920336923` artifact；根因是 `package.json` 写死 `build.electronDist=node_modules/electron/dist`，Actions 环境中该目录不存在，electron-builder 未产出安装包。已做最小修复，等待新 Actions run 真实结果。证据见 `verification/install-release/repair1-3-summary.json` 和 `verification/install-release/repair1-3-report.md`。
- `shared_managed` 生产注入仍为 blocked，本轮不处理、不冒充 passed。

## 明天路线图（2026-07-19）

- 战术优化：模型分层调用。理解、编排、关键决策用好模型；执行琐事、格式整理、重复查询用便宜模型，降低长期运行成本。
- 待办：OpenClaw 稳定性体检。当前健康检查频繁不可用，需要确认安装路径、CLI 状态、gateway/channel 状态和最小执行链路。
- 2026-07-20 结论：OpenClaw gateway 问题已定位到 runtime 残留状态。清理 `.openclaw`/`%TEMP%\openclaw` 下 lock/tmp/browser profile 残留后，直接 Node 入口启动 gateway 可在第 26 秒监听 `127.0.0.1:18789`；主配置未改。
- 2026-07-22 结论：共享 key 已收敛到 18800 服务端读取，优先使用用户本机 `DEEPSEEK_API_KEY`，缺失时使用 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`；`/health` 只暴露来源类型，不暴露 key。

### 路线图

1. 阶段1：桌面端执行闭环
   - 聊天入口能理解用户目标，并把“打开、查看、安装、清理”等电脑动作派给员工真实执行。
   - 优先清理欠账：体验三件套、版本管理落地、动作路由盲区。
2. 阶段2：手机App产品落地
   - 自建 iOS App，保留一个自然语言入口。
   - 通过电脑通道连接桌面工作台，让手机指令可以驱动电脑侧执行。
   - 建立双端更新机制，保证手机端和电脑端状态、任务、记忆同步。
3. 阶段3：生态扩展
   - 扩展技能/员工生态，让常用岗位能力和工具能力可复用。
   - 扩展多通道接入，把微信、飞书、Telegram、QQ、抖音、小红书等入口收束到同一个工作台。
   - 继续坚持功能内置化，用户只看见一个页面。

### 今天完成
- [x] 创建 GitHub 仓库 AI-Workbench
- [x] 建立四个基础文档（README / PRODUCT / PRINCIPLES / CURRENT_TASK）
- [x] Codex CLI 恢复正常工作
- [x] 按 `Codex任务卡_MVP工作台.md` 完成最小闭环：发指令 → 系统留痕 → 展示进度
- [x] 新增 React + Tailwind 本地网页
- [x] 新增 Node 本地 API，数据写入 `data/workbench.json`
- [x] 完成四个页面：首页、聊天页、任务状态页、历史记录页
- [x] 实现失败任务必须填写失败原因的强制规则
- [x] 新增 `CONTEXT.md` 作为项目最新基准文件
- [x] 新增 `VISION.md` 作为长期构想备忘录
- [x] 新增 `CHANGELOG.md` 记录 v0.1.0
- [x] 修复 Windows 下 `npm run dev` 一键启动问题
- [x] 新增自动验证脚本 `npm run verify`
- [x] v0.1.1 扩充显示面板：模型连接状态、用户偏好、存储状态、系统错误日志
- [x] 新增 DeepSeek API 连接测试入口
- [x] 打 `v0.1.1-stable` 备份标签并推送，作为大改前稳定回退点
- [x] v0.2.0 收缩为聊天中心界面，取消四个独立 tab
- [x] 新增 DeepSeek 聊天自动提炼：从自然语言识别今日目标、任务和偏好
- [x] 修复对话持久化：支持连续对话、标题推导和会话恢复
- [x] 上线通用搜索能力：DeepSeek 可通过工具调用执行实时联网搜索
- [x] 修复失败任务留痕体验：标记失败时自动生成失败原因，用户可再编辑
- [x] 优化任务列表视觉区分：任务卡片显示负责人、日期和短 ID
- [x] 完成 Hermes v0.17.0 安装收尾：清理重复 WSL 发行版，验证 Playwright Chromium 可运行，读取并归档 doctor 结果
- [x] 记录 Agent 双引擎、云端部署和 7x24 运行构想到 `VISION.md`
- [x] 停止 Hermes gateway，清理 `auth.lock` 和 `logs\.__agent.lock` 问题
- [x] 以普通 Windows 用户身份重新运行 `hermes doctor`，确认 lock 相关报错已消失
- [x] 完成 Hermes DeepSeek 最小对话验证：`deepseek-chat` 可正常回复
- [x] 完成 Hermes 四项实测：正式对话成功、联网回答成功、跨会话记忆未生效、文件读取 `CURRENT_TASK.md` 未成功
- [x] 完成 B 类 4 项遗留任务：视觉细节 5 项、开机自启动、Hermes 记忆可用确认、Hermes 文件读取能力修复

### 当前问题清单
- [x] P0：聊天→执行链路接通；理解层根治
- [ ] P1：聊天自愈/JSON崩溃消化/失败主动解释
- [x] P2：回复排版/右键粘贴/菜单栏中文化或隐藏
- [x] P3：电脑与冰灵代理体检
- [ ] P4：版本管理落地，避免安装包输出、版本号和验收记录分散
- [ ] P5：动作路由补盲，覆盖终端、文件夹、设置页和任意已安装应用

### 执行顺序
1. P0 与 P3 并行：已完成
2. P1
3. P4：版本管理落地优先清理
4. P5：动作路由补盲

### 本次改动文件
- `CONTEXT.md`：项目基准文档，供后续 GPT / Codex / Claude 新对话同步上下文
- `VISION.md`：构想备忘录，存放暂不进入执行排期的长期想法
- `CHANGELOG.md`：版本变更记录，记录 v0.1.0 功能、已知问题和下一步方向
- `package.json` / `package-lock.json`：项目脚本与依赖
- `index.html` / `vite.config.js` / `tailwind.config.js` / `postcss.config.js`：前端工程配置
- `server.mjs`：本地 JSON 存储 API
- `scripts/dev.mjs`：同时启动 API 与 Vite 开发服务器，兼容 Windows
- `scripts/verify.mjs`：自动验证本地持久化、失败原因必填规则、存储状态和无 API Key 错误日志
- `src/main.jsx` / `src/styles.css`：聊天中心工作台页面与样式
- `.gitignore`：忽略依赖、构建产物、本地缓存、运行数据和本地日志
- `hermes-doctor-2026-07-16.txt`：Hermes doctor 健康检查原始输出，用于后续排查配置问题
- `hermes-doctor-2026-07-17.txt`：lock 修复后的 Hermes doctor 输出，用于确认权限报错消失

### 验证结果
- [x] `npm.cmd install --cache .npm-cache`
- [x] `npm.cmd run build`
- [x] `node --check server.mjs`
- [x] API 校验：无失败原因的失败任务返回 400
- [x] 新增 `npm run verify`，自动校验 JSON 持久化和失败原因必填规则
- [x] `npm.cmd run dev` 可启动 API 与 Vite，本地访问地址为 `http://127.0.0.1:5173`
- [x] `npm run verify` 覆盖无 API Key 时的系统错误日志写入
- [x] DeepSeek API 真实调用已接入聊天自动提炼
- [x] Hermes doctor 输出已读取：主体安装可用，剩余为 `.env`、config、API key 和 lock 权限配置问题
- [x] `.wsl-cache/` 和 `.wsl/` 已加入 `.gitignore`，避免 Ubuntu 安装包和 WSL 运行目录进入项目文件监控/版本库
- [x] 2026-07-17 `hermes doctor` 退出码为 0，未再出现 `Permission denied`、`auth.lock`、`.__agent.lock` 或 `Logging error`
- [x] Hermes 首次正式对话：对“你好，请介绍一下你自己。”能正常介绍自身，显示当前连接模型为 DeepSeek Chat
- [x] Hermes 联网测试：对“今天的 AI 新闻”给出 3 条新闻和来源链接，但同时提示 Firecrawl API Key 未配置
- [x] Hermes 记忆测试：已确认正确用法为 `hermes chat -q "..." --toolsets memory,terminal`，内置 memory 可用
- [x] Hermes 文件执行测试：已修复 terminal backend 命中默认 WSL 的路径问题；Hermes 可读取 `F:\AI-Workbench\CURRENT_TASK.md` 并总结待办
- [x] 开机自启动验证：Windows 登录启动项已创建，后台脚本可拉起 API 与 Vite，本地访问 `http://127.0.0.1:5173`
- [x] 视觉细节验证：完成中文侧栏、版本徽标、正规图标、hover 时间戳和移动端对话入口
- [x] OpenClaw runtime 深挖：`npm.cmd run openclaw:runtime-deep-dive` 直调 Node 入口，备份并清理 lock/tmp/browser/devices/cron 残留后，gateway 成功监听 `127.0.0.1:18789`
- [x] 共享 key 验收：`npm.cmd run verify:shared-key` 在无 `DEEPSEEK_API_KEY` 的临时环境下通过共享托管 key 调通 18800，确认 health、日志和进程输出不泄露 key

### 下一步
1. 上线硬骨头3：打安装包并挂 GitHub Release，只给用户一个下载链接。
2. 对失败和卡壳场景补齐自愈、重试和人话解释。
3. 模型分层、手机端、情报流水线暂不抢跑。

## 任务记录规则

- 每完成一个功能，在 tasks/ 下记一条
- 文件名格式：`YYYY-MM-DD-功能名.md`
- 内容：做了什么 + 为什么这样做 + 下次改进方向
