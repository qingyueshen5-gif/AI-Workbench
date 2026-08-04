# CQ-002 TaskInterpreter受限纠正成功专项报告

```text
task=TASK-LIFECYCLE-M1-CQ002-INTERPRETER-CORRECTION-SUCCESS-001
focusedSuite=PASS
modelCalls=2
thirdCall=false
realModelCalled=false
productionCodeTouched=true
requiredImpactRegression=11
```

## 专项

```text
scripts/verify-task-interpreter-bounded-correction-success-001.mjs
```

隔离Fixture第一次返回缺少正式Schema必需数组字段的非法结构；第二次返回合法结构，同时携带多余`providerId`和伪授权字段，用于验证内部协议清洗。

## 受限纠正

第二次请求：

- 保留相同system prompt；
- responseFormat仍为`json_object`；
- 只增加一条纠正消息；
- 纠正消息包含第一次结构错误；
- 明确“只纠正JSON结构”；
- 保留原始用户消息；
- 不要求选择Provider、执行任务或构造授权。

## 最小生产修正

首次专项暴露正式`validateTaskInterpretation()`仅剥离授权字段，但会保留任意额外顶层字段，例如`providerId`。分类为：

```text
PRODUCT_OR_SECURITY_FAILURE
```

最小修正：验证返回值只投影正式Schema的11个required字段；授权字段仍递归剥离。未改变TaskInterpreter重试次数、Prompt、Task类型或执行路径。

## 结果

```text
modelCalls=2
thirdCall=false
schemaValidation=PASS
Provider=0
Task=0
Run=0
Scheduler=0
trustedAuthorization=0
realExecution=0
```

`providerId/approved/authorized/trusted/authorizationContext`均未进入最终解释协议。

历史断言：

```text
verification/task-lifecycle-contract-migration/historical-assertions/CQ-002.md
```

因为触及生产`agents/task-interpreter.mjs`，影响面回归扩展为完整11项。本轮不修改旧Task Lifecycle脚本，不开始CQ-003。
