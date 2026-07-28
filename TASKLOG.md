# TASKLOG.md - 任务总账本

> 仓库文件是唯一事实来源。每个任务下达、完成、验收和交接都必须写回本仓库，不能只留在对话里。

最新更新：2026-07-28

## 当前一句话状态

`AW-AILINK-CONFIRM-AND-CREATE-001`已按产品负责人批准一次确认版本3方案并完成员工准备：3名新员工创建事务均为`done`，2名现有员工正确复用，当前`waiting_bindings/bindings`、飞书绑定2/5、`group=null`。已停止，等待单独批准飞书绑定。

## 最近完成任务

## 2026-07-29｜AW-AILINK-CONFIRM-AND-CREATE-001｜版本3方案确认与员工准备

- 产品负责人验收员工分配恢复结果，并批准针对`workflow-3da933e691b5`执行一次“确认方案并准备员工”。
- 确认控件只执行一次；工作流从`review_ready/review`进入`waiting_bindings/bindings`，写入`confirmedAt`，`group`仍为`null`。
- 正确复用`worker-1g20 / 协调角色`和`worker-1u80 / 测试验收角色`。
- 分别创建`worker-3bp0 / A架构开发`、`worker-5fr0 / E隐私开发`、`worker-2tj0 / 总集成`；三项独立事务均为`done`。
- 五个worker ID唯一，未发现重复员工或部分创建；工作流数量仍为2。
- 当前飞书绑定2/5；未点击扫码绑定或创建群，未发送员工消息，未进入正式开发。
- 18765没有模型生成请求；UI余额¥73.84、今日用量¥81.16未观察到变化。
- 证据：`verification/ai-link-confirm-and-prepare/`。

## 2026-07-28｜AW-AILINK-ROUTE-AND-REVIEW-001｜AI Link上游路由定性与已有协作方案只读审查

- 产品负责人验收`AW-AILINK-READINESS-001`并批准只读路由定性和版本3方案审查，不批准生成、调整或确认。
- 安装包和运行配置确认workflow creator经18765由Node fetch访问AI Link自有LLM上游；18766不是该链路入口。
- 直连和经7890均可访问上游公开根路径，TLS证书和HTTP行为一致；没有该域名必须经7890的证据。
- 客户端缺少明确DIRECT/分流策略、Node代理dispatcher、监控、超时重试和fallback，最终分类`functional_but_unmanaged_route`。
- 完整审查草稿3：五个角色齐全，协调监工单入口、总集成单一最终集成、产品负责人双审批门、原生@响应和权限边界合格，产品定位模型中立。
- 审查结果`review_passed_with_nonblocking_notes`；明确`new_generation_not_required`，无需版本4或第三个同目标工作流。
- 未修改工作流、未确认方案、未创建员工或飞书群、未修改运行环境或产品代码。
- 证据：`verification/ai-link-route-and-review/`。

## 2026-07-28｜AW-AILINK-READINESS-001｜AI Link单次受控生成前最小就绪核验

- 产品负责人验收`AW-ENV-BASELINE-001`并批准进入最小就绪核验，不批准执行生成。
- 只读确认AI Link UI完整可交互、Session有效、1个主进程族、当前工作流数量2。
- `AW-AILINK-GROUP-001`对应工作流为`review_ready/review`、草稿3；另一工作流为`ready/done`；没有落盘中的生成中状态。
- 安装包只读审计确认workflow creator经18765访问AI Link LLM上游；核验时AI Link PID未连接7890，无法证明上游fetch经过7890。
- workflow-creator持久累计计数不可恢复；记录UI费用快照和两个workflow落盘基准。
- 完成单次提交操作卡和任务阻塞重分类；最终`blocked_proxy_path_unverified`。
- 未点击生成，未创建或修改工作流、员工或飞书群，未修改AI Link、代理、网络、产品代码或运行配置。
- 证据：`verification/ai-link-readiness/`。

## 已完成任务

| 任务 | 状态 | 做了什么 | 验收产物 |
| --- | --- | --- | --- |
| 25 模块知识归档与权威归属去重 | 已完成 | 建立事实归属表；去重六份核心文档；将 25 模块归入 PRODUCT/VISION/PRINCIPLES/ARCHITECTURE/EXECUTION_PROTOCOL/CURRENT_PROGRESS_AUDIT/DECISIONS/THINKING；更新 Handoff 生成源并通过文档一致性检查。未改功能代码、生产环境和当前唯一下一步，未重写历史任务与验收证据。 | `CONTEXT.md`、`verification/docs-consistency/summary.json` |
| 基础环境、网络、代理、支付与账号问题资产化 | 已完成文档资产化 | 建立17项统一问题档案和故障时间线；将 Environment Ops 写入现有架构；建立 Incident 流程、12项 Preflight、P0-P4 顺序和敏感信息边界。本轮只改文档，无付费调用、员工、群、AI Link/代理/网络/账号/产品代码变更。 | `ENVIRONMENT_OPS_ISSUES.md`、`ARCHITECTURE.md`、`EXECUTION_PROTOCOL.md` |
| Environment Ops只读运行环境基线 | 已完成，等待产品负责人验收 | 采集Windows、资源、适配器、时间同步、AI Link进程/端口/health、代理、国内外非付费链路、飞书活动连接和Git基线；完成30分17秒7样本观察，建立八层矩阵和13个独立任务草案。网络为route_dependent，代理为application_proxy_mismatch，UI/Session未验证，付费生成仍blocked。未修改运行环境或产品代码。 | `verification/environment-ops-readonly-baseline/summary.json`、`report.md` |
| 统一模型入口 | 已完成 | Workbench、Hermes、OpenClaw 三个员工的模型调用统一收敛到本机 `18800` 代理；`model-proxy.mjs` 已扩展为 provider registry。 | `verification/unified-model-proxy/summary.json` |
| 硬骨头1：陌生机器不崩 | 已完成 | 启动路径改为缺依赖降级；首次运行自动创建 config/data/logs/evidence；18800/Hermes/OpenClaw/端口异常统一返回中文未就绪状态。 | `verification/clean-machine/summary.json`、`verification/clean-machine/readiness-report.md` |
| 硬骨头2：共享 key 落地 | 已完成 | 18800 网关支持共享托管 key 兜底；用户本机 key 优先；前端、Hermes、OpenClaw 和员工配置只使用本机占位 token。 | `verification/shared-key/summary.json` |
| 任务账本与进度口径校准 | 已完成 | 新增本文件作为总账本；明确当前缺失文件、真实进度和下一步；避免跨 AI 协作时混淆“统一模型入口”和“模型分层”。 | `TASKLOG.md` |
| 固化分段执行与验收协议 | 已完成 | 创建 `EXECUTION_PROTOCOL.md`，把单一主线、分段执行、真实验收、失败也留痕和产品负责人批准下一阶段写成固定规范；当前 3A 仍是唯一主线，未改变产品路线。 | `EXECUTION_PROTOCOL.md`、`tasks/2026-07-22-固化分段执行与验收协议.md` |
| 恢复本机安装版 | 已完成 | 将 F 盘候选安装包恢复为 Actions Run `29935231224` 通过验收的 hash 版本，重新安装 v0.4.6 到本机，修正桌面和开始菜单快捷方式，启动验证通过；未进入 R2/3B，未改代码。 | `tasks/2026-07-22-恢复本机安装版.md` |
| 今日收尾与产品距离核验 | 已完成 | 复核本机安装版、最近任务真实状态和产品距离；当时确认 3A-R1.3 passed、本机安装版已保留、生产注入和 3B Release 仍是核心阻塞；该生产注入阻塞已由 R2.1 解除。 | `verification/daily-closeout/summary.json`、`verification/daily-closeout/report.md`、`tasks/2026-07-23-今日收尾与产品距离核验.md` |
| 3A-R2.0：共享 Key 架构核验 | 已完成 | 审计当前 `shared_managed` 链路，确认当前只是本机环境兜底机制，不是生产远程注入；锁定正式架构为本机 18800 -> 自控远程 Managed Proxy -> DeepSeek 官方 API。 | `research/managed-proxy-production-plan.md`、`verification/managed-shared-key/architecture-summary.json`、`verification/managed-shared-key/architecture-report.md` |
| 3A-R2.1：Cloudflare 生产部署与真实验证 | 已完成 | Cloudflare Worker、D1、Secrets、生产 URL、真实 DeepSeek 调用、安装版零配置、刷新/吊销/限流/预算/紧急关闭/中文降级和安全扫描均通过；本阶段当时未创建 Release/tag，后续已进入并通过 ③A 总验收。 | `verification/managed-proxy-production/summary.json`、`verification/managed-proxy-production/report.md` |
| ③A 总验收 | 已完成 | 真实安装候选包、检查快捷方式、启动安装版后端、通过 `managed_remote` 生产链路完成模型对话、验证中文降级、安全扫描、真实卸载并恢复日常安装版。 | `verification/3a-final/summary.json`、`verification/3a-final/report.md` |
| ③B：v0.4.6 Alpha GitHub Release | 已完成 | 创建 annotated tag `v0.4.6`，创建公开 prerelease，上传安装包和 SHA256 文件，并从公开链接下载回测通过。 | `verification/3b-release/summary.json`、`verification/3b-release/report.md` |
| AI Workbench 产品方向收口 | 已完成 | 将全球愿景、一个输入框、用户状态波动补偿、借用生态但掌握控制层、跨平台执行边界和阶段路线整合进现有文档；未创建平行路线图。 | `tasks/2026-07-24-AI-Workbench产品方向收口.md` |
| 文档基准纠偏与防漂移机制 | 已完成 | 纠正当前状态文档漂移，建立事实单一归属规则，新增 Handoff 自动生成和文档一致性校验。 | `verification/docs-consistency/summary.json`、`verification/docs-consistency/report.md`、`tasks/2026-07-24-文档基准纠偏与防漂移机制.md` |
| 产品决策更新与任务顺序调整 | 已完成 | 写入产品效果与用户水平关系、可持续经营边界、合规情报边界、当前风险，并将下一任务调整为电脑环境治理。 | `tasks/2026-07-24-产品决策更新与任务顺序调整.md` |
| 电脑环境治理审计 | 已完成 | 完成产品资产备份、备份可恢复性验证、GitHub/Cloudflare/工具登录状态核查、磁盘/进程/缓存/安装包/自启项/软件盘点和清理候选清单。 | `verification/pc-environment-governance/summary.json`、`verification/pc-environment-governance/report.md`、`tasks/2026-07-24-电脑环境治理审计.md` |
| 电脑环境治理第一批安全清理 | 部分完成 | 已释放 F 盘约 3.06 GB；npm 缓存因 `EPERM` 未清理，Windows 临时文件改为人工确认，权限异常旧目录待重启后精确处理。 | `verification/pc-cleanup-batch1/summary.json`、`verification/pc-cleanup-batch1/report.md`、`tasks/2026-07-24-电脑环境治理第一批安全清理.md` |
| 产品定位修正与判断依据文档 | 已完成 | 将当前状态文档统一为“AI Workbench 是模型与 Agent 无关的调度框架；DeepSeek 是当前唯一生产实现且可替换”的口径；新增 `THINKING.md` 记录产品负责人判断依据；交接文件清单改为三份。 | `THINKING.md`、`tasks/2026-07-24-产品定位修正与判断依据文档.md` |
| 阶段性总审核（砍薄版） | 已完成 | 隔离恢复最新外部备份；扫描当前 Git tracked 内容和完整本地可达历史的凭据泄漏；核对 completed/passed/已完成声明与证据是否匹配；未发现确认的 Git 凭据泄漏或 confirmed fake completion，已修正 README、当前进度和 CONTEXT 的非关键过期表述。 | `verification/thin-stage-audit/summary.json`、`verification/thin-stage-audit/report.md` |
| 生存体检 | 已完成并修正场景边界 | 在 SSE 中断后先盘点现场，保护半成品，只做验证和交付收尾；随后修正 5/50/100 场景边界。当前限额正常路径月平台成本上界约 40.76 CNY，现金跑道约 7.96 个月；原 199.12 / 1686.24 / 3338.61 CNY 保留为 `uncapped_demand_pressure`，不代表当前生产限额下实际可发生的正常路径成本。钱包安全状态 unsafe，理论最坏成本 `unbounded` 的依据是失败/超时/并发逃逸路径不能证明 fail-closed。 | `verification/survival-cost-audit/summary.json`、`verification/survival-cost-audit/report.md` |
| 第 3A 段：本地钱包刹车 | 已完成平台合计预算纠偏和本地验证 | 产品负责人验收发现首次实现按模型分别执行 40 USD 硬上限，未来多模型会突破“所有模型合计 40 USD”的政策；现已修正为 `monthly_platform_budget` 平台总账执行唯一条件原子预留，`monthly_model_budget` 只做模型明细。单模型、跨模型顺序、跨模型并发、模型明细失败 fail-closed、失败不退款和缺价格/D1 失败不上游均通过本地 mock 测试；未部署 Cloudflare、未执行远端 D1 migration、未调用真实 provider。 | `verification/monthly-budget-circuit-breaker-local/summary.json`、`verification/monthly-budget-circuit-breaker-local/report.md` |
| 第 3B-1 段：生产预检与远端 D1 备份 | 已完成预检与备份 | 产品负责人验收通过 3A 后批准进入 3B-1。本轮只读核对 Wrangler 身份、Worker、D1 binding、生产数据库和既有 production evidence；远端 D1 已完整导出到仓库外备份目录，SHA256 二次一致，并通过临时 SQLite 恢复 schema 验证。未执行远端 migration，未部署 Worker，未修改 Secrets，未调用真实 provider。 | `verification/monthly-budget-production-preflight/summary.json`、`verification/monthly-budget-production-preflight/report.md` |
| 第 3B-2a 段：远端 D1 migration | 已完成远端预算表 migration | 产品负责人验收通过 3B-1 后批准进入 3B-2a。本轮复核 3B-1 外部备份大小和 SHA256，一次性执行远端 D1 `CREATE TABLE IF NOT EXISTS` migration，创建 `monthly_platform_budget` 和 `monthly_model_budget`；只读验证原三张业务表仍存在，两张预算表存在且行数均为 0。未部署 Worker，未修改 Secrets，未调用真实 provider，未执行回滚。 | `verification/monthly-budget-production-migration/summary.json`、`verification/monthly-budget-production-migration/report.md` |
| 第 3B-2b1 段：部署候选锁定 | 已完成部署候选锁定 | 产品负责人验收通过 3B-2a 后批准进入 3B-2b1。本轮显式补齐生产 Wrangler 预算 vars 和 `deepseek-chat` 价格配置；Managed Proxy 12 项本地回归通过；远端预算表仍为空；只读确认当前生产 Worker 版本、健康状态和回滚目标。未部署 Worker，未修改 Secrets，未调用真实 provider。 | `verification/monthly-budget-worker-deploy-readiness/summary.json`、`verification/monthly-budget-worker-deploy-readiness/report.md` |
| 第 3B-2b2a 段：Preview 上传验证 | 已完成 Preview 上传验证 | 产品负责人验收通过 3B-2b1 后批准进入 3B-2b2a。本轮仅上传已锁定候选为 Worker Preview version `483e4fae-3af8-40fa-ab83-4551f08b519e`，验证 Preview URL 的 `/health`、`/v1/models` 和未认证聊天拒绝路径；active deployment 和 100% 生产流量仍指向原稳定 version，远端预算表仍为空。未部署 Worker，未修改 Secrets，未使用真实安装 Token，未调用真实 provider。 | `verification/monthly-budget-worker-preview-upload/summary.json`、`verification/monthly-budget-worker-preview-upload/report.md` |
| 产品战略与升级路径 | 已完成 | 将“省时间”作为产品单点核心价值写入 `PRODUCT.md`，补充双人群价值、人机分工闭环、技术够用原则和长期升级路径；在 `PRINCIPLES.md` 写入“了解与开发分离”，明确前沿方向可以学习但不得在地基稳固、成本可控、有真实用户前启动工程开发。本轮只改文档，未改功能代码，未改变 `NEXT_STEP.md` 当前唯一下一步。 | `tasks/2026-07-24-产品战略与升级路径.md` |
| 判断逻辑与学习记录 | 已完成 | 在 `PRINCIPLES.md` 写入简单粗暴模式与细致模式的切换原则：默认直接办事，遇到技术保护墙切换细致模式，遇到信息分散墙保持快速采集汇总；新建 `GROWTH_LOG.md` 记录具身智能长期了解和独立支付路径待办。本轮只改文档，未改功能代码，未改变 `NEXT_STEP.md`。 | `tasks/2026-07-24-判断逻辑与学习记录.md` |
| 判断原则固化与信息收集排期 | 已完成 | 在 `PRINCIPLES.md` 固化简单粗暴/细致模式、单任务推进、借用生态扩大适用和支付路径范围划分四条原则；在 `GROWTH_LOG.md` 追加个人独立支付工具、具身智能长期了解、信息与用户反馈情报收集排期三条记录。信息收集能力确认重要但排在钱包刹车完全上线生效和找到真实用户之后，启动时优先复用现成开源工具。本轮只改文档，未改功能代码，未修改 `NEXT_STEP.md` 当前唯一下一步，未影响当前钱包刹车灰度任务。 | `tasks/2026-07-24-判断原则固化与信息收集排期.md` |
| 产品判断原则、成长记录与新对话交接固化 | 已完成 | 固化六条原则：简单模式/细致模式切换、单任务推进、优先借用成熟生态、个人支付与产品支付分离、角色分工与阶段验收、防御性安全与攻击能力边界；在 `THINKING.md` 写入产品负责人长期判断框架；在 `GROWTH_LOG.md` 追加个人支付、具身智能、信息与用户反馈情报、防御性安全加固、产品负责人持续成长五类记录；新对话默认必读文件由三份更新为五份：`AI-Workbench-Handoff.md`、`NEXT_STEP.md`、`THINKING.md`、`PRINCIPLES.md`、`GROWTH_LOG.md`；明确 Codex、Claude/GPT 和产品负责人的角色分工，Claude/GPT 只能基于其实际可访问的 GitHub 证据做独立验收；补充执行验收和阶段验收规则。本轮只改文档和文档一致性工具，未修改当前 `NEXT_STEP.md`，未影响钱包刹车或当前生产任务，未启动信息收集、安全加固、支付或具身智能开发。 | `tasks/2026-07-25-产品判断原则成长记录与新对话交接固化.md` |
| 用户试用门槛与 v0.4.7 埋点反馈机制固化 | 已完成 | 产品负责人确认用户试用前及格线与真实用户后的满分线分开，重要方向不自动插队；v0.4.7 未来范围增加产品内埋点和错误日志，但当前只允许记录最小化的工作台内部交互元数据，工作台外行为不在当前范围，原始用户输入和模型回答正文当前未批准采集。同步统一产品负责人、Claude、GPT、Codex 最新四方角色分工。本轮只改文档，未修改当前 `NEXT_STEP.md`，未启动 v0.4.7、信息收集、安全加固、支付、具身智能或其他新产品阶段。 | `tasks/2026-07-26-用户试用门槛与v0.4.7埋点反馈机制固化.md` |
| 第 3 阶段钱包刹车正式封板 | 已完成 | 产品负责人批准 `ACCEPT_CONDITIONAL_PASS`，第 3 阶段最终状态为 `PASS_AFTER_CONDITIONS_RESOLVED`。本轮只修正文档和 verification 表述：明确平台总账是唯一硬刹车，模型明细只做审计和分类统计；两张账本不是整体原子事务，模型明细失败会 fail closed、provider 不调用、平台保守预留不退款，只会更早耗尽预算，不会突破 40 USD 硬上限。整理真实 Preview 报告 run1/run2 标题，记录自然用户规模稳定性尚未证明，以及桌面端预算到顶提示展示需放入 v0.4.7 或首批真人试用前检查。本轮未修改功能代码或生产环境，未重新部署，未调用真实模型，未启动新阶段。 | `tasks/2026-07-26-第3阶段钱包刹车正式封板.md` |
| AI Workbench 完整产品能力、专业工作流、任务归属与长期发展地图 | 已完成 | 梳理 23 个产品能力模块、34 类专业岗位、62 条任务线和时间执行分类；把产品定义、专业工作流、任务归属、并行/串行边界、用户信任、第一批用户缺口、两个用户流失关口、市场质量线、v0.4.7 完整候选范围和长期愿景边界写入现有权威文档。`NEXT_STEP.md` 保持原文不变；本轮只改文档、Handoff 生成源和文档一致性证据，未修改功能代码或生产环境，未启动 v0.4.7、图片、上下文、手机端、Web 端、多 Agent、支付、加密支付、宣传营销或其他实施任务。 | `PRODUCT.md`、`EXECUTION_PROTOCOL.md`、`CURRENT_PROGRESS_AUDIT.md`、`THINKING.md`、`PRINCIPLES.md`、`VISION.md`、`DECISIONS.md` |
| 固化 20 块产品战略并补充国际多渠道入口 | 已完成 | 固化 20 块产品战略；明确飞书、微信、Telegram、WhatsApp、Discord 都只是 AI Workbench 外部入口适配器，核心不绑定单一平台；将通讯入口拆成国内内部研发指挥入口、国际内部研发指挥入口、国内外部用户入口、国际外部用户入口四条任务；补充 `waiting_for_product_owner_channel_selection`、入口成本框架、文件驱动无隐藏长期记忆协调 Agent、并行任务开工门槛、快但不免检、DeepSeek 与高质量模型分工。本轮只改文档和 Handoff 生成源，未修改 `NEXT_STEP.md`，未修改功能代码或生产环境，未启动 v0.4.7、飞书、Telegram、多 Agent、支付、信息收集、具身智能或其他实施任务。 | `PRODUCT.md`、`CURRENT_PROGRESS_AUDIT.md`、`EXECUTION_PROTOCOL.md`、`DECISIONS.md`、`THINKING.md`、`PRINCIPLES.md`、`VISION.md`、`GROWTH_LOG.md` |
| 建立 AI Workbench v0.4.7 可执行施工图并推荐第一批实施任务 | 已完成施工图，等待产品负责人审核 | 真实读取前端、应用服务、本机模型代理、Agent adapter、错误归一化、readiness、Electron、安装配置、验证脚本、Managed Proxy 代码和测试，只做文档审计。记录 9 个模块状态：模型底层、基础界面、图片、文件、上下文会话、反馈埋点日志隐私、安装环境恢复、测试虚拟人格真人验收、内部研发提速。建立公共底层清单、施工顺序和 A-H 8 个工作包；推荐第一批候选为 A 公共底层、E 反馈日志隐私、G 测试验收。未修改功能代码或生产环境，未调用真实模型，未启动 Agent、入口或部署。 | `CURRENT_PROGRESS_AUDIT.md`、`CURRENT_TASK.md`、`NEXT_STEP.md`、`CONTEXT.md` |
| 建立本地 Codex 任务网关 v0.1 | local_gateway_and_real_codex_smoke_passed | 新增本地任务网关和 mock 验收：结构化任务卡、状态机、人工批准、独立 branch/worktree、Codex adapter、事件账本、日志脱敏、并发限制、取消和 cleanup。本轮修复 Windows `.cmd` 启动：直接 `spawn('codex.cmd')` 会在进程创建前 `spawn EINVAL`，现改为 `%ComSpec% /d /s /c call "codex.cmd" ...` 且 prompt 走 stdin；同步移除当前 CLI 不支持的 `--ask-for-approval` 参数。新增 launcher fixture 测试和 per-call `safe.directory` 后置 Git 检查；mock、无模型 CLI 和原有 `npm.cmd run verify` 通过。唯一真实只读 Codex smoke 启动 1 次并得到正确只读输出；未修改文件、未 commit、未 push、未部署、未触发 scope violation，费用状态 `unknown`。 | `scripts/task-gateway.mjs`、`scripts/verify-task-gateway.mjs`、`verification/local-codex-task-gateway-v01/summary.json` |
| 建立飞书渠道适配最小闭环 v0.1 | feishu_channel_implementation_passed_live_smoke_blocked_by_credentials_or_permissions | 使用 AI Workbench 自己控制的飞书企业自建应用方案，安装并审计官方 SDK `@larksuiteoapi/node-sdk@1.71.1`。新增飞书渠道适配器、mock 测试、`.env.example` 和人工配置清单；支持 WebSocket 长连接事件、文本命令、owner allowlist/一次性配对、单聊、群 @、报告群绑定、状态通知和脱敏。飞书层只调用任务网关模块，不直接碰 Git/worktree/Codex/生产。mock 测试通过；真实飞书长连接和 smoke 因缺少本机 App ID/App Secret 与后台权限配置未执行。未调用 GPT、Hermes、朋友平台数字员工或生产环境，未启动 A/E/G。 | `scripts/feishu-task-channel.mjs`、`scripts/verify-feishu-task-channel.mjs`、`verification/feishu-task-channel-v01/summary.json` |
| 第 3B-2b2b 段：零流量 deployment | 已完成零流量验证 | 产品负责人验收通过 3B-2b2a 后批准进入 3B-2b2b，并在严格基线 blocked 后批准以文档提交 `37ab9c2` 为新基线继续。本轮用 `wrangler versions deploy` 将新预算 version 加入 active deployment，但流量为 0%；旧稳定 version 继续 100%。通过 production hostname version override 验证候选 version 的健康、模型列表和未认证聊天拒绝路径；预算表仍为空。未使用真实安装 Token，未调用真实 provider，未修改 Secrets，未执行回滚。上一段完整 Preview URL 当前文件已脱敏，历史不重写。 | `verification/monthly-budget-worker-zero-traffic-deployment/summary.json`、`verification/monthly-budget-worker-zero-traffic-deployment/report.md` |
| DeepSeek V4 Flash 路由迁移本地候选 | 本地候选完成，等待验收 | 产品负责人确认 3B-2b2d HTTP 400 根因高度确定为旧 DeepSeek 上游模型名退役；本轮先将失败候选 version 从 1% 撤回到 0%，旧稳定 version 恢复 100%。本地实现逻辑模型 `deepseek-chat` 到上游正式模型 `deepseek-v4-flash` 的显式路由，预算明细按实际计费模型记录；16 项 Managed Proxy 测试和 TypeScript 检查通过。既有 21 micro-USD 失败预留保留，未上传新 Worker version，未部署生产修复，未修改 Secrets/D1 schema，未发起新的真实 provider 调用。 | `verification/deepseek-v4-flash-route-migration/summary.json`、`verification/deepseek-v4-flash-route-migration/report.md` |
| DeepSeek V4 Flash 修复 Worker Preview | Preview 已上传并通过无付费验证，等待验收 | 产品负责人验收本地候选后批准只上传新 Worker version 并执行无付费 Preview 验证。新修复 Worker version `a7eb385b-84df-4a45-b554-0aca40b6b407` / version number `12` 已上传，Preview alias 为 `budget-v4-flash-candidate`；Preview `/health` 200、`/v1/models` 200、未认证聊天 401 `missing_token`。active deployment 和正常生产流量未变化，旧稳定 version 100%，失败候选 0%，新修复 version 0%。既有 21 micro-USD 预算历史保留，未注册 installation，未调用真实 provider，未修改 Secrets/D1 schema。 | `verification/deepseek-v4-flash-worker-preview-upload/summary.json`、`verification/deepseek-v4-flash-worker-preview-upload/report.md` |
| DeepSeek V4 Flash 非思考兼容本地候选 | 本地候选完成，等待验收 | 产品负责人验收第 3B-2b2e Preview 上传通过后，付费验证前确认 version 12 未显式固定 `deepseek-chat` 非思考语义，因此 version 12 不用于付费真实验证。本地新增 `thinkingMode: "disabled"`，服务端强制上游 payload 非思考模式并覆盖客户端 enabled；19 项 Managed Proxy 测试和 TypeScript 检查通过。未上传新 Worker version，未部署，未注册 installation，未调用真实 provider，未修改生产流量、Secrets、D1 schema 或历史 21 micro-USD。 | `verification/deepseek-v4-flash-nonthinking-compatibility/summary.json`、`verification/deepseek-v4-flash-nonthinking-compatibility/report.md` |
| DeepSeek V4 Flash 非思考真实 Preview 验证 | blocked_after_single_registration_before_real_call | 产品负责人验收非思考兼容本地候选后批准上传新的非思考兼容 Worker version，执行无付费 Preview 安全门，并在通过后最多一次注册和一次真实聊天。新 version `cf002344-57ee-4c3f-86a6-115ca66c8b5f` / version number `13` 已上传，Preview alias `budget-v4-nt-real-candidate`；无付费 Preview 检查通过且生产流量未变化。唯一一次注册后一次性脚本在聊天前预算读取阶段崩溃，Token 未打印未持久化且不可恢复；按边界停止，真实聊天 0 次、provider 调用 0 次、预算预留 0。D1 仅确认 installations +1、daily_usage +1；平台预算仍 21/1，历史 `deepseek-chat` 仍 21/1，无 `deepseek-v4-flash` 行。 | `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json`、`verification/deepseek-v4-flash-nonthinking-real-preview/report.md` |
| DeepSeek V4 Flash 非思考真实 Preview 链路 | passed，等待产品负责人验收 | 产品负责人确认上次阻断为 Windows Node 子进程错误调用 `.cmd` 文件，并批准 run2 复用现有 version 13。本轮未上传新 version，未修改 Worker、Wrangler 配置、Secrets、D1 schema 或 production deployment；Token 进程移除所有子进程调用。run2 注册 1 次成功，聊天 1 次 HTTP 200，provider model `deepseek-v4-flash`，回答 `OK`，`reasoning_content` 为空，usage prompt 7 / completion 1 / total 8。预算预留 23 micro-USD；平台总账 21/1 -> 44/2，V4 Flash 明细不存在 -> 23/1，历史 `deepseek-chat` 保持 21/1。version 13 正常生产流量仍为 0%。 | `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json`、`verification/deepseek-v4-flash-nonthinking-real-preview/run2-real-call-result.json` |
| Version 13 的 1% 生产灰度 | 已完成，观察可信度受低流量限制 | 产品负责人验收 version 13 真实 Preview 链路后批准 1% 灰度。本轮先纠正旧 summary 的 run1/run2 歧义；dry-run 正确后用 `wrangler versions deploy` 创建 active deployment `9952d7cb-2d99-483a-85f7-c9ada1a09db4`，旧稳定 version 99%，version 13 1%。20 分钟观察和 5 分钟缓冲完成，健康检查均 200，候选 tail/error tail 未输出 JSON invocation 或 runtime error；未捕获足够自然候选流量。预算、Secrets、D1 schema 和 Worker 代码未变，Codex 未主动注册或聊天，未触发回滚。 | `verification/version13-one-percent-production-canary/summary.json`、`verification/version13-one-percent-production-canary/report.md` |
| Version 13 全量生产切换 | 已完成，观察可信度受低流量限制 | 产品负责人验收 version 13 的 1% 灰度后批准 100% 全量。本轮复用现有 version 13，未上传新 version，未修改 Worker、Wrangler 配置、Secrets、D1 schema、routes 或 domains；dry-run 正确后用 `wrangler versions deploy` 创建 active deployment `0400b7aa-49fe-460d-ac6d-3ed5bfdb0480`，只包含 version 13 且承载 100%。30 分钟主动观察和 5 分钟指标缓冲完成，生产与 Preview 健康检查均 200，error tail 未输出 JSON runtime error；预算保持平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1，Codex 未主动注册或聊天，未触发回滚。自然生产 invocation 样本不足，状态为 `version13_full_production_active_observation_limited_by_low_traffic`。 | `verification/version13-full-production-promotion/summary.json`、`verification/version13-full-production-promotion/report.md` |
| 第 3B-2b2c 段：1% 生产灰度 | 已完成，观察可信度受低流量限制 | 产品负责人验收通过 3B-2b2b 后批准进入 3B-2b2c，并拍板钱包刹车采用灰度切流量。开始前确认仓库 clean、HEAD=origin/main、`managed-proxy` 无 diff、active deployment 为旧 100%/新 0%、预算表为空、健康端点 200；`git fetch` 因本机凭据 `SEC_E_NO_CREDENTIALS` 失败但未影响 HEAD=origin/main。dry-run 正确后用 `wrangler versions deploy` 将旧稳定 version 调为 99%、新预算 version 调为 1%。20 分钟观察加 5 分钟缓冲完成，生产 `/health` 和 `/v1/models` 共 11 轮均 200，version override GET 通过；tail 未输出可见事件，未确认自然候选流量。预算表仍为空，Secrets 和 D1 schema 未变，未主动真实模型调用，未触发回滚。 | `verification/monthly-budget-worker-one-percent-canary/summary.json`、`verification/monthly-budget-worker-one-percent-canary/report.md` |
| 第 3B-2b2d 段：单笔真实预算链路验证 | blocked_before_paid_call | 产品负责人验收通过 3B-2b2c 后批准在 99%/1% 灰度下对新预算 version 执行最多一笔注册和最多一笔真实聊天。开始前确认仓库 clean、HEAD=origin/main、`managed-proxy` 无 diff、active deployment 仍为 99%/1%、预算表为空、健康端点 200；`git fetch` 仍因本机凭据 `SEC_E_NO_CREDENTIALS` 失败但未修改凭据。预留计算为 21 micro-USD，低于 100 micro-USD 门槛。一次性临时 Node 脚本只尝试 1 次注册，未返回 HTTP 状态且未取得 Token；按不得重试边界停止，聊天请求 0 次，未调用 provider，预算表、installations 和 daily_usage 均无增量，Secrets/D1 schema/Worker 代码未变，未触发回滚。 | `verification/monthly-budget-worker-controlled-real-canary/summary.json`、`verification/monthly-budget-worker-controlled-real-canary/report.md` |
| 第 3B-2b2d 段：阻塞恢复诊断 | blocked_transport_cause_unresolved | 产品负责人确认上次阻塞处理正确后批准继续同一段，先诊断注册无 HTTP 状态原因。上次 evidence 缺少异常详情；本轮无付费诊断确认 Node 内置 fetch 未显式使用代理时出现 `UND_ERR_CONNECT_TIMEOUT`，显式 undici `ProxyAgent` 后 GET/OPTIONS/无状态 POST 可取得 HTTP 响应，根因分类 `system_proxy_error`。但未取得独立证据证明 version override 命中新预算 version，因此不满足再次注册条件。新增注册 0 次、聊天 0 次、provider 调用 0 次、预算写入 0；流量仍 99%/1%，未回滚。 | `verification/monthly-budget-worker-controlled-real-canary/summary.json`、`verification/monthly-budget-worker-controlled-real-canary/transport-diagnosis.json` |
| 第 3B-2b2d 段：候选 Preview 单笔真实链路 | real_preview_call_failed_after_budget_reservation | 产品负责人确认 transport 根因后批准改用候选 version Preview URL。本轮无付费 Preview 检查通过；注册 1 次成功；唯一真实聊天 1 次返回 HTTP 400 `invalid_request_error`，未重试。预算预留已写入：平台总账和 `deepseek-chat` 明细各 +21 micro-USD、call_count +1；installations +1，daily_usage +2 requests/+2 input tokens/+0 output tokens。生产流量仍旧版本 99%、新预算版本 1%；Secrets、D1 schema 和 Managed Proxy 代码未变，未回滚。 | `verification/monthly-budget-worker-controlled-real-canary/summary.json`、`verification/monthly-budget-worker-controlled-real-canary/versioned-preview-check.json` |
| 个人学习节奏与具身智能范围边界 | 已完成 | 在 `THINKING.md` 补充产品负责人分块安排个人学习是正常节奏，不代表项目停滞或优先级改变；具身智能可作为个人时间和个人资金下的小规模自学实践，但当前阶段不得投入产品工程资源或 Codex 执行做具身智能开发。本轮只改文档，未改 `NEXT_STEP.md` 当前唯一下一步。 | `THINKING.md` |

## 当前未完成任务

| 任务 | 当前状态 | 下一步 |
| --- | --- | --- |
| 硬骨头3：能下载能安装 | 已完成；v0.4.6 Alpha Release 已公开发布，下载回测通过 | 下一任务转入电脑环境治理。 |
| 打开后知道能干嘛 | 未完成 | 首屏放 3-5 条能点即跑的示例指令。 |
| 办不成时是人话不是崩 | 部分完成 | 已有 readiness 降级说明；后续继续补失败自愈、重试和人话解释。 |
| 反馈出口 + 一句安全告知 | 未完成 | 增加反馈渠道和基础安全告知。 |
| v0.4.7 产品内埋点与错误日志 | 未开始 | 已纳入 v0.4.7 施工图工作包 E；等待产品负责人审核施工图并批准第一批工作包后才可开工。只允许最小化工作台内部交互元数据，原始用户输入和模型回答正文当前未批准采集。 |
| 桌面端预算到顶错误展示与用户引导 | 未开始 | 后端已有 `monthly_budget_exhausted` 和“共享模型服务本月额度已用完，请稍后再试。”；桌面端是否清晰、友好展示尚未独立证明，放入 v0.4.7 或首批真人试用前检查。 |
| 模型分层调用 | 未开始/暂缓 | 等上线最小集前三条稳定后再做；不要抢跑。 |
| 手机端 | 未开始 | 等桌面上线闭环后再排期。 |
| 自动情报流水线 | 未开始/P3 | 后续再做，不阻塞上线。 |
| 电脑环境治理：产品资产备份、单点故障核查和清理候选盘点 | 已完成 | 已进入第一批安全清理，当前清理结果为 partial。 |
| 重启后处理第一批遗留空目录，并由产品负责人决定Windows临时文件及第二批软件清理 | 部分完成 | 已处理批准遗留目录；用户 npm 缓存仍因 `EPERM` 失败，Windows 临时文件仍需产品负责人手动确认；不得自动进入第二批清理。 |
| DeepSeek V4 Flash 非思考兼容 Worker 上传、Preview、真实验证和生产切流 | 第 3 阶段已正式封板 | version 13 已上传并通过无付费 Preview、真实 Preview 链路、1% 生产灰度和 100% 全量生产观察；当前 version 13 承载 100% 正常生产流量。技术验收、逻辑复核和产品负责人最终批准已完成；未经批准不得发起新的主动真实调用或进入模型分层、上下文压缩、v0.4.7 或其他新阶段。 |
| Environment Ops P0 任务和账号安全 | 未开始 | 先解决草稿保存、重复请求/费用、端到端幂等和账号恢复单点。 |
| Environment Ops P1 基础环境稳定 | 暂时恢复，未永久修复 | 解决唯一实例、UI/Session/服务一致性、Node/Electron代理、国内外分流、网络和飞书稳定性。 |
| Environment Ops P2 官方支付和 API | 只调研，未开通 | OpenAI/Anthropic独立Billing、项目/Workspace、Key和预算小额验证。 |
| Environment Ops P3 首批开发协作群 | blocked | 通过Preflight后只执行一次受控生成、5员工、飞书绑定、建群和只读冒烟。 |

## 最新 3A-R1.3 结果

- 任务：上线硬骨头3A-R1.3：恢复 GitHub Actions 可观测性并完成云端预验收。
- 状态：passed。
- 本轮确认：GitHub CLI 已恢复，Run `29920336923` 的 artifact 已下载读取；`actions-build.log` 显示云端构建失败根因是 `package.json` 写死 `build.electronDist=node_modules/electron/dist`，而 Actions `npm ci` 后该目录不存在。
- 已做最小修复：删除 `electronDist`；预验收脚本不再读取旧 NSIS 证据；NSIS smoke runtime 改为唯一目录；workflow 增加 Step Summary 和 build/preflight/artifact gate；临时 Actions 下载目录加入 `.gitignore`。
- Run `29933834029`：云端安装包构建、安装、smoke-test、卸载和扫描均通过，artifact 内 `preflight-summary.json` 为 passed；但 job 仍 failure，原因是 electron-builder 在 CI 中尝试隐式 publish，报 `GH_TOKEN` 未设置。已追加 `--publish never`。
- Run `29935231224`：真实 conclusion 为 success；云端 build/install/smoke/uninstall/扫描均 passed。
- 本地验证：`node --check` 和 `npm.cmd run build` 通过；`npm.cmd run verify:install-release` 完成安装、smoke、卸载和扫描，但因本机旧 `win-unpacked` 被文件锁清理破坏仍为 failed。最终以新 Actions 干净环境 run 为准。
- 验收产物：`verification/install-release/repair1-3-summary.json`、`verification/install-release/repair1-3-report.md`。
- 结论：R1.3 已判绿。Run `29935231224` 真实 success，云端 build/install/smoke/uninstall/扫描通过；不自动进入 R2，不进入 3B。

## 缺失文件说明

| 缺失文件 | 是否需要现在补 | 原因 |
| --- | --- | --- |
| `verification/model-router/summary.json` | 不补 | 这个文件名对应“模型分层/模型路由”验收产物，但模型分层任务尚未正式执行。当前已有的是 `verification/unified-model-proxy/summary.json`，它只代表“统一模型入口”验收，不能冒充模型分层验收。 |
| `research/market-intelligence.md` | 暂不补 | 该文件对应后续市场/情报材料，当前仓库不存在；情报流水线是 P3，不阻塞上线硬骨头3。 |

## 留痕规则

- 每次下达或完成任务，都必须更新 `TASKLOG.md`、`CHANGELOG.md`、`CURRENT_TASK.md`。
- 每个新 AI / 新 Codex 接手前必须先读 `EXECUTION_PROTOCOL.md`。
- 涉及方案或调研时，必须写入 `research/` 下对应 `.md`。
- 涉及验收时，必须把摘要写入 `verification/<task-name>/summary.json`；有人工可读报告时写入同目录 `.md`。
- 完成后必须 `commit + push`，让本地 F 盘和 GitHub 同步。
- 不允许为了“补齐文件”伪造未执行任务的验收产物。

## 最新 3A 结果

- 任务：上线硬骨头3A：安装包候选版与发布前预验收。
- 最新修复轮：3A-R1.3，状态 passed。
- 候选安装包：`release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`，SHA256 `ca833403906e8ba82c267813ced701b39a83f9d7a7d9f3e9e857a011b6b9ab47`。
- 验收产物：`verification/install-release/preflight-summary.json`、`verification/install-release/preflight-report.md`、`verification/install-release/nsis-install-uninstall.json`、`verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/repair1-2-install.log`、`verification/install-release/repair1-2-smoke.log`、`verification/install-release/repair1-2-uninstall.log`。
- R1 已做：为 packaged smoke-test 禁用更多 GPU 路径并改为 HTTP renderer 探测；安装验证改为发现真实安装路径；尝试 assisted NSIS、默认 per-user、`/currentuser`、oneClick NSIS、`force-run` 和 60 秒等待。
- R1.2 根因：安装包 payload 有效；默认 per-user 安装目录在当前中文用户名环境下没有稳定落盘，只留下 updater 缓存副本。显式 `/D=` 到 ASCII 路径可落盘。
- R1.2 修复：新增 `build/installer.nsh`，将默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`；新增 `scripts/verify-nsis-install.mjs`，主 preflight 改用 Node helper 真实执行安装、安装版 smoke-test 和卸载。
- 本地结果：`npm.cmd run verify:install-release` 通过；NSIS `/S` 安装真实落盘，exe、卸载器、卸载注册表项、桌面/开始菜单快捷方式均存在；安装版 `--smoke-test` 退出码 0；卸载退出码 0。
- GitHub Actions：Run `29919498085` failure，失败在 build；Run `29919834193` 和 `29920088772` build 成功但 preflight 被 skipped；Run `29920336923` build 失败根因已定位；Run `29933834029` preflight passed 但隐式 publish 失败；Run `29935231224` 已真实 success。
- ③A 总验收：passed。候选安装包来自 Actions Run `30001627121` artifact，SHA256 `b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`；真实安装、快捷方式、安装版后端启动、生产对话、中文降级、安全扫描、卸载和恢复安装版均通过。
- ③B GitHub Release：passed。公开 Release、安装包、SHA256 文件和下载回测均已完成；上线硬骨头3已完成。
- 结论：3A-R1.3 已通过；本机安装版已恢复；3A-R2.0 架构核验已通过；3A-R2.1 Cloudflare 生产部署与真实验证已通过；③A 总验收已通过；③B GitHub Alpha Release 已通过；产品方向和文档防漂移机制已完成。下一任务是电脑环境治理：产品资产备份、单点故障核查和清理候选盘点。
