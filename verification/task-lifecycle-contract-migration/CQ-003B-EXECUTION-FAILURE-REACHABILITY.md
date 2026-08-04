# CQ-003-B' 执行失败路径可达性核查

```text
baseline=fb5b7050fe34f3667ba14900811b6ca8bca7dcfc
conclusion=CURRENT_PROVIDER_FAILURE_PATH_REACHABLE_WITH_CONTRACT_RISKS
primaryPath=Provider execution failure
productionCodeModified=false
```

## 路径P：Provider执行失败

真实可达。

```text
合法runtime.status execute输入
→ InterpreterAdapter产生taskDraft
→ TaskStore.create
→ interpreting
→ scheduling
→ ready
→ executing
→ TaskStore.startRun
→ Run created→starting
→ 隔离Provider.status抛错
→ executeWithRun.failRunVerification
→ AgentRuntime catch/failTask
→ Task failed
```

证据：

```text
agents/agent-runtime.mjs:130-141
agents/agent-runtime.mjs:173-179
agents/agent-runtime.mjs:240-247
agents/agent-runtime.mjs:292-350
agents/agent-runtime.mjs:419-421
channels/task-store.mjs:51-63
```

该路径可使用当前Allowlist内的`runtime.status`，注入隔离Registry、Provider、Verifier、TaskStore，不需要改变正式Provider或Verifier契约，也不产生真实系统副作用。因此选择路径P作为主用例。

## 路径V：Verifier拒绝

拒绝路径真实可达：Provider可返回隔离候选结果，现有`verifyCapabilityResult()`可确定性拒绝，随后执行`failRunVerification()`和`failTask()`。

但当前控制流中Verifier在`executeCapabilityPlan()`内部调用；Task只有在`executeWithRun()`完整成功后才从`executing`转入`verifying`。因此Verifier拒绝发生时，Task仍是`executing`，不能满足“先进入verifying再拒绝”的精确补充契约。

结论：

```text
SUPPLEMENTAL_VERIFIER_CASE_NOT_IMPLEMENTED_DUE_TO_CURRENT_INJECTION_BOUNDARY
```

本轮不为补充用例修改Verifier绑定或通用执行路径。

## 十项回答

1. 路径P：真实可达。
2. 路径V：拒绝链可达，但拒绝发生前Task尚未转入`verifying`。
3. 路径P不需修改正式Provider或Verifier契约，并被选为主用例。
4. 路径P可完全使用隔离Fixture且无真实副作用。
5. 当前Run层能记录`failureReason`；Task.failure仅有`message/name`，没有稳定`errorCode/failureStage/failureClassification`。
6. 正式`failTask()`会写入Task failure并转移到`failed`，但当前failure结构不足批准契约。
7. `failed`属于`TERMINAL_TASK_STATES`；第二次`handle()`会在任何控制、Adapter、Scheduler或Provider逻辑前返回`terminalResult()`。
8. 正式身份：`taskId=job.taskId||job.messageId`；`originalMessageId=job.originalMessageId||job.messageId`；`conversationId=job.conversationId||job.chatId`；Run由`TaskStore.newRunId()`生成。
9. 第二次处理复用同一`messageId/originalMessageId/conversationId/chatId/openId`和必要上下文，不直接传入`taskId`。
10. Runtime执行失败时当前直接抛错，不返回结构化失败提示；用户通知责任位于Runtime之外的Delivery/Gateway错误处理层。仅凭当前Runtime隔离表面无法证明用户一定收到失败通知。

## 施工前已识别风险

```text
TASK_FAILURE_MISSING_STABLE_ERROR_CODE_STAGE_CLASSIFICATION_AND_RUN_IDENTITY
TERMINAL_FAILED_REPLAY_HAS_NO_EXPLICIT_TASK_REPLAYED_MESSAGE_REPLAYED_DISTINCTION
TERMINAL_FAILED_REPLAY_DEFAULTS_VERIFIED_TRUE_WHEN_FINAL_RESULT_IS_ABSENT
RUNTIME_FAILURE_NOTIFICATION_NOT_GUARANTEED_AT_RUNTIME_SURFACE
```

下一步按批准范围构造正式隔离专项；若上述任一风险被实测确认，分类`PRODUCT_OR_SECURITY_FAILURE`，保存WIP并硬停止，不自行修改通用执行路径。
