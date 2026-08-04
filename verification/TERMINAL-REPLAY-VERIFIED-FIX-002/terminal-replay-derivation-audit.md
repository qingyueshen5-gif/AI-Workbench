# Terminal Task Replay可信派生审计（FIX-002）

```text
baseline=26869632656d20d78a33cf23c86304c750ac31fb
conclusion=TERMINAL_RESULT_MINIMUM_FIX_AUTHORIZED
```

## terminalResult

定义：`agents/agent-runtime.mjs:156-170`。

全部调用点：

- `agents/agent-runtime.mjs:175`：`finalize()`发现Task已终态；
- `agents/agent-runtime.mjs:268`：`handle()`发现同一正式Task已终态。

当前错误派生：

```js
verified: task.finalResult?.verified !== false
```

没有Final的failed/cancelled会默认true。

## 可读事实及终态Run定位

`terminalResult()`可直接读取：

```text
task.currentState
task.taskId
task.taskRevision
task.runs[]
task.finalResult
task.failure
```

正式定位：

- failed：`task.failure.runId`定位`task.runs[]`中的失败Run；
- completed：`task.finalResult.runId`定位completed Run；
- cancelled、capability_unavailable：直接fail-closed，不需要成功Run。

## completed Verifier事实

Grounded正式执行路径构造`verificationRecord`，通过展开`executeWithRun()`的identity保存：

```text
taskId
runId
taskRevision
passed
```

`TaskStore.bindRunVerification()`将其持久化到匹配Run的`run.verification`。

`finalResult`持久化：

```text
runId
taskRevision
verified
verification
```

`run.finalEvidence`持久化：

```text
taskId
runId
taskRevision
passed
```

`finalResult`不单独保存taskId，因此Task身份的权威来源是外围`task.taskId`，并要求`run.finalEvidence.taskId`一致。

## 权威验收revision

实际字段名：

```text
run.taskRevision
```

正式语义：

```text
Run activation / verification acceptance revision
```

`TaskStore.startRun()`创建Run时将Task revision增加一次，并同时写入`run.taskRevision`。后续：

- `bindRunVerification()`要求并保留同一个`identity.taskRevision`；
- `finalizeRun()`再次要求同一个active identity；
- `run.finalEvidence`持久化同一revision；
- `finalizeRun()`本身不增加Task revision。

因此可信比较为：

```text
verification.taskRevision === run.taskRevision
finalResult.taskRevision === run.taskRevision
run.finalEvidence.taskRevision === run.taskRevision
```

纯派生函数不把“当前最新task.taskRevision”作为验收权威，避免未来其他Task持久化动作错误地使历史真实Verifier结论失效。

## task/message replay分类

当前业务Task重放：

```text
replayed=true
taskReplayed=缺失
messageReplayed=缺失
```

当前非执行消息重放：

```text
taskReplayed=false
messageReplayed=true
```

目标业务Task：

```text
replayed=true
taskReplayed=true
messageReplayed=false
```

## 全部终态

```text
completed
capability_unavailable
failed
cancelled
```

failed、cancelled、capability_unavailable必须始终`verified=false`。

## capability_unavailable写入侧与重放侧差异

写入侧当前仍持久化：

```text
finalResult.verified=true
```

它属于已延期风险`NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER`，本轮不修改。

重放侧必须忽略该不可信布尔值，并依据终态直接派生：

```text
terminalState=capability_unavailable
verified=false
```

两者差异由本文件和机器JSON显式记录。

## 已知风险例外及新风险扫描

以下三项保持OPEN，统一交由`VERIFIED-SEMANTICS-UNIFICATION-001`：

- `NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER`；
- `LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING`；
- `NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND`。

本轮核查没有发现第四类风险，也没有发现三项风险扩展到新的生产路径。terminalResult最小修复可以继续，但不得修改上述路径。
