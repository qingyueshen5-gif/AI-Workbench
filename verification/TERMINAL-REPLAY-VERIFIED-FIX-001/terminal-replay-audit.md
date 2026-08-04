# Terminal Task Replay verified与分类审计

```text
baseline=db746967ac8c55e88a7f656c04ad478db58c7fea
result=NEW_PRODUCT_OR_SECURITY_FAILURES_FOUND_DURING_REQUIRED_SCAN
productionCodeModified=false
```

## terminalResult

定义：

```text
agents/agent-runtime.mjs:156-170
```

全部调用点：

```text
agents/agent-runtime.mjs:175
AgentRuntime.finalize()发现Task已终态

agents/agent-runtime.mjs:268
AgentRuntime.handle()发现同一Task已终态
```

当前默认true代码：

```js
verified: task.finalResult?.verified !== false
```

因此没有Final的failed/cancelled Task会返回`verified=true`；`capability_unavailable`当前还持久化`finalResult.verified=true`。

## terminalResult可用事实

```text
task.currentState
task.taskId
task.taskRevision
task.activeRunId
task.runs[]
task.finalResult
task.failure
```

失败Run应由`task.failure.runId`定位；completed Run应由`finalResult.runId`定位。只有定位到Run后，才能检查Run verification、finalEvidence和Task/Run/revision绑定。

## completed验证事实与Final绑定

Grounded正式链将Verifier结论写到：

```text
run.verification
finalResult.verification
run.finalEvidence
```

`verificationRecord`含：

```text
passed
taskId
runId
taskRevision
```

Grounded `finalResult`含：

```text
runId
taskRevision
```

Task身份由外围Task权威提供；Run finalEvidence通过verificationRecord保留完整identity。严格派生应同时要求Run verification和Final/finalEvidence绑定一致。

## 重放分类

当前业务Task：

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

目标业务Task结构：

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

施工前输出：

| 终态 | verified现状 |
|---|---|
| completed | Final未显式false即true |
| capability_unavailable | 持久化Final verified=true，重放true |
| failed | 无Final时默认true |
| cancelled | 无Final时默认true |

## verified赋值扫描

机器证据：

```text
verification/TERMINAL-REPLAY-VERIFIED-FIX-001/verified-assignment-inventory.json
```

词法扫描统计：

```text
总条目=66
生产代码=33
测试/Fixture=33
默认true=33
缺少Verifier来源=55
缺少Task/Run/revision完整绑定=66
```

该统计是全仓词法清单，不等于66项均为相同产品语义；已对生产边界进行人工分类。

## 扫描发现的其它生产风险

### 1. NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER

```text
agents/agent-runtime.mjs:278 control interception
agents/agent-runtime.mjs:330 clarification
agents/agent-runtime.mjs:342 confirmation
agents/agent-runtime.mjs:348,350 capability_unavailable
```

这些路径在没有taskId/runId/taskRevision绑定Verifier PASS时输出或持久化`verified=true`。尤其`capability_unavailable`按本任务正式契约必须为false。

本轮只允许修改terminalResult，不得修改这些成功或非执行路径。

### 2. LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING

```text
agents/agent-runtime.mjs:408,410 process.stop
agents/agent-runtime.mjs:430 code execution
agents/agent-runtime.mjs:439 conversation answer
```

这些路径经过不同检查后直接设置`verified=true`，但没有统一持久化Task/Run/revision绑定Verifier PASS。由于本轮禁止修改成功执行路径，登记为独立风险。

### 3. NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND

```text
agents/interpreter-adapter-contract.mjs:68
```

非执行renderer用共享字段`verified=true`表达renderer结果，但没有Task/Run/revision身份。它可能意指渲染有效而非业务验证，但共享字段在机器协议上不可区分。本轮禁止修改非执行行为。

## 结论

按任务第5节：扫描发现其它生产路径存在默认`verified=true`、没有真实Verifier来源或缺少Task/Run/revision绑定，必须登记新的`PRODUCT_OR_SECURITY_FAILURE`，不得静默忽略或扩大修改范围。

因此本步保存审计Checkpoint后硬停止，不进入terminalResult生产修复。
