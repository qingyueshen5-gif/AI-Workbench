# Task.failure结构修复后CQ-003-B'重跑首失败

```text
task=FAILED-TASK-FAILURE-FACT-STRUCTURE-FIX-001
failureFactFix=PASS
cq003bReplaySuite=BLOCKED
classification=PRODUCT_OR_SECURITY_FAILURE
code=TERMINAL_TASK_REPLAY_CLASSIFICATION_MISSING
exitCode=1
```

## 已修复并实测

第一次正式处理后的`Task.failure`现包含：

```json
{
  "errorCode": "PROVIDER_EXECUTION_FAILED",
  "failureStage": "provider_execution",
  "failureClassification": "provider_failure",
  "taskId": "正式Task ID",
  "runId": "正式失败Run ID",
  "taskRevision": 9,
  "failedAt": "Runtime可信时间戳",
  "message": "isolated provider execution failed",
  "name": "Error",
  "causeCode": "ISOLATED_PROVIDER_EXECUTION_FAILED"
}
```

`FAILED_TASK_FAILURE_FACT_INCOMPLETE`已不再触发。

## 新首失败

第二次使用同一正式身份调用`Runtime.handle()`，实际返回：

```json
{
  "replayed": true,
  "verified": true,
  "terminalState": "failed"
}
```

缺少：

```text
taskReplayed=true
```

`messageReplayed`为undefined，符合“不得为true”的允许范围；但Task终态重放没有结构化标记为`taskReplayed=true`，且failed Task在没有`finalResult`时默认成为`verified=true`。

正式分类：

```text
PRODUCT_OR_SECURITY_FAILURE
code=TERMINAL_TASK_REPLAY_CLASSIFICATION_MISSING
```

本轮批准范围只修复failure事实结构，不处理terminalResult。按硬约束保存WIP并停止。

## 重放前后计数

```text
TaskCreates增量=0
RunCreates增量=0
ProviderCalls增量=0
VerifierCalls增量=0
FinalWrites增量=0
ProgressWrites增量=0
AssistantAppends增量=0
DeliveryAttempts增量=0
SideEffects增量=0
```

说明重放没有重新执行，但结果分类及verified状态存在新的产品安全缺陷。

## 证据

```text
verification/FAILED-TASK-FAILURE-FACT-STRUCTURE-FIX-001/cq003b-rerun.stderr.json
verification/FAILED-TASK-FAILURE-FACT-STRUCTURE-FIX-001/cq003b-rerun.stdout.json
verification/FAILED-TASK-FAILURE-FACT-STRUCTURE-FIX-001/cq003b-rerun.exit-code.txt
```
