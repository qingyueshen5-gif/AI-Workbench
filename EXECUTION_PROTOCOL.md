# EXECUTION_PROTOCOL.md — 工程执行、证据、测试与连续性

> 本文件是模块 13、16、17、20 的唯一执行规范权威。产品和团队判断见 `THINKING.md`；Agent 技术体系见 `ARCHITECTURE.md`；产品铁律见 `PRINCIPLES.md`。

## 基本执行契约

每轮只有一个明确主线。执行者开始前必须确认仓库、分支、工作区、HEAD、`origin/main`、任务范围、预算、安全边界、允许修改的文件、验收条件和停止条件。

阶段状态只允许：`passed`、`failed`、`blocked`、`partial`、`pending`、`not_run`、`skipped`。不得用 planned、expected、should work 代替真实结果。

高风险动作包括支付、删除、覆盖重要成果、对外发布、发消息、跨账号、权限和生产变更，必须逐次获得产品负责人授权。普通可逆技术细节由执行者依现有架构、最小修改、最低风险和可验证原则自行判断。

## 标准执行阶段

1. 仓库与远端基线审计；
2. 读取权威文件和相关真实证据；
3. 定义最小修改与禁止事项；
4. 实施修改；
5. 构建或运行真实产物；
6. 本地测试、安全和失败路径验证；
7. 必要的外部环境验证；
8. 生成或更新 verification；
9. 更新当前文档、历史账本和 Handoff；
10. 检查 diff、敏感信息和范围；
11. commit、push，并核验本地 HEAD 等于 `origin/main`；
12. 一次性汇报结果并停止。

mock 只能证明机制可运行，不能证明生产可用；本地成功不能代替 GitHub、Cloudflare、Release 或真实用户环境结果。

## 13. 工程经验

- 临时脚本、测试目录、安装缓存和运行残留用完即删，必要证据进入 verification，避免污染仓库和用户电脑。
- 重复任务、相同输入和稳定中间结果优先复用；缓存必须有来源、版本、失效和清理规则。
- 上下文按任务最小化：只读取相关权威文件与证据，不默认吞入全部聊天、日志和 verification。
- 先用本地确定性工具完成搜索、计算、格式转换、去重和校验；需要开放知识、模型判断或跨设备能力时才调用云端。
- 不为一次性内容生成长期文件；长期结论进入权威文档，执行历史进入 `tasks/`/`verification/`，临时输出留在忽略目录后清理。
- 多 Agent 研究可以并行，但同一权威文件、核心代码、预算、Release 和生产配置必须串行集成。
- 任何成本未知的外部调用先估算；可复用上下文、Prompt、结果和证据，减少重复 Token。

## 16. 日志与证据

每个任务至少记录：目标、基线、实际命令或动作、退出码/状态、修改文件、结果、失败原因、成本状态、证据路径和验证结论。

证据按任务类型选择：

- 代码：diff、测试、构建、运行结果；
- 文件：路径、读回内容或摘要、哈希（需要时）；
- 浏览器：最终页面、关键字段、截图；
- 外部服务：URL/ID、真实状态和时间；
- 系统：命令、退出码、进程/端口/环境状态；
- 模型：路由、Token/费用状态、输出与复核结果；
- 安装：安装、启动、快捷方式、卸载和残留。

用户可见日志使用大白话；内部 Debug 保留错误码、Trace 和原始日志，但必须脱敏。Secret、Cookie、Authorization、App Secret、用户原文和未批准数据不得进入 Git 或普通报告。

验收产物放在 `verification/<任务>/`，任务历史放在 `tasks/`；失败和阻塞也必须如实留证，不伪造绿色。

## 17. 测试体系

测试按层次执行：

1. **单元测试**：函数、规则、解析、权限和错误分类；
2. **集成测试**：Gateway、Provider、Agent、任务状态、存储和恢复；
3. **E2E**：从用户入口到真实结果与证据；
4. **虚拟人格**：普通人、专业人、小白、弱网、低配、国际等回答和流程质量；
5. **安全/成本/故障测试**：越权、注入、预算到顶、超时、断网、Provider 和 Agent 故障；
6. **真人真机测试**：最终验证安装、首次使用、理解成本、真实任务和恢复体验。

虚拟人格现在即可持续运行，但只验证模拟交互和回答质量，不能冒充真人反馈，也不能替代陌生机器安装。执行者不能自行宣布完整产品阶段通过；阶段封板需要独立验收与产品负责人批准。

## 20. 项目连续性

仓库是唯一事实来源，聊天记忆不是。每次对话结束前必须回答：今天确认了什么、写进哪个权威文件、是否与现有事实重复、是否真实写入、当前下一步是否改变。

### 单一事实归属

事实归属表见 `CONTEXT.md`。当前版本、唯一下一步、完成度、产品、愿景、原则、架构、决策、思考、执行和成长分别由其权威文件维护；其他文件只引用或由脚本生成快照。

### 协调与交接

文件驱动协调 Agent 可读取任务、派活、跟踪和汇总，但无隐藏长期记忆，不改变方向，不批准风险，不免除验收。项目连续性由文件保证，可由第二协调 Agent 维护检查，但最终写回和集成仍需单一入口。

普通新对话先读 `AI-Workbench-Handoff.md`、`NEXT_STEP.md`，再读任务相关权威文件和证据。Handoff 只承载自动生成的最小快照和索引，不保存独有事实。

修改当前状态或权威文档后，必须运行：

```text
npm.cmd run docs:generate-handoff
npm.cmd run verify:docs-consistency
```

## Git 与发布完成条件

需要提交的任务只有在以下条件满足后才能报完成：修改已写入、真实验证已执行、证据和历史账本已更新、diff 已检查、敏感信息扫描无问题、commit 存在、push 成功、工作区除明确保留的用户文件外无意外改动、本地 HEAD 与 `origin/main` 一致。

外部发布、生产部署和 Release 仍需单独授权；普通 commit/push 只在用户明确要求时执行。

### Checkpoint 与破坏性 Git 硬规则

- 测试 `PASS` 与 Git 保存是两个独立状态；每个节点通过即提交，不得等待整个工作包结束。专项阶段一旦 `PASS`，必须立即自动创建 checkpoint commit，并生成机器可读 `PASS` manifest；测试通过与保存不得依赖执行者记得手动提交。
- checkpoint 后必须生成仓库外 `git format-patch`（或等价补丁）并校验 SHA-256；只有 checkpoint commit 和外部 patch 均验证成功、manifest 已更新为 `saved: true` 后，才允许继续完整回归或清理。
- 未提交的 `PASS` 成果存在时禁止 reset/clean；来源或价值无法确认的脏工作区以及任何未跟踪文件同样禁止 reset/clean，不得猜测其无价值或自动删除。“工作区干净”不是允许清理的唯一依据。
- 测试基础设施失败或无关回归失败不得删除已通过的生产实现；只有 checkpoint 和外部 patch 均验证成功后，才允许由保护器执行清理。
- 绕过保护器属于 `Deployment BLOCKED`。禁止直接执行 `git reset --hard`、`git clean -fd` 或任何 `resetHard` 等价路径；`scripts/git-guard.mjs` 是唯一 guarded reset/clean 入口，仓库扫描不得存在生产绕过。测试 fixture 只有在同一行显式标记 `CHECKPOINT_PROTECTION_FIXTURE` 时才可包含这些字面量。
- 专项测试失败时必须保留实现，不得 reset/clean；立即停止后续 Gate，并返回首失败命令、退出码和原始输出。失败证据不得伪装为 PASS。
- 专项测试 PASS 后，必须按明确的 repository-relative `scope allowlist` 校验全部 tracked/untracked 改动；allowlist 外任一改动都必须 fail closed，禁止暂存或混入 checkpoint。
- guarded restore 只接受当前仓库、当前 HEAD 等于 checkpoint commit、工作区干净、patch 位于仓库外且 SHA-256 匹配的机器可读 `PASS` manifest。任一条件不满足时禁止 reset/clean。

### Worktree、外部恢复副本与后台进程硬门禁

- 正式施工开始前必须只读验证 repoPath、worktreePath和所在卷存在且可读；需要写入时还必须可写，并成功读取当前HEAD和Git状态。卷未挂载或目录不可访问时必须返回`WORKTREE_VOLUME_UNAVAILABLE`并停止，禁止在其他目录重建过期副本继续施工。
- Checkpoint唯一恢复副本不得只存在于Worktree所在卷。批准根目录为`C:\Users\qingy\AppData\Roaming\ai-workbench\`；format-patch、SHA-256、PASS/final manifest、首失败日志、关键证据和后台进程台账必须保存于该根目录或其子目录。
- `saved=true`只能在外部Patch存在、大小大于0、位于C盘、位于Worktree之外、重算SHA-256匹配且manifest中的commit可由Git解析为真实commit后写入。任一检查失败必须停止，不得进入下一阶段或执行reset/clean。
- 每个任务期间启动或观察到的后台进程必须进入机器可读台账，至少记录processId/processRef、command、workingDirectory、startedAt、finishedAt、exitCode、owningTask、owningGate、gating、classification、supersededBy和evidencePath。
- 进程分类限定为`PASS`、`EXPECTED_TERMINATION`、`NON_GATING_FAILURE`、`FORMAL_GATE_FAILURE`、`UNKNOWN_FAILURE`。任何`UNKNOWN_FAILURE`使任务BLOCKED；任何正式门禁非零退出必须保留失败记录，只有同一门禁后续真实重跑、明确PASS并绑定具体运行和证据时才可解除当前阻断，禁止宣称失败从未发生。

### EXTERNAL-SKILL-CHANGE-CONTROL

- Agent可以提出Skill修改，但不得自行批准。所有`create`、`edit`、`patch`、`delete`、`write_file`和`remove_file`必须经过Hermes原生`skills.write_approval`，先进入Pending并提供完整Diff，只有产品负责人明确批准后才可落盘。
- `curator.enabled`在治理期间必须为`false`。后台Review、Self-improvement、Curator或任何其他名称不得绕过原生审批；审批开关关闭、Curator重启或批准基线字节漂移均属于安全边界漂移。
- 每次外部Skill写入批准必须记录taskId、原因、修改前后SHA-256、文件、执行组件和时间。未批准项目保持Pending或被产品负责人明确拒绝，Agent不得自行approve/reject。
- 外部Skill本体不强行提交到AI Workbench仓库。批准的C盘快照与`verification/external-skill-registry.json`共同构成治理证据；任务开始和结束均须检查配置与哈希。
- 发现未批准变化时，先保存仓库内有效成果，再硬停止。不得使用只读属性或NTFS ACL掩盖Hermes原生治理失败。

## Environment Ops 事故处理流程

所有电脑、进程、端口、网络、代理、AI Link、通讯渠道、Provider、账号恢复、支付和预算异常统一执行：

`问题出现 → 自动保存当前任务和草稿 → 冻结重复提交 → 生成唯一 Incident ID → 检查是否产生费用 → 检查是否已部分成功 → 分层检查电脑、进程、端口、网络、代理、应用、渠道和上游 → 保存脱敏证据 → 判断临时恢复或永久修复 → 执行最小风险恢复 → 验证 → 更新 ENVIRONMENT_OPS_ISSUES.md → 更新 Runbook/验收脚本 → 决定是否恢复主线任务`

固定要求：

- Incident ID、task ID、request ID 能关联时必须关联；没有则写 `unknown`，不得编造。
- 在费用、部分成功和幂等状态确认前，不得重复付费请求或多步骤创建。
- 页面、Electron IPC、主进程、本地 Gateway、远端 Gateway、Provider 必须分层判断，不能只重复最外层报错。
- Chromium 网络栈、Node/Undici fetch、系统代理、WinHTTP、环境变量和显式 dispatcher 必须分别检查。
- 临时恢复统一写 `temporarily_recovered`，不得写 `fully_fixed` 或 `permanently_resolved`。
- 问题记录格式、状态枚举、严重度和维护责任以 `ENVIRONMENT_OPS_ISSUES.md` 为准。

## 付费生成和正式任务 Preflight

只有以下 12 项全部通过，才允许发起付费生成、正式工作流、员工/群创建或正式开发任务：

1. 本地资源正常；
2. 应用唯一实例；
3. 必要端口正常且拥有者正确；
4. 当前网络基线正常；
5. 代理模式、分流和本地直连正常；
6. 国内服务独立可达；
7. 国外服务独立可达；
8. 飞书或目标渠道连接正常；
9. Provider/Gateway 的非付费健康检查正常；
10. 登录 Session 正常；
11. 预算、自动充值、幂等和重复费用保护正常；
12. 草稿、任务状态和恢复检查点已保存。

Preflight 失败必须 fail closed：不点击生成，不调用付费模型，不创建员工或群，不切换未知价格 Provider；必须报告失败层、证据、草稿、费用和最小恢复建议。

安全复测最多一次：先通过非付费健康检查，再生成唯一 request ID，只提交一次，冻结重复点击并等待明确结果；成功时核对对象与计数增量，失败时保存完整 cause 并停止。
