# 当前真实进度清单

生成时间：2026-07-24

范围：只按当前仓库真实文件和已提交验收证据盘点；不按记忆猜测。

## 1. 根目录关键文件

| 文件 | 是否存在 | 大小 |
| --- | --- | ---: |
| `PRODUCT.md` | 存在 | 2399 bytes |
| `VISION.md` | 存在 | 7645 bytes |
| `CURRENT_TASK.md` | 存在 | 7898 bytes |
| `ARCHITECTURE.md` | 存在 | 13686 bytes |
| `CHANGELOG.md` | 存在 | 17978 bytes |
| `TASKLOG.md` | 存在 | 任务总账本，记录任务状态、验收产物和缺失文件原因。 |
| `EXECUTION_PROTOCOL.md` | 存在 | GPT / Codex / Claude / 其他执行助手的任务执行与验收协议。 |
| `THINKING.md` | 存在 | 产品负责人判断依据，帮助新对话理解结论背后的原因。 |

版本号：

- `package.json` 当前版本：`0.4.6`
- `CHANGELOG.md` 最新版本条目：`Unreleased - AI Workbench 产品方向收口`

## 2. `research/` 真实存在文件

| 文件 | 大小 | 对应任务 | 当前进度 |
| --- | ---: | --- | --- |
| `ai-link-analysis.md` | 19371 bytes | AI Link 本机实现调研，拆解 Electron、worker、模型/通道代理和可借鉴架构。 | 调研完成；作为微信/飞书通道和本地代理方案参考。 |
| `channel-connection-plan.md` | 16555 bytes | 多平台连接实施方案，覆盖微信、飞书、Telegram 的通道 adapter、扫码绑定和消息回传。 | 方案完成；尚未进入实现，下一阶段手机端/通道连接时使用。 |
| `hermes-one-ecosystem.md` | 4065 bytes | Hermes One 商业版产品形态对标，梳理员工、通道、技能、编排、记忆。 | 调研完成；结论是功能内置化，用户只见一个页面。 |
| `intel-pipeline-plan.md` | 23681 bytes | AI 行业情报采集流水线方案，覆盖 X、小红书、平台 AI、OpenClaw 浏览器辅助和合规边界。 | 方案完成；当前明确先不做，等 P0/P1 稳定后再推进。 |
| `openclaw-candidate-gateway-test.md` | 4903 bytes | OpenClaw candidate 配置 gateway 启动验证。 | 已完成；结论是 candidate 配置结构可用但不能解决 gateway 不监听，问题转向 runtime。 |
| `openclaw-config-diff.md` | 11594 bytes | OpenClaw 配置缩水对比诊断，对比当前配置和 last-known-good。 | 已完成；结论是 size drop 主要来自 JSON 序列化变紧，不是关键配置段丢失。 |
| `openclaw-health.md` | 8358 bytes | OpenClaw 安装、命令、gateway、配置和日志的只读健康体检。 | 已完成；早期结论是 gateway 不可达、status 不应作为唯一健康检查。 |
| `openclaw-runtime-gateway-diagnosis.md` | 5729 bytes | OpenClaw gateway runtime 深挖，直调 Node 入口并检查 lock/state/device/browser/channel 残留。 | 已完成；结论是清理残留后 gateway 可启动监听 `18789`，问题收敛为启动慢和常驻管理。 |
| `pc-health-report.md` | 6594 bytes | 电脑与冰灵代理体检，检查系统资源、磁盘、网络、工作台/Hermes/OpenClaw。 | 已完成；作为环境稳定性和代理问题记录。 |
| `self-hosting-plan.md` | 10203 bytes | 自主化与去第三方依赖方案，规划把模型和员工调用收敛到本机代理。 | 方案完成；其中 OpenClaw 收敛到 `18800` 已进入并完成一轮实现验收。 |
| `unified-model-proxy-plan.md` | 6286 bytes | 统一模型入口方案，把 Workbench、Hermes、OpenClaw 三员工模型调用统一经过 `18800`。 | 已补卡并完成；代码已实现、验收脚本已跑通、commit 已推送。 |
| `version-management-plan.md` | 8879 bytes | 全链版本管理方案，锁定工作台、员工、模型、运行配置和验收证据。 | 方案完成；`v0.4.5` 已落地版本矩阵和验证脚本。 |

## 3. 应该有但没有的文件

| 缺失文件 | 为什么应该有 | 当前处理 |
| --- | --- | --- |
| `verification/model-router/summary.json` | 对话中曾用它指代“模型分层/模型路由”验收产物。 | 当前仓库不存在；模型分层任务尚未执行，不补假验收。已有 `verification/unified-model-proxy/summary.json` 只代表“统一模型入口”。 |
| `research/market-intelligence.md` | 对话中提到它应记录“39 张小红书情报整理”，属于后续情报/市场材料。 | 当前仓库不存在；已明确 P3，不影响 P0/P1 和统一模型入口，不补内容、不猜。 |

说明：

- `research/unified-model-proxy-plan.md` 之前缺失，但已经在本次补卡中新建并提交。
- `research/hermes-one-ecosystem.md` 和 `research/channel-connection-plan.md` 当前都真实存在，不是缺失文件。

## 4. 当前真实进度

<!-- AIW_CAPABILITY_STATUS_START -->

已完成：

- Windows 安装、启动、快捷方式和卸载。
- 陌生机器不崩：缺依赖、端口异常、18800/Hermes/OpenClaw 未就绪时给中文降级说明。
- 无用户 Key 真实模型调用：安装后无需用户配置模型 API Key；当前生产 provider 为 DeepSeek，架构保持多 provider 可替换。
- Cloudflare Managed Proxy 生产部署：Worker、D1、Secrets、生产 URL、当前真实 DeepSeek 上游、限流、预算、令牌刷新/吊销、紧急关闭和安全扫描已通过；这是当前生产实现，不是产品定位。
- ③A 总验收 passed。
- ③B GitHub Release passed，v0.4.6 Alpha 已公开下载并完成下载回测。
- 产品方向收口 completed。
- 文档基准纠偏与防漂移机制 completed：Handoff 已改为自动生成快照 + 权威索引，文档一致性校验脚本已建立。
- 电脑环境治理审计 completed：产品资产备份、恢复性验证、账号登录状态核查和清理候选清单已完成。
- 电脑环境治理第一批安全清理 partial：累计释放 F 盘约 3.06 GB，重启后指定遗留目录已删除并新增释放约 11.54 GiB；用户 npm 缓存仍因 `EPERM` 未清理，Windows 临时文件仍需产品负责人手动确认。
- 阶段性总审核（砍薄版） completed：备份隔离恢复、Git 凭据扫描和文档假完成核对均已通过，证据见 `verification/thin-stage-audit/summary.json`。
- 生存体检 completed_after_boundary_correction：分析任务 passed_after_boundary_correction。当前无真实用户用量；当前限额正常路径在 8000 input + 2048 output token 假设下先撞 `DAILY_TOKEN_LIMIT`，平台每天约 20 次成功模型调用、若每任务 2 次调用则每天约 10 个完整前端任务，月平台成本上界约 40.76 CNY，现金跑道约 7.96 个月。原 5/50/100 用户平台月成本 199.12 / 1686.24 / 3338.61 CNY 保留为 `uncapped_demand_pressure`，不代表当前生产限额下实际可发生的正常路径成本。钱包安全状态 unsafe；理论最坏成本 `unbounded` 的依据是失败/超时/并发逃逸路径不能证明 fail-closed。证据见 `verification/survival-cost-audit/summary.json`。
- 第 3A 段本地钱包刹车 local_passed_after_platform_aggregate_correction：首次实现被发现按模型分别执行 40 USD 硬上限，不满足所有 provider/模型合计 40 USD 的政策；现已修正为 `monthly_platform_budget(month_key)` 平台总账执行唯一条件原子预留，`monthly_model_budget(month_key, model)` 仅记录模型明细，不决定硬上限。单模型、跨模型顺序、跨模型并发、模型明细写入失败 fail-closed、超时/500 不退款、D1/缺价格不上游等本地 mock 测试通过。本轮未部署生产，未调用真实 provider，证据见 `verification/monthly-budget-circuit-breaker-local/summary.json`。
- 第 3B-1 段生产预检与远端 D1 备份 preflight_and_backup_passed：产品负责人已验收第 3A 段并批准进入 3B-1。本轮确认 Wrangler 4.113.0、既有 Cloudflare OAuth 身份、Worker `ai-workbench-managed-proxy`、D1 binding `DB`、生产数据库 `aiw-managed-proxy` 和脱敏 database ID 均与仓库配置及既有生产 verification 一致。远端 D1 已完整导出到仓库外 `D:\AI-Workbench-Backups\2026-07-24-managed-proxy-budget-predeploy\aiw-managed-proxy-predeploy-20260724.sql`，大小 20253 bytes，SHA256 `0D0A554C9BB655578FF747FB04F0B3407874A9022A1B6A9617F800C27AC54AAD`，并通过临时 SQLite 恢复 schema 验证。migration 未执行，Worker 未部署，Secrets 未修改，真实 provider 未调用。证据见 `verification/monthly-budget-production-preflight/summary.json`。
- 第 3B-2a 段远端 D1 migration remote_migration_passed：产品负责人已验收第 3B-1 段并批准进入 3B-2a。本轮在生产 D1 `aiw-managed-proxy` 中仅创建预算表 `monthly_platform_budget` 和 `monthly_model_budget`。migration 前复核外部备份大小 20253 bytes、SHA256 `0D0A554C9BB655578FF747FB04F0B3407874A9022A1B6A9617F800C27AC54AAD` 一致；migration 前只有 `daily_usage`、`installations`、`revoked_tokens`；migration 后原三张表仍存在，两张预算表存在且行数均为 0。未部署 Worker，未修改 Secrets，未调用真实 provider，未写入测试预算数据，未执行回滚。证据见 `verification/monthly-budget-production-migration/summary.json`。预算表已创建但生产钱包刹车尚未生效。
- 第 3B-2b1 段部署候选 deployment_candidate_ready：产品负责人已验收第 3B-2a 段并批准进入 3B-2b1。本轮在 `managed-proxy/wrangler.jsonc` 显式补齐 50 USD 平台政策上限、40 USD 模型硬上限和 `deepseek-chat` 公开价格配置，不再依赖代码 fallback；Managed Proxy 12 项本地回归通过。远端预算表仍存在且为空；当前生产 Worker 流量版本 `16333442-925a-4b11-a3d1-d6249d2492ba`、当前 deployment `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e` 和回滚目标已只读确认，`/health` 与 `/v1/models` 均 HTTP 200。未部署 Worker，未修改 Secrets，未调用真实 provider。证据见 `verification/monthly-budget-worker-deploy-readiness/summary.json`。部署候选已锁定但生产钱包刹车尚未生效。
- 第 3B-2b2a 段 Preview 上传验证 preview_upload_verified：产品负责人已验收第 3B-2b1 段并批准进入 3B-2b2a。本轮仅上传已锁定候选为新的 Worker Preview version `483e4fae-3af8-40fa-ab83-4551f08b519e`，Preview URL `/health` 和 `/v1/models` 均 HTTP 200，未认证 `/v1/chat/completions` HTTP 401 `missing_token` 并在 provider 前拒绝。active deployment 仍为 `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`，100% 生产流量仍指向 version `16333442-925a-4b11-a3d1-d6249d2492ba`；远端 `monthly_platform_budget` 和 `monthly_model_budget` 行数仍为 0。未部署 Worker，未修改 Secrets，未使用真实安装 Token，未调用真实 provider。证据见 `verification/monthly-budget-worker-preview-upload/summary.json`。Preview 版本已上传但生产钱包刹车尚未生效。
- 第 3B-2b2b 段零流量 deployment zero_traffic_deployment_verified：产品负责人验收通过 3B-2b2a 后批准执行。本轮用 `wrangler versions deploy` 创建 active deployment `063b83c3-974f-43fb-84f2-9da0d574f745`：旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 为 100%，新预算 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 为 0%。通过 production hostname 的 version override 定向验证新预算 version：`/health` HTTP 200，`/v1/models` HTTP 200，未认证聊天 HTTP 401 `missing_token`；预算表仍为空，未使用真实安装 Token，未调用真实 provider，未修改 Secrets，未执行回滚。上一段完整 Preview URL 当前文件已脱敏，历史不重写。证据见 `verification/monthly-budget-worker-zero-traffic-deployment/summary.json`。新预算 Worker 已加入 deployment，但正常生产流量仍为 0%，生产钱包刹车尚未对正常流量生效。
- 第 3B-2b2c 段 1% 生产灰度 one_percent_canary_observation_limited_by_low_traffic：产品负责人验收通过 3B-2b2b 后批准执行 1% 灰度。本轮 active deployment 更新为 `55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`，旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 为 99%，新预算 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 为 1%。20 分钟主动观察和 5 分钟指标缓冲完成；生产 `/health` 11 次和 `/v1/models` 11 次均 HTTP 200，version override 无付费 GET 检查通过。整体 tail 和候选错误 tail 未输出可见事件，未确认自然候选版本 invocation，因此可信度受低流量限制。预算表仍为 0 行/0 预留，未主动调用真实 provider，未修改 Secrets、D1 schema 或 Managed Proxy 功能代码，未触发回滚。证据见 `verification/monthly-budget-worker-one-percent-canary/summary.json`。新预算 Worker 当前仅 1% 正常生产流量，尚未全量。
- 第 3B-2b2d 段单笔真实预算链路验证 blocked_before_paid_call：产品负责人验收通过 3B-2b2c 后批准在 99%/1% 灰度状态下向新预算 version 发起最多一笔受控真实模型请求。本轮开始前仓库 clean，HEAD=origin/main=`db4e055273c4cd8a3639fe61e322644d5ed5a908`，`managed-proxy` 无 diff；active deployment 仍为 `55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`，旧稳定 version 99%，新预算 version 1%。生产和候选 override 的 `/health` 与 `/v1/models` 均 HTTP 200，Secrets 名称与 D1 schema 未变，预算表为空。预计算预留金额为 21 micro-USD，满足 100 micro-USD 安全门槛；一次性临时 Node 脚本只尝试 1 次注册，但未返回 HTTP 状态且未取得 Token，因此没有执行聊天请求、没有调用真实 provider、没有预算或 usage 增量、没有触发回滚。证据见 `verification/monthly-budget-worker-controlled-real-canary/summary.json`。本轮不得写成真实预算链路通过。
- 第 3B-2b2d 段阻塞恢复诊断 blocked_transport_cause_unresolved：产品负责人确认上次阻塞处理正确后批准继续同一段，先诊断注册无 HTTP 状态原因。本轮仓库 clean，HEAD=origin/main=`a36dfc0acb53bc8a636a5fcf7ce605c118156199`，`managed-proxy` 无 diff；生产仍为旧稳定 99%、新预算 1%，预算表仍为空，Secrets 和 D1 schema 未变。上次 evidence 未保存异常详情，本轮无付费诊断确认 Node 内置 fetch 未显式使用代理时在响应头前连接超时，cause code `UND_ERR_CONNECT_TIMEOUT`；显式 undici `ProxyAgent` 后同一 Node 环境可取得 GET/OPTIONS/无状态 POST 的 HTTP 响应，根因分类 `system_proxy_error`。但未取得独立证据证明 version override 命中新预算 version，因此不满足再次注册条件；本轮新增注册 0 次，累计注册仍 1 次，聊天 0 次，provider 调用 0 次，预算写入 0，未回滚。证据见 `verification/monthly-budget-worker-controlled-real-canary/summary.json`。
- 第 3B-2b2d 段候选 Versioned Preview 单笔真实链路 real_preview_call_failed_after_budget_reservation：产品负责人确认 transport 根因后批准改用候选 version Preview URL。本轮 Preview 无付费检查 `/health` 200、`/v1/models` 200、未认证聊天 401 `missing_token`；注册 1 次成功，唯一聊天 1 次返回 HTTP 400 `invalid_request_error`，无重试。预算账本已在 provider 前预留：平台总账 +21 micro-USD/+1 call，`deepseek-chat` 模型明细 +21 micro-USD/+1 call，增量等于预计算值；installations +1，daily_usage +2 requests/+2 input tokens/+0 output tokens。生产 active deployment 当时仍为旧版本 99%、新预算版本 1%，Secrets、D1 schema 和 Managed Proxy 代码未变，未回滚。证据见 `verification/monthly-budget-worker-controlled-real-canary/summary.json`。本轮不得写成 passed。
- DeepSeek V4 Flash 路由迁移本地候选 new_provider_model_route_candidate_ready_locally：产品负责人确认 HTTP 400 根因为旧上游模型名 `deepseek-chat` 退役后，本轮先将已知失败候选 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 从 1% 正常生产流量撤回到 0%，旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 恢复 100%，active deployment 为 `d9acb146-b720-4e09-b2b8-0257b93fc407`。本地代码实现逻辑模型 `deepseek-chat` 到上游正式模型 `deepseek-v4-flash` 的显式路由，预算明细改按实际计费模型 `deepseek-v4-flash` 记录；16 项 Managed Proxy 测试和 TypeScript 检查通过。既有 21 micro-USD 历史预留未修改。未上传新 Worker version，未部署生产修复，未修改 Secrets 或 D1 schema，未发起新的真实 provider 调用。证据见 `verification/deepseek-v4-flash-route-migration/summary.json`。
- DeepSeek V4 Flash 修复 Worker Preview v4_flash_candidate_preview_verified：产品负责人验收本地候选后批准只上传新 Worker version 并执行无付费 Preview 验证。新修复 version `a7eb385b-84df-4a45-b554-0aca40b6b407` / version number `12` 已上传，Preview alias 为 `budget-v4-flash-candidate`。Preview `/health` HTTP 200，`/v1/models` HTTP 200 并确认 `deepseek-chat` 是逻辑 alias、上游为 `deepseek-v4-flash`；未认证聊天 HTTP 401 `missing_token`。active deployment 前后均为 `d9acb146-b720-4e09-b2b8-0257b93fc407`，旧稳定 version 100%，失败候选 0%，新修复 version 正常生产流量 0%。两张预算表仍保持 21 micro-USD / call_count 1，未出现 `deepseek-v4-flash` 真实调用明细，Secrets 和 D1 schema 未修改，未注册 installation，未调用真实 provider。证据见 `verification/deepseek-v4-flash-worker-preview-upload/summary.json`。
- DeepSeek V4 Flash 非思考兼容本地候选 v4_flash_nonthinking_compatibility_candidate_ready_locally：产品负责人验收第 3B-2b2e Preview 上传通过后，付费验证前确认 version 12 未显式固定 `deepseek-chat` 非思考语义，因此 version 12 不用于付费真实验证。本地修正为 `deepseek-chat` 路由新增 `thinkingMode: "disabled"`，服务端强制上游 payload 为 `model: deepseek-v4-flash` 和 `thinking.type: disabled`，并覆盖客户端传入的 `thinking.type: enabled`。缺失或非法 `thinkingMode` 在预算预留和 provider 调用前 fail closed；`/v1/models` 输出 `thinking_mode: disabled`。Managed Proxy 19 项测试和 TypeScript 检查通过；未上传新 Worker version，未部署，未注册 installation，未调用真实 provider，生产流量未修改，历史 21 micro-USD 未修改。证据见 `verification/deepseek-v4-flash-nonthinking-compatibility/summary.json`。
- DeepSeek V4 Flash 非思考真实 Preview 验证 blocked_after_single_registration_before_real_call：产品负责人验收非思考兼容本地候选后批准上传新的非思考兼容 Worker version，并在无付费安全门后最多一次注册和一次真实调用。新 version `cf002344-57ee-4c3f-86a6-115ca66c8b5f` / version number `13` 已上传，Preview alias `budget-v4-nt-real-candidate`；无付费 Preview `/health`、`/v1/models`、未认证聊天 401 `missing_token` 均通过，生产 active deployment 未变化，旧稳定 version 仍 100%，新 version 正常生产流量 0%。一次性脚本唯一注册后在聊天前预算读取阶段崩溃，Token 未打印未持久化且不可恢复；按“一次且仅一次注册”边界停止，真实聊天 0 次、provider 调用 0 次、预算预留 0。D1 仅确认 installations +1、daily_usage +1；平台预算仍 21/1，历史 `deepseek-chat` 仍 21/1，无 `deepseek-v4-flash` 行。证据见 `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json`。
- DeepSeek V4 Flash 非思考真实 Preview 链路 v4_flash_nonthinking_real_path_passed：产品负责人确认 run1 阻断不是 Worker、D1、Secret、DeepSeek 或预算代码问题，而是 Windows Node 子进程错误调用 `.cmd` 文件，并批准 run2 复用现有 version 13。run2 未上传新 version，未修改 Worker/配置/Secrets/D1 schema/production deployment；父级终端直接读 D1，Token 进程移除所有子进程调用，只注册一次并聊天一次。注册 HTTP 200，聊天 HTTP 200，provider model `deepseek-v4-flash`，回答 `OK`，`reasoning_content` 为空，usage 为 prompt 7 / completion 1 / total 8。预算预留按最终 payload 计算为 23 micro-USD；平台总账 21/1 -> 44/2，`deepseek-v4-flash` 明细不存在 -> 23/1，历史 `deepseek-chat` 保持 21/1。version 13 仍未加入 active deployment，正常生产流量 0%。证据见 `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json`。
- Version 13 的 1% 生产灰度 version13_one_percent_canary_observation_limited_by_low_traffic：产品负责人验收通过 version 13 DeepSeek V4 Flash 非思考真实 Preview 链路后批准执行 1% 灰度。本轮先纠正旧 verification summary 中 run1/run2 顶层字段歧义；随后复用现有 version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f`，未上传新 version，未修改 Worker、Wrangler 配置、Secrets 或 D1 schema。active deployment 更新为 `9952d7cb-2d99-483a-85f7-c9ada1a09db4`，旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 承载 99%，version 13 承载 1%。20 分钟主动观察和 5 分钟指标缓冲完成；生产 `/health`、`/v1/models` 和 Preview GET 检查均 HTTP 200，候选 tail/error tail 窗口未观察到 JSON invocation 或 runtime error，未触发回滚。因未捕获足够自然候选 invocation，观察可信度受低流量限制。预算保持平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1；Codex 本轮主动注册 0 次、聊天 0 次、provider 调用 0 次。证据见 `verification/version13-one-percent-production-canary/summary.json`。
- Version 13 全量生产切换 version13_full_production_active_observation_limited_by_low_traffic：产品负责人验收通过 version 13 的 1% 正常生产灰度后批准 100% 全量。本轮复用现有 version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f`，未上传新 version，未修改 Worker、Wrangler 配置、Secrets、D1 schema、routes 或 domains；只用 `wrangler versions deploy` 将 active deployment 更新为 `0400b7aa-49fe-460d-ac6d-3ed5bfdb0480`，且该 deployment 只包含 version 13，承载 100% 正常生产流量。30 分钟主动观察和 5 分钟指标缓冲完成；生产 `/health`、`/v1/models` 和 Preview GET 检查均 HTTP 200，error tail 窗口未观察到 JSON runtime error，未触发回滚。预算保持平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1；Codex 本轮主动注册 0 次、聊天 0 次、provider 调用 0 次。钱包刹车与 V4 Flash 非思考路由已处于 active production version，但未捕获足够自然生产 invocation，长期真实用户样本仍不足。证据见 `verification/version13-full-production-promotion/summary.json`。
- 第 3 阶段钱包刹车正式封板 PASS_AFTER_CONDITIONS_RESOLVED：GPT 技术验收初始结论为 `CONDITIONAL_PASS`，Claude 逻辑复核提出需要确认两张账本非整体原子是否可能绕过硬上限；代码和测试复核确认属于安全的情况 A。平台总账 `monthly_platform_budget` 是唯一用于决定是否允许继续调用 provider 的硬刹车，模型明细 `monthly_model_budget` 只用于审计和分类统计。平台总账的硬上限预留通过带额度条件的单条更新完成，属于硬刹车所依赖的条件原子操作；模型明细账在平台预留成功后单独更新，不与平台总账构成一个整体原子事务。如果模型明细账更新失败，请求会 fail closed，provider 不会被调用；平台总账已产生的保守预留保持不退款，后续请求仍以平台总账判断剩余额度，因此只可能更早停止，不可能突破 40 USD 模型调用硬上限。产品负责人已批准正式结束第 3 阶段。

未完成：

- 等待产品负责人批准下一阶段范围和执行指令。
- 实际电脑清理。
- 首屏 3-5 条示例指令。
- 反馈入口和安全/隐私告知。
- v0.4.7 产品内埋点与错误日志：需求已确认，尚未设计和开发；隐私告知需要覆盖埋点字段、目的、范围、保存方式和用户权利；第 3 阶段已封板，但 v0.4.7 仍未启动，需等待产品负责人批准下一阶段范围和执行指令。
- 桌面端预算到顶错误展示与用户引导：后端已有错误码 `monthly_budget_exhausted` 和中文提示“共享模型服务本月额度已用完，请稍后再试。”；本阶段没有独立证明桌面端会以清晰、友好的方式展示该提示，记录到 v0.4.7 或首批真人试用前检查。
- 3-5 名真实用户测试。
- 长期记忆。
- 任务历史和状态卡。
- 质量检查层。
- 自动任务拆解和分配。
- 模型分层。
- 完整多 Agent 调度。
- 手机端。
- 情报流水线。
- 跨网站复杂执行。
- 国际化和区域合规。

当前唯一下一步：等待产品负责人批准下一阶段范围和执行指令。

<!-- AIW_CAPABILITY_STATUS_END -->

- 产品版本：`v0.4.6` Alpha，GitHub Release 已公开发布并完成下载回测。
- 任务账本：`TASKLOG.md` 已补齐，后续每次任务都必须同步更新。
- 执行协议：`EXECUTION_PROTOCOL.md` 已补齐，所有新 AI / Codex 接手前必须读取。
- 上一步做完了什么：上线硬骨头2“共享 key 落地”已完成。18800 服务端支持共享托管 key 兜底，用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`；验收摘要在 `verification/shared-key/summary.json`。
- 统一模型入口：已完成代码实现和验收。`model-proxy.mjs` 已扩展为 provider registry；Workbench、Hermes、OpenClaw 三类执行入口都已通过 `18800` 调用当前生产 provider DeepSeek，验收摘要在 `verification/unified-model-proxy/summary.json`。DeepSeek 是当前实现细节，后续 provider 必须可替换。
- 模型分层：尚未执行；不要用统一模型入口的验收产物冒充 `verification/model-router/summary.json`。
- 现在卡在什么：上线三大硬骨头已完成。3A-R1.3、3A-R2.0、3A-R2.1、③A 总验收和 ③B GitHub Alpha Release 均已 passed；公开 Release 下载回测确认安装包大小和 SHA256 与 ③A 候选包完全一致。产品方向已收口并写入现有文档。第 3 阶段钱包刹车与 DeepSeek V4 Flash 非思考 version 13 全量生产已通过技术验收、逻辑复核和产品负责人最终批准，状态为 `PASS_AFTER_CONDITIONS_RESOLVED`。自然用户规模稳定性仍未证明；唯一下一步是等待产品负责人批准下一阶段范围和执行指令。
- `research/` 里真实存在文件：见第 2 节，共 12 个 `.md` 文件。
- `research/` 里应该有但缺的文件：`market-intelligence.md`，原因见第 3 节。

## 5. 近期优先级

1. 等待产品负责人批准下一阶段范围和执行指令。
2. 模型分层调度与上下文压缩只能在产品负责人明确批准后执行。
3. v0.4.7 首屏示例、反馈入口和安全告知。
4. 3-5 名真实用户测试。
5. 合规的竞品和用户反馈情报收集。

当前不做：

- 收费机制。
- 多语言。
- 手机端。
- 完整多 Agent 调度。
- 生态扩张。

## 6. 当前未解决风险

- 成本失控：生存体检曾确认钱包安全状态 unsafe；第 3 阶段已正式封板，生产 D1 预算表已创建，DeepSeek V4 Flash 非思考真实 Preview 链路已通过，version 13 已成为 100% active production version，钱包刹车处于生产生效状态。模型分层和上下文压缩仍未完成，且大量真实用户长期稳定性仍未证明。
- 上游账号合规：当前生产 DeepSeek provider 使用单一上游账户服务陌生用户的许可边界仍需确认；这是当前实现风险，不改变产品的多 provider 框架定位。
- 账号单点故障：GitHub、Cloudflare 和关键开发账号的恢复方案尚未核查。
- 本机执行安全：未来在用户电脑执行操作前必须建立权限、确认和回滚机制。
- 尚无真实用户使用数据。
- 工具链依赖 Codex 等外部工具。
