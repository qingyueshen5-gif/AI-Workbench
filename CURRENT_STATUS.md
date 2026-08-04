# CURRENT_STATUS.md — 当前真实工程状态唯一权威

- **状态时间：2026-08-04**
- 本文件只记录已证明事实。
- 计划、愿景和目标不得写成已完成能力。
- 其他文件与本文件冲突时，以本文件为准。

## 一、当前结论

- 产品尚未达到可部署和真人稳定使用状态。
- 当前不能宣布P0清零。
- 当前不能进入正式发布。
- RUN-FENCING候选`c2ed8c13e42b5c006a6c30a943b08975cff6c3a5`已通过验收，但未部署。
- D0-1B原始事实提取器候选已完成完整回归；尚未接入生产Interpreter路径，尚未部署，Production Smoke未重新执行或通过，真人验收尚未通过。

## 二、版本与运行状态

- 生产known-good Runtime：`75ef8ca8838790fc32cb95ddeb9d56fcfd969a92`。
- 生产Runtime本轮未触碰。
- 最近失败候选基线：`6006013be5aaa809401198f91eec5aafbb29136b`。
- Checkpoint保护基线：`bc43431e954f708d74d82b49ce367a73e07d0174`。
- Critical/High IPC隔离修复：`e4af9f912f82bf25f31bb3ad7bcaa0645cec2265`。
- 保护标签：`candidate/checkpoint-protection-v1`。

## 三、最近关键事件

1. 候选版本部署后，真实飞书Production Smoke失败。
2. “你好”和Runtime状态请求均在Interpreter阶段失败。
3. 失败根因是实际模型输出不符合严格内部Schema。
4. 候选已回滚到known-good Runtime。
5. RUN-FENCING已重新实现、分阶段Checkpoint并通过15/15及完整回归。
6. D0-1A `runtime.status`与指定真实文件`file.read`已通过。
7. D0-1B已建立确定性原始事实提取器，模型调用和网络调用均为0。
8. 所有成果仍是候选状态，Production Smoke未重新执行或通过。

## 四、当前已完成

- v0.4.6历史发布。
- 钱包刹车和成本保护历史里程碑。
- Gateway/Runtime解耦基础。
- 既有Mandatory Gates。
- Critical/High IPC隔离修复。
- Checkpoint保护机制及远端存档。
- RUN-FENCING候选通过并保存，未部署。
- D0-1A候选验证通过。
- D0-1B候选专项通过，未接入Interpreter。

## 五、当前阻断

- Interpreter Adapter未完成。
- 安全闸门和抗变体矩阵未完成。
- Production Smoke未通过。
- 真人验收未通过。

## 六、当前技术主线

RUN-FENCING候选（已通过、未部署）
→ D0-1A（已通过）
→ D0-1B原始事实提取（候选完成）
→ 等待用户批准Interpreter Adapter
→ 安全闸门与抗变体
→ Production Smoke
→ 真人验收

当前唯一获准的下一任务和施工边界以`NEXT_STEP.md`为准；不得因为本节列出后续技术主线而提前施工。

## 八、风险登记

- **HIGH · RISK_POLICY_NOT_CENTRALIZED**：风险规则目前分散于`task-interpreter.mjs`、`capability-registry.mjs`、`capability-scheduler.mjs`和`agent-runtime.mjs`；`code.execute`与`code.modify`已经注册。在开放飞书或其他远程执行入口之前，必须完成集中审查或建立独立可信Risk Policy。本轮只登记，不实施。
- **MEDIUM · CAPABILITY_ADVERTISED_NOT_REGISTERED**：Interpreter中提及但Registry未注册`file.write`、`file.manage`、`computer.control`、`commerce.*`、`media.video.create`、`web.research`和`system.diagnose`。阶段B必须把这些稳定收敛到unsupported，不得暗示已经可以执行。
- **LOW · HERMES_CONFIG_VERSION_LAG**：当前Hermes配置版本提示`0 → 33`。本轮不迁移，留到独立维护窗口。
- **PLANNED · CHECKPOINT-REPORT-CONSISTENCY-001**：S6完成后、阶段B最终收口之前实施。Checkpoint创建时若缺少对应任务报告，应拒绝`saved=true`。本轮只登记，不修改Checkpoint Runner、不新增门禁。
- **MEDIUM · MULTI_TURN_CLARIFICATION_CONTEXT_NOT_SUPPORTED**：CQ-001现行契约将`clarify`定义为非执行消息，必须保留结构化`missingFields/questions`证据。当前clarify返回后，用户下一条回答尚不会自动与前一条缺失字段请求关联，也不支持跨消息、多轮澄清上下文恢复。须在开放远程入口（飞书）之前评估；本轮只登记，不实施多轮上下文。
- **MEDIUM · INTENT_RECOGNITION_KEYWORD_MATCHING_INCOMPLETE_BY_DESIGN**：当前确定性意图识别依赖关键词及结构规则，无法穷尽自然语言表达，漏判在设计上无法完全消除。当前缓解是复合意图连接结构优先fail-closed到`clarify`，防止只识别部分要求后直接执行。后续在真实模型Production Path Smoke阶段重新评估：模型负责语义理解，Adapter只负责确定性协议映射、安全收口和事实保真；本轮不接入真实模型。
- **LOW · TEST_ASSERTIONS_COUPLED_TO_LITERAL_USER_FACING_TEXT**：部分测试绑定具体用户文案，而不是结构化行为契约；后续调整表达层可能导致与产品行为无关的门禁失败。当前盘点见`verification/CQ-001-COMPOUND-NOTICE-BEHAVIORAL-ASSERTION-FIX-001/literal-text-assertion-inventory.json`，阶段B收口后统一整改；本轮只修复导致CQ-001回归失败的旁路断言。
- **HIGH · NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER**：`agents/agent-runtime.mjs:278,330,342,348,350`的控制拦截、clarification、confirmation和capability_unavailable路径在缺少Task/Run/revision绑定Verifier PASS时输出或持久化`verified=true`。本轮terminalResult修复不得修改这些写入或非执行路径；统一由`VERIFIED-SEMANTICS-UNIFICATION-001`处理。状态=`OPEN`；deploymentImpact=`BLOCKED`。
- **HIGH · LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING**：`agents/agent-runtime.mjs:408,410,430,439`的process.stop、code执行和conversation路径使用异构检查后直接输出`verified=true`，缺少统一持久化Task/Run/revision绑定Verifier PASS。本轮禁止修改成功执行路径；统一由`VERIFIED-SEMANTICS-UNIFICATION-001`处理。状态=`OPEN`；deploymentImpact=`BLOCKED`。
- **HIGH · NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND**：`agents/interpreter-adapter-contract.mjs:68`的非执行renderer使用共享字段`verified=true`，但没有Task/Run/revision身份，机器协议无法区分renderer有效与业务验证成功。本轮禁止修改非执行旁路；统一由`VERIFIED-SEMANTICS-UNIFICATION-001`处理。状态=`OPEN`；deploymentImpact=`BLOCKED`。
- **HIGH · USER_NOT_INFORMED_OF_EXECUTION_FAILURE_UNVERIFIED**：Runtime执行失败时直接throw；当前尚未确认Delivery或Gateway是否保证向用户发送明确失败通知。本轮不修改用户文案、Delivery、Gateway或IPC；必须在独立工作包中只读核查责任层后裁定。状态=`OPEN`；deploymentImpact=`BLOCKED`。
- **MEDIUM · TASK_INTERPRETER_NO_LONGER_ON_PRODUCTION_PATH**：`AgentRuntime`仍保存`this.taskInterpreter`，但`handle()`正式路径不存在可达调用，当前业务理解由`InterpreterAdapter`完成。CQ-002与CQ-003-A只证明组件自身契约，不证明其仍在生产链。M4必须明确选择重新接入真实模型理解链或正式移除死代码。状态=`OPEN`。
- **RESOLVED · FAILED_TASK_FAILURE_FACT_INCOMPLETE**：Task.failure已持久化稳定`errorCode/failureStage/failureClassification/taskId/runId/taskRevision/failedAt/message/name`及受控`causeCode`，并绑定正式失败Run。
- **RESOLVED · TERMINAL_TASK_REPLAY_CLASSIFICATION_MISSING**：业务Task终态重放现显式返回`replayed=true/taskReplayed=true/messageReplayed=false`；非执行消息重放保持相反分类。
- **RESOLVED · TERMINAL_REPLAY_VERIFIED_DEFAULT_TRUE_ON_FAILED_TASK**：terminalResult不再默认true；failed、cancelled及capability_unavailable重放均fail-closed，completed仅在Run verification与Final identity全部绑定一致时为true。
- **HIGH · ENVIRONMENT_COMPATIBILITY_RISK（未修复）**：固定路径`D:\\Anaconda\\Scripts\\hermes.exe`必须在真人陌生Windows机器验收前处理。本轮不批量修改生产路径。
- 盘符清单中其余31项`PRODUCTION_PATH`登记为`PENDING_ENVIRONMENT_COMPATIBILITY_REVIEW`，需逐项确认配置化、自动发现或保留理由后再修改。

## 九、Task Lifecycle七项产品裁定与迁移顺序

七项`CONTRACT_QUESTION`产品裁定已完成，并已固化到`verification/task-lifecycle-contract-migration/MIGRATION-PLAN.md`及`migration-plan.json`：

1. **CQ-001**：`clarify`属于非执行消息，不创建Task、不进入`waiting_for_clarification`；必须保留结构化`missingFields/questions`。历史waiting Task断言标记为`SUPERSEDED_BY_NON_EXECUTION_CLARIFY_CONTRACT`并在后续迁移时逐字存档。
2. **CQ-002**：迁移到TaskInterpreter受限纠正成功专项，保留模型调用2次、仅一次纠正、第二次合法输出通过。
3. **CQ-003**：拆分为TaskInterpreter受限纠正失败专项，以及Runtime failed Task事实持久化和终态重放专项。
4. **CQ-004**：迁移到Authorization/Confirmation Boundary专项，状态为`ACTIVE_SECURITY_GATE`，必须始终运行。
5. **CQ-005**：Adapter层保持unsupported且Task=0；Scheduler层建立直接输入的`capability_unavailable`安全兜底，状态为`ACTIVE_SECURITY_GATE`。
6. **CQ-006**：迁移到code能力专项；当前状态为`NOT_APPLICABLE_CAPABILITY_DISABLED`，能力进入Allowlist后自动转为`REQUIRED`，未PASS则Deployment BLOCKED。
7. **CQ-007**：迁移到process能力专项；当前状态为`NOT_APPLICABLE_CAPABILITY_DISABLED`，`process.stop`进入Allowlist后自动转为`REQUIRED`，未PASS则Deployment BLOCKED。

后续必须按独立原子工作包顺序执行，不得合并：

```text
M1 · Clarify与Interpreter契约迁移
→ M2 · 安全边界专项
→ M3 · 能力封存专项与机器阻断
→ M4 · 两项OUTDATED_SAMPLE修正、Task Lifecycle重跑、阶段回归和契约收口
```

当前事实：

```text
M1=NOT_STARTED
M2=NOT_STARTED
M3=NOT_STARTED
M4=NOT_STARTED
测试迁移=NOT_STARTED
生产修改=NONE
新门禁=NONE
完整回归=NOT_RUN
当前状态=BLOCKED
```

在M1—M4按顺序完成并通过之前，不得进入完整阶段回归或最终收口。

## 十、未裁定资产

`E:\AI-Workbench`主仓库仍存在原有modified和untracked资产。它们尚未全部确定来源和权威性，不得清除，也不得自动视为正式成果。本次施工只将其作为只读参考，并在仓库外保存资产清单。
