# AI Workbench 统一任务交接

## 0. 文件身份与属性

```text
fileName=AI_WORKBENCH_TASK_HANDOFF.md
documentType=SYNTHESIZED_TASK_HANDOFF
authorityLevel=DERIVED_NAVIGATION_DOCUMENT
canProveCompletion=false
mustRevalidateBeforeExecution=true
generatedFromHead=17326b3de06a61de6cde42f9966f0f185fdf5c70
generatedFromBranch=candidate/interpreter-adapter-v1-work
generatedFromRemote=17326b3de06a61de6cde42f9966f0f185fdf5c70
validatorPath=scripts/verify-authoritative-index-consistency-001.mjs
validatorExitCode=0
validatorChecks=523
validatorFailures=[]
```

本文件用于新对话导航和任务交接，不能单独证明任何功能完成。交接文件本身是导航和综合摘要，不是最高权威事实源。新助手必须重新核验 Git、权威索引和验证器。

一旦当前 HEAD、权威索引、风险状态或唯一安全下一步发生变化，应重新生成或更新本文件。本文件不填写包含自身的最终 Commit，以避免自引用 Commit；本文件的实际 Commit 由外部 Checkpoint Manifest 绑定。

### 事实权威优先级

1. 当前文件系统和 Git 实测；
2. `git ls-remote`权威远端；
3. exitCode=0 的权威索引独立验证结果；
4. 权威索引 JSON；
5. Checkpoint Manifest、Commit、Patch 与 SHA-256；
6. `CURRENT_STATUS.md`；
7. `NEXT_STEP.md`；
8. `PRODUCT.md`；
9. Markdown 人读报告；
10. 聊天记录、人工总结和记忆。

发生冲突时，高优先级覆盖低优先级。不得使用聊天结论、报告摘要或人工记忆覆盖机器事实。

## 1. 我们正在做什么

这是 AI Workbench 的候选开发 Worktree，当前分支是：

```text
candidate/interpreter-adapter-v1-work
```

当前大工作包：

```text
VERIFIED-SEMANTICS-UNIFICATION-001
```

当前目标是统一系统中的`verified`语义，防止客户端、历史持久化数据、上下文、UI、Gateway、Delivery或其他非可信路径把普通执行事实伪装成可信验收通过。

当前正在处理的第四类风险：

```text
LEGACY_WORKBENCH_RUN_VERIFIED_TRUST_BOUNDARY_BYPASS
```

该风险为HIGH且阻断部署。第四类风险解决后，仍需继续处理父工作包原三项系统性HIGH风险，因此第四类风险关闭不等于可以上线。

更大的产品目标是：AI Workbench把用户意图转成可验证、可执行、可回传、可审计的电脑任务，最终形成手机或飞书下达指令、电脑持续执行、结果回传的闭环。它不是只生成文字的聊天机器人，而是以真实执行、证据、验收和诚实失败为核心的AI工作台。

## 2. 当前机器权威状态

本节来自当前权威索引JSON及本轮独立验证器实测：

```text
STEP5-A=PRESENT_AND_VERIFIED
STEP5-B=PRESENT_AND_VERIFIED
STEP5-C=PRESENT_AND_VERIFIED
STEP5-D=PRESENT_AND_VERIFIED
STEP5-E=ACTUALLY_MISSING
STEP6=ACTUALLY_MISSING
STEP7=ACTUALLY_MISSING
STEP8=NOT_STARTED
verifiedFunctionalItems=4
totalRequiredFunctionalItems=7
completionRatio=4/7
step8Eligible=false
```

`4/7`只描述Step5-A至Step5-E、Step6、Step7这七个功能项，不包含Step8完整回归与风险关闭，也不代表整个产品完成度。

本轮未发现机器索引与上述机器状态之间的冲突，因此未设置`STATUS_CONFLICT_DETECTED`。人工状态文档和计划文档存在滞后，见“已知文档冲突”。

## 3. 当前风险与部署状态

```text
fourthRiskStatus=OPEN
originalThreeHighRisks=OPEN
parentWorkPackageStatus=BLOCKED_BY_FOURTH_RISK_REMEDIATION_IN_PROGRESS
finalAcceptance=false
deployment=NOT_DEPLOYED
overallSecurityStatus=BLOCKED
step8=NOT_STARTED
```

当前不可写成“可交付”“可部署”“可创建候选标签”或“可以启动Smoke”。

## 4. 已完成工作摘要

### Step5-A：服务端事实保留

```text
machineStatus=PRESENT_AND_VERIFIED
checkpoint=LEGACY-RUN-API-STEP5-SERVER-FACT-PRESERVATION-001
commit=58df1f714fcc13311b6c7b98145e239d61449fba
patchSha256=3f169482985567dd5e8fa0aff5507358f53fff134c34668592c4be6bb24dad8c
```

主要文件：

- `server.mjs`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/server-fact-preservation-map.json`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/server-fact-preservation-report.md`

专项脚本：

- `scripts/verify-server-owned-run-fact-preservation-001.mjs`

### Step5-B：UI客户端可写DTO和信任路径策略

```text
machineStatus=PRESENT_AND_VERIFIED
checkpoint=LEGACY-RUN-API-STEP5-UI-WRITABLE-DTO-001
commit=2bc72b9044dde9787cd8c75b5bbb80a14271da4c
patchSha256=6d6fd109de86d22e80427f43bf18f4d8677fffb3d211c1008dd2e006f97c1ebc
```

主要文件：

- `src/lib/writable-data-dto.js`
- `shared/run-trust-field-policy.mjs`
- `src/lib/server-owned-run-paths.js`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/ui-writable-dto-report.md`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/trust-field-path-matching-report.md`

专项脚本：

- `scripts/verify-ui-writable-dto-001.mjs`
- `scripts/verify-trust-field-protocol-path-matching-001.mjs`

### Step5-C：Context信任边界

```text
machineStatus=PRESENT_AND_VERIFIED
checkpoint=LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-002
commit=0618b838c0b85fe62339b5270ecf74255810b21c
patchSha256=bb866e2cb6cc4dca917e267f0170c8b98b0eaf1f079fb8c501fa9ebe8326ea94
supersedes=LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-001
```

旧版本必须保留但不得作为有效成果引用：

```text
invalidatedCheckpoint=LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-001
invalidatedCommit=0aa2f70c8dab4b80c80e78009d7058575279d845
effectiveGateStatus=INVALIDATED_BY_NEW_RISK
```

主要文件：

- `shared/run-context-projection.mjs`
- `server.mjs`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/caller-context-injection-fix-report.md`

专项脚本：

- `scripts/verify-workbench-context-verified-trust-boundary-001.mjs`
- `scripts/verify-agent-context-injection-rejection-001.mjs`

### Step5-D：UI状态与可信verified语义分离

```text
machineStatus=PRESENT_AND_VERIFIED
checkpoint=LEGACY-RUN-API-STEP5-UI-STATUS-SEPARATION-001
commit=8e111bb4531fe0fdd7ae219963c02e1deb88ca06
patchSha256=f3f212cfeae0857f966278b1ceb29f0e8adc27bcd4089c7e7b1a794ad07708c0
```

主要文件：

- `src/lib/run-status-view.js`
- `src/main.jsx`
- `verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/ui-status-separation-report.md`

专项脚本：

- `scripts/verify-ui-run-status-verification-separation-001.mjs`

## 5. 当前唯一安全下一步

```text
NEXT_SAFE_TASK=REMEDIATE_ACTUALLY_MISSING_STEP5_E
任务名称=Step5-E · verified传播边界核验与正式收口
```

目标：审计Gateway、Delivery、飞书适配、IPC、完成提示、重试停止、幂等和成功分支是否直接消费裸`verified`，或把普通执行事实升级为可信验收结果。

原则：

1. 以只读审计为主；
2. 每个组件标记`trustDecisionResponsibility=YES/NO`；
3. 纯传输或交付组件不得新增验收判断职责；
4. 没有直接消费时，不修改生产代码；
5. 有直接消费时，仅允许最小字段来源修正；
6. 不创建第三份`verified`派生规则；
7. 不处理失败通知责任链；
8. 不自动开始Step6。

需要产出的正式成果及当前存在状态：

| 成果 | 当前状态 |
|---|---|
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/propagation-boundary-audit.json` | NOT_FOUND |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/propagation-boundary-audit.md` | NOT_FOUND |
| `scripts/verify-verified-propagation-boundary-001.mjs` | NOT_FOUND |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/propagation-boundary-matrix.json` | NOT_FOUND |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/propagation-boundary-report.md` | NOT_FOUND |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5e-propagation-boundary-closeout.json` | NOT_FOUND |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5e-propagation-boundary-closeout.md` | NOT_FOUND |

预定正式功能Checkpoint：

```text
LEGACY-RUN-API-STEP5-PROPAGATION-BOUNDARY-001
```

预定索引更新Checkpoint：

```text
AUTHORITATIVE-INDEX-UPDATE-STEP5E-001
```

只有以下条件全部满足，才能把Step5-E更新为`PRESENT_AND_VERIFIED`：

1. 审计完成；
2. 传播边界专项全部PASS；
3. 聚焦回归PASS；
4. `npm run build` PASS；
5. 正式功能Checkpoint存在；
6. Patch与SHA-256一致；
7. 权威索引完成更新；
8. 最终验证器exitCode=0；
9. HEAD与`git ls-remote`一致；
10. worktree和staging clean。

## 6. 后续路线

必须顺序推进，不得并行自动开始：

1. 当前：Step5-E传播边界；
2. 随后：Step6三个旧测试迁移、历史断言存档和完备性专项；
3. 随后：Step7十二项信任边界专项接入Mandatory Gates，完成防伪和完整门禁留证；
4. 随后：Step8完整影响面回归和第四类风险关闭；
5. 然后才返回父工作包原始范围，处理原三项系统性HIGH风险。

原三项HIGH未解决前，deployment始终为`BLOCKED`。

## 7. 文件作用与属性表

| 文件 | 类型 | 主要作用 | 权威等级 | 是否能证明完成 | 是否可能过期 | 何时读取 | 何时允许修改 | 冲突时如何处理 |
|---|---|---|---|---|---|---|---|---|
| `PRODUCT.md` | 产品定义文档 | 说明产品是什么、目标用户、长期方向和产品边界 | 产品定义权威，但低于当前机器事实 | 否 | 是，可能落后于施工状态 | 理解产品目的时 | 产品定义正式调整时 | 不能覆盖Git、索引或Checkpoint机器事实 |
| `CURRENT_STATUS.md` | 人工维护的状态与风险登记文档 | 记录阶段、风险、部署状态和阻断原因 | 人工状态权威，低于机器索引 | 否 | 是，高频变化且可能因未获准修改而滞后 | 恢复项目状态时 | 经批准同步状态时 | 以机器索引、Git、Checkpoint为准并标记滞后 |
| `NEXT_STEP.md` | 计划文档 | 描述计划中的下一任务和顺序 | 计划权威，不是完成证据 | 否 | 是，易因风险或硬停止过期 | 准备继续施工前 | 产品负责人批准下一任务变化时 | 机器前置不满足时不得执行其中计划 |
| `EXECUTION_PROTOCOL.md` | 执行治理协议 | 规定基线、Checkpoint、Patch、SHA、Push、`git ls-remote`、风险停止和禁令 | 程序性高权威 | 否；只证明必须遵循的规则 | 是，但相对稳定 | 每次准备施工前 | 执行制度正式变更时 | 施工行为必须遵守；功能状态仍由机器证据证明 |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json` | 机器可读权威索引 | 绑定功能项、状态、Checkpoint、Commit、Patch、SHA、文件和失效关系 | 当前工作包内最高结构化治理事实源之一 | 验证器exitCode=0且外部证据一致时，可作为完成证明的一部分 | 是，随真实成果更新 | 任何Step5至Step8预检和引用前 | 真实成果完成并通过索引更新流程时 | 高于Markdown和聊天；低于当前文件系统、Git和独立实测 |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.md` | 权威索引人读镜像 | 方便阅读JSON索引 | 派生 | 不能单独证明 | 是 | 人工快速理解索引时 | 与JSON同步更新时 | 以JSON和验证器为准 |
| `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-real-remaining-work.md` | 派生剩余工作清单 | 按机器状态列出待补功能 | 派生 | 否 | 是 | 规划当前顺序时 | 与索引同步更新时 | 以索引JSON和验证器为准 |
| `scripts/verify-authoritative-index-consistency-001.mjs` | 独立治理验证器 | 核对索引、文件、测试契约、门禁执行图、Checkpoint、Commit、Patch和SHA | 机器裁决工具 | 可证明索引与当前仓库证据一致，但不能替代业务专项 | 是，规则可演进 | 每次施工前和索引更新后 | 独立治理规则获准变化时 | 失败时索引不得作为施工前置 |
| Checkpoint `manifest.json` | 不可变施工证据绑定 | 绑定Checkpoint、Commit、gateStatus、saveStatus、Patch和SHA | 外部机器证据 | 仅在`GATE_PASSED`且专项真实通过时证明限定范围 | 原则上不可变 | 核验具体成果时 | 既有Manifest不得修改 | 同时核验Commit、Patch实体和SHA |
| 外部Patch文件 | 外部变更证据 | 保存Checkpoint对应差异 | 外部实体证据 | 单独不能 | 原则上不可变 | 核验或恢复成果时 | 既有Patch不得修改 | 路径字符串不能替代实体；必须重算SHA |
| `AI_WORKBENCH_TASK_HANDOFF.md` | 统一交接导航文件 | 帮助新对话理解项目、文件、当前任务和复核步骤 | 派生导航文档 | 否 | 是 | 每个新对话开始时 | HEAD、状态、风险、路线或索引变化后 | 任何机器证据都高于本文件 |

## 8. 新对话接管流程

新助手收到任务后必须先做：

1. 读取`AI_WORKBENCH_TASK_HANDOFF.md`；
2. 读取其中列出的批准基线和当前状态；
3. 只读执行：

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/candidate/interpreter-adapter-v1-work
git status --porcelain=v2
git rev-list --left-right --count HEAD...<git-ls-remote返回的完整SHA>
```

4. 重新运行：

```bash
node --check scripts/verify-authoritative-index-consistency-001.mjs
node scripts/verify-authoritative-index-consistency-001.mjs
```

5. 重新读取权威索引JSON；
6. 确认当前机器状态是否仍与交接文件一致；
7. 若一致，报告当前阶段和唯一安全下一步；
8. 若不一致，停止施工并列出：交接文件值、当前机器值、发生变化的Commit、应采用的真实基线。

新助手不得只读交接文件后直接施工。

## 9. 新对话可直接复制的启动指令

> 请先只读接管项目，不要施工。  
> 仓库：  
> `E:\AI-Workbench-candidates\interpreter-adapter-001`  
> 分支：  
> `candidate/interpreter-adapter-v1-work`  
> 先读取仓库根目录：  
> `AI_WORKBENCH_TASK_HANDOFF.md`  
> 然后按该文件中的“新对话接管流程”核验：HEAD、`git ls-remote`、ahead/behind、worktree/staging/untracked、权威索引JSON、权威索引验证器。  
> 完成后告诉我：  
> 1. 我们在做什么产品；  
> 2. 当前处于哪个工作包；  
> 3. Step5-A至Step8的机器状态；  
> 4. 当前风险与部署状态；  
> 5. 唯一安全下一步；  
> 6. 交接文件与当前机器事实是否一致；  
> 7. 下一轮施工应使用的完整40位`authoritativeBaselineForNextInstruction`。  
> 不要自动施工，等待我确认。

## 10. 交接文件更新规则

出现以下任一情况时，应更新本文件：

1. 当前HEAD发生正式推进；
2. Step5-E、Step6、Step7或Step8状态变化；
3. 第四类风险状态变化；
4. 父工作包状态变化；
5. deployment或overallSecurityStatus变化；
6. 唯一安全下一步变化；
7. 权威索引结构或验证器路径变化。

更新时必须先重跑权威索引验证器，记录`generatedFromHead`，不得删除旧错误历史，不得让本文件覆盖机器事实，不得在文件中自引用包含自身的最终Commit。

## 最新停止证据

Checkpoint：

```text
LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002
checkpointCommit=17326b3de06a61de6cde42f9966f0f185fdf5c70
saveStatus=SAVED
gateStatus=WIP_NOT_GATED
failureClassification=PRECONDITION_BINDING_MISMATCH
finalAcceptance=false
```

Patch完整路径：

```text
C:\Users\qingy\AppData\Roaming\ai-workbench\checkpoints\LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002\LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002-17326b3de06a.patch
```

实体复核：

```text
patchExists=true
manifestPatchSha256=6097cb93d49b7a2f22455c0b4b8439e47a89e4a50fdc9b8e9caa0f471d335632
actualPatchSha256=6097cb93d49b7a2f22455c0b4b8439e47a89e4a50fdc9b8e9caa0f471d335632
patchHashMatch=true
```

该Checkpoint仅证明Step6因错误前置绑定而停止，不属于Step5-E功能成果，不证明Step5-E已完成。其`gateStatus=WIP_NOT_GATED`，不能作为功能验收通过证据。

## 已知文档冲突

| topic | sourceFile | sourceClaim | machineClaim | authoritativeResolution | actionRequired |
|---|---|---|---|---|---|
| 当前唯一下一步 | `NEXT_STEP.md` | 等待用户批准Interpreter Adapter | Step5-E=`ACTUALLY_MISSING`，当前安全顺序应先补Step5-E | 采用权威索引和验证器：`REMEDIATE_ACTUALLY_MISSING_STEP5_E` | 后续经单独批准同步`NEXT_STEP.md`；本轮不修改 |
| 当前状态时间和主线 | `CURRENT_STATUS.md` | 状态时间为2026-08-04，主线仍描述D0-1B到Interpreter Adapter | 当前HEAD为`17326b3de06a61de6cde42f9966f0f185fdf5c70`，已进入`VERIFIED-SEMANTICS-UNIFICATION-001`第四类风险整改 | 当前工程阶段采用Git、索引和验证器；状态文档视为滞后 | 后续单独同步；本轮不修改 |
| Step5-E是否完成 | 最新停止Checkpoint所针对的旧指令 | 旧指令手写绑定曾声称Step5-E完成 | 权威索引记录Step5-E=`ACTUALLY_MISSING`，且预定Step5-E成果文件均为NOT_FOUND | 机器事实覆盖旧指令；停止Checkpoint本身也明确不证明Step5-E完成 | 必须真实完成Step5-E后再更新索引 |
| 是否可以启动Step6 | Step6停止前置指令 | 以不存在的Step5-E绑定作为启动前置 | Step5-E和Step6均为`ACTUALLY_MISSING` | 不得启动Step6；先补Step5-E | 等待产品负责人批准独立Step5-E原子任务 |
| 第四类风险与部署 | `CURRENT_STATUS.md`及权威索引 | 第四类风险OPEN、部署BLOCKED | 相同 | 无冲突，维持OPEN和NOT_DEPLOYED | 不启动部署、标签或Smoke |
| 历史HEAD引用 | `PRODUCT.md`、`CURRENT_STATUS.md`、`NEXT_STEP.md` | 包含`b9cfaac917f27cfebac7d0acb2c7e6c3a85b8c80`、`75ef8ca8838790fc32cb95ddeb9d56fcfd969a92`、`c2ed8c13e42b5c006a6c30a943b08975cff6c3a5`等历史或阶段性提交 | 当前批准HEAD和远端均为`17326b3de06a61de6cde42f9966f0f185fdf5c70` | 历史提交只按其原用途理解，不得作为当前施工基线 | 新施工必须重新取得当前完整40位基线 |

## 本次生成读取与机器核验清单

本文件生成时实际读取或机器解析了：

- `PRODUCT.md`
- `CURRENT_STATUS.md`
- `NEXT_STEP.md`
- `EXECUTION_PROTOCOL.md`
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json`
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.md`
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-real-remaining-work.md`
- `scripts/verify-authoritative-index-consistency-001.mjs`
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/authoritative-index-consistency-reconciliation-findings.json`
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/authoritative-index-consistency-reconciliation-report.md`
- `C:\Users\qingy\AppData\Roaming\ai-workbench\checkpoints\LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002\manifest.json`
- `C:\Users\qingy\AppData\Roaming\ai-workbench\checkpoints\LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002\LEGACY-RUN-API-STEP6-PRECONDITION-STOP-002-17326b3de06a.patch`

生成前权威验证器结果：

```text
nodeCheckExitCode=0
validatorExitCode=0
ok=true
checks=523
failures=[]
```

本轮只创建统一交接文件，不补做Step5-E，不启动Step6、Step7或Step8，不修改生产代码、测试、门禁、风险状态或权威索引。
