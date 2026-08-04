# CQ-003阶段报告

```text
task=TASK-LIFECYCLE-M1-CQ003-INTERPRETER-FAILURE-AND-FAILED-TASK-001
cq003A=PASS
cq003B=COMPLETED_BY_RE_ANCHORED_CONTRACT
cq003BConclusion=B. HISTORICAL_CONTRACT_DRIFT
productDecision=RE_ANCHORED_TO_EXECUTION_STAGE_FAILURE_BY_PRODUCT_DECISION
productionCodeTouched=true
impactRegression=PENDING_THIS_REPORT_UPDATE
```

## CQ-003-B产品重新锚定

原“Task已创建→TaskInterpreter失败→failed”的控制流仍为：

```text
B. HISTORICAL_CONTRACT_DRIFT
```

产品负责人已将其承载的通用安全语义重新锚定到当前正式可达边界：

```text
EXECUTION_STAGE_FAILED_TASK_PERSISTENCE_AND_REPLAY
```

专项：

```text
scripts/verify-failed-task-persistence-and-replay-001.mjs
```

真实Provider隔离失败通过Runtime正式错误处理产生结构化failed Task；同一正式Task身份重放时Provider、Run、Final、Progress、assistant和Delivery相对增量均为0，Task.failure哈希保持不变，`taskReplayed=true`、`messageReplayed=false`、`verified=false`。

没有恢复旧chat Task、提前创建占位Task、手工写failed状态或恢复不可达TaskInterpreter入口。

## CQ-003-A

独立专项：

```text
scripts/verify-task-interpreter-bounded-correction-failure-001.mjs
```

结果：

```text
modelCalls=2
thirdCall=false
errorName=TaskInterpretationError
errorCode=TASK_INTERPRETER_BOUNDED_CORRECTION_FAILED
clarification=false
Scheduler=0
Provider=0
Task=0
Run=0
成功Final=0
可信授权=0
真实模型=0
```

## 影响面回归

本轮生产代码已触及，完整影响面回归将在独立Checkpoint `TERMINAL-TASK-REPLAY-VERIFICATION-IMPACT-REGRESSION-001`执行。本报告更新时CQ-003-A与CQ-003-B'专项均已独立PASS；不得以旧6/6替代本轮完整回归。

## 状态

```text
CQ-003整体=COMPONENT_CONTRACTS_COMPLETED_IMPACT_REGRESSION_PENDING
CQ-003-A=COMPLETED
CQ-003-B'=COMPLETED_BY_RE_ANCHORED_CONTRACT
旧脚本迁出=NOT_STARTED
M1聚合门禁=NOT_STARTED
```
