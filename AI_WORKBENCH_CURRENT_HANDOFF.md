# AI Workbench Current Handoff

```text
documentRole=CURRENT_HUMAN_READABLE_HANDOFF_AUTHORITY
authorityStatus=CURRENT
currentHandoffAuthorityUnique=true
```

本文件是新 GPT、Claude、本地执行助手和人工 Reviewer 了解“项目现在在哪里”的首要人类可读入口。它不能推翻 Git、Checkpoint、Verification Evidence 或 Authoritative Machine Index；发生冲突时，机器事实按既有职责优先。

历史 Handoff 保留但不再覆盖当前状态：

- `AI-Workbench-Handoff.md`：`HISTORICAL_GENERATED_HANDOFF`；
- `AI_WORKBENCH_TASK_HANDOFF.md`：`HISTORICAL_SYNTHESIZED_TASK_HANDOFF`。

## 1. 产品定义

AI Workbench 是安装在用户电脑上的执行工作台。用户通过受支持的 Port / Channel 与自己的 Workbench 建立安全绑定，然后使用自然语言创建、控制和验收真实任务。飞书不是 Workbench 本体；飞书属于 Port / Channel。

核心原则：**遵守端口协议，保持核心主权。**

```text
Port / Channel
→ Channel Adapter
→ AI Workbench Core
→ Task / Run / Agent
→ Provider / Tool / Skill
→ Verification
→ Progress / Result
→ Channel Adapter
→ original Port
```

## 2. Repository HEAD 与 Runtime Release

```text
repositoryAuthoritativeHead=THE_GIT_HEAD_CONTAINING_THIS_FILE
repositoryAuthoritativeHeadResolution=git rev-parse HEAD
approvedRuntimeReleaseCommit=e75a13d265802d343adb4fc28daf2392b4218129
liveRuntimeCommit=e75a13d265802d343adb4fc28daf2392b4218129
runtimeRebindRequiredForDocsOnlyCommit=false
```

当前文档提交会使 Repository HEAD 前移，但不会改变 executable runtime。不得因 docs-only HEAD 前移而重新 Rebind Runtime。

```text
canonicalBusinessRuntime=agents/agent-runtime.mjs::AgentRuntime
selectedRuntimeCommit=e75a13d265802d343adb4fc28daf2392b4218129
activeRuntimeCommit=e75a13d265802d343adb4fc28daf2392b4218129
```

当前真实 canonical chain：

```text
Feishu
→ Gateway / Adapter
→ canonical IPC
→ Runtime Supervisor
→ workbench-agent-runtime
→ agents/agent-runtime.mjs::AgentRuntime
```

PID 只属于历史运行证据，不是永久Runtime身份。

## 3. Foundation Milestone

```text
Step5=COMPLETE
Step6=COMPLETE
Step7=COMPLETE
Step8=COMPLETE
PackageBRuntimeAuthorityUnification=COMPLETE
runtimeAuthorityCount=1
duplicateBusinessAuthorityCount=0
productCoreMilestone=FIRST_REAL_PRODUCT_CORE_MILESTONE_COMPLETE
```

Step5—Step8的机器权威仍在：

- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json`；
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step8-full-impact-regression.json`；
- `verification/VERIFIED-SEMANTICS-UNIFICATION-001/step8-fourth-risk-closeout.json`。

Package B authority topology由现有门禁实测为：

```text
canonicalAuthority=agents/agent-runtime.mjs::AgentRuntime
runtimeAuthorityCount=1
duplicateBusinessAuthorityCount=0
```

## 4. Conversation / Continue Control Repair

```text
milestone=ROUND1_CONVERSATION_ROUTE_AND_CONTINUE_CONTROL_BOUNDARY_REPAIR
repairCommit=e75a13d265802d343adb4fc28daf2392b4218129
ConversationRouteRepair=COMPLETE
ContinueControlBoundaryRepair=COMPLETE
```

Conversation contract：

```text
ordinary model-answerable natural language
→ decision="execute"
→ taskType="chat"
→ actions=["answer"]
→ requiredCapabilities=["conversation"]
```

其他边界：

```text
Greeting → deterministic non-execution respond
Empty / invalid input → clarify
Unsupported → fail closed
paused continue → resume existing task
non-paused active continue
  → intercepted
  → existing task status
  → no new Task
  → no new Run
  → no Conversation Provider
```

## 5. Machine Validation Milestone

Step8正式fresh evidence记录：

```text
MandatoryGates=35/35 PASS
Regression=12/12 PASS
Attack=14/14 PASS
Propagation=3/3 PASS
ExecGuard=20/20 PASS
Build=PASS
```

本次docs-only冻结没有重复运行上述executable gates；它们是approved runtime release的已有里程碑证据，不是本次文档修改的新测试结果。

## 6. Live Runtime Rebind

```text
LiveRuntimeRebind=COMPLETE
liveRuntimeRebound=true
currentProductionBindingProven=true
selectedRuntimeCommit=e75a13d265802d343adb4fc28daf2392b4218129
activeRuntimeCommit=e75a13d265802d343adb4fc28daf2392b4218129
```

## 7. Real Feishu E2E

### Round 1

```text
status=PASS
evidenceClass=FULL_MACHINE_TRACE
deliveryExactlyOnce=true
```

已验证：

```text
real Feishu
→ Gateway
→ canonical Runtime
→ InterpreterAdapter
→ Conversation Task
→ Scheduler
→ durable Run
→ DeepSeek
→ Run-bound Verification
→ Final Result
→ original Feishu conversation
```

### Round 2

```text
status=PASS
evidenceClass=FULL_MACHINE_TRACE
requestClass=ordinary constrained natural-language task
deliveryExactlyOnce=true
```

已验证Python冒泡排序、仅代码格式约束、Task、Scheduler、Run、DeepSeek、Run-bound Verification与Exactly-once delivery。

### Round 3

```text
status=ACCEPTED
testClass=empty / whitespace input
evidenceClass=PHASE_REVIEW_ACCEPTED_EXTERNAL_TRACE
fullMachineTracePresentInRepository=false
```

接受结论为：

```text
empty / whitespace input
→ clarify
→ no Task
→ no Run
→ no Provider
→ clarification returned
```

仓库中未发现Round3完整原始machine trace，因此不得写成`FULL_MACHINE_TRACE_PRESENT_IN_REPO`，也不得在本次文档任务中重新执行Round3。

## 8. 当前产品状态

```text
round1RetestPassed=true
round2Passed=true
round3Status=ACCEPTED
humanAcceptancePerformed=false
productOwnerSignoff=false
finalAcceptance=false
deployment=NOT_DEPLOYED
```

“第一阶段真实产品核心完成”不等于最终验收、产品负责人签字或Deployment。

## 9. Provider Facts

DeepSeek：

```text
providerId=deepseek
model=deepseek-chat
realFeishuConversationE2EProven=true
```

Codex：

```text
providerTransportExists=true
transport=official_cli_subscription
liveStatusEvidence=online
realFeishuTaskE2EProven=false
```

不得宣称Scheduler已经真实证明可在DeepSeek与Codex之间动态自由调度。

## 10. 已知非阻塞架构债务

```text
schedulerConversationAssignmentConsumedDynamically=false
runtimeConversationProviderHardcoded=true
debtClass=NONBLOCKING_FOLLOWUP_ARCHITECTURE_DEBT
```

当前Registry、Scheduler与Runtime实际都指向DeepSeek，因此不阻塞本次已通过的Conversation里程碑；不得在docs-only冻结中修复。

## 11. Golden Reference Environment

```text
environmentClass=GOLDEN_REFERENCE_ENVIRONMENT
preserveCurrentEnvironment=true
```

当前成功机器环境不得为了陌生用户安装测试而直接卸载或破坏。Clean-room测试优先使用：

1. 新的Windows用户；
2. 虚拟机；
3. 第二台电脑。

## 12. 尚未证明或尚未实现

```text
ZERO-TO-ONE INSTALLATION=NOT_PROVEN
FIRST-RUN BOOTSTRAP=NOT_PROVEN
NEW USER ONBOARDING=NOT_PROVEN
NEW FEISHU ACCOUNT PAIRING=NOT_PROVEN
PAIRING QR UX=NOT_IMPLEMENTED_OR_NOT_PROVEN
CHANNEL ACCOUNT BINDING UX=NOT_PROVEN
PROVIDER FIRST-RUN SETUP=NOT_PROVEN
SELF-HEALING ENVIRONMENT SETUP=NOT_PROVEN
WORKBENCH BILLING / RECHARGE=NOT_IMPLEMENTED
MULTI-AGENT USER UX=NOT_PROVEN
MULTI-TASK USER UX=NOT_PROVEN
REAL ACTIVE TASK CONTROL HUMAN E2E=NOT_YET_ACCEPTED
```

## 13. 当前阶段与下一阶段

产品已从：

```text
CORE_RUNTIME_AND_REAL_CHANNEL_CLOSURE
```

进入：

```text
PRODUCTIZATION_AND_FIRST_USER_ONBOARDING
```

```text
nextProductPhase=ZERO_TO_ONE_ONBOARDING_AND_CHANNEL_PAIRING
nextSafeTask=ZERO_TO_ONE_ONBOARDING_AND_CHANNEL_PAIRING_DISCOVERY_AND_CONTRACT_AWAIT_APPROVAL
```

下一阶段目标用户是完全陌生的新用户。目标体验：

1. 下载AI Workbench；
2. 安装；
3. 第一次启动；
4. 自动环境检查；
5. 创建Workspace；
6. 选择“连接飞书”；
7. 建立安全Pairing；
8. 用户授权自己的飞书账号；
9. 建立`User ↔ Workspace ↔ Device ↔ Feishu Account ↔ Channel Binding`；
10. 配置Provider；
11. 发送第一条真实任务；
12. PC Workbench执行；
13. 手机看到进度与结果。

二维码是目标UX，不是已完成功能。Pairing必须一次性、短期有效，且不得包含永久Secret、API Key或Token。具体Feishu OAuth / authorization mechanism必须在下一工作包中依据现有代码和正式Feishu接口能力审查后确定，本文件不预设实现。

## 14. Roadmap

```text
Phase 1 FIRST PRODUCT CORE MILESTONE=COMPLETE
Phase 2 ZERO-TO-ONE ONBOARDING=NEXT
Phase 3 CHANNEL PAIRING=PLANNED
Phase 4 CLEAN-ROOM INSTALLATION=PLANNED
Phase 5 FIRST-USER HUMAN ACCEPTANCE=PLANNED
Phase 6 TASK UX / ACTIVE CONTROL=PLANNED
Phase 7 MULTI-TASK / MULTI-AGENT=FUTURE
Phase 8 BILLING / CREDIT / COMMERCIALIZATION=FUTURE
```

真正First-user Acceptance必须逐步覆盖：

```text
从零获得Workbench
→ 安装
→ 初始化
→ 绑定自己的Channel
→ 配置Provider
→ 创建第一条真实任务
→ PC执行
→ 手机得到结果
```

它不能被缩减为“用现有已配置账号继续问几个更难的问题”。

## 15. 新对话接管入口

新GPT、Claude或执行助手必须：

1. 先读`AI_WORKBENCH_CURRENT_HANDOFF.md`；
2. 再读`CURRENT_STATUS.md`、`NEXT_STEP.md`与`CURRENT_PROGRESS_AUDIT.md`；
3. 必要时读取最新milestone evidence和machine index；
4. 只读核验当前Git HEAD、remote、worktree和live runtime commit；
5. 回答：产品是什么、approved runtime release、repository HEAD、已完成什么、未完成什么、唯一next safe task；
6. 明确区分Repository HEAD与approved/live runtime release commit；
7. 未经用户批准，不开始下一阶段施工。
