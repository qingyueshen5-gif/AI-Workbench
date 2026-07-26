# AI Workbench 项目基准文档 (CONTEXT.md)

> 使用方法：新对话需要完整基准时，提供本文件内容或 GitHub 链接；需要快速交接时优先提供 `AI-Workbench-Handoff.md`、`NEXT_STEP.md`、`THINKING.md`、`PRINCIPLES.md` 和 `GROWTH_LOG.md`。
> 当前版本号以 `package.json` 的 `version` 为唯一权威，本文件只展示脚本可校验的当前口径。
> 新电脑迁移或重装环境时，先看仓库根目录的 `SETUP.md`。

---

## 当前状态

<!-- AIW_CURRENT_VERSION_START -->
当前版本：v0.4.6 Alpha
package.json.version：0.4.6
Release：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
Release 类型：public prerelease / Alpha
<!-- AIW_CURRENT_VERSION_END -->

AI Workbench v0.4.6 Alpha 已公开发布。③A 总验收和 ③B GitHub Release 均已 passed，公开安装包下载回测通过。上线三大硬骨头整体完成，产品方向已收口。

当前尚无真实用户。模型调用成本由平台承担，第 3 阶段钱包刹车已正式封板，平台模型调用 40 USD 月度硬上限已在生产生效；自然用户长期规模稳定性仍未证明。当前目标是建立可靠产品、真实用户、知名度和可持续经营能力，不是收费或利润最大化。

生存体检和第 3A 段本地钱包刹车均已由产品负责人验收通过。3A 已完成平台合计预算纠偏和 mock 验证：平台月度总预算政策上限 50 USD，所有 provider/模型合计的模型调用硬上限 40 USD，基础设施及价格波动预留 10 USD；Managed Proxy 使用整数 micro-USD，在调用 provider 前按模型价格保守预留。平台总账的硬上限预留通过 `monthly_platform_budget(month_key)` 带额度条件的单条更新完成，属于硬刹车所依赖的条件原子操作；`monthly_model_budget(month_key, model)` 模型明细账在平台预留成功后单独更新，不与平台总账构成一个整体原子事务。模型明细只做审计和分类统计，不决定硬上限。如果模型明细账更新失败，请求会 fail closed，provider 不会被调用；平台总账已产生的保守预留保持不退款，可能导致预算更早耗尽，但不会导致预算绕过或超支。失败/超时/500 不退款，缺价格或预算账本不可用时 fail closed。证据见 `verification/monthly-budget-circuit-breaker-local/summary.json`。

第 3B-1 段生产预检与远端 D1 部署前备份已完成：生产变更前必须核对 Cloudflare 身份、Worker、D1 binding、目标数据库和既有生产 evidence，并在仓库外完成远端 D1 完整导出备份。当前备份位于 `D:\AI-Workbench-Backups\2026-07-24-managed-proxy-budget-predeploy\`，证据见 `verification/monthly-budget-production-preflight/summary.json`。本轮未执行远端 D1 migration，未部署生产 Cloudflare Worker，未修改 Secrets，未调用真实 provider。

第 3B-2a 段远端 D1 migration 已完成：生产 D1 `aiw-managed-proxy` 现已存在 `monthly_platform_budget` 和 `monthly_model_budget` 两张预算表，原有 `daily_usage`、`installations`、`revoked_tokens` 保持存在；两张预算表当前行数均为 0。证据见 `verification/monthly-budget-production-migration/summary.json`。本轮未部署 Worker，未修改 Secrets，未调用真实 provider；预算表已创建但生产钱包刹车尚未生效。

第 3B-2b1 段部署候选已锁定：生产部署前必须保存当前稳定 Worker version 和回滚目标。本轮已确认当前生产流量版本 `16333442-925a-4b11-a3d1-d6249d2492ba`、当前 deployment `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`，并以当前稳定版本作为回滚目标；`/health` 和 `/v1/models` 均 HTTP 200。`managed-proxy/wrangler.jsonc` 当时显式配置 50 USD 平台政策上限、40 USD 模型硬上限和 `deepseek-chat` 公开价格参数。证据见 `verification/monthly-budget-worker-deploy-readiness/summary.json`。本轮未部署 Worker，未修改 Secrets，未调用真实 provider；部署候选已锁定但生产钱包刹车尚未生效。

第 3B-2b2d 后续根因修复本地候选已完成：产品负责人确认真实聊天 HTTP 400 根因为旧 DeepSeek 上游模型名 `deepseek-chat` 已在 2026-07-24 15:59 UTC 后退役。本轮先将已知失败候选 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 从 1% 正常生产流量撤回到 0%，旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 恢复 100%，当前 active deployment 为 `d9acb146-b720-4e09-b2b8-0257b93fc407`。本地代码已实现客户端逻辑模型 `deepseek-chat` 到上游正式模型 `deepseek-v4-flash` 的显式路由，预算明细新路径按实际计费模型 `deepseek-v4-flash` 记录；16 项 Managed Proxy 测试和 TypeScript 检查通过。既有 21 micro-USD 历史预留未修改。未上传新 Worker version，未部署生产修复，未修改 Secrets 或 D1 schema，未发起新的真实 provider 调用。证据见 `verification/deepseek-v4-flash-route-migration/summary.json`。

第 3B-2b2e 段 DeepSeek V4 Flash 修复 Worker Preview 已完成无付费验证：产品负责人验收本地候选后批准只上传新 Worker version 并做 Preview 检查。新修复 version `a7eb385b-84df-4a45-b554-0aca40b6b407` / version number `12` 已上传，Preview alias 为 `budget-v4-flash-candidate`。active deployment 仍为 `d9acb146-b720-4e09-b2b8-0257b93fc407`；旧稳定 version 仍为 100%，已知失败候选仍为 0%，新修复 version 正常生产流量为 0%。Preview `/health` HTTP 200，`/v1/models` HTTP 200 并显示 `deepseek-chat` 为逻辑 alias、上游为 `deepseek-v4-flash`；未认证聊天 HTTP 401 `missing_token`。本轮未注册 installation，未发起已认证聊天，未调用真实 provider，两张预算表仍保持 21 micro-USD / call_count 1，Secrets 和 D1 schema 未修改。证据见 `verification/deepseek-v4-flash-worker-preview-upload/summary.json`。

DeepSeek V4 Flash 非思考兼容 version 13 已通过真实 Preview 链路、1% 正常生产灰度，并已提升为 100% active production version：客户端逻辑模型仍为 `deepseek-chat`，Worker 内部路由到上游 `deepseek-v4-flash` 并强制 `thinking: { "type": "disabled" }`。真实 Preview run2 注册和聊天各 1 次均 HTTP 200，provider model `deepseek-v4-flash`，回答 `OK`，预算平台总账 21/1 -> 44/2，V4 Flash 明细不存在 -> 23/1，历史 `deepseek-chat` 保持 21/1。1% 灰度由产品负责人验收后，本轮用 `wrangler versions deploy` 将 version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f` 提升到 100%，新 active deployment 为 `0400b7aa-49fe-460d-ac6d-3ed5bfdb0480`，只包含 version 13。30 分钟主动观察和 5 分钟指标缓冲完成，生产与 Preview 健康检查正常，未观察到 runtime error，预算保持平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1。本轮没有主动注册或真实模型调用；自然生产 invocation 样本不足，因此不能声称长期真实用户规模稳定性已证明。GPT 技术验收和 Claude 逻辑复核后的文档条件已解决，产品负责人批准 `ACCEPT_CONDITIONAL_PASS`，第 3 阶段最终状态为 `PASS_AFTER_CONDITIONS_RESOLVED`。证据见 `verification/version13-full-production-promotion/summary.json`。

## 当前架构

```text
Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider
```

产品定位是模型与 Agent 无关的调度框架，不是 DeepSeek 客户端。DeepSeek 是当前唯一已接入的生产实现；架构必须保持 provider registry 和 Managed Proxy 可替换，后续可接入其他模型 provider、Agent 和成熟工具。

当前生产链路的真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包、用户电脑、前端、员工配置、日志或公开仓库。

## 已完成能力摘要

详细能力状态以 `CURRENT_PROGRESS_AUDIT.md` 为唯一权威。本文件只展示摘要：

- Windows 安装、启动、快捷方式和卸载已通过真实验收。
- 陌生机器缺依赖时不白屏、不崩栈，提供中文未就绪说明。
- 用户安装后无需填写模型 API Key；当前生产实现通过 AI Workbench Managed Proxy 调用 DeepSeek `deepseek-chat`，架构保持多 provider 可替换。
- Cloudflare Managed Proxy 生产部署、D1、Secrets、限流、预算、令牌刷新/吊销和紧急关闭已通过验证。
- ③A 总验收 passed，③B GitHub Release passed，v0.4.6 Alpha 已公开下载。

## 未完成能力摘要

详细未完成清单以 `CURRENT_PROGRESS_AUDIT.md` 为唯一权威。本文件只展示摘要：

- 电脑环境治理审计已完成；第一批安全清理仍为 partial，用户 npm 缓存仍因 `EPERM` 未清理，Windows 临时文件仍需产品负责人手动确认。
- DeepSeek V4 Flash 非思考兼容 version 13 已通过真实 Preview 链路、1% 生产灰度，并已成为 100% active production version；第 3 阶段钱包刹车与 version 13 全量生产已正式封板。未经批准不得进入模型分层、上下文压缩、v0.4.7 或其他新阶段，不得注册 installation 或发起新的主动真实模型调用。
- 首屏 3-5 条示例指令、反馈入口、安全和隐私告知尚未完成；v0.4.7 产品内埋点与错误日志需求已确认但尚未设计和开发，不属于当前第 3 阶段完成条件。
- 3-5 名真实用户测试尚未开始。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配尚未完成。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规尚未实施。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为唯一权威：

等待产品负责人批准下一阶段范围和执行指令。

不得上传新 Worker version、注册 installation、发起真实模型调用、修改 Secrets、进入后续段、实际电脑清理、首屏示例、反馈入口、安全告知、真实用户测试、模型分层、上下文压缩、手机端、情报流水线或任何新功能开发，除非产品负责人明确批准对应下一阶段任务。

## 产品方向文件索引

- `PRODUCT.md`：产品定义、目标用户、一个输入框、产品边界和阶段路线。
- `VISION.md`：全球愿景、质量基线、人机共同打磨和长期方向。
- `THINKING.md`：产品负责人判断依据，解释关键结论背后的原因。
- `PRINCIPLES.md`：简单、高质量、快速、低损耗、真实完成和透明可追溯。
- `GROWTH_LOG.md`：产品负责人的学习目标、长期关注方向和未来排期记录。
- `DECISIONS.md`：已锁定决策，包括借用生态但掌握控制层、跨平台执行边界和用户状态波动补偿。
- `CURRENT_PROGRESS_AUDIT.md`：已完成/未完成能力的唯一权威。
- `NEXT_STEP.md`：当前唯一下一步的唯一权威。
- `verification/3b-release/summary.json`：v0.4.6 Release 事实权威证据。

## 产品地图基准

本轮已把完整产品地图写入现有权威文件，不新建平行路线图：

- 产品能力地图：`PRODUCT.md` 的“完整产品能力地图”，覆盖 23 个模块，包括基础体验、桌面端、Web、手机端、图片文件多模态、上下文记忆、任务拆解、模型/Agent/工具调度、执行验证、成本钱包、反馈埋点、安全隐私、环境自检、真人试用、虚拟人格、通讯入口、生态扩展、模型分层和上下文压缩、信息收集、支付、加密支付、宣传营销、多 Agent 杠杆。
- 20 块产品战略与入口适配层原则：`PRODUCT.md` 的“二十块产品战略”和“通讯入口适配层原则”。AI Workbench 核心不绑定飞书、微信、Telegram、WhatsApp、Discord 或任何单一平台；通讯产品只是入口适配器。
- 专业工作流地图：`EXECUTION_PROTOCOL.md` 的“专业工作流地图”，覆盖产品、用户研究、设计、前端、桌面、Web、移动、后端、API、AI 调度、Agent、上下文、多模态、数据、日志、安全、合规、测试、DevOps、Cloudflare、发布、支付、品牌、市场、运营、客服、国际化、生态、成本、文档和独立审计等岗位。
- 任务归属地图：`CURRENT_PROGRESS_AUDIT.md` 的“任务归属地图”，覆盖 66 条已提出任务线，统一使用固定状态枚举，并标明所属模块、岗位、证据、缺口、依赖、并行关系、风险和是否当前开工。新增四条入口任务：国内内部研发指挥入口、国际内部研发指挥入口、国内外部用户入口、国际外部用户入口。
- 时间与执行地图：`CURRENT_PROGRESS_AUDIT.md` 的“时间与执行地图”，区分当前真实问题、首批市场交付前必须做、真人试用后再决定、长期能力、战略研究、当前不做、可并行研究、可隔离并行开发和必须串行集成。
- 并行执行规则：`EXECUTION_PROTOCOL.md` 的“文件驱动协调 Agent”“并行任务开工门槛”和“执行快但不能免检”。任何并行线缺少目标、预算、安全边界、权限范围、输出、验收、停止条件或最终集成者时，状态为 `not_ready_to_start`。

这些地图只用于让产品负责人审核和后续排期，不代表 v0.4.7、飞书、Telegram、图片、上下文、手机端、Web 端、多 Agent、支付、加密支付、宣传营销或其他实施任务已经启动。当前首选内部入口状态为 `waiting_for_product_owner_channel_selection`。

## 协作分工

| 角色 | 负责什么 |
|---|---|
| 产品负责人 | 定产品方向、定优先级、决定是否改变当前唯一任务、接受或拒绝风险、最终拍板阶段是否通过 |
| Claude | 帮助产品负责人梳理想法并结构化，从产品角度把关，对完整产品阶段基于 GitHub 可访问证据做独立验收并给出 `PASS / CONDITIONAL_PASS / BLOCKED`；不声称访问无权访问的本地或生产环境 |
| GPT | 统一跨对话上下文、判断当前唯一任务、防止任务线漂移、把产品负责人决定转化为完整有边界的 Codex 指令，并根据 Codex 回报帮助理解进度；不替代最终拍板 |
| Codex | 在授权范围内执行，修改代码或文档，运行测试，检查基线，发现基线冲突、证据不足或风险时停止，生成 verification，commit + push，如实汇报 `passed / failed / blocked`；不自行宣布完整产品阶段最终通过 |
| Hermes / OpenClaw | 未来由工作台调度的电脑、浏览器和长任务执行工具 |

## 验收协议

- 执行规范以 `EXECUTION_PROTOCOL.md` 为准。
- AI 不负责宣布成功，AI 负责提供证据；用户负责最终验收。
- Codex 单轮完成后做执行验收并停止；完整产品阶段结束时必须另做独立验收，从 GitHub 交叉核对代码、测试、verification 和权威文档。独立验收和产品负责人批准前，不得宣布阶段结束或进入下一阶段。
- 外部流程必须取得真实外部结果后才能判绿。
- 任何任务结论、验收结果和新决策都必须写回仓库，不得只留在聊天里。
- 历史记录不得为统一当前口径而篡改；历史文件可保留当时版本号和当时状态。

## 环境层已知问题

工作台应用问题与电脑开发环境问题要分开看：

- 工作台出问题：改代码、改功能，是 Codex 的活。
- 环境出问题：例如登录掉了、路径不对、权限报错，是地基层问题，不等同于工作台功能失败。

已发生过的环境问题记录：

| 问题 | 原因 | 解决方式 |
|---|---|---|
| git push 报 `dubious ownership` | 外接硬盘的文件系统不记录归属权 | `git config --global --add safe.directory F:/AI-Workbench` |
| git push/fetch 报 `SEC_E_NO_CREDENTIALS` | 本机 Git 登录凭证失效/未设置 | 在系统终端执行 `gh auth login --web --git-protocol https`，走浏览器授权 |
| Codex 沙盒内 push 超时/授权卡住 | Codex 运行环境隔离，浏览器跳转登录容易失败 | 换到电脑自带终端执行登录和 push |
| Codex 窗口断连后不知道怎么重开 | 正常操作，不是故障 | 在 `F:\AI-Workbench` 打开终端，输入 `codex` 回车 |
| Codex 任务量太大导致 502/连接中断 | 一次性任务过大 | 拆小任务，分批发送 |
| Hermes / WSL / OpenClaw 历史环境问题 | 见任务记录和历史文档 | 不在当前任务中重复排查，按对应历史留痕处理 |

## 第 3B-2b2a 当前生产变更边界

- 第 3B-2b1 段部署候选已由产品负责人验收通过，验收提交 `982d6a324727465cd89911325d13e3f395b58142`。
- 已上传新的 Cloudflare Worker Preview version `483e4fae-3af8-40fa-ab83-4551f08b519e`，Preview alias 为 `budget-candidate-3b2b2a`。
- Preview URL 已验证 `/health`、`/v1/models` 和未认证聊天拒绝路径；未使用真实安装 Token，未调用真实 provider。
- 当前 active deployment 已更新为 `d9acb146-b720-4e09-b2b8-0257b93fc407`，100% 正常生产流量指向稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba`，已知失败预算候选 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 正常生产流量为 0%。
- 远端 `monthly_platform_budget` 和 `monthly_model_budget` 保留第 3B-2b2d 失败真实调用产生的 21 micro-USD 和 call_count 1。
- 已知失败预算候选不再承载正常生产流量；本地 V4 Flash 路由修复尚未上传到 Cloudflare。100% 切换必须等待产品负责人批准后进入后续段。
- 第 3B-2b2d 段尝试单笔受控真实预算链路验证：预留金额按生产公式计算为 21 micro-USD，但一次性临时脚本的唯一注册尝试未返回 HTTP 状态、未取得 Token，因此没有执行真实聊天请求，没有取得真实调用前预算预留证据。新预算 Worker 仍只承载 1%，尚未切到 100%；40 USD 耗尽路径仍由本地并发和边界测试证明，不会在生产主动消耗到上限。
- 第 3B-2b2d 阻塞恢复诊断：本地 Node 内置 fetch 未显式使用代理时对生产 Worker 在响应头前连接超时，显式 undici `ProxyAgent` 后无付费 GET/OPTIONS/无状态 POST 可取得 HTTP 响应。但未取得独立证据证明 version override 命中新预算 version，因此本轮未再次注册、未发起聊天、未调用 provider、未写预算。
- 第 3B-2b2d 候选 Preview 单笔真实链路：改用候选 version Preview URL 后，注册成功，唯一真实聊天返回 HTTP 400 `invalid_request_error`；预算预留已在 provider 前写入，平台总账和模型明细各 +21 micro-USD、call_count +1。生产域名仍为旧版本 99%、新预算版本 1%，尚未切到 100%，本轮不得写成 passed。
- 第 3B-2b2d 根因修复本地候选：已确认旧上游模型名退役，撤回失败候选 1% 流量；本地实现 `deepseek-chat` 逻辑模型到 `deepseek-v4-flash` 上游模型路由，预算明细按实际计费模型记录。该修复尚未上传或部署，不得写成 production fixed 或 real provider path passed。
- 第 3B-2b2e 修复 Worker Preview：新修复 version `a7eb385b-84df-4a45-b554-0aca40b6b407` 已上传为 version number `12`，Preview 三项无付费检查通过；生产当前仍为旧稳定 version 100%，失败候选 0%，新修复 version 正常生产流量 0%。该修复尚未加入 production deployment，尚未执行修复后的真实模型调用，不得写成 production fixed、real provider path passed 或 wallet guard complete。
- DeepSeek V4 Flash 非思考兼容本地候选：version 12 已验收但不用于付费验证；本地候选新增 `thinkingMode: "disabled"`，服务端强制上游非思考 payload。该修正尚未上传到 Cloudflare，不得写成 Preview passed、production fixed、real provider path passed 或 wallet guard complete。
- DeepSeek V4 Flash 非思考真实 Preview 阻断：非思考兼容新 Worker version `cf002344-57ee-4c3f-86a6-115ca66c8b5f` / version number `13` 已上传并通过无付费 Preview 安全门；未加入 active deployment，正常生产流量 0%。唯一一次注册已消耗，D1 确认 installations +1、daily_usage +1；一次性脚本随后在聊天前预算读取阶段崩溃，Token 未打印未持久化且不可恢复，真实聊天 0 次、provider 调用 0 次、预算预留 0。不得写成 real path passed；未经产品负责人重新批准不得第二次注册或真实调用。
- DeepSeek V4 Flash 非思考真实 Preview 链路：产品负责人批准 run2 后，复用现有 version 13，移除 Token 进程中的所有子进程调用，完成一次注册和一次真实聊天。聊天 HTTP 200，provider model `deepseek-v4-flash`，回答 `OK`，`reasoning_content` 为空；平台总账 21/1 -> 44/2，`deepseek-v4-flash` 明细不存在 -> 23/1，历史 `deepseek-chat` 保持 21/1。version 13 未加入 active deployment，正常生产流量仍为 0%；等待产品负责人验收，不得自动进入 production deployment、1% 或 100%。
- Version 13 全量生产切换与第 3 阶段封板：产品负责人验收 1% 灰度后批准 100% 全量；当前 active deployment `0400b7aa-49fe-460d-ac6d-3ed5bfdb0480` 只包含 version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f`，承载 100% 正常生产流量。观察窗口正常但受低自然生产流量限制；本轮未主动注册或聊天，预算仍为平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1。第 3 阶段已在 GPT 技术验收 `CONDITIONAL_PASS`、Claude 逻辑复核和产品负责人 `ACCEPT_CONDITIONAL_PASS` 后正式封板；自然用户规模稳定性尚未证明。未经批准不得进入模型分层、上下文压缩、v0.4.7 或其他新阶段。

## 第三方 Agent/工具升级管理规则

1. 不在任务进行中升级，任何升级都单独立项、单独验证。
2. 升级前必须先看官方 Release Notes，确认有没有破坏性变更。
3. 升级前记录当前可用版本号，出问题能回退。
4. 升级后必须重跑核心能力验证：对话、记忆、文件执行、联网。
5. 定期检查重要更新，不被提示框推着走。

## 历史版本记录

以下是历史版本口径，不代表当前版本：

- v0.1.0：功能显性版。
- v0.1.1：显示面板扩充和 DeepSeek 连接测试入口。
- v0.2.0：聊天为中心和自动信息提炼，当时属于 Phase 3 第一步。
- v0.3.0：MVP 架构闭环。
- v0.4.0-v0.4.5：桌面发行、执行底座、动作路由、版本管理和体验修复。
- v0.4.6 Alpha：公开 Alpha Release，当前版本。

## 对话管理原则

- 不依赖任何 AI 记住整段对话历史。
- 一个对话框只聊一个主线任务。
- 新对话默认提供 `AI-Workbench-Handoff.md`、`NEXT_STEP.md`、`THINKING.md`、`PRINCIPLES.md` 和 `GROWTH_LOG.md`；需要完整基准时再提供本文件。
- 需要判断某项具体验收时，再读取对应 `verification/<task>/summary.json`、`report.md`、必要的 `commands.log`、对应 commit 和 Git diff；不默认读取全部 verification 目录。
- 任何决策、结论、进度变化必须写回仓库。
