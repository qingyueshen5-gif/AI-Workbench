# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-24
> 当前任务文件只描述正在执行或最近完成的任务，不定义后续路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

本轮唯一任务：第 3B-2b1 段部署候选锁定。

边界：

- 只显式补齐生产预算配置、完成本地回归、记录当前生产 Worker 版本和回滚基线。
- 不部署 Cloudflare Worker，不修改 Secrets。
- 不调用真实模型，不产生模型费用。
- 不修改生产功能代码，不进入第 3B-2b2 段、模型分层、上下文压缩或 v0.4.7。
- 完成后停止，等待产品负责人验收第 3B-2b1 段。

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
- 第 3B-2b2 段 Worker 部署和生产验证。
- 首屏示例指令、反馈入口、安全和隐私告知。
- 3-5 名真实用户测试。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为准：等待产品负责人验收第 3B-2b1 段部署候选。未经批准不得部署 Worker 或进入第 3B-2b2 段。

完成本轮后必须停止，等待产品负责人验收第 3B-2b1 段，不自动部署 Worker、不进入第 3B-2b2 段、第二批清理或其他任务。
