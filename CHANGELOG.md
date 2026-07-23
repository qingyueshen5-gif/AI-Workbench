# CHANGELOG

## Unreleased - 上线硬骨头3A：总验收

- 新增 `scripts/verify-3a-final.mjs`，执行 ③A 总验收：候选安装包真实安装、快捷方式检查、安装版后端启动、生产 Managed Proxy 对话、中文降级、安全扫描、真实卸载和恢复日常安装版。
- 新增 `verification/3a-final/summary.json`、`verification/3a-final/report.md`、`verification/3a-final/production-dialogue.log`、`verification/3a-final/security-scan.log` 和 `verification/3a-final/app-launch.log`。
- ③A 总验收 passed：候选包来自 Actions Run `30001627121` artifact，文件名 `AI-Workbench-Setup-v0.4.6-x64.exe`，SHA256 `b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 无本机 `DEEPSEEK_API_KEY` / shared key 环境下，安装版通过 `managed_remote` 生产链路返回 `③A总验收通过`。
- 安全扫描 passed：源码、安装器、安装目录可行动项、运行目录和进程命令行均未发现真实 key；Electron/Chromium 第三方运行时二进制命中已单独归类为误报噪声。
- 本轮未创建 GitHub Release，未创建正式 tag；下一步必须等待产品负责人明确批准后，才可进入 ③B 正式 Release。

## Unreleased - 上线硬骨头3A-R2.1：Cloudflare 生产部署与真实验证

- 部署 `managed-proxy/` 到 Cloudflare Workers：`https://ai-workbench-managed-proxy.qingyueshen5.workers.dev`。
- 创建并绑定 D1 数据库 `aiw-managed-proxy`，真实 `database_id` 为 `202583b9-817f-4115-9ab1-41e136133de8`，`installations`、`daily_usage`、`revoked_tokens` 三张表已执行 schema 并读写通过。
- 通过 Cloudflare Secret 配置 `DEEPSEEK_API_KEY`、`TOKEN_SIGNING_SECRET`、`INSTALLATION_HASH_SALT`；Secret 值未写入仓库、本机 `.env`、日志或命令行。
- `model-proxy.mjs` 内置公开生产 Worker URL 作为安装版默认 Managed Proxy URL；本机 `DEEPSEEK_API_KEY` 仍优先，安装版禁止回退本机 shared key 作为生产方案。
- 真实生产验证 passed：无本机 Key 的 18800 和安装版均通过生产 Worker 调用 DeepSeek，返回 `生产共享模型调用成功`。
- 刷新、吊销、单实例限流、单 IP 限流、全局限流、预算限额、紧急关闭/恢复、中文降级和安全扫描均通过。
- 未创建 GitHub Release，未创建 tag，未进入 ③A 总验收或 ③B。

## Unreleased - 上线硬骨头3A-R2.1：Managed Proxy 机制落地

- 新增 `managed-proxy/` Cloudflare Workers 服务骨架，包含 `/health`、`/v1/models`、`/v1/install/register`、`/v1/install/refresh` 和 `/v1/chat/completions`，真实 DeepSeek key 只通过 Worker Secret 读取。
- `model-proxy.mjs` 新增远程 `managed_remote` 模式：安装版无本机 key 时可指向远程 Managed Proxy，首次运行生成安装实例 ID，获取短期实例 token，并用 Windows DPAPI 保存 token。
- `electron/main.cjs` 启动子 Node 进程时传入 `AIW_PACKAGED`，安装版不会再回退读取本机 shared key 作为生产方案。
- 新增 `scripts/verify-managed-proxy-production.mjs` 和 `verification/managed-proxy-production/summary.json`，本地 mock 证明 18800 -> Managed Proxy 机制链路、注册/转发/token 保存和日志脱敏均通过。
- 本轮总状态仍为 `blocked`：真实 Cloudflare Worker、D1、Secrets、生产 URL 和 DeepSeek 上游生产调用未执行，不能进入 3A 总验收或 3B Release。

## Unreleased - 上线硬骨头3A-R2.0：共享 Key 架构核验

- 新增 `research/managed-proxy-production-plan.md`，锁定正式生产架构：客户端/Workbench/Hermes/OpenClaw -> 本机 `127.0.0.1:18800` -> AI Workbench 自控远程 Managed Proxy -> DeepSeek 官方 API。
- 新增 `verification/managed-shared-key/architecture-summary.json` 和 `verification/managed-shared-key/architecture-report.md`，记录 `shared_managed` 当前阻塞、mock 边界、真实 key 安全边界和 R2.1 外部条件。
- 新增 `tasks/2026-07-24-上线硬骨头3A-R2.0-共享Key架构核验.md`，记录本轮只做架构核验，不改代码，不进入 Release/首屏示例/模型分层。
- 明确真实 DeepSeek key 只能存在远程服务端 Secret，禁止进入安装包、用户电脑、本机 `.env`、环境变量、日志或进程参数。
- 正式拒绝“Key 随包分发 + 消费限额”方案；限流、预算、紧急关闭统一放在远程 Managed Proxy。
- 下一次唯一主线更新为 `③A-R2.1：实现远程 Managed Proxy 并做真实生产注入验证`。

## Unreleased - 今日收尾与产品距离核验

- 新增 `verification/daily-closeout/summary.json` 和 `verification/daily-closeout/report.md`，记录 2026-07-23 今日收尾、真实任务状态和产品距离核验。
- 新增 `tasks/2026-07-23-今日收尾与产品距离核验.md`，记录本轮只做收尾、不开发新功能、不进入 R2/3B。
- 复核本机 v0.4.6 安装版已恢复并保留：安装目录为 `%LOCALAPPDATA%\Programs\AIWorkbench`，桌面和开始菜单快捷方式已指向当前安装目录，安装版 smoke-test 退出码 0，用户数据未删除。
- 修正 `LAUNCH.md`、`CURRENT_TASK.md`、`NEXT_STEP.md`、`TASKLOG.md`、`CURRENT_PROGRESS_AUDIT.md` 和 `AI-Workbench-Handoff.md` 中关于 3A-R1.3 的旧口径：Run `29935231224` 已真实 success，3A-R1.3 已通过。
- 保持真实边界：`shared_managed` 生产注入仍为 blocked，GitHub Release 和唯一下载链接尚未完成，硬骨头3不能标记完成。

## Unreleased - 上线硬骨头3A-R1.3：Actions 云端预验收阻塞记录

- 新增并更新 `verification/install-release/repair1-3-summary.json` 和 `verification/install-release/repair1-3-report.md`，记录 R1.3 从 GitHub CLI/Git 凭证阻塞恢复到云端构建根因定位。
- 新增 `tasks/2026-07-22-上线硬骨头3A-R1.3-Actions云端预验收.md`，记录本轮执行、阻塞原因和恢复后的下一步命令。
- 已下载并读取 Actions Run `29920336923` 的 artifact；根因是 `package.json` 写死 `build.electronDist=node_modules/electron/dist`，Actions 环境中该目录不存在导致 electron-builder 未产出安装包。
- 删除 `build.electronDist`，让 electron-builder 在 CI 中自行解析/下载 Electron runtime。
- 新增 `scripts/clean-release-output.mjs` 并接入 `dist:win`，减少重复构建残留。
- `scripts/verify-install-release.mjs` 不再读取旧 NSIS 证据，并在扫描解包目录遇到不可读目录时继续。
- `scripts/verify-nsis-install.mjs` 改为每次使用唯一 installed smoke runtime 目录。
- Windows Installer Preflight workflow 增加 Step Summary，并在 final gate 同时检查 build、preflight 和 installer artifact。
- Run `29933834029` 的 artifact 证明云端 build/install/smoke/uninstall/扫描已 passed，但 electron-builder 在 CI 中隐式 publish 导致 job failure；`dist:win` 已追加 `--publish never`。
- Run `29935231224` 真实 conclusion 为 success；云端候选安装包 build、NSIS 安装、安装版 smoke-test、卸载和安全扫描均通过。
- 未进入 3B，未创建 Release/tag，`shared_managed` 生产验证仍为 blocked。

## Unreleased - 上线硬骨头3A-R1.2：NSIS安装器修复

- 新增 `build/installer.nsh`，将 NSIS 默认 per-user 安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`，修复中文用户名环境下默认安装不稳定落盘问题。
- 新增 `scripts/verify-nsis-install.mjs`，用真实 NSIS `/S` 安装、安装版 `--smoke-test` 和真实卸载生成证据。
- 更新 `scripts/verify-install-release.mjs`，主 preflight 改用 Node helper 验证安装链路。
- 更新 Windows Installer Preflight workflow，失败时也 `always()` 上传安装包和 verification 证据。
- 本地 `npm.cmd run verify:install-release` 已通过；安装、启动、smoke-test、卸载均通过，证据见 `verification/install-release/repair1-2-summary.json`。
- GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`；已补 workflow 诊断，后续失败也会上传 `actions-build.log`。未取得 Actions passed 前不得进入 3B 正式 Release。

## Unreleased - 上线硬骨头3A-R1：安装启动卸载修复

### 修复尝试

- Electron packaged smoke-test 增加 GPU 禁用参数，避免 Chromium GPU 进程触发 `0x80000003` 后直接崩溃。
- smoke-test 不再依赖隐藏 BrowserWindow，改为启动内部服务后通过本地 HTTP 验证 renderer 产物可加载。
- `scripts/verify-install-release.mjs` 增加 R1 真实安装/启动/卸载证据：`repair1-summary.json`、`repair1-report.md`、`repair1-install.log`、`repair1-smoke.log`、`repair1-uninstall.log`。
- 安装验证改为记录真实用户上下文、快捷方式目标、updater installer 副本、注册表卸载项、真实安装目录、真实卸载器和退出码。
- NSIS 配置尝试从 assisted installer 切到 oneClick per-user installer，以减少安装交互和管理员权限要求。

### 验收

- R1 本地预验收状态为 failed。
- 安装包 `release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe` 已重新生成，SHA256 为 `7aef266db879f5f912b5eb806cd85347690ab033201736e39f59541c8617accd`。
- 安装器 `/S /currentuser` 退出码为 0，但未创建真实安装目录、卸载注册表项、`AI Workbench.exe` 或卸载器；仅在 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe` 留下同 hash 副本。
- 旧快捷方式仍指向历史坏路径；packaged smoke-test 未运行；卸载未实际执行。
- `shared_managed` 生产验证继续 blocked，本轮未处理、不冒充 passed。

## Unreleased - 上线硬骨头3A：安装包候选版预验收

### 新增

- 新增 `EXECUTION_PROTOCOL.md`，固化 GPT / Codex / Claude / 其他执行助手的任务执行与验收协议。
- 新增 `research/release-plan.md`，记录上线硬骨头3A/3B 拆分、安装包候选版预验收方案和四条现实约束。
- 新增 `tasks/2026-07-22-固化分段执行与验收协议.md`，记录执行协议落档。

### 文档

- 将 `EXECUTION_PROTOCOL.md` 加入 `CURRENT_TASK.md`、`NEXT_STEP.md`、`CURRENT_PROGRESS_AUDIT.md` 和 `AI-Workbench-Handoff.md` 的交接必读清单。
- 在 `DECISIONS.md` 中记录“单一主线、分段执行、逐段验证、失败也留痕、产品负责人批准后才能进入下一阶段”的正式决策。
- 明确当前唯一主线仍是硬骨头3A，不创建 GitHub Release、不创建正式 tag、不进入 3B。

### 验收

- 生成本地候选安装包 `release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`，SHA256 为 `90b9a6c30e015fe8a283eae0ae31909c330511f372660596f4905b52b735adf7`。
- 新增 `verification/install-release/preflight-summary.json`、`verification/install-release/preflight-report.md` 和 `verification/install-release/nsis-install-uninstall.json`。
- 3A 预验收状态为 failed：NSIS 静默安装未创建预期 per-user 安装目录/卸载器，packaged Electron smoke test 未完成，`shared_managed` 生产注入未验证。

## Unreleased - 任务账本与进度口径校准

### 新增

- 新增 `TASKLOG.md` 作为跨 GPT/Codex/其他 AI 协作的任务总账本，记录已完成任务、验收产物、未完成任务和缺失文件原因。

### 文档

- 更新 `CURRENT_TASK.md`、`CURRENT_PROGRESS_AUDIT.md` 和 `AI-Workbench-Handoff.md`，把 `TASKLOG.md` 纳入交接必读文件。
- 明确 `verification/model-router/summary.json` 当前不存在，因为模型分层/模型路由任务尚未正式执行；已有 `verification/unified-model-proxy/summary.json` 只代表统一模型入口验收，不能冒充模型分层验收。
- 明确下一步仍是上线硬骨头3：打安装包并挂 GitHub Release 下载链接。

### 验收

- 文档校准任务只改文档，未运行 npm 测试。

## Unreleased - 上线硬骨头2：共享 key 落地

### 新增

- `model-proxy.mjs` 支持共享托管 key 兜底：用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`，统一由 18800 转发到上游。
- `/health` 新增 `credentialSource`，只暴露 `local_env` / `shared_managed` / `missing` 来源类型，不返回任何 key 内容。
- 新增 `verify:shared-key`，用本地 mock 上游验证无用户 key 时仍可通过共享 key 调通 18800，并扫描 health、日志、进程输出不泄露 key。
- 新增 `verification/shared-key/summary.json` 作为共享 key 验收证据。

### 验收

- `npm.cmd run verify:shared-key`

## Unreleased - 上线硬骨头1：陌生机器不崩

### 新增

- 新增 `readiness.mjs` 和 `/api/readiness`，统一检查本机路径、模型代理、Hermes、OpenClaw 和端口状态，并输出中文未就绪说明。
- 新增 `verify:clean-machine`，自动验收开发机路径清理、首次启动目录重建、依赖缺失降级、端口冲突兜底和 readiness 报告完整性。
- 新增 `verification/clean-machine/summary.json` 和 `verification/clean-machine/readiness-report.md` 作为上线硬骨头1验收证据。

### 修复

- Electron 启动不再强等 18800/8787 成功；内部服务启动失败、脚本缺失、端口不可达时加载中文降级页，保留核心对话入口，不白屏、不崩栈。
- 前端首屏接入 readiness 提示，18800/Hermes/OpenClaw 未就绪时显示中文说明，聊天输入框仍可见。
- `server.mjs` 和 `model-proxy.mjs` 对端口占用输出中文可解释状态，避免把 Node 堆栈甩给用户。
- 历史文档和验收证据中的开发机用户路径已脱敏为 `%USERPROFILE%` / `<USER>`。

### 验收

- `npm.cmd run verify:clean-machine`

## v0.4.5 - 全链版本管理落地

### 新增

- 员工注册表增加 `version` 字段，DeepSeek 固定到 `deepseek-chat`，Hermes/OpenClaw 由版本快照运行时采集。
- 新增 `versions/current.json`、`versions/lock.json` 和 `versions/releases/v0.4.4.json`，记录工作台、员工和模型版本矩阵。
- 新增 `versions:snapshot`、`versions:doctor`、`versions:restore`、`versions:check-models` 和 `verify:versions` 脚本。
- 服务端新增 `/api/versions/current`、`/api/versions/doctor`、`/api/versions/models/check`，供工作台查询版本矩阵和下线检测结果。

### 验收

- `verify:versions` 演示锁定版本、模拟 Hermes 升级偏离、生成 pip/npm 指定版本回退计划、模拟 `deepseek-chat` 不可用并给出处置提示。

## v0.4.4 - 窗口前置与回复排版精修

### 修复

- `open_terminal`、`open_app`、`open_folder`、`open_settings` 执行后会最小化工作台并用 `AppActivate` / `SetForegroundWindow` 前置目标窗口。
- 前端消息渲染升级为轻量 Markdown 块渲染，支持段落、标题、编号列表、项目符号列表、粗体和行内代码的清晰层级。

### 验收

- v0.4.4 安装版真实验收：“帮我打开终端/记事本/下载文件夹”后，目标窗口成为 Windows 当前前台窗口并截图留证。
- “我最近有什么事没办”回复有段落留白、列表缩进和清晰标题层级。

## v0.4.3 - 动作路由补盲与生态路线整理

### 新增

- 新增 Hermes One 商业版产品形态对标文档：员工管理、多平台通道、技能/插件生态、任务编排和记忆系统。
- `CURRENT_TASK.md` 新增路线图：阶段2 手机 App 产品落地，阶段3 生态扩展。
- Function Calling 工具集新增 `open_terminal`、`open_folder`、`open_settings`，并强化 `open_app` 覆盖任意已安装应用。

### 修复

- “打开终端”“打开下载文件夹”等打开类指令不再落到普通回答，统一派 Hermes 员工真实执行。
- 路由识别补充终端、命令行、设置、下载文件夹等常见电脑操作目标词。

### 验收

- v0.4.3 安装版真实验收：“帮我打开终端”弹出终端。
- v0.4.3 安装版真实验收：“帮我打开记事本”弹出记事本。
- v0.4.3 安装版真实验收：“帮我打开下载文件夹”弹出文件夹。

## Unreleased - 聊天执行链路与体检报告

### 新增

- 聊天理解层新增通用动作意图路由：下载、安装、打开、查看、清理、配置等电脑操作请求不再交给 DeepSeek 口头回答，统一派给执行员工。
- Hermes adapter 新增通用 Windows 动作执行器：清晰的磁盘查看、软件安装状态验证、打开应用等请求优先走确定性本机命令，并保留命令证据。
- 聊天执行中新增进度消息：用户发出动作请求后先显示“已派给 Hermes/OpenClaw”，执行完成后再汇报人话结果和证据。
- 新增 `agents/router.mjs`，把聊天员工路由规则抽成共享模块，避免为单个验收软件写死逻辑。
- 新增 `research/pc-health-report.md`，记录电脑卡顿、冰灵代理、磁盘、网络和工作台/Hermes/OpenClaw 体检结论。

### 修复

- 修复 DeepSeek 对动作类请求只给官网/步骤、不派员工执行的问题。
- 修复 Hermes 失败报告被验证层误判为成功的问题。
- `runtime-paths.mjs` 支持 `AIW_DATA_FILE` 覆盖，便于临时验收服务使用独立数据文件。

### 验收

- “帮我下载爱奇艺到电脑上”：聊天入口路由 Hermes，确认爱奇艺已安装，证据包括注册表条目 `爱奇艺 14.6.5.10119` 和目录 `C:\Program Files\IQIYI Video`。
- “帮我看看C盘还剩多少空间”：聊天入口路由 Hermes，返回 C 盘剩余约 28.68GB、总容量约 198.82GB。
- “帮我打开记事本”：聊天入口路由 Hermes，实际执行打开记事本流程并通过验证。

## v0.4.2 - 桌面体验修复

### 修复

- 回复排版：系统提示词要求分行、`1. 2. 3.` 编号列表、重点 `**加粗**`，列表内容一行一条。
- 前端消息渲染保留换行，并支持 `**重点**` 粗体显示，避免回复糊成一整段。
- Electron 输入框新增中文右键菜单：剪切、复制、粘贴、全选。
- Electron 顶部应用菜单隐藏，不再显示英文 File/Edit 菜单。

### 验收

- v0.4.2 安装版需覆盖旧版后验收：“我最近有什么事没办”返回清晰编号列表。
- 从外部复制文字后，可在输入框右键粘贴；Ctrl+C / Ctrl+V 保持可用。
- 窗口顶部不再出现英文菜单栏。

## v0.4.1 - Function Calling 执行路由与安装版同步

### 新增

- 聊天入口改为 DeepSeek Function Calling 调度：工作台向模型提供 `open_url`、`open_app`、`run_system_query`、`clean_disk`、`download_install`、`read_file_summarize`、`web_search` 工具清单。
- 模型返回 `tool_calls` 后，工作台按工具名派 Hermes 或联网搜索执行，并把工具结果回填给 DeepSeek 生成最终中文回复。
- 动作类请求增加漏派保险层：模型没有返回工具调用时，工作台仍会合成对应工具调用，避免再次口头拒绝执行。
- Electron 版本升到 `0.4.1`，最终安装包输出目录为 `release-v0.4.1-installer-final`。

### 修复

- 修复 v0.4.0 安装版仍运行旧构建，导致仓库路由修复没有部署到用户实际使用实例的问题。
- 删除聊天入口旧的自由文本 JSON 提炼路径，消除“返回结果不是JSON”类解析崩溃。
- 系统提示词明确工作台具备电脑操作能力，禁止“无法操作你的电脑/无法直接打开”等拒绝话术。

### 验收

- v0.4.1 安装版需覆盖旧版后验收：打开腾讯页面、打开 GitHub、连续三次查询 C 盘空间、C 盘安全清理、联网天气问答。

## v0.4.0 - 桌面发行版与执行底座

### 新增

- 新增 Electron 打包链路，支持生成 Windows 桌面发行包和安装包。
- 新增模型代理 `model-proxy.mjs`，统一代理工作台、Hermes、OpenClaw 等员工的模型请求。
- 新增数据迁移与运行路径处理，兼容开发环境和 Electron 发行环境的数据目录差异。
- 新增 watchdog 守护脚本，负责拉起和检查工作台本地服务。
- 新增 OpenClaw 员工接入，支持电脑/浏览器操作、长任务编排和本地 agent 调用。

### 验证

- Electron 打包产物已生成到 `release-v0.4.0*` 相关目录。
- Hermes、OpenClaw、模型代理和 watchdog 均已纳入验证脚本或本地运行检查。

## v0.3.0 - MVP 架构闭环

### 新增

- 新增员工注册表 MVP：建立 `agents` 数据结构，先注册 DeepSeek（模型）和 Hermes（Agent）。
- 新增统一员工 adapter 接口：`healthCheck()` / `canHandle()` / `execute()` / `status()` / `cancel()` / `verify()` / `normalizeError()`。
- 新增 `/api/agents` 和 `/api/agents/health`，核心服务通过统一注册表读取员工档案和健康状态。
- 新增 `npm run verify:agents`，用于验证已注册员工的健康状态。
- 新增统一任务结构 MVP：建立 `tasks` 和 `runs` 数据结构，聊天消息会自动生成任务和执行记录。
- 新增 `/api/tasks`、`/api/tasks/:id`、`/api/runs`、`/api/runs/:id`，支持创建和查询任务/执行记录。
- 新增 `npm run verify:tasks-runs`，用于模拟聊天消息并验证 task/run 持久化和查询接口。
- 新增中央记忆库 MVP：建立 `memories` 数据结构，支持用户偏好、项目上下文、任务历史和错误经验库四类记忆。
- 新增 `/api/memories`、`/api/memories/:type`、`/api/tasks/:id/context`、`/api/runs/:id/memory-suggestions`，确保 Agent 只能提交记忆建议，主记忆由工作台确认写入。
- 新增 `npm run verify:memories`，验证“写入偏好 → 生成任务上下文包 → Agent 提建议 → 工作台确认后写入主记忆”的完整流程。
- 完善 Hermes adapter：支持 `invoke(task, context)`，固定使用 `hermes chat -q ... --provider custom -m deepseek-chat --toolsets memory,terminal`，返回结构化结果、命令证据和记忆建议。
- 新增 `/api/agents/hermes/invoke`，工作台可通过统一 adapter 调 Hermes 执行任务并写入 run 记录。
- 新增 `npm run verify:hermes`，验证 Hermes 读取 `CURRENT_TASK.md`、返回待办摘要和完整命令证据。
- 新增验证层 MVP：按代码、Hermes、搜索、文件四类任务检查证据完整性、有效性和结果一致性，禁止无证据或无效证据的 run 被标记完成。
- 新增 `/api/runs/:id/verify` 和 `/api/verification-rules`，工作台可统一验证执行记录并查看当前规则。
- 新增 `npm run verify:verification`，覆盖成功、假完成和执行失败三类验证场景。
- 新增错误翻译层 MVP：将超时、权限、API 配置、连接、限流、参数、假完成和执行失败等错误统一转成中文用户消息、内部技术细节和可点击恢复建议。
- 新增 `/api/errors/normalize` 和 `/api/errors/recovery-hints/:errorType`，用于错误归一化和恢复方案查询。
- 新增 `npm run verify:errors`，覆盖 5 类真实错误场景，确保用户消息不暴露 traceback 或英文技术错误。
- 新增环境自愈层 MVP：支持网络重试、Hermes/AppData 权限降级、缺工具安全安装入口、API 配置续期入口、环境变量缺失提示和数据文件自动重建/恢复。
- 新增 `/api/health/self-heal`、`/api/health/status`、`/api/health/fix-permission`、`/api/health/setup-env`，用于系统主动检测和修复环境问题。
- 新增 `npm run health:check`、`npm run health:repair` 和 `npm run verify:health`，覆盖网络恢复、权限降级和 API key 缺失三类自愈场景。
- 新增聊天入口 Hermes 自动调度：用户在网页聊天框提出文件读取/终端类需求时，工作台自动生成 task/context/run 并通过 Hermes adapter 执行。
- 新增任务详情执行记录展示：可查看对应 run、执行员工、验证状态、命令证据、耗时和成本估算。
- 新增 `web_search` 通用联网搜索工具，DeepSeek 可按需调用 Serper Google Search API 查询实时数据、新闻、当前状态、产品价格等变化性问题。
- `.env` 新增可选 `SERPER_API_KEY` 配置；未配置时保留聊天能力，但联网搜索会返回明确缺 key 错误。

### 修复

- 任务标记为失败时自动生成具体失败原因，不再要求用户先手填。
- 任务列表和今日目标关联任务改为独立任务卡片，显示负责人、日期和短 ID，减少不同任务被误认为同一件事的风险。
- Hermes adapter 改用工作台私有 `.hermes-runtime` 运行态目录，避开 AppData 日志锁和 session DB 权限问题；该目录已加入 `.gitignore`。
- 聊天页 Hermes 返回内容做用户侧清洗，只展示中文结果，不暴露命令回显、session 信息或内部上下文。

### 验证

- `npm run build`
- `npm run verify:agents`
- `npm run verify:tasks-runs`
- `npm run verify:memories`
- `npm run verify:hermes`
- `npm run verify:verification`
- `npm run verify:errors`
- `npm run verify:health`
- `npm run verify`
- 网页端到端验收：在聊天框发送“让Hermes读取 F:\AI-Workbench\CURRENT_TASK.md 并告诉我现在有哪些待办”，生成 Hermes task/run，验证 `verified=true`。

## v0.2.3 - 遗留任务收尾 + 环境归档

### 新增

- `VISION.md` 新增工具层扩展规划：按能力分层接入 Hermes、OpenClaw、Codex、Claude Code、浏览器抓取 Agent、文档/表格/数据处理工具。
- 新增 Windows 登录自启动脚本：`scripts/start-workbench-dev.ps1` 和 `scripts/dev-background.mjs`，开机后可直接打开 `http://127.0.0.1:5173` 使用。
- `SETUP.md` 补充开机自启动说明、关闭方式和日志位置。

### 优化

- 完成 v0.2.2 视觉细节第二轮：左侧栏中文化、版本徽标更新、顶部按钮改正规图标、消息时间戳 hover 显示、移动端新增对话切换入口。

### 修复

- 修复 Hermes `.__agent.lock`、`auth.lock`、`session DB readonly` 遗留问题：停止旧 Hermes gateway 自动拉起源，清理锁文件，并记录真实原因。
- 修复 Hermes doctor 归档文件编码：`hermes-doctor-2026-07-17.txt` 和 `hermes-doctor-2026-07-17-fixed.txt` 已转为 UTF-8 无 BOM。

### 验证

- `npm.cmd run build`
- 真实 Windows 用户权限运行 `hermes doctor`，无 lock / readonly / Logging error 报错。
- 本地自启动脚本验证：前端 `5173` 和 API `8787` 均返回 200。

## v0.2.2 - 功能修复 + 视觉细节对齐

### 修复

- 左侧对话列表新增悬停更多菜单，支持重命名和删除；删除会一并移除该对话的消息记录。
- 新消息到达时聊天区会自动滚动到底部。
- 今日目标支持点击展开，展示当天关联任务。
- 任务条目点击后会选中并展示可编辑详情。
- 负责人选项新增 DeepSeek，并标注 DeepSeek 已接入、Codex/GPT/Claude 未接入。
- 修复内部操作文字被保存为对话标题的问题，标题会从首条真实用户消息生成。
- 新建空对话保留居中欢迎语和简洁输入框。
- 顶部常驻技术信息移入侧栏设置区。
- 左下角不再暴露本地项目路径。

### 验证

- `npm run build`
- `npm run verify`

## v0.2.1 - 聊天回复修复 + 侧边栏抽屉 + 多对话

### 修复

- 修复聊天发送“你好”等无目标/任务/偏好的内容后界面没有任何反馈的问题。
- `/api/chat-message` 现在始终追加一条 assistant 自然语言回复；寒暄类消息不会再被误写成目标、任务或偏好。
- DeepSeek 调用失败时会写入系统错误日志，并在聊天流里显示处理失败提示。

### 优化

- 右侧“今日/任务/历史和错误”改为默认收起的右侧滑出面板，通过右上角按钮打开。
- 右侧内容合并为两个板块：“今日和任务”“历史和错误”，主聊天区占据主要视觉空间。
- 左侧栏新增“新建对话”，支持多个独立对话线程；切换历史对话时只显示对应消息。
- 今日目标、任务和偏好仍然是全局共享，不按对话隔离。

## v0.2.0 - 聊天为中心 + 自动信息提炼

### 改动原因

- 用户实际使用 v0.1.1 一天后反馈：四个独立页面和多处表单让用户必须手动填写目标、偏好、负责人，违背“简单”和“减少用户操作”的项目原则。
- 本次进入 Phase 3 的第一步：把功能从“全部显性展示”收缩为“聊天入口优先”，让系统从自然语言里提炼结构化数据。

### 已有功能

- 主界面改为一个连续聊天流，不再用“首页 / 聊天 / 任务状态 / 历史记录”四个独立 tab。
- 右侧栏保留今日目标、任务列表、任务详情修正、历史和失败原因搜索，作为查看和纠错入口。
- 新增聊天自动提炼：用户发送消息后调用 DeepSeek，自动识别今日目标、任务和用户偏好。
- 置信度高的提炼结果会自动写入目标、任务或偏好；不确定的结果会在聊天消息下方提示用户确认。
- 保留失败任务必须填写失败原因、历史搜索失败原因、系统错误日志、本地 JSON 持久化等规则。

### 边界

- 当前只做“聊天内容 → 结构化数据”的信息提炼。
- 不做自动执行任务、不操作电脑、不做多 Agent 调度；这些仍属于 Phase 5。

## v0.1.1 - 显示面板扩充 + DeepSeek 连接测试入口

### 已有功能

- 首页新增模型/连接状态面板，当前如实显示未连接，连接成功后显示 DeepSeek 与具体模型名。
- 首页新增用户偏好设置区，可保存默认负责人、每日任务数量上限、DeepSeek 测试模型。
- 首页新增存储状态显示，可查看本地数据文件大小、任务数、消息数、历史天数、系统错误数。
- 历史页新增系统级错误日志，格式为时间、错误描述、发生操作，并支持按关键词搜索。
- 新增「测试AI连接」按钮，通过本地 API 尝试调用 DeepSeek API。
- 无 API Key 时会记录“等待用户提供API Key”系统错误，不伪装成已连接。

### 已知问题

- DeepSeek API 真实调用尚未实测，等待用户在 `.env` 中提供可用 API Key。
- API Key 只从根目录 `.env` 读取，`.env` 已加入 `.gitignore`，不会提交到 GitHub。
- 当前仅测试单次 DeepSeek API 连接，不做任务自动执行、多模型调度或偏好自动应用。

### 下一步方向

- 用户提供可用 DeepSeek API Key 后实测连接成功、无效 Key、额度不足等错误路径。
- 根据 3-7 天使用反馈进入 Phase 3，判断哪些面板保留、合并、隐藏或删除。

## v0.1.0 - 功能显性版

### 已有功能

- 首页能填写目标、添加任务、勾选后有进度变化
- 聊天消息能标记成任务
- 任务状态、负责人、备注可修改
- 刷新网页后数据仍在（本地持久化生效）
- 任务设为"失败"但不填写原因时不能保存（强制留痕机制）
- 填写失败原因后可以保存
- 历史页面能搜索到失败原因（错误记忆库雏形）

### 已知问题

- 当前是功能显性版，不是最终用户界面，页面会刻意暴露较多内部字段。
- 本地服务只能在本机访问，AI 无法远程打开 `127.0.0.1` 链接。
- 目前没有真实 AI API 调用、自动执行、多 Agent 调度或用户登录。
- 数据保存在本地 JSON 文件，暂不支持多设备同步。

### 下一步方向

- 进入 Phase 3 功能筛选与收缩。
- 通过 3-7 天真实使用判断哪些功能需要保留、合并、隐藏或删除。
- 暂不新增自动执行、模型调度或复杂授权中心。
