# CHANGELOG

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
