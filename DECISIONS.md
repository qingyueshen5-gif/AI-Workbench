# DECISIONS.md

## 已定决策（不可推翻）

- 目标用户：普通人（要结果）+ 专业人（要省时间）。
- 护城河：极致零门槛 + 真办成事 + 死守简单。
- 全球产品方向：长期不只服务中国或海外某一个市场；不同国家和地区的语言、模型、合规和平台差异由后台逐步适配，用户入口保持一个输入框。
- 一个输入框：用户只表达目标，工作台后台承担上下文读取、任务拆解、模型选择、工具调用、检查、修复和最终交付。
- 用户状态波动补偿：用户睡眠、情绪、记忆和判断质量会波动；工作台必须保存长期目标、产品初衷、历史决策和当前进度，发现新决定与原方向冲突时主动提醒。
- 借用生态但掌握控制层：可以使用 GPT、Claude、DeepSeek、Hermes、OpenClaw、浏览器自动化和其他成熟产品作为杠杆；任务状态、长期记忆、任务分配、质量检查、失败恢复、成本控制、执行证据和最终结果审计必须由 AI Workbench 掌握。
- 跨平台执行边界：长期目标是在用户授权和平台规则范围内操作网站和电脑，完成阅读、收集、比较、填写、下载、上传、中断恢复和跨平台交接；不以绕过验证码、安全限制、平台权限或反自动化规则为产品目标。
- 可持续经营边界：当前阶段不追求利润最大化，但必须逐步达到可持续的盈亏平衡。知名度和真实用户使用优先于短期利润，但不得建立用户越多、亏损越大的不可持续模式。仓库只记录产品层面的资金跑道有限、成本控制和盈亏平衡原则，不写入个人财务数字。
- 情报收集合规边界：允许产品负责人在本人授权并已登录的浏览器中，以正常人的使用节奏，使用平台面向普通用户提供的功能做个人调研；严禁把该方式扩展为面向全部用户的规模化抓取、反检测、绕过验证码、规避限流或绕过平台权限的功能。
- 去第三方依赖：三员工模型全经 18800。
- 共享 key 边界：真实模型 key 只允许 18800 服务端读取；前端、员工配置、OpenClaw/Hermes 只使用本机占位 token。用户本机 `DEEPSEEK_API_KEY` 优先，共享托管 key 作为开箱即用兜底。
- 上线最小集优先：先过 3 个硬骨头（陌生机器不崩 ✓、共享 key ✓、下载安装 ✓），模型分层/手机端/情报流水线可为上线让路。
- 后续候选路线：模型分层、手机端和情报流水线仍未实施，不是当前唯一下一步；当前唯一下一步以 `NEXT_STEP.md` 为准。
- 执行协议：所有大任务采用单一主线、分段执行、逐段验证、失败也留痕；产品负责人批准后才能进入下一阶段。固定规范见 `EXECUTION_PROTOCOL.md`。
- 发布分段：硬骨头3拆成 3A 候选安装包预验收和 3B GitHub Release 正式发布。3A 未通过时禁止 Release、禁止 tag、禁止把 LAUNCH 硬骨头3标记完成。
- 安装器策略：3A-R1.2 保持 NSIS oneClick per-user installer，不要求管理员权限；默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`，避免中文用户名环境下默认 per-user 安装目录不稳定落盘。该策略已通过本地 `npm.cmd run verify:install-release` 和 GitHub Actions Run `29935231224` 云端预验收。
- Actions 判绿策略：3A-R1.3 只有在恢复 GitHub CLI/Git 凭证、读取真实 Actions 日志/artifact，并取得新的 `windows-installer-preflight.yml` success run 后才能判绿。Run `29935231224` 已满足该条件；后续外部流程仍必须取得真实 run 结果后才能判绿。
- CI Electron runtime 策略：不要在 `package.json` 写死 `build.electronDist=node_modules/electron/dist`；CI 中由 electron-builder 自行解析/下载 Electron runtime，避免 `npm ci` 后该目录不存在导致云端安装包构建失败。
- shared_managed 生产架构：正式链路锁定为客户端/Workbench/Hermes/OpenClaw -> 本机 `127.0.0.1:18800` -> AI Workbench 自控远程 Managed Proxy -> DeepSeek 官方 API。真实 DeepSeek key 只能存远程服务端 Secret，禁止进入安装包、用户电脑、本机 `.env`、环境变量、日志或进程参数；不采用“Key 随包分发 + 消费限额”方案，限流、预算和紧急关闭只能作为远程服务保护措施。
- R2.0 历史结论：当时 `shared_managed` 机制测试 passed，但生产注入仍 blocked；该 blocked 已由 R2.1 Cloudflare 生产部署与真实验证解除。R2.1 前不得进入 3B Release、首屏示例、模型分层、手机端或情报流水线。
- R2.1 结论：Cloudflare Worker、D1、Secrets、生产 URL、真实 DeepSeek 上游、无本机 Key 18800、安装版零配置、刷新/吊销/限流/预算/紧急关闭/中文降级和安全扫描均已通过。R2.1 passed 只允许进入 3A 总验收，不等于 3A 总验收已完成，也不允许直接进入 3B Release。
- ③A 总验收结论：候选安装包真实安装、快捷方式、安装版后端启动、`managed_remote` 生产对话、中文降级、安全扫描、真实卸载和恢复日常安装版均已通过；证据见 `verification/3a-final/summary.json`。该阶段已完成，后续已进入并通过 ③B。
- ③B 发布结论：AI Workbench v0.4.6 Alpha 已创建公开 GitHub prerelease，annotated tag `v0.4.6` 指向 ③A 验收提交，安装包和 SHA256 文件已上传，公开下载回测 passed；证据见 `verification/3b-release/summary.json`。上线三大硬骨头整体完成，产品方向已收口，下一任务已调整为电脑环境治理：产品资产备份、单点故障核查和清理候选盘点。
- 2026-07-24 阶段性总审核优先级调整：产品负责人将当前优先级从电脑环境清理调整为“阶段性总审核（砍薄版）”。本轮只审核三件事：现有产品资产备份是否真的可以恢复；Git 当前内容及完整可达历史是否泄漏真实密钥、Token、密码或其他凭据；文档是否宣称 completed/passed/已完成但没有实现、没有执行或没有真实证据。已有有效 verification 证据且已经判绿的模块不得重复跑完整验收，只检查证据是否存在、是否与结论对应；发现冲突或缺口才深入。审核完成后必须停止，等待产品负责人验收，不得自动进入生存体检、成本熔断、模型分层、v0.4.7 或其他任务。
- 2026-07-24 阶段性总审核结论：砍薄版审核 passed，证据见 `verification/thin-stage-audit/summary.json`。最新外部备份已做隔离恢复并比对关键文件；当前 Git tracked 内容和完整本地可达历史未发现确认的真实凭据泄漏；未发现 confirmed fake completion。README、CURRENT_PROGRESS_AUDIT、CONTEXT 和 Handoff 中的非关键过期/冲突表述已修正。`git fetch origin --prune` 因本机 Git 凭据 `SEC_E_NO_CREDENTIALS` 失败，远端最新性刷新未完成；不得自动登录或修改凭据，等待产品负责人后续批准处理。
- 2026-07-24 生存体检执行方式：产品负责人已验收通过阶段性总审核（砍薄版）并批准进入生存体检。生存体检首次执行因任务量大出现 SSE idle timeout，中断后采用“先盘点现场、保护半成品、只补验证和交付收尾”的断点恢复方式，不从头重跑成本调查或计算。
- 2026-07-24 生存体检结论修正：分析任务 passed_after_boundary_correction，但钱包安全状态 unsafe。原 5/50/100 用户平台月成本 199.12 / 1686.24 / 3338.61 CNY 算术保留，但正式命名为 `uncapped_demand_pressure`，表示未来扩容或放宽限额后高活跃需求全部满足时的规划成本，不代表当前生产限额下可实际发生的正常路径成本。当前限额正常路径在 8000 input + 2048 output token 假设下先撞 `DAILY_TOKEN_LIMIT`，平台每天约 20 次成功模型调用、若每任务 2 次调用则每天约 10 个完整前端任务，月平台成本上界约 40.76 CNY，现金跑道约 7.96 个月。理论最坏成本仍为 `unbounded`，依据是失败/超时/并发逃逸路径不能证明 fail-closed，provider 对失败尝试是否计费为 `cannot_determine_but_not_fail_closed`。证据见 `verification/survival-cost-audit/summary.json`；下一步应等待产品负责人重新验收，不得自动实现熔断。
- 2026-07-24 第 3A 段本地钱包刹车决策：产品负责人已正式验收生存体检，批准进入第 3A 段。早期测试阶段平台月度总预算政策上限为 50 USD，其中模型调用硬上限 40 USD，基础设施及价格波动预留 10 USD。代码只实现模型 40 USD 硬上限：`PLATFORM_MONTHLY_BUDGET_MICRO_USD=50000000`，`MONTHLY_MODEL_HARD_CAP_MICRO_USD=40000000`。预算计算必须使用整数 micro-USD，调用 provider 前按模型价格保守预留，缺少价格或预算账本不可用时 fail closed，不要求用户填 Key，不向用户转嫁费用。
- 2026-07-24 第 3A 段本地钱包刹车结论：Managed Proxy 已在本地实现月度模型预算账本、调用前条件原子预留、失败不退款、并发不超支和缺价格/D1 失败 fail-closed；本地 mock 验证 passed，证据见 `verification/monthly-budget-circuit-breaker-local/summary.json`。本轮未部署 Cloudflare Worker，未执行远端 D1 migration，未修改 Secrets，未调用真实 provider；deployment_status 为 `not_deployed`，不得写 production_passed。下一步等待产品负责人验收第 3A 段，未经批准不得部署生产环境或进入 3B。
- 2026-07-24 第 3A 段平台合计预算纠偏：产品负责人验收发现首次 3A 实现以 `monthly_model_budget(month_key, model)` 作为硬上限账本，实际会让每个模型各自使用 40 USD，不符合“所有 provider、所有模型合计 40 USD”的政策。现已修正为 `monthly_platform_budget(month_key)` 平台总账执行唯一 40 USD 条件原子预留，`monthly_model_budget` 仅保留为模型明细账和审计用途，不决定是否允许上游调用。本地单模型、跨模型顺序、跨模型并发、明细写入失败 fail-closed 等测试通过；状态为 `local_passed_after_platform_aggregate_correction`，仍未部署生产环境，等待产品负责人重新验收第 3A 段。
