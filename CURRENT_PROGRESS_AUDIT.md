# 当前真实进度清单

> 历史快照：本文件不再代表当前项目状态。
> 当前真实状态唯一以CURRENT_STATUS.md为准；
> 当前唯一下一步以NEXT_STEP.md为准。

生成时间：2026-07-28

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
| `ENVIRONMENT_OPS_ISSUES.md` | 存在 | 运行环境、网络、代理、AI Link、渠道、账号恢复和支付/API 问题的权威总表。 |

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
- v0.4.7 可执行施工图 audit_completed_docs_only：本轮从代码、配置、测试、安装脚本和现有文档审计 v0.4.7 市场基础可用性缺口，形成 9 个模块状态、公共底层清单、施工顺序、8 个工作包和第一批 2–3 个推荐工作包。状态只是施工图，不代表 v0.4.7 功能开发已启动；本轮未修改功能代码、未调用真实模型、未启动 Agent、未部署、未接入任何通讯入口。
- 本地 Codex 任务网关 v0.1 local_gateway_and_real_codex_smoke_passed：本轮修复 Windows `.cmd` 启动适配，根因为 Node/Windows 直接 `spawn('codex.cmd', ...)` 在进程创建前返回 `spawn EINVAL`；现在通过 `%ComSpec% /d /s /c call "codex.cmd" ...` 受控启动，prompt 仍走 stdin，不进入命令行。已确认本机 Codex CLI `codex-cli 0.144.4`，正式非交互入口为 `codex.cmd exec`，支持 stdin、`--cd`、`--json`、`--sandbox` 和 `--output-last-message`；实测不支持 `--ask-for-approval`，已从调用契约移除，人工批准由任务网关状态机强制。新增 launcher fixture 测试覆盖 `.cmd`、带空格路径、cwd、stdin/stdout/stderr、退出码、超时/取消和 shell 注入防护；`npm.cmd run verify:task-gateway`、`npm.cmd run verify`、无模型 `codex.cmd --version`、无模型 `codex.cmd exec --help` 均通过。唯一新增真实只读 Codex smoke 启动 1 次，得到正确只读输出，worktree 已清理，文件修改为空，无 commit、push、deploy、scope violation、auth/quota/billing 错误；费用状态 `unknown`。真实 smoke 后发现网关后置 Git 检查缺少 `safe.directory`，已改为 per-call 临时配置，不修改全局 Git 配置。证据见 `verification/local-codex-task-gateway-v01/summary.json`。
- 飞书渠道适配最小闭环 v0.1 feishu_channel_implementation_passed_live_smoke_blocked_by_credentials_or_permissions：本轮使用 AI Workbench 自己控制的飞书企业自建应用方案，安装并审计官方 SDK `@larksuiteoapi/node-sdk@1.71.1`，实测支持 `WSClient`、`im.message.receive_v1` 和 `client.im.v1.message.create`。新增 `scripts/feishu-task-channel.mjs` 和 `scripts/verify-feishu-task-channel.mjs`，飞书层只负责接收文本命令、owner 鉴权、一次性配对、报告群绑定、调用现有任务网关、回复状态和发送脱敏摘要；任务执行仍由本地任务网关和独立 worktree 中的 Codex 负责。新增 npm 命令 `feishu-channel:start`、`feishu-channel:check`、`verify:feishu-channel`，新增 `.env.example` 只列变量名。mock Feishu 测试通过，覆盖非文本拒绝、未授权拦截、配对过期/一次性、重复事件去重、群普通消息忽略、群 @ 触发、报告群绑定、started/completed/failed/blocked/cancelled 通知、通知去重、通知失败不改变任务结果、prompt 不进群通知和不自动 push/deploy。当前本机未配置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`，真实长连接、ping、报告群绑定和飞书到本地 Codex 真实 smoke 未执行。证据见 `verification/feishu-task-channel-v01/summary.json`。
- 基础环境、网络、代理、支付与账号问题资产化 docs_only_completed：新增 `ENVIRONMENT_OPS_ISSUES.md`，归档 2026-07-27 至 2026-07-28 的 17 项真实问题，覆盖电脑、本地进程、代理、网络、国内外兼容、AI Link/飞书、海外账号恢复、官方API支付和用户体验；P0 5项、P1 9项、P2 2项、P3 1项。AI Link 当前状态统一为 `temporarily_recovered`，不得写成永久修复。Environment Ops 已写入架构，执行协议已加入事故流程和12项Preflight。本轮只改文档，不修改产品代码、AI Link、代理、网络、账号、支付或生产环境，不发起付费调用。

- Environment Ops只读运行环境基线 completed_and_accepted：完成Windows、资源、适配器、时间同步、AI Link进程/端口/health、代理、国内外非付费链路、飞书活动连接和Git基线；完成30分17秒、7样本观察。L1 healthy、L2 healthy、L3 route_dependent、L4 application_proxy_mismatch、L5 healthy、L6初始unknown、L7 healthy、L8 partially_reachable。证据见`verification/environment-ops-readonly-baseline/`。

- AI Link单次受控生成前最小就绪核验 completed_and_accepted：UI完整可交互，Session有效，当前1个主进程族和2个工作流；`AW-AILINK-GROUP-001`草稿为`review_ready/review`。请求链静态审计和单次提交操作卡已完成，未执行生成。证据见`verification/ai-link-readiness/`。

- AI Link上游路由定性与版本3方案只读审查 completed_and_accepted：分类`functional_but_unmanaged_route`，方案审查`review_passed_with_nonblocking_notes`，明确`new_generation_not_required`。证据见`verification/ai-link-route-and-review/`。

- AI Link版本3方案确认与员工准备 completed_and_accepted：方案只确认一次；3名新员工分别创建成功，2名现有员工正确复用。证据见`verification/ai-link-confirm-and-prepare/`。

- AI Link首批开发协作群创建与结构核验 completed_waiting_product_owner_acceptance：5/5绑定和正式名称映射核验通过，唯一目标群已创建；当前`ready/done`，群专属Skill 1.0.0在5名员工中一致安装，`requiresMention=true`。证据见`verification/ai-link-group-create/`。

未完成：

- 等待产品负责人验收AW-AILINK-GROUP-CREATE-001群结构；验收通过后，另行决定是否批准准备阶段的群内只读任务，不自动发送消息或进入正式开发。
- 实际电脑清理。
- 首屏 3-5 条示例指令。
- 反馈入口和安全/隐私告知。
- v0.4.7 产品内埋点与错误日志：需求已确认，尚未开发；已纳入本轮施工图的工作包 E，需等待产品负责人审核施工图并批准第一批工作包。
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
- Environment Ops P0/P1：草稿和账号安全、请求幂等、唯一实例、UI/Session/服务一致性、Node/Electron代理适配、国内外分流、网络稳定性和飞书连接稳定性尚未永久修复。
- Environment Ops P2：OpenAI/Anthropic官方API付款、项目/Workspace、Key和预算小额验证尚未执行。
- Environment Ops P3：现有首批开发协作群已创建，5名员工绑定和群专属Skill结构已核验；准备阶段群内只读任务和正式开工均尚未批准。

当前唯一下一步：等待产品负责人验收 AW-AILINK-GROUP-CREATE-001 群结构；验收通过后，另行决定是否批准准备阶段的群内只读任务，不自动发送消息或进入正式开发。

<!-- AIW_CAPABILITY_STATUS_END -->

## 5. 任务归属地图

状态枚举固定为：`completed_and_verified`、`active_current_stage`、`approved_not_started`、`candidate_after_current_stage`、`waiting_for_real_user_feedback`、`strategic_research`、`personal_growth_or_external_dependency`、`blocked`、`rejected_or_deferred`、`unknown_needs_audit`。

当前没有 `active_current_stage` 的产品实施任务；唯一下一步仍是等待产品负责人验收 AW-AILINK-GROUP-CREATE-001 群结构；验收通过后，另行决定是否批准准备阶段的群内只读任务，不自动发送消息或进入正式开发。

| # | 任务线 | 产品模块 | 专业岗位 | 真实问题/用户 | 状态与证据 | 已完成/未完成/子模块 | 依赖 | 记录位置与完整性 | 预计涉及 | 并行/冲突 | 信任/安全/验证 | 当前是否开始/拍板 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | v0.4.6 Windows 发布 | 桌面端、打包发布 | 桌面端、DevOps、QA | 用户需要公开安装包。 | `completed_and_verified`，`verification/3b-release/summary.json`。 | 已发布 public prerelease；长期稳定未证明。 | 3A 总验收。 | `TASKLOG.md`、`CHANGELOG.md`、`verification/3b-release/summary.json`，记录完整。 | Release、安装包、SHA256。 | 发布操作必须串行。 | 下载回测、哈希、安装验收。 | 不开始，已完成。 |
| 2 | 三员工统一模型入口 | 模型/Agent/工具调度 | 后端、AI 调度、QA | Workbench/Hermes/OpenClaw 模型请求需统一。 | `completed_and_verified`，`verification/unified-model-proxy/summary.json`。 | 18800 统一入口已完成；模型分层未完成。 | 本机代理。 | `research/unified-model-proxy-plan.md`、`TASKLOG.md`，记录完整。 | `model-proxy.mjs`、员工配置。 | 与模型路由冲突，集成串行。 | 不泄露 Key，验证三入口。 | 不开始，已完成。 |
| 3 | Cloudflare Managed Proxy | 成本和钱包安全、后端 | Cloudflare、后端、安全 | 用户无 Key 也能安全调用真实模型。 | `completed_and_verified`，`verification/managed-proxy-production/summary.json`。 | Worker/D1/Secrets/限流/令牌/紧急关闭已验收。 | shared_managed 架构。 | `DECISIONS.md`、`TASKLOG.md`、`verification/managed-proxy-production/`，记录完整。 | `managed-proxy/`、Cloudflare。 | 生产操作串行。 | Secret 只在服务端，安全扫描。 | 不开始，已完成底座。 |
| 4 | 钱包刹车第 3 阶段 | 成本和钱包安全 | 后端、Cloudflare、成本、审计 | 平台模型费用不能失控。 | `completed_and_verified`，状态 `PASS_AFTER_CONDITIONS_RESOLVED`。 | 40 USD 硬上限生产生效；自然规模稳定性未证明。 | D1、version 13、生产灰度。 | `CURRENT_PROGRESS_AUDIT.md`、`tasks/2026-07-26-第3阶段钱包刹车正式封板.md`，记录完整。 | `managed-proxy/` 和 verification；本轮不改代码。 | 预算算法/生产流量必须串行。 | 平台总账硬刹车、fail closed、独立验收。 | 不开始，已封板。 |
| 5 | v0.4.7 | 基础体验、反馈/埋点、桌面端 | 产品、UX、前端、数据、QA | 首批市场可用性缺口。 | `candidate_after_current_stage`，范围已记录，未启动。 | 候选范围十项；未设计未开发。 | 第 3 阶段封板已满足；仍需产品负责人批准下一阶段。 | `PRODUCT.md`、`DECISIONS.md`、`GROWTH_LOG.md`，记录较完整。 | `src/`、日志、隐私文案、桌面提示。 | 内部各项可设计并行，集成串行。 | 隐私、错误提示、基础质量验收。 | 需要产品负责人拍板。 |
| 6 | 首屏示例 | 产品定义与基础体验 | 产品、UX、UI、前端 | 用户打开后不知道能干嘛。 | `candidate_after_current_stage`。 | 3-5 条示例未做。 | v0.4.7 或真人试用前质量线。 | `TASKLOG.md`、`PRODUCT.md`，记录完整。 | 首页/聊天入口。 | 可并行设计，前端串行。 | 不夸大能力，点击即跑需验收。 | 待拍板。 |
| 7 | 反馈入口 | 用户反馈、埋点和错误日志 | 产品、前端、用户运营 | 用户遇阻后需要说问题。 | `candidate_after_current_stage`。 | 入口未做。 | 隐私告知和反馈处理流程。 | `DECISIONS.md`、`PRODUCT.md`，记录完整。 | 前端入口、反馈渠道。 | 可并行设计。 | 不收集过度信息。 | 待拍板。 |
| 8 | 安全和隐私告知 | 安全/隐私/合规 | 隐私合规、UX、前端 | 用户需知道产品记录什么、不做什么。 | `candidate_after_current_stage`。 | 告知要求已定，具体文案未设计。 | 埋点字段、权限、日志方案。 | `DECISIONS.md`，记录完整。 | 隐私文案、设置。 | 可并行草拟，发布串行。 | 明确保存、访问、关闭和清除。 | 待拍板。 |
| 9 | 埋点和错误日志 | 用户反馈、埋点和错误日志 | 数据、日志、隐私、后端 | 用户只说“不好用”时需要定位卡点。 | `candidate_after_current_stage`。 | 需求确认；事件 schema/存储/上传未做。 | 隐私批准和 v0.4.7 设计。 | `DECISIONS.md`、`GROWTH_LOG.md`，记录完整。 | 事件、错误码、日志。 | 方案可并行，代码串行。 | 仅最小元数据，不默认正文。 | 待拍板。 |
| 10 | 预算撞顶中文提示 | 成本和钱包安全、桌面端 | 后端、前端、UX、QA | 额度用完时用户要理解原因。 | `candidate_after_current_stage`。 | 后端错误码和中文提示已存在；桌面端友好展示未证明。 | v0.4.7 或试用前检查。 | `NEXT_STEP.md`、`TASKLOG.md`，记录完整。 | 前端错误展示。 | 可并行测试设计。 | 不暴露技术细节，恢复路径清楚。 | 待拍板。 |
| 11 | 图片粘贴 | 图片、文件和多模态 | 前端、多模态、隐私、QA | 用户用截图表达问题。 | `candidate_after_current_stage`。 | 真实缺口，未开发。 | 隐私告知、附件模型。 | 本轮补入 `PRODUCT.md`，原记录不完整。 | 输入框、附件预览。 | 与图片上传/理解相关，集成串行。 | 不泄露路径，用户可删除。 | 待拍板。 |
| 12 | 图片上传 | 图片、文件和多模态 | 前端、后端、隐私 | 用户需要选择图片文件。 | `candidate_after_current_stage`。 | 未开发。 | 文件类型/大小限制、隐私。 | 本轮补入 `PRODUCT.md`，原记录不完整。 | 文件选择、上传链路。 | 与文件理解冲突。 | 明确是否发送服务端。 | 待拍板。 |
| 13 | 图片理解 | 图片、文件和多模态 | 多模态、AI 调度、成本 | 用户希望工作台看懂图片。 | `waiting_for_real_user_feedback`。 | 未开发；是否 v0.4.7 实现待工作量判断。 | 图片上传、模型能力、钱包成本。 | 本轮补入 `PRODUCT.md`，原记录不完整。 | 模型路由、预算、UI。 | 与模型分层/成本冲突。 | 不默认采集敏感图片。 | 待拍板。 |
| 14 | 文件理解 | 图片、文件和多模态 | 前端、后端、多模态/解析、隐私 | 用户希望总结或处理文件。 | `waiting_for_real_user_feedback`。 | 早期 Hermes 读文件场景有验证；通用文件理解未完成。 | 文件权限、解析、安全。 | `ARCHITECTURE.md` 有历史，当前地图补齐。 | 文件选择、解析器、证据。 | 可研究并行，代码串行。 | 文件范围和权限透明。 | 待拍板。 |
| 15 | 上下文连续性 | 上下文、记忆和会话 | 上下文、数据、UX | 用户不想重复解释。 | `candidate_after_current_stage`。 | 多对话和记忆 MVP 存在；完整连续性待审计。 | 会话存储、隐私、压缩。 | `ARCHITECTURE.md`、`CHANGELOG.md`，记录不完整。 | 数据结构、聊天入口。 | 与压缩/记忆冲突。 | 防串线、可清除。 | 待拍板。 |
| 16 | 会话恢复 | 上下文、记忆和会话 | 桌面端、数据、QA | 重启后不丢上下文。 | `unknown_needs_audit`。 | 历史多会话存在；恢复质量未单独验收。 | 本地数据、异常恢复。 | `CHANGELOG.md`，需补审计到 `CURRENT_PROGRESS_AUDIT.md`。 | 本地数据、UI。 | 可审计并行，修复串行。 | 防串线和用户清除。 | 待拍板。 |
| 17 | 上下文压缩 | 模型分层和上下文压缩 | 上下文、AI 调度、成本 | 降低重复 Token，保留关键上下文。 | `waiting_for_real_user_feedback`。 | 已确认重要，未启动。 | 真实用户任务、质量验收。 | `THINKING.md`、`GROWTH_LOG.md`，记录完整。 | 摘要/压缩链路。 | 与模型分层相关。 | 不丢关键信息，不降质量。 | 待拍板。 |
| 18 | 安装和卸载 | 桌面端 | 桌面端、打包、QA | 用户必须能安装和卸载。 | `completed_and_verified`。 | v0.4.6 安装/启动/卸载已验收；自动更新未做。 | NSIS、Release。 | `verification/3a-final/summary.json`、`verification/3b-release/summary.json`，记录完整。 | Electron/NSIS。 | 发布串行。 | 哈希、卸载、残留检查。 | 已完成底座。 |
| 19 | 真人试用 | 真人试用和质量验收 | 产品、用户研究、QA、客服 | 内部想象不能替代真实用户。 | `candidate_after_current_stage`。 | 1-2 名/3-5 名尚未开始。 | 第 3 阶段封板，首批质量线。 | `PRODUCT.md`、`THINKING.md`，第一批画像不完整。 | 试用任务、反馈表、日志。 | 招募准备可并行。 | 不采集过度数据。 | 需产品负责人定人群。 |
| 20 | 环境自检 | 环境自检和用户同意后配置 | 桌面端、DevOps、UX | 环境问题阻止用户开始。 | `candidate_after_current_stage`。 | readiness 降级已做；主动诊断未完整。 | 安装链路和权限告知。 | `ARCHITECTURE.md`、`verification/clean-machine/summary.json`，记录较完整。 | readiness、自检页面。 | 可审计并行。 | 禁止无关扫描。 | 待拍板。 |
| 21 | 用户同意后配置 | 环境自检和用户同意后配置 | UX、安全、桌面端 | 配置需要透明同意。 | `candidate_after_current_stage`。 | 原则已写，功能未完整。 | 环境自检、权限设计。 | `PRODUCT.md`、`PRINCIPLES.md`，本轮补齐。 | 设置/修复动作。 | 与自动修复冲突。 | 说明原因、好处、可撤回。 | 待拍板。 |
| 22 | 手机端 App | 手机端 App | 移动端、隐私、发布 | 移动场景长期可能重要。 | `strategic_research`。 | 未设计未开发。 | 桌面闭环和真实需求。 | `VISION.md`、`PRODUCT.md`，记录完整。 | iOS/Android/鸿蒙。 | 研究可并行。 | 平台权限和审核。 | 当前不做。 |
| 23 | Web 端 | Web端 | Web、后端、安全 | 浏览器访问和同步长期可能需要。 | `strategic_research`。 | 未设计未开发。 | 账户、同步、云安全。 | 本轮补入 `PRODUCT.md`，原记录不完整。 | Web/API/部署。 | 研究可并行。 | 账号和数据安全。 | 当前不做。 |
| 24 | macOS | 多系统和生态扩展 | 桌面端、发布、QA | 覆盖非 Windows 用户。 | `strategic_research`。 | 未开始。 | Windows 稳定和真实需求。 | 本轮补入 `PRODUCT.md`，原记录不足。 | 打包、签名、公证。 | 研究可并行。 | 平台签名和兼容。 | 当前不做。 |
| 25 | Linux | 多系统和生态扩展 | 桌面端、发布、QA | 覆盖开发者/专业用户。 | `strategic_research`。 | 未开始。 | 核心能力稳定。 | 本轮补入 `PRODUCT.md`。 | 打包、依赖。 | 研究可并行。 | 发行版差异。 | 当前不做。 |
| 26 | 鸿蒙 | 手机端 App、多系统扩展 | 移动端、本地化、合规 | 中国移动生态可能需要。 | `strategic_research`。 | 未开始。 | 手机端策略和用户分布。 | 本轮补入 `PRODUCT.md`。 | 移动端代码/商店。 | 研究可并行。 | 平台规则。 | 当前不做。 |
| 27 | 微信入口 | 通讯入口 | API、生态、合规、客服 | 用户可能在微信触达。 | `strategic_research`。 | 未开始。 | 用户分布、平台规则。 | `research/channel-connection-plan.md`，记录较完整。 | Channel adapter。 | 研究可并行，接入串行。 | 授权、隐私、平台限制。 | 当前不做。 |
| 28 | 飞书入口 | 通讯入口 | API、生态、合规 | 团队用户可能在飞书；当前优先用于产品负责人内部研发指挥。 | `approved_not_started` 用于外部/团队用户入口；内部研发适配见任务 63。 | 通用入口原则和调研存在；本轮只实现内部研发最小适配，真实飞书 smoke 因凭据/权限未执行。 | 产品负责人自建应用配置、账号规则。 | `research/channel-connection-plan.md`、`VISION.md`、`verification/feishu-task-channel-v01/summary.json`。 | Feishu adapter。 | 内部研发 smoke 可继续；外部用户入口仍需另行批准。 | 权限、消息数据、App Secret 不入仓库。 | 外部用户入口当前不做；内部 smoke 等待配置。 |
| 29 | Telegram 入口 | 通讯入口 | API、国际化、合规 | 国际用户通讯入口候选。 | `strategic_research`。 | 未实现。 | 国际用户验证。 | `research/channel-connection-plan.md`。 | Bot/API adapter。 | 研究可并行。 | 平台规则、隐私。 | 当前不做。 |
| 30 | WhatsApp 入口 | 通讯入口 | API、国际化、合规 | 国际用户候选入口。 | `strategic_research`。 | 未记录充分，未实现。 | 用户分布和 Meta 平台规则。 | 本轮补入 `PRODUCT.md`，原先不完整。 | WhatsApp API。 | 研究可并行。 | 平台审核和数据。 | 当前不做。 |
| 31 | Discord 入口 | 通讯入口 | API、开发者生态、合规 | 开发者/社区入口候选。 | `strategic_research`。 | 未记录充分，未实现。 | 用户分布。 | 本轮补入 `PRODUCT.md`，原先不完整。 | Discord bot。 | 研究可并行。 | 权限和社区规则。 | 当前不做。 |
| 32 | 应用商店 | 多系统和生态扩展、发布 | 发布、合规、品牌 | 用户需要可信分发。 | `strategic_research`。 | GitHub Release 已有；商店未做。 | 签名、隐私、成熟版本。 | 本轮补入 `PRODUCT.md`，原先不完整。 | 商店材料/包。 | 研究可并行，发布串行。 | 审核、隐私、更新。 | 当前不做。 |
| 33 | 虚拟人格测试 | 真人试用和质量验收 | 用户研究、QA、Claude/GPT | 提前覆盖表达差和信息缺失场景。 | `candidate_after_current_stage`。 | 方法已记录，未执行。 | 试用任务和质量线。 | 本轮补入 `PRODUCT.md`。 | 测试脚本/用例。 | 可并行。 | 不替代真人测试。 | 待拍板。 |
| 34 | 模型分层 | 模型分层和上下文压缩 | AI 调度、成本、QA | 简单任务低成本，复杂任务高质量。 | `waiting_for_real_user_feedback`。 | 未实施，不得用统一入口冒充。 | 钱包安全、真实任务数据。 | `CURRENT_PROGRESS_AUDIT.md`、`THINKING.md`，记录完整。 | 路由、模型配置、测试。 | 方案可并行，代码串行。 | 不为省钱牺牲质量。 | 当前不做。 |
| 35 | 多模型生态 | 模型/Agent/工具调度 | AI 调度、生态、成本 | 避免单模型结构性风险。 | `waiting_for_real_user_feedback`。 | 架构开放，生产仅 DeepSeek。 | Provider registry、成本、安全。 | `PRODUCT.md`、`DECISIONS.md`，记录完整。 | Provider adapter。 | 研究可并行。 | Key、费用、合规。 | 当前不做。 |
| 36 | 多 Agent 生态 | 模型/Agent/工具调度、多 Agent 杠杆 | Agent 工程、产品、QA | 不同任务需要不同执行者。 | `waiting_for_real_user_feedback`。 | Hermes/OpenClaw 历史接入；完整多 Agent 未完成。 | 任务引擎和验证。 | `ARCHITECTURE.md`、`EXECUTION_PROTOCOL.md`，记录完整。 | Agent adapter。 | 研究可并行，集成串行。 | 权限、冲突、假完成。 | 当前不做。 |
| 37 | 工具生态 | 模型/Agent/工具调度 | API、生态、安全 | 成熟工具比自造更快。 | `waiting_for_real_user_feedback`。 | 原则已定，具体工具待需求。 | 用户任务、权限。 | `PRINCIPLES.md`、`PRODUCT.md`，记录完整。 | Tool adapters/MCP。 | 研究可并行。 | 供应链和权限。 | 当前不做。 |
| 38 | 信息收集 | 信息收集 | 用户研究、数据、合规 | 产品需要真实市场和生态信息。 | `waiting_for_real_user_feedback`。 | 重要性确认，当前不开工。 | 真实用户和具体信息需求。 | `GROWTH_LOG.md`、`THINKING.md`，记录完整。 | 研究工具/公开 API。 | 可并行研究，不接生产。 | 不绕过验证码/登录/反爬。 | 当前不做。 |
| 39 | 用户反馈情报 | 信息收集、反馈日志 | 用户研究、数据、产品 | 发现重复需求，减少凭感觉开发。 | `waiting_for_real_user_feedback`。 | 未开发；可随真人试用启动轻量整理。 | 反馈入口、用户样本。 | `GROWTH_LOG.md`，记录完整。 | 表格/反馈分析。 | 可并行研究。 | 隐私和授权。 | 待用户反馈。 |
| 40 | 支付 | 支付和商业化 | 支付、后端、合规、客服 | 长期可持续经营。 | `strategic_research`。 | 产品支付未开发。 | 真实用户、成本模型、合规。 | `DECISIONS.md`、`PRODUCT.md`，记录完整。 | 支付接口、账单。 | 研究可并行，集成串行。 | 透明收费、退款、欺诈。 | 当前不做。 |
| 41 | 免费额度 | 支付和商业化、成本安全 | 产品、成本、支付 | 零门槛与成本平衡。 | `strategic_research`。 | 平台预算底座有，用户免费策略未定。 | 真实用量和商业化策略。 | `DECISIONS.md`，记录不完整；本轮补入 `PRODUCT.md`。 | 额度、账单、提示。 | 研究可并行。 | 不误导用户。 | 待拍板。 |
| 42 | 用户自带 Key | 支付和商业化、成本安全 | 产品、后端、安全、隐私 | 可能降低平台成本但会破坏零门槛。 | `strategic_research`。 | 当前不作为首选；共享托管 Key 已落地。 | 成本压力、用户能力、隐私。 | `DECISIONS.md`，记录较完整。 | Key 管理、加密存储。 | 研究可并行。 | Key 泄露和门槛。 | 当前不做。 |
| 43 | Visa 个人支付能力 | 个人成长 | 产品负责人 | 减少对第三方账号访问 AI 工具依赖。 | `personal_growth_or_external_dependency`。 | 个人学习待研究。 | 个人时间和资金。 | `GROWTH_LOG.md`，记录完整。 | 不涉及产品代码。 | 可个人并行。 | 不写个人精确财务数字。 | 产品不启动。 |
| 44 | 加密支付研究 | 加密支付 | 合规、安全、支付研究 | 可能解决部分国际支付问题。 | `strategic_research`。 | 当前只研究，不开发。 | 法律允许、平台规则、真实需求。 | `VISION.md`、`PRODUCT.md`，本轮补齐。 | 不涉及代码。 | 可研究并行。 | 资产安全、欺诈、争议。 | 当前不做。 |
| 45 | 宣传网站 | 宣传页面、品牌和市场营销 | 品牌、前端、市场 | 用户需要可信介绍和入口。 | `strategic_research`。 | 未启动。 | 产品实际能力、下载路径。 | 本轮补入 `PRODUCT.md`，原记录不完整。 | 官网/站点。 | 文案可并行，公开发布串行。 | 不宣传未完成功能。 | 当前不做。 |
| 46 | 产品下载页 | 宣传页面、发布 | 前端、发布、品牌 | 下载入口要清晰可信。 | `candidate_after_current_stage`。 | GitHub Release 已有；专门下载页未做。 | v0.4.6 Release、品牌文案。 | `README.md`、本轮补入 `PRODUCT.md`。 | 官网/README。 | 可并行草案。 | 版本、哈希、边界准确。 | 待拍板。 |
| 47 | 品牌 | 宣传页面、品牌和市场营销 | 品牌、产品、内容 | 用户需要理解定位并信任。 | `strategic_research`。 | 未系统设计。 | 产品能力稳定和用户反馈。 | 本轮补入 `PRODUCT.md`。 | 文案、视觉。 | 可并行研究。 | 不夸大。 | 当前不做。 |
| 48 | 内容宣传 | 宣传页面、品牌和市场营销 | 内容、市场、产品 | 让用户理解真实使用场景。 | `strategic_research`。 | 未启动。 | 真实案例和边界。 | 本轮补入 `PRODUCT.md`。 | 文章、案例。 | 可并行草拟。 | 宣传不能超过能力。 | 当前不做。 |
| 49 | 市场营销 | 宣传页面、品牌和市场营销 | 市场、用户运营、品牌 | 找到真实用户和渠道。 | `strategic_research`。 | 未启动。 | 首批质量线和定位。 | `THINKING.md`、本轮补入 `PRODUCT.md`。 | 渠道、活动。 | 可研究并行。 | 不以夸大换增长。 | 当前不做。 |
| 50 | 国际化 | 多系统和生态扩展 | i18n、本地化、合规 | 全球用户需要语言和地区适配。 | `strategic_research`。 | 未实施。 | 真实地区需求。 | `VISION.md`、`PRODUCT.md`。 | 文案、地区配置。 | 研究可并行。 | 地区合规。 | 当前不做。 |
| 51 | 用户运营 | 真人试用、客户支持 | 用户运营、客服、产品 | 试用后需要收集、分类和跟进问题。 | `candidate_after_current_stage`。 | 未启动。 | 真人试用批准。 | 本轮补入 `EXECUTION_PROTOCOL.md`。 | 反馈表、问题分类。 | 可准备并行。 | 隐私和用户同意。 | 待拍板。 |
| 52 | 客户支持 | 客户支持、环境自检 | 客服、产品、QA | 用户遇到安装/错误需要恢复路径。 | `candidate_after_current_stage`。 | 未系统化。 | 试用和错误日志。 | 本轮补入 `EXECUTION_PROTOCOL.md`。 | FAQ、错误提示。 | 可并行准备。 | 不甩技术报错。 | 待拍板。 |
| 53 | 多 Agent 协作 | 多 Agent 和一人团队杠杆 | GPT、Claude、Codex、Agent 工程 | 一人团队需要杠杆但不能失控。 | `strategic_research`。 | 规则已写，未调用外部 Agent。 | baseline 和文件边界。 | `EXECUTION_PROTOCOL.md`、`PRINCIPLES.md`，记录完整。 | 研究/补丁/审计流程。 | 研究可并行，main 集成串行。 | 不直接 push main，不读 Secret。 | 当前不做。 |
| 54 | 一人团队并行成本 | 多 Agent 和一人团队杠杆 | 产品、成本、项目管理 | 并行会消耗注意力和集成成本。 | `strategic_research`。 | 原则已记录。 | 任务边界和真实收益。 | `THINKING.md`、`EXECUTION_PROTOCOL.md`。 | 计划/审计。 | 可研究。 | 防止多线漂移。 | 当前不做。 |
| 55 | 产品安全 | 安全、权限、隐私和合规 | 安全、QA、后端 | 保护密钥、用户、安装包和声誉。 | `candidate_after_current_stage`。 | 密钥/预算底座已做；系统安全加固未启动。 | 真实用户和权限范围。 | `PRINCIPLES.md`、`GROWTH_LOG.md`，记录完整。 | 扫描、权限、日志。 | 审查可并行。 | 只防御，不攻击。 | 待拍板。 |
| 56 | 防御性安全 | 安全、权限、隐私和合规 | 安全、合规 | 防 Prompt Injection、依赖和供应链风险。 | `candidate_after_current_stage`。 | 已确认重要，未开发。 | v0.4.7/真实用户。 | `PRINCIPLES.md`、`GROWTH_LOG.md`。 | 安全工具、扫描。 | 可研究并行。 | 不开发攻击能力。 | 待拍板。 |
| 57 | 隐私合规 | 安全、权限、隐私和合规 | 隐私、合规、产品 | 数据记录和权限需要透明。 | `candidate_after_current_stage`。 | 原则和埋点边界已写；完整政策未设计。 | 埋点/图片/文件/支付。 | `DECISIONS.md`、`PRINCIPLES.md`，记录完整。 | 隐私告知、设置。 | 可并行草拟。 | 告知、同意、撤回、清除。 | 待拍板。 |
| 58 | 自动更新 | 桌面端、发布 | 桌面端、DevOps、安全 | 用户需要获得修复，不手动重装。 | `unknown_needs_audit`。 | 未单独设计。 | 发布、签名、回滚。 | 本轮补入 `PRODUCT.md`，原记录不足。 | Electron updater。 | 研究可并行。 | 签名、回滚、用户同意。 | 待拍板。 |
| 59 | 崩溃恢复 | 桌面端、环境自检 | 桌面端、QA、日志 | 崩溃后用户要能继续。 | `candidate_after_current_stage`。 | 陌生机器不崩部分完成；崩溃恢复体系未完整。 | 错误日志、环境自检。 | `verification/clean-machine/summary.json`、本轮补齐。 | watchdog、日志、UI。 | 可审计并行。 | 不暴露 traceback。 | 待拍板。 |
| 60 | 数据备份和恢复 | 上下文、记忆、环境 | 数据、桌面端、安全 | 用户本地数据和证据不能轻易丢。 | `unknown_needs_audit`。 | 项目资产备份已做；产品用户数据备份未明确。 | 本地数据结构、隐私。 | `verification/pc-environment-governance/summary.json`，产品侧记录不足。 | 本地数据/导出恢复。 | 研究可并行。 | 用户可控、隐私。 | 待拍板。 |
| 61 | 产品分析和质量体系 | 执行/检查/修复、反馈日志 | QA、数据、产品 | 持续发现质量问题。 | `candidate_after_current_stage`。 | verification 制度已建；产品内质量数据未做。 | 埋点、错误日志、真人试用。 | `EXECUTION_PROTOCOL.md`、本轮补入 `PRODUCT.md`。 | 指标、报告、验收。 | 可并行设计。 | 指标不能夸大。 | 待拍板。 |
| 62 | 其他仓库中已提出但未列出的任务 | 全部 | 技术文档、产品、审计 | 防止历史任务散落丢失。 | `unknown_needs_audit`。 | 已搜索并纳入当前 66 条；后续发现继续补。 | 新对话/历史审计。 | `TASKLOG.md`、`CHANGELOG.md`、`research/`，需要持续维护。 | 文档。 | 可审计并行，写回串行。 | 不伪造未执行验收。 | 持续补录，需拍板。 |
| 63 | 国内内部研发指挥入口 | 通讯入口、多渠道指挥 | 产品、API、安全、Codex、成本 | 使用者是产品负责人本人；希望通过手机向 AI Workbench 派发研发任务，再交给本地 Codex。 | `blocked`，状态 `feishu_channel_implementation_passed_live_smoke_blocked_by_credentials_or_permissions`。 | 飞书适配实现和 mock 测试已完成；真实长连接、ping、报告群绑定和飞书到本地 Codex 真实 smoke 因缺少本机 `FEISHU_APP_ID`/`FEISHU_APP_SECRET` 与后台权限配置未执行。 | 产品负责人完成飞书企业自建应用最小权限配置、发布应用、设置本机环境变量。 | `verification/feishu-task-channel-v01/summary.json`、`manual-config-checklist.md`，记录完整。 | `scripts/feishu-task-channel.mjs`、`scripts/verify-feishu-task-channel.mjs`、任务网关。 | 不阻塞 v0.4.7；与 Telegram 内部入口共享任务网关核心。 | owner allowlist/一次性配对、报告群绑定、通知脱敏、App Secret 不入仓库；验收仍需真实飞书 smoke。 | 等待产品负责人配置飞书应用并批准真实 smoke。 |
| 64 | 国际内部研发指挥入口 | 通讯入口、多渠道指挥 | 产品、API、安全、Codex、国际化、成本 | 使用者是产品负责人本人；通过国际通用入口验证远程指挥 AI Workbench 和本地 Codex。 | `approved_not_started`，当前只研究，不开发。 | 候选入口 Telegram；目标与任务 63 相同，用于国际通用入口和国际环境验证；未开发。 | 统一任务入口、身份权限、Codex 本地隔离执行、成本框架、账号条件。 | 本轮补入 `CURRENT_PROGRESS_AUDIT.md` 和 `PRODUCT.md`，原先记录不完整。 | Telegram adapter、任务网关、权限确认；本轮不改代码。 | 可与飞书入口做方案比较，不能同时开发两个入口。 | 同任务 63；额外验证国际可用性、稳定性、平台规则和成本。 | 首选入口仍待产品负责人批准。 |
| 65 | 国内外部用户入口 | 通讯入口、用户入口 | 产品、API、合规、客服、用户运营 | 未来国内用户可能希望通过熟悉的通讯工具使用 AI Workbench。 | `candidate_after_current_stage`，当前不做。 | 候选入口飞书、微信；目标是用户通过外部入口使用同一 AI Workbench 核心；未开发。 | 真实用户需求、隐私告知、账号合规、客服流程、核心调度稳定。 | 本轮补入 `CURRENT_PROGRESS_AUDIT.md` 和 `PRODUCT.md`。 | 入口适配器、用户身份、消息回传。 | 研究可并行，开发必须等用户需求和产品负责人批准。 | 用户数据、授权、平台规则、客服负担；验收看授权、消息往返、核心能力一致和隐私告知。 | 当前不开始，需拍板。 |
| 66 | 国际外部用户入口 | 通讯入口、用户入口、国际化 | 产品、API、国际化、合规、客服 | 未来国际用户可能通过 Telegram、WhatsApp、Discord 或其他集中渠道使用产品。 | `candidate_after_current_stage`，当前不做。 | 候选入口 Telegram、WhatsApp、Discord、其他国际渠道；未开发。 | 真实国际用户、地区合规、隐私告知、支付和支持能力。 | 本轮补入 `CURRENT_PROGRESS_AUDIT.md` 和 `PRODUCT.md`。 | 国际入口适配器、身份、消息回传。 | 研究可并行，开发串行；不得把核心锁死在 Telegram。 | 地区规则、平台审核、隐私和客服风险；验收看授权、跨地区可用性、消息往返和核心能力一致。 | 当前不开始，需拍板。 |

### 通讯入口成本框架

本轮只建立核算框架，不制造真实付费调用。所有数据必须标记为 `actual`、`estimate` 或 `unknown`，不知道的不得写成 0。

当前首选入口选择状态：`waiting_for_product_owner_channel_selection`。飞书和 Telegram 都是内部研发指挥入口候选；当前不同时开发，先做哪一个由产品负责人根据账号条件、支付、成本、安全和接入难度批准。

| 成本项 | 每天 1 个任务 | 每天 3 个任务 | 每天 10 个任务 | 1 个 Codex 任务 | 2 个并行 Codex 任务 | 3 个并行 Codex 任务 | 当前数据状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 飞书内部入口 | unknown | unknown | unknown | unknown | unknown | unknown | `unknown`：未接入、未测算账号/API/消息成本。 |
| Telegram 内部入口 | unknown | unknown | unknown | unknown | unknown | unknown | `unknown`：未接入、未测算 Bot/API/网络成本。 |
| AI Link 或其他第三方方案 | unknown | unknown | unknown | unknown | unknown | unknown | `unknown`：未重新核价，不能写成免费或 0。 |
| 自建 AI Workbench 入口 | estimate：会有本地服务、网关、维护和安全成本 | estimate | estimate | estimate | estimate | estimate | `estimate`：只有成本类别，未做金额测算。 |
| Codex 使用费用 | unknown | unknown | unknown | unknown | unknown | unknown | `unknown`：本轮不查询或触发付费。 |
| 大脑模型费用 | actual：生产钱包刹车 40 USD 月硬上限已生效；具体入口任务增量 unknown | actual/unknown | actual/unknown | unknown | unknown | unknown | `actual` 仅限已封板钱包刹车事实；入口增量 unknown。 |
| 本地电脑运行 | estimate：电力、设备占用和网络稳定性成本 | estimate | estimate | estimate | estimate | estimate | `estimate`：未做精确金额。 |
| 维护 | estimate：入口、权限、日志、异常处理和平台变更维护成本 | estimate | estimate | estimate | estimate | estimate | `estimate`：未量化。 |
| 审核和返工 | estimate：GPT 技术证据审核、Claude 产品逻辑复核、产品负责人拍板会增加时间成本 | estimate | estimate | estimate | estimate | estimate | `estimate`：未量化。 |

## 6. 时间与执行地图

| 分类 | 任务线 |
| --- | --- |
| 当前真实问题 | 首屏示例、反馈入口、安全和隐私告知、埋点和错误日志、桌面端预算撞顶中文提示、图片/上下文可用性审计、基础加载/失败/重试/恢复体验、真人试用前质量检查。 |
| 首批市场交付前必须做 | 产品定义与基础体验及格线、桌面端安装启动卸载、成本和钱包安全、基础安全隐私告知、反馈入口、预算到顶友好提示检查、真人试用准备。 |
| 真人试用后再决定 | 图片理解、文件理解、上下文压缩、模型分层、多模型生态、多 Agent 生态、信息收集、用户反馈情报、更多渠道入口。 |
| 长期产品能力 | Web 端、手机端、多系统、生态扩展、自动更新、数据备份恢复、完整质量体系、团队/开发者能力、国际化。 |
| 战略研究 | 加密支付、支付商业化、应用商店、宣传品牌营销、生态合作、外部多 Agent 平台。 |
| 当前不做 | v0.4.7 开发、图片/上下文/手机端/Web 端、多 Agent、支付、加密支付、宣传营销、信息抓取、安全加固工程、任何新阶段。 |
| 可并行研究 | 国内/国际内部研发指挥入口、虚拟人格测试设计、成熟产品研究、信息收集方案、多 Agent 成本测算、用户研究、市场/竞品、支付和合规、UI/UX 草案、测试用例、渠道入口、生态和工具调研。 |
| 可隔离并行开发 | 小型 UI 候选、测试脚本候选、文案候选、外部 Agent 隔离补丁；不得直接 push main，必须由 Codex 统一集成。 |
| 必须串行集成 | `NEXT_STEP.md`、产品定义、已锁定决策、当前进度、功能代码、预算/模型路由、Cloudflare/D1/Secrets、Release 和安装包。 |

- 产品版本：`v0.4.6` Alpha，GitHub Release 已公开发布并完成下载回测。
- 任务账本：`TASKLOG.md` 已补齐，后续每次任务都必须同步更新。
- 执行协议：`EXECUTION_PROTOCOL.md` 已补齐，所有新 AI / Codex 接手前必须读取。
- 上一步做完了什么：上线硬骨头2“共享 key 落地”已完成。18800 服务端支持共享托管 key 兜底，用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`；验收摘要在 `verification/shared-key/summary.json`。
- 统一模型入口：已完成代码实现和验收。`model-proxy.mjs` 已扩展为 provider registry；Workbench、Hermes、OpenClaw 三类执行入口都已通过 `18800` 调用当前生产 provider DeepSeek，验收摘要在 `verification/unified-model-proxy/summary.json`。DeepSeek 是当前实现细节，后续 provider 必须可替换。
- 模型分层：尚未执行；不要用统一模型入口的验收产物冒充 `verification/model-router/summary.json`。
- 现在卡在什么：上线三大硬骨头已完成。3A-R1.3、3A-R2.0、3A-R2.1、③A 总验收和 ③B GitHub Alpha Release 均已 passed；公开 Release 下载回测确认安装包大小和 SHA256 与 ③A 候选包完全一致。产品方向已收口并写入现有文档。第 3 阶段钱包刹车与 DeepSeek V4 Flash 非思考 version 13 全量生产已通过技术验收、逻辑复核和产品负责人最终批准，状态为 `PASS_AFTER_CONDITIONS_RESOLVED`。自然用户规模稳定性仍未证明；v0.4.7 施工图已形成但未开工；首批开发协作群已创建并完成结构核验，唯一下一步是等待产品负责人验收 AW-AILINK-GROUP-CREATE-001 群结构；验收通过后，另行决定是否批准准备阶段的群内只读任务，不自动发送消息或进入正式开发。
- `research/` 里真实存在文件：见第 2 节，共 12 个 `.md` 文件。
- `research/` 里应该有但缺的文件：`market-intelligence.md`，原因见第 3 节。

## 7. 25 模块路线与归档基准（唯一进度权威）

本节只维护阶段、优先级、完成度和开工状态；模块理念和设计正文在对应权威文件中。状态不等于自动开工，当前唯一下一步仍以 `NEXT_STEP.md` 为准。

| # | 模块 | 内容权威 | 当前阶段状态 |
| ---: | --- | --- | --- |
| 01 | 产品愿景 | `VISION.md` | 方向已归档，持续校准 |
| 02 | 产品路线图 | 本文件 | 持续维护 |
| 03 | 产品原则 | `PRINCIPLES.md` | 已归档并生效 |
| 04 | 产品架构 | `ARCHITECTURE.md` | 基础架构已形成，持续演进 |
| 05 | Agent体系 | `ARCHITECTURE.md` | 单体接入与内部网关已有基础；完整体系未完成 |
| 06 | 模型调度 | `ARCHITECTURE.md` | 统一入口已完成；完整模型分层未完成 |
| 07 | 信息抓取与竞品观察 | `PRODUCT.md` | 研究方案存在，产品能力未开工 |
| 08 | 用户理解 | `PRODUCT.md` | 产品要求已归档，系统化能力未完成 |
| 09 | 虚拟人格 | `PRODUCT.md` | 立即纳入测试设计，不能替代真人验收 |
| 10 | 用户体验 | `PRODUCT.md` | 基础桌面体验已有；v0.4.7 及格线待实施 |
| 11 | 故障诊断 | `ARCHITECTURE.md`、`ENVIRONMENT_OPS_ISSUES.md` | 已建立17项真实问题档案；自动诊断库未完成 |
| 12 | 环境兼容 | `ARCHITECTURE.md`、`ENVIRONMENT_OPS_ISSUES.md` | Environment Ops边界已建立；代理兼容、分流和网络稳定仍待修复 |
| 13 | 工程经验 | `EXECUTION_PROTOCOL.md` | 已归档并作为执行规范生效 |
| 14 | 安全 | `PRINCIPLES.md` | 铁律已生效；持续审计 |
| 15 | 成本控制 | `PRINCIPLES.md` | 生产钱包刹车已封板；长期成本持续观察 |
| 16 | 日志与证据 | `EXECUTION_PROTOCOL.md` | verification 体系已建立；产品内日志待 v0.4.7 |
| 17 | 测试体系 | `EXECUTION_PROTOCOL.md` | 自动验收基础已建立；虚拟人格与真人真机体系未完整 |
| 18 | 飞书/AI Link集成 | `ARCHITECTURE.md` | 内部飞书本地实现/mock 通过，真实闭环阻塞；外部入口未开工 |
| 19 | 产品运营与营销 | `PRODUCT.md` | 尚无真实用户，未正式启动 |
| 20 | 项目连续性 | `EXECUTION_PROTOCOL.md` | 文件驱动、Handoff 和一致性检查已建立 |
| 21 | 故障恢复 | `ARCHITECTURE.md` | 部分降级和恢复存在；完整任务续跑未完成 |
| 22 | 产品演进 | `VISION.md` | 思考层已归档，不代表开工 |
| 23 | 决策记录 | `DECISIONS.md` | 已建立唯一决定权威 |
| 24 | 决策者与团队运作 | `THINKING.md` | 已归档并持续维护 |
| 25 | 商业化与收款 | `PRODUCT.md` | 正式产品模块；收费与收款实现暂缓 |

优先级口径：当前先完成可靠及格线和真实用户闭环；长期模块先保留边界，不因重要而自动插队。版本号唯一权威是 `package.json`。

## 8. v0.4.7 可执行施工图

本节是 v0.4.7 第 1 步“审计现有代码并建立施工图”的权威记录。状态标签只使用：`completed_and_verified`、`implemented_not_verified`、`partially_implemented`、`not_implemented`、`unknown_needs_audit`、`blocked`、`deferred_after_v047`。本节不代表功能开发已经启动。

### 8.1 当前代码真实结构

- 桌面壳：`electron/main.cjs` 启动本机模型代理 `model-proxy.mjs` 和应用服务 `server.mjs`，默认检查 `18800`、`8787`，失败时加载中文 fallback page。
- 前端：`src/main.jsx` 和 `src/styles.css` 实现聊天主界面、输入框、会话列表、任务侧栏、基础 Markdown、伪流式显示、网络重试和本地数据保存。
- 应用服务：`server.mjs` 提供 `/api/data`、`/api/readiness`、`/api/chat-message`、Agent health、错误归一化、健康修复、版本检查和静态资源。
- 模型代理：`model-proxy.mjs` 监听 `127.0.0.1:18800`，当前 provider registry 只有 DeepSeek；本机 key 优先，安装版默认走 Managed Proxy；公开模型仍是 `deepseek-chat` 逻辑名。
- 生产代理：`managed-proxy/src/index.ts` 已完成钱包刹车、`deepseek-chat` 到 `deepseek-v4-flash` 非思考路由和 D1 预算账本，生产已封板。
- Agent 雏形：`agents/registry.mjs`、`agents/adapter-contract.mjs`、`agents/router.mjs`、`agents/adapters/*.mjs` 定义 DeepSeek、Hermes、OpenClaw adapter，但面向市场的统一任务状态、权限确认和多入口调度还不完整。
- 本地数据：`runtime-paths.mjs` 把用户数据、日志、证据放到 `%APPDATA%\ai-workbench` 或用户目录 fallback；`server.mjs` 的 `workbench.json` 保存 messages、conversations、tasks、runs、memories。
- 安装发布：`package.json`、`build/installer.nsh` 和 `electron-builder` 支持 v0.4.6 Windows NSIS 安装包；自动更新、非中文系统完整验收和陌生真人验收未完成。

### 8.2 9 个模块审计

| 模块 | 状态 | 真实代码位置 | 已实现 | 主要缺口 | v0.4.7 市场及格线 |
| --- | --- | --- | --- | --- | --- |
| 1. 模型调用和任务执行底层 | `partially_implemented` | `server.mjs`、`model-proxy.mjs`、`agents/*`、`managed-proxy/src/index.ts` | Workbench/Hermes/OpenClaw 都可经 `18800` 调当前生产 provider；Managed Proxy 有生产钱包刹车和 V4 Flash 非思考路由。 | 本地 `model-proxy.mjs` provider registry 只有 DeepSeek；模型能力、价格、路由、错误仍分散在本机代理和 Worker；没有统一 model capability schema；Codex 只是研发工具，不是产品运行模型。 | 先抽出最小 provider/model capability 配置和统一调用/错误结构，不接新模型；保留 DeepSeek 低成本执行者定位。 |
| 2. 基础对话和界面 | `partially_implemented` | `src/main.jsx`、`src/styles.css`、`server.mjs` | 输入框、发送、Enter 发送/Shift+Enter 换行、加载中、伪流式、网络重试、失败文案、本地会话、新建/删除/重命名、基础 Markdown、长内容滚动、自动滚动。 | 无真正取消；无用户可点重试；无复制按钮；无代码块专门渲染；链接不自动可点击；首屏只有 1 条示例；预算撞顶无专门 UI；用户对长任务状态感知不足。 | 首屏 3–5 条示例、明确 loading/cancel/retry、复制、代码块和链接、预算到顶中文提示、基础状态提示。 |
| 3. 图片能力 | `not_implemented` | `src/main.jsx`、`server.mjs` | 静态资源 MIME 包含常见图片类型，仅用于前端静态文件。 | 无粘贴/拖入/选择/预览/删除/多图/大小格式限制/压缩/上传/后端接收/provider 多模态格式/隐私提示/失败恢复。 | 最低及格线需先做可见附件结构、预览删除、大小格式限制、隐私提示、失败提示；图片理解是否进 v0.4.7 需单独拍板。 |
| 4. 文件能力 | `partially_implemented` | `agents/adapters/hermes.mjs`、`server.mjs` | Hermes 有 `read_file_summarize` 工具意图和本地文件读取执行路径。 | 前端不能选择文件；没有统一附件结构；没有 PDF/Word/Excel/Markdown/代码文件解析策略；没有临时文件生命周期；可能只靠自然语言路径，不适合陌生用户。 | v0.4.7 先支持文本/Markdown/代码或先只做文件入口审计，PDF/Office 优先评估成熟解析库，不自研大解析系统。 |
| 5. 上下文和会话 | `partially_implemented` | `src/main.jsx`、`server.mjs`、`runtime-paths.mjs` | 同一会话消息保存在本地 JSON；会话列表、新建、删除、重命名、应用重启后可读取数据结构；旧 messages 可迁移为 default conversation。 | 未做会话恢复专项验收；无长对话限制；无上下文压缩；模型调用只发送当前输入或工具短上下文，不发送完整多轮历史给模型；无用户可见数据位置/清除全部；跨会话串线风险未专项测试。 | v0.4.7 必须证明同一会话连续性、不同会话隔离、本地保存和重启恢复；高级上下文压缩可后置，但必须有长度限制。 |
| 6. 反馈、埋点、错误日志和隐私 | `partially_implemented` | `electron/main.cjs`、`runtime-paths.mjs`、`model-proxy.mjs`、`server.mjs`、`errors/normalize.mjs` | Electron 启动日志、模型代理调用日志、systemErrors、错误归一化已有；后端可记录失败经验。 | 无反馈入口；无正/负反馈；无用户补充说明；无产品埋点 schema；无日志保留期限、查看/删除、拒绝开关；未证明不采集正文、图片、文件或凭据。 | 最小数据原则：默认不记录完整对话正文、图片正文、文件正文、Secret、Token、Cookie、Authorization；只记录必要元数据并提供隐私告知。 |
| 7. 安装、启动、环境自检和恢复 | `partially_implemented` | `electron/main.cjs`、`readiness.mjs`、`health/self-heal.mjs`、`build/installer.nsh`、`scripts/verify-install-release.mjs` | Windows 安装/卸载、服务自启、端口/依赖 readiness、fallback page、smoke test、日志目录已存在。 | 端口冲突恢复不够主动；防火墙/代理/非中文 Windows/陌生真人安装未充分验证；自动更新未做；用户同意后配置流程不完整；崩溃恢复和卸载数据保留说明不足。 | 陌生用户能下载、安装、启动；缺环境时看懂原因；配置前征得同意；失败可恢复或退出。 |
| 8. 测试、虚拟人格和真人验收 | `partially_implemented` | `scripts/verify*.mjs`、`scripts/capture*.mjs`、`verification/*` | 已有单元/集成/安装/发布/Cloudflare/文档一致性验证脚本和大量 evidence。 | 没有 v0.4.7 模块级测试矩阵；虚拟人格测试未脚本化；图片/文件/上下文/日志隐私/预算撞顶 UI/非中文系统/真人下载安装验收未建立。 | 建立 v0.4.7 验收矩阵，覆盖虚拟人格、UI、会话、图片文件、日志隐私、安装和真人试用；虚拟人格不能替代真人。 |
| 9. 内部研发提速和并行执行 | `partially_implemented` | `EXECUTION_PROTOCOL.md`、`agents/*`、`research/channel-connection-plan.md` | 多 Agent 原则、入口拆分、Agent adapter 雏形、OpenClaw/Hermes 调用已有。 | 没有飞书/Telegram 内部入口；没有手机任务接收、任务编号、文件驱动协调 Agent 执行器、独立 worktree 并行和高风险审批产品化链路。 | 作为辅助研究线，不阻塞 v0.4.7 主线；底层保持入口适配器可替换。 |

文档与代码不一致或容易误读的点：

- 文档长期描述的图片、文件、多模态、上下文压缩、反馈埋点、手机端、Web 端、多入口和多模型分层都属于战略或候选任务，不是当前已实现功能。
- `agents/definitions.mjs` 中 OpenClaw capabilities 包含 `feishu`、`telegram`、`discord` 等词，但仓库没有真实通讯入口接入；只能说明候选能力标签存在。
- `src/main.jsx` 有 `storage.fileSizeBytes` 元数据展示来源，但没有用户文件上传能力；不能写成文件能力已完成。
- `model-proxy.mjs` 有 provider registry 形态，但当前只有 DeepSeek provider；不能写成完整多 provider 生产分层已完成。
- 后端已有 `monthly_budget_exhausted` 中文提示来自 Managed Proxy，但桌面端专门展示和用户引导尚未独立验证。

### 8.3 公共底层清单

| 公共底层 | 当前是否存在 | 是否需要重构 | 依赖方 | 不先做的返工风险 | 是否第一批 |
| --- | --- | --- | --- | --- | --- |
| 统一输入结构 | 部分存在：`/api/chat-message` 只接 `{content, conversationId}` | 需要 | UI、图片、文件、会话、Agent | 图片/文件会各自造参数 | 是 |
| 文字/图片/文件统一消息结构 | 不存在 | 需要 | UI、后端、provider、日志 | 附件与会话、隐私、重试全返工 | 是 |
| 统一任务状态 | 部分存在：tasks/runs 有 running/done/failed | 需要收敛 | Agent、UI、验收 | UI 状态、取消、重试不一致 | 是 |
| 统一错误结构 | 部分存在：`errors/normalize.mjs` 和 Managed Proxy error | 需要映射 | UI、日志、预算撞顶 | 各模块各写错误文案 | 是 |
| 统一取消和重试机制 | 部分存在：前端网络重试、adapter cancel | 需要 | UI、Agent、模型请求 | 长任务无法恢复，重复请求风险 | 是 |
| 会话数据结构 | 部分存在：conversations/messages | 需要加版本和边界 | 上下文、附件、恢复 | 后续迁移困难 | 是 |
| 本地持久化 | 部分存在：runtime `workbench.json` | 需要隐私/清除/备份策略 | 会话、日志、反馈 | 用户数据不可控 | 是 |
| provider 抽象 | 部分存在：`model-proxy.mjs` provider registry、Worker 路由 | 需要最小化 | 模型调用、测试 | 多模型时散改 UI/业务 | 是 |
| 模型能力声明 | 部分存在：`agents/definitions.mjs` 和 Worker `/v1/models` | 需要统一 | 图片、文件、分层 | 不知道哪个模型能看图/长上下文 | 是 |
| 文件和图片临时存储边界 | 不存在 | 需要 | 图片、文件、隐私 | 内容泄漏或残留 | 是 |
| 日志字段和隐私边界 | 部分存在：日志文件和 systemErrors | 需要 | 反馈、埋点、QA | 误记正文或凭据 | 是 |
| 权限检查 | 部分存在：健康修复和高权限说明 | 需要 | 文件、系统操作、入口 | 擅自操作用户环境 | 是 |
| 成本记录接口 | 部分存在：Managed Proxy D1 预算 | 暂不改生产，可加客户端成本状态映射 | 预算提示、测试 | 前端无法解释预算到顶 | 否，先做 UI 映射 |
| 测试夹具和模拟 provider | 部分存在：managed-proxy tests、verify 脚本 | 需要 v0.4.7 专用 | 所有模块 | 付费/真实环境测试成本高 | 是 |

### 8.4 施工顺序

| 类别 | 内容 |
| --- | --- |
| A. 必须先完成的公共底层 | 工作包 A：统一输入/消息/错误/任务状态、最小 provider/model capability 抽象、测试 mock provider；工作包 E 的日志隐私 schema 可与 A 并行设计但最终需同 A 对齐。 |
| B. 公共底层确定后可并行开发 | 工作包 B 基础界面状态、工作包 C 图片与文件入口、工作包 D 上下文与会话保存恢复、工作包 E 反馈埋点、工作包 F 安装环境恢复、工作包 G 测试矩阵。 |
| C. 必须最后统一集成 | `src/main.jsx`、`server.mjs`、统一消息结构、会话迁移、日志隐私开关、安装包验收、Release 候选；由 Codex 统一集成。 |
| D. 真人测试前必须完成 | 首屏示例、发送/取消/重试/复制/错误展示、预算到顶提示、基础隐私告知、反馈入口、会话恢复、安装启动降级、日志最小化、v0.4.7 验收矩阵。 |
| E. v0.4.7 后继续优化 | 高级上下文压缩、完整多模型分层、手机端/Web 端、外部通讯入口、支付、加密支付、宣传营销、信息收集和完整多 Agent 编排。 |

### 8.5 工作包

| 工作包 | 目标 | 为什么现在做 | 前置依赖 | 输出 | 会修改的实际文件 | 禁止修改 | 可并行/冲突 | 安全边界 | 成本状态 | 工作量 | 测试和验收 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. 公共底层、统一输入和模型抽象 | 建立文字/图片/文件统一消息结构、统一错误、任务状态、最小 provider/model capability、mock provider | 后续 UI、图片、文件、上下文都会依赖 | 产品负责人批准工作包；不得接新模型 | 数据结构、接口契约、迁移策略、测试夹具 | `server.mjs`、`model-proxy.mjs`、`agents/*`、`errors/normalize.mjs`、`src/main.jsx` 少量契约适配、`scripts/verify*.mjs` | `managed-proxy/src/`、Cloudflare、D1 schema、Secrets、生产配置、package version | 可与 E/G 设计并行；与 B/C/D 实现冲突 | 不读用户真实文件；不碰 Secret；不碰生产；失败即停止并保留 diff | `estimate`：Codex、高质量模型复核、mock 测试；DeepSeek 真实调用 `unknown` 且本包不调用 | large | 单元/集成/mock provider/数据迁移测试；验收为旧文本聊天不退化、结构可承载附件 | `ready_to_start` |
| B. 基础界面与交互状态 | 补齐首屏示例、加载、取消、重试、复制、代码块、链接、预算到顶提示 | 直接决定用户第一关是否留下 | A 的错误/状态契约至少冻结 | 市场基础聊天体验 | `src/main.jsx`、`src/styles.css`、必要 `scripts/capture*.mjs` | 模型路由、Managed Proxy、D1、生产配置 | A 未冻结前不宜开；与 C/D 同改 UI 有冲突 | 不接触用户文件/Secret/生产；预算提示只做展示 | `estimate`：Codex、UI 验收；真实模型调用 `unknown` 且需批准 | medium | UI 截图、键盘、失败、预算错误 mock、长内容 | `not_ready_to_start` |
| C. 图片与文件 | 做附件入口、预览删除、格式大小限制、最小文本文件支持或图片可用性判断 | 图片/文件可能是市场基础缺口，但范围需控 | A 的消息结构、E 的隐私边界 | 附件 MVP 或明确后置报告 | `src/main.jsx`、`src/styles.css`、`server.mjs`、可能新增测试脚本 | Managed Proxy、生产、多模态 provider、Secret、package version | 可在 A 后与 D/E 并行；与 B 同改输入框冲突 | 默认不记录正文；临时文件位置和删除规则明确；用户同意后发送 | `unknown`：解析库、多模态模型、存储费用；不能写 0 | large | 图片/文件 UI、大小格式、失败恢复、隐私扫描 | `not_ready_to_start` |
| D. 上下文与会话保存恢复 | 证明同会话连续、不同会话隔离、重启恢复、清空/删除和长度限制 | 多轮是市场及格线 | A 的消息结构 | 会话 v0.4.7 可用性闭环 | `server.mjs`、`src/main.jsx`、`runtime-paths.mjs`、`scripts/verify*.mjs` | Managed Proxy、D1、生产流量、Secret | 可在 A 后与 B/E 并行；与 C 附件持久化交叉 | 只读写本地 runtime；提供清除；防串会话 | `estimate`：本地测试；长上下文真实模型费用 `unknown` | medium | 重启恢复、隔离、长度限制、删除、迁移回归 | `not_ready_to_start` |
| E. 反馈、埋点、错误日志和隐私 | 建立最小数据 schema、反馈入口、错误编号、日志保留/查看/删除/拒绝和隐私告知 | 真人试用前必须知道失败原因且不能伤害信任 | 可与 A 共同定义字段 | 最小化日志和反馈闭环 | `server.mjs`、`src/main.jsx`、`src/styles.css`、`runtime-paths.mjs`、`errors/normalize.mjs`、`scripts/verify*.mjs` | 用户正文采集默认禁止、Secret、生产配置、Cloudflare | 可与 A/G 并行设计；与 B UI 有小冲突 | 不记录完整对话/图片/文件正文；不记录凭据；用户可拒绝/删除 | `estimate`：本地日志；第三方埋点 `unknown` 且当前不接 | medium | 隐私扫描、日志字段测试、反馈提交/删除、错误码展示 | `ready_to_start` |
| F. 安装、环境自检和崩溃恢复 | 强化陌生 Windows 下载/安装/启动/端口/网络/代理/非中文环境/卸载数据说明 | 第二关决定用户能不能开始 | B/E 基础错误和隐私口径 | 安装和恢复验收矩阵 | `electron/main.cjs`、`readiness.mjs`、`health/self-heal.mjs`、`build/installer.nsh`、`scripts/verify-install-release.mjs` | package version、Release、Cloudflare、D1、Secret | 可独立研究，代码集成需串行 | 不擅自扫描无关系统；配置前需同意；可退出恢复 | `unknown`：真人安装、非中文系统、回归测试成本 | large | 安装/smoke/卸载/端口冲突/非中文系统/崩溃日志 | `not_ready_to_start` |
| G. 测试、虚拟人格和质量验收 | 建立 v0.4.7 验收矩阵、虚拟人格、mock、UI、安装、隐私和真人验收清单 | 先定义验收，防止做完不可验 | 无，可先文档和脚本设计 | 验收矩阵和自动化脚本候选 | `scripts/verify*.mjs`、`scripts/capture*.mjs`、`verification/`、`TASKLOG.md`、`EXECUTION_PROTOCOL.md` | 功能代码、生产、真实模型 | 可与 A/E 并行；不直接改产品逻辑 | 不跑付费测试；不上传数据；虚拟人格不替代真人 | `estimate`：脚本和本地测试；虚拟人格模型调用 `unknown` | medium | docs/test matrix 通过，mock 覆盖预算撞顶/网络/隐私 | `ready_to_start` |
| H. 内部研发提速通道研究 | 研究飞书/Telegram 内部入口、本地 Codex、任务编号、独立 worktree、高风险审批 | 提升研发效率，但不能阻塞 v0.4.7 | 产品负责人选入口；公共网关边界 | 研究报告和后续独立工作包 | `research/channel-connection-plan.md`、`CURRENT_PROGRESS_AUDIT.md`、`EXECUTION_PROTOCOL.md` | 任何入口代码、机器人、Secret、生产、Codex 远程执行 | 可并行研究，不和主线抢文件 | 不接入平台、不创建机器人、不发外部消息 | `unknown`：飞书/Telegram/API/Codex/维护费用 | small | 只读方案审计；验收为成本/安全/可行性表 | `not_ready_to_start` |

预算说明：`actual` 仅限已经封板的钱包刹车生产事实；本轮没有制造新的真实付费调用。工作包的 Codex、高质量模型复核、虚拟人格、第三方组件、文件解析、云存储、日志埋点、多 Agent、真人安装、返工和集成成本均按 `estimate` 或 `unknown` 记录，不知道的不得写成 0。

推荐第一批等待产品负责人批准的工作包：

1. 工作包 A：先冻结统一输入、消息、错误、任务状态和模型能力契约。原因是 B/C/D/E 都会依赖它；不先做会导致输入框、附件、会话、日志各自返工。
2. 工作包 E：与 A 并行设计最小日志、反馈和隐私边界。原因是真人试用前必须能收集失败但不能采集过量数据；文件冲突主要在 `server.mjs` 和 `src/main.jsx`，需要 Codex 统一集成。
3. 工作包 G：与 A/E 并行建立验收矩阵和 mock 测试。原因是先有验收标准，后续 B/C/D/F 才能分包开发；它主要改测试和文档，和 A/E 冲突低。

仍需产品负责人拍板：

- v0.4.7 是否必须包含图片理解，还是只做附件入口和图片能力可用性判断。
- v0.4.7 是否必须支持 PDF/Word/Excel，还是先做文本/Markdown/代码文件。
- 是否批准 A/E/G 作为第一批实施工作包。
- 是否允许后续工作包为测试使用 mock provider；真实模型调用仍需单独批准。
- 陌生真人试用的 1–2 名目标用户、地区、语言和设备范围。

## 9. 近期优先级

1. P0 任务和账号安全：防草稿丢失、重复请求、重复费用和账号恢复单点。
2. P1 基础环境稳定：唯一实例、状态一致、代理兼容、国内外分流、网络与飞书稳定。
3. P2 官方支付和 API 路径：OpenAI/Anthropic 独立 Billing、项目/Workspace、Key、预算和小额验证。
4. P3 工作群创建：通过 Preflight 后只执行一次受控工作流生成、5员工、飞书绑定、建群和只读冒烟。
5. P4 正式开发：仅在产品负责人验收并批准后进入。

当前不做：

- 收费机制。
- 多语言。
- 手机端。
- 完整多 Agent 调度。
- 生态扩张。

## 10. 当前未解决风险

- 成本失控：生存体检曾确认钱包安全状态 unsafe；第 3 阶段已正式封板，生产 D1 预算表已创建，DeepSeek V4 Flash 非思考真实 Preview 链路已通过，version 13 已成为 100% active production version，钱包刹车处于生产生效状态。模型分层和上下文压缩仍未完成，且大量真实用户长期稳定性仍未证明。
- 上游账号合规：当前生产 DeepSeek provider 使用单一上游账户服务陌生用户的许可边界仍需确认；这是当前实现风险，不改变产品的多 provider 框架定位。
- 账号单点故障：GitHub、Cloudflare 和关键开发账号的恢复方案尚未核查。
- 本机执行安全：未来在用户电脑执行操作前必须建立权限、确认和回滚机制。
- 尚无真实用户使用数据。
- 工具链依赖 Codex 等外部工具。
- AI Link 当前只是 `temporarily_recovered`：Electron 主进程 Node fetch 与系统代理兼容、重复实例、空壳窗口和完整 cause 日志尚未永久解决。
- 网络责任边界未确认：手机热点改善只是相关性证据，需对比 DNS、TCP、TLS、延迟、丢包、重置、出口和代理节点。
- 账号恢复风险：海外号码不能成为唯一恢复方式；不得在备用恢复路径建立前删除或解绑现有恢复方式。
- 工作群创建必须等待 Environment Ops Preflight，不得直接恢复付费生成。
