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

未完成：

- 等待产品负责人验收第 3B-1 段生产预检与远端 D1 备份。未经批准不得执行远端 migration 或部署 Worker。
- 实际电脑清理。
- 首屏 3-5 条示例指令。
- 反馈入口和安全/隐私告知。
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

当前唯一下一步：等待产品负责人验收第 3B-1 段生产预检与远端 D1 备份。未经批准不得执行远端 migration 或部署 Worker。

<!-- AIW_CAPABILITY_STATUS_END -->

- 产品版本：`v0.4.6` Alpha，GitHub Release 已公开发布并完成下载回测。
- 任务账本：`TASKLOG.md` 已补齐，后续每次任务都必须同步更新。
- 执行协议：`EXECUTION_PROTOCOL.md` 已补齐，所有新 AI / Codex 接手前必须读取。
- 上一步做完了什么：上线硬骨头2“共享 key 落地”已完成。18800 服务端支持共享托管 key 兜底，用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`；验收摘要在 `verification/shared-key/summary.json`。
- 统一模型入口：已完成代码实现和验收。`model-proxy.mjs` 已扩展为 provider registry；Workbench、Hermes、OpenClaw 三类执行入口都已通过 `18800` 调用当前生产 provider DeepSeek，验收摘要在 `verification/unified-model-proxy/summary.json`。DeepSeek 是当前实现细节，后续 provider 必须可替换。
- 模型分层：尚未执行；不要用统一模型入口的验收产物冒充 `verification/model-router/summary.json`。
- 现在卡在什么：上线三大硬骨头已完成。3A-R1.3、3A-R2.0、3A-R2.1、③A 总验收和 ③B GitHub Alpha Release 均已 passed；公开 Release 下载回测确认安装包大小和 SHA256 与 ③A 候选包完全一致。产品方向已收口并写入现有文档。阶段性总审核、生存体检和第 3A 段本地钱包刹车均已由产品负责人验收通过。第 3B-1 段生产预检与远端 D1 部署前备份已完成但未执行 migration、未部署 Worker；当前唯一下一步是等待产品负责人验收第 3B-1 段，未经批准不得执行远端 migration 或部署 Worker。
- `research/` 里真实存在文件：见第 2 节，共 12 个 `.md` 文件。
- `research/` 里应该有但缺的文件：`market-intelligence.md`，原因见第 3 节。

## 5. 近期优先级

1. 等待产品负责人验收第 3B-1 段生产预检与远端 D1 备份。
2. 第 3B-2 段远端 D1 migration 和 Worker 部署。该项只能在产品负责人验收 3B-1 并明确批准后执行。
3. 模型分层调度与上下文压缩。
4. v0.4.7 首屏示例、反馈入口和安全告知。
5. 3-5 名真实用户测试。
6. 合规的竞品和用户反馈情报收集。

当前不做：

- 收费机制。
- 多语言。
- 手机端。
- 完整多 Agent 调度。
- 生态扩张。

## 6. 当前未解决风险

- 成本失控：生存体检已确认当前钱包安全状态 unsafe；第 3A 本地钱包刹车已通过，但生产环境尚未执行远端 D1 migration 和 Worker 部署，模型分层和上下文压缩仍未完成。
- 上游账号合规：当前生产 DeepSeek provider 使用单一上游账户服务陌生用户的许可边界仍需确认；这是当前实现风险，不改变产品的多 provider 框架定位。
- 账号单点故障：GitHub、Cloudflare 和关键开发账号的恢复方案尚未核查。
- 本机执行安全：未来在用户电脑执行操作前必须建立权限、确认和回滚机制。
- 尚无真实用户使用数据。
- 工具链依赖 Codex 等外部工具。
