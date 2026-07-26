# AI Workbench 新对话交接包

生成方式：运行 `npm.cmd run docs:generate-handoff` 自动刷新本文件中间的快照区。

用途：让新开的 GPT / Claude / Codex 对话在读不到完整历史聊天时，仍能快速理解项目当前真实状态、边界和下一步。

## 新对话交接规则

- 普通新对话：提供 `AI-Workbench-Handoff.md`、`NEXT_STEP.md`、`THINKING.md`、`PRINCIPLES.md` 和 `GROWTH_LOG.md`。
- 新对话如需理解决策背景，应阅读 `THINKING.md`、`PRINCIPLES.md` 和 `GROWTH_LOG.md`。
- 需要判断某项验收：再提供对应 `verification/<task>/summary.json`、`report.md`、必要的 `commands.log`、对应 commit 和 Git diff。
- 新对话不需要默认读取全部 `verification/` 目录，只有当前任务相关证据才需要增加。
- 对方无法访问本机仓库时，必须提供文件内容或 GitHub 链接，不能只给本地路径。
- 任何新决策、任务结论和验收结果都必须回写仓库，不得只留在聊天里。

## 自动生成快照

<!-- AIW_GENERATED_HANDOFF_START -->
快照来源时间：2026-07-24T03:29:00Z

## 项目是什么

AI Workbench 是一个面向普通人和专业人的 Windows 桌面 AI 工作台，也是模型与 Agent 无关的调度框架。用户只通过一个输入框表达目标，工作台负责上下文读取、任务拆解、模型和工具调用、质量检查、失败恢复、证据留存和最终交付。

长期方向是全球产品，不只服务某一个国家或地区；不同语言、模型、平台规则和合规差异由后台逐步适配。

## 当前版本与公开 Release

- 当前版本：v0.4.6 Alpha（package.json version 0.4.6）
- Release 页面：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
- 安装包下载：https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe
- Release 状态：public / prerelease
- 安装包大小：111524004 bytes
- SHA256：b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9

## 当前架构

Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider

DeepSeek 是当前唯一已接入的生产实现，属于可替换的实现细节，不是产品定位。真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包、用户电脑、前端、员工配置或公开仓库。

## 已完成能力摘要

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

## 未完成能力摘要

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

## 产品地图基准

- 产品能力地图：见 PRODUCT.md 的“完整产品能力地图”，当前覆盖 23 个产品模块。
- 专业工作流地图：见 EXECUTION_PROTOCOL.md 的“专业工作流地图”，当前覆盖产品、研究、设计、工程、数据、安全、合规、发布、市场、运营和审计等岗位。
- 任务归属地图：见 CURRENT_PROGRESS_AUDIT.md 的“任务归属地图”，当前覆盖 62 条已提出任务线，并统一状态枚举。
- 时间与执行地图：见 CURRENT_PROGRESS_AUDIT.md 的“时间与执行地图”，区分当前真实问题、首批市场交付前必须做、真人试用后再决定、长期能力、战略研究、当前不做、可并行研究、可隔离并行开发和必须串行集成。

## 当前唯一下一步

等待产品负责人批准下一阶段范围和执行指令。

不得自动上传或部署新 Worker version、发起新的真实模型调用、电脑清理、首屏示例、反馈入口、安全告知、真实用户测试、模型分层、上下文压缩、手机端、情报流水线或任何新功能开发，除非产品负责人明确批准对应任务。

## 产品方向要点

- 用户状态差时，把结果托到稳定合格以上；
- 用户状态正常时，把结果推到更高质量；
- 用户本身很强时，放大判断力、创造力和执行力。
- 产品要托住用户下限，也要提高用户上限：表达差、知识少、不懂技术或不会配置时，工作台负责理解、补全、解释和协助；高能力用户使用后，应能完成更复杂、更高质量、更大规模的任务。
- 用户状态波动补偿：用户睡眠、情绪、记忆和判断质量会波动；工作台必须保存长期目标、产品初衷、历史决策和当前进度，发现新决定与原方向冲突时主动提醒。
- 借用生态但掌握控制层：可以使用 GPT、Claude、DeepSeek、Hermes、OpenClaw、浏览器自动化和其他成熟产品作为杠杆；任务状态、长期记忆、任务分配、质量检查、失败恢复、成本控制、执行证据和最终结果审计必须由 AI Workbench 掌握。
- 跨平台执行边界：长期目标是在用户授权和平台规则范围内操作网站和电脑，完成阅读、收集、比较、填写、下载、上传、中断恢复和跨平台交接；不以绕过验证码、安全限制、平台权限或反自动化规则为产品目标。

## 产品负责人、Claude、GPT、Codex 分工

- 产品负责人：定产品方向、定优先级、决定是否改变当前唯一任务、接受或拒绝风险、最终拍板阶段是否通过。
- Claude：帮助产品负责人梳理想法并结构化，从产品角度把关，对完整产品阶段基于 GitHub 可访问证据做独立验收并给出 PASS / CONDITIONAL_PASS / BLOCKED；不声称访问无权访问的本地或生产环境。
- GPT：统一跨对话上下文、判断当前唯一任务、防止任务线漂移、把产品负责人决定转化为完整有边界的 Codex 指令，并根据 Codex 回报帮助理解进度；不替代最终拍板。
- Codex：在授权范围内执行，修改代码或文档，运行测试，检查基线，发现基线冲突、证据不足或风险时停止，生成 verification，commit + push，如实汇报 passed / failed / blocked；不自行宣布完整产品阶段最终通过。

## 新对话交接方法

- 普通新对话：提供 AI-Workbench-Handoff.md、NEXT_STEP.md、THINKING.md、PRINCIPLES.md 和 GROWTH_LOG.md。
- 新对话如需理解决策背景，应阅读 THINKING.md、PRINCIPLES.md 和 GROWTH_LOG.md。
- 需要判断某项验收：再提供对应 verification/<task>/summary.json、report.md、必要的 commands.log、对应 commit 和 Git diff。
- 新对话不需要默认读取全部 verification 目录，只有当前任务相关证据才需要增加。
- 对方无法访问本机仓库时，必须提供文件内容或 GitHub 链接，不能只给本地路径。
- 任何新决策、任务结论和验收结果都必须回写仓库，不得只留在聊天里。
<!-- AIW_GENERATED_HANDOFF_END -->

## 权威文件索引

- `package.json`：当前版本号唯一权威。
- `NEXT_STEP.md`：当前唯一下一步唯一权威。
- `CURRENT_PROGRESS_AUDIT.md`：已完成/未完成能力唯一权威。
- `PRODUCT.md`：产品定义、用户、场景、一个输入框和产品边界。
- `VISION.md`：全球愿景、质量基线、人机共同成长和长期方向。
- `THINKING.md`：产品负责人判断依据，解释关键结论背后的原因。
- `PRINCIPLES.md`：简单、高质量、快速、低损耗、真实完成和透明可追溯。
- `DECISIONS.md`：已锁定决策。
- `CONTEXT.md`：项目基准和协作背景。
- `EXECUTION_PROTOCOL.md`：任务执行、验收、事实归属和交接协议。
- `verification/3a-final/summary.json`：③A 总验收证据。
- `verification/3b-release/summary.json`：v0.4.6 Release 事实证据。
- `verification/managed-proxy-production/summary.json`：Cloudflare Managed Proxy 生产验证证据。
