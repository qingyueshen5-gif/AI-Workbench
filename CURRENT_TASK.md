# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-25
> 当前任务文件只描述正在执行或最近完成的任务，不定义后续路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

本轮唯一任务：等待产品负责人验收 DeepSeek V4 Flash 修复 Worker Preview。

边界：

- 产品负责人已确认第 3B-2b2d HTTP 400 根因为旧 DeepSeek 上游模型名 `deepseek-chat` 在 2026-07-24 15:59 UTC 后退役。
- 已先执行生产风险收敛：旧稳定 Worker version `16333442-925a-4b11-a3d1-d6249d2492ba` 恢复 100%，已知失败候选 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 撤回到 0%。
- 当前 active deployment 为 `d9acb146-b720-4e09-b2b8-0257b93fc407`。
- 本地修复已完成：客户端逻辑模型 `deepseek-chat` 通过 `upstreamModel` 路由到正式上游 `deepseek-v4-flash`。
- 新预算明细将按实际计费模型 `deepseek-v4-flash` 记录；既有 `deepseek-chat` 21 micro-USD 历史预留不删除、不退款、不修改。
- 产品负责人已验收 DeepSeek V4 Flash 路由迁移本地候选，并批准只上传新 Worker version 和执行无付费 Preview 验证。
- 新修复 Worker version `a7eb385b-84df-4a45-b554-0aca40b6b407` 已上传，version number 为 `12`，Preview alias 为 `budget-v4-flash-candidate`。
- active deployment 仍为 `d9acb146-b720-4e09-b2b8-0257b93fc407`；旧稳定 version 仍为 100%，已知失败候选仍为 0%，新修复 version 正常生产流量为 0%。
- Preview `/health` HTTP 200，`/v1/models` HTTP 200 且显示 `deepseek-chat` 为 logical alias、上游为 `deepseek-v4-flash`；未认证聊天 HTTP 401 `missing_token`。
- 本轮未注册 installation，未发起已认证聊天，未调用真实 provider，未修改 Secrets 或 D1 schema，两张预算表仍保持既有 21 micro-USD / call_count 1。
- 完成后停止，等待产品负责人验收 DeepSeek V4 Flash 修复 Worker Preview。

## 最近完成

- ③A 总验收：passed。证据见 `verification/3a-final/summary.json`。
- ③B GitHub Release：passed。AI Workbench v0.4.6 Alpha 已公开发布为 public prerelease，证据见 `verification/3b-release/summary.json`。
- 产品方向收口：completed。全球产品、一个输入框、质量基线托底、人机共同打磨、借用生态但掌握控制层、跨平台执行边界和阶段路线已整合进现有文档。
- 文档基准纠偏与防漂移机制：completed。已纠正当前状态漂移，建立 Handoff 自动生成和文档一致性校验，故障注入已证明可检出版本漂移。
- 电脑环境治理审计：completed。证据见 `verification/pc-environment-governance/summary.json`。
- 电脑环境治理第一批安全清理：partial。累计释放 F 盘约 3.06 GB；重启后指定遗留目录已处理，用户 npm 缓存仍因 `EPERM` 未清理，Windows 临时文件仍需产品负责人手动确认。证据见 `verification/pc-cleanup-batch1/summary.json`。
- 阶段性总审核（砍薄版）：passed。备份隔离恢复、Git 凭据扫描和文档假完成核对均已执行；未发现确认的 Git 凭据泄漏或 confirmed fake completion，非关键过期表述已修正。证据见 `verification/thin-stage-audit/summary.json`。
- 生存体检：passed。当前没有真实用户用量；5/50/100 用户平台月成本规划值约为 199.12 / 1686.24 / 3338.61 CNY，现金跑道约 7.81 / 6.64 / 5.69 个月。钱包安全状态 unsafe，理论最坏成本 `unbounded`，证据见 `verification/survival-cost-audit/summary.json`。
- 第 3A 段本地钱包刹车：local_passed_after_platform_aggregate_correction。首次实现被发现按模型分别执行 40 USD 硬上限；现已修正为所有 provider/模型合计 40 USD 的平台总账硬上限，模型账只做明细。单模型、跨模型顺序、跨模型并发、模型明细失败 fail-closed、缺价格/D1 失败不上游等 mock 测试通过；未部署生产，证据见 `verification/monthly-budget-circuit-breaker-local/summary.json`。
- 第 3B-1 段生产预检与远端 D1 备份：preflight_and_backup_passed。已确认 Cloudflare 身份、Worker、D1 binding、生产数据库和既有 production evidence；远端 D1 已完整导出到仓库外备份目录，SHA256 二次一致，并通过临时 SQLite 恢复 schema 验证。未执行远端 migration，未部署 Worker，未修改 Secrets，未调用真实 provider。证据见 `verification/monthly-budget-production-preflight/summary.json`。
- 第 3B-2a 段远端 D1 migration：remote_migration_passed。已在生产 D1 `aiw-managed-proxy` 创建 `monthly_platform_budget` 和 `monthly_model_budget`；原三张业务表仍存在，两张预算表行数均为 0。未部署 Worker，未修改 Secrets，未调用真实 provider。证据见 `verification/monthly-budget-production-migration/summary.json`。
- 第 3B-2b1 段部署候选：deployment_candidate_ready。`wrangler.jsonc` 已显式补齐 50/40 USD 预算 vars 和 `deepseek-chat` 公开价格配置；Managed Proxy 12 项本地测试通过；远端预算表仍为空；当前生产 Worker 版本和回滚目标已只读确认。未部署 Worker，未修改 Secrets，未调用真实 provider。证据见 `verification/monthly-budget-worker-deploy-readiness/summary.json`。
- 第 3B-2b2a 段 Preview 上传验证：preview_upload_verified。已上传 Worker Preview version `483e4fae-3af8-40fa-ab83-4551f08b519e`；Preview `/health` 与 `/v1/models` 均 HTTP 200，未认证聊天请求 HTTP 401 `missing_token` 且在 provider 前拒绝。active deployment、生产流量和原稳定 version 未变；预算表仍为空。未部署 Worker，未修改 Secrets，未调用真实 provider。证据见 `verification/monthly-budget-worker-preview-upload/summary.json`。
- 第 3B-2b2b 段零流量 deployment：zero_traffic_deployment_verified。新 active deployment `063b83c3-974f-43fb-84f2-9da0d574f745` 中旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 为 100%，新预算 version `483e4fae-3af8-40fa-ab83-4551f08b519e` 为 0%。version override 三项验证通过，预算表仍为空，未调用真实 provider，未修改 Secrets。证据见 `verification/monthly-budget-worker-zero-traffic-deployment/summary.json`。
- 第 3B-2b2c 段 1% 生产灰度：one_percent_canary_observation_limited_by_low_traffic。active deployment `55b20f6c-1a50-446b-95cc-18ebf0e6cbe1` 中旧稳定 version 为 99%，新预算 version 为 1%。20 分钟观察和 5 分钟缓冲完成，健康检查均 200，预算表仍为空，未主动真实模型调用，未修改 Secrets 或 D1 schema，未触发回滚。证据见 `verification/monthly-budget-worker-one-percent-canary/summary.json`。
- 第 3B-2b2d 候选 Preview 单笔真实链路：real_preview_call_failed_after_budget_reservation。注册成功，唯一真实聊天返回 HTTP 400 `invalid_request_error`；预算预留已写入且两账一致，未重试，生产流量仍 99%/1%。证据见 `verification/monthly-budget-worker-controlled-real-canary/summary.json`。
- DeepSeek V4 Flash 路由迁移本地候选：new_provider_model_route_candidate_ready_locally。已撤回失败候选 1% 流量；本地实现 `deepseek-chat` 逻辑模型到 `deepseek-v4-flash` 上游模型路由，16 项 Managed Proxy 测试和 TypeScript 检查通过；未上传、未部署、未调用真实 provider。证据见 `verification/deepseek-v4-flash-route-migration/summary.json`。
- DeepSeek V4 Flash 修复 Worker Preview：v4_flash_candidate_preview_verified。新修复 Worker version `a7eb385b-84df-4a45-b554-0aca40b6b407` / version number `12` 已上传为 Preview；无付费 Preview 三项检查通过，active deployment 和正常生产流量未变化；未注册 installation，未调用真实 provider。证据见 `verification/deepseek-v4-flash-worker-preview-upload/summary.json`。

## 当前事实

- 当前版本：`package.json` version `0.4.6`，对外为 `v0.4.6 Alpha`。
- Release 页面：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6`。
- 安装包直接下载：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe`。
- 安装包大小：`111524004` bytes。
- SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 当前架构：`Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider`。
- DeepSeek 是当前唯一已接入的生产实现，属于可替换实现细节，不是产品定位。真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包和用户电脑。

## 上线硬骨头

- [x] 硬骨头1：陌生机器不崩。证据见 `verification/clean-machine/summary.json`。
- [x] 硬骨头2：共享 key 落地。证据见 `verification/shared-key/summary.json` 和 `verification/managed-proxy-production/summary.json`。
- [x] 硬骨头3：能下载能安装。③A 总验收和 ③B GitHub Alpha Release 均已通过，公开下载回测通过。证据见 `verification/3b-release/summary.json`。

## 未完成边界

以下能力仍未实施，不得写成当前已完成：

- Windows 临时文件人工确认。
- 自启项调整和闲置软件卸载决策。
- 新预算 Worker 100% 全量切换。
- DeepSeek V4 Flash 修复 Worker 真实 provider 成功链路和灰度/全量。
- 首屏示例指令、反馈入口、安全和隐私告知。
- 3-5 名真实用户测试。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为准：等待产品负责人验收 DeepSeek V4 Flash 修复 Worker Preview。未经批准不得把新修复 version 加入 production deployment，不得注册 installation，不得发起真实模型调用。

完成本轮后必须停止，等待产品负责人验收 DeepSeek V4 Flash 修复 Worker Preview，不把新修复 version 加入 production deployment，不注册 installation，不发起真实模型调用，不进入后续段、第二批清理或其他任务。
