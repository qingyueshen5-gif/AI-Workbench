# CQ-003-B 控制流可行性核查

```text
baseline=30afd0ae493929d8de3dd8ec8111c9e0cc60109f
conclusion=B. HISTORICAL_CONTRACT_DRIFT
productionCodeModified=false
```

## 1. TaskInterpreter发生在Task创建之前还是之后

当前`AgentRuntime.handle()`正式路径中，**TaskInterpreter没有被调用**。

真实顺序为：

```text
normalizeClassification
→ extractGroundTruth
→ InterpreterAdapter.adapt
→ non-execute直接返回，或execute继续
→ TaskStore.create
→ interpreting
→ interpretation = adapterResult.taskDraft
```

证据：

```text
agents/agent-runtime.mjs:266-269
agents/agent-runtime.mjs:293-298
```

Runtime构造函数仍创建`this.taskInterpreter`，但当前`handle()`没有可达的`taskInterpreter.interpret()`调用。

## 2. 当前解释阶段失败时是否已有正式业务Task

对**TaskInterpreter失败**而言：没有。

- 非执行请求在Task创建前通过Adapter和消息级幂等返回，Task=0；
- execute请求在Adapter成功生成`taskDraft`后才创建Task；
- Task创建后的`interpreting`阶段只保存已经存在的`adapterResult.taskDraft`，不调用TaskInterpreter。

因此当前不存在“TaskInterpreter失败时已经有正式业务Task”的正式路径。

## 3. 是否存在合法可达路径

目标路径：

```text
Task已创建
→ interpreting
→ TaskInterpreter失败
→ failTask()
→ currentState=failed
```

结论：**不存在。**

通用catch确实会在`task != null`时调用`failTask()`：

```text
agents/agent-runtime.mjs:419-421
```

但Task创建后的解释逻辑是：

```js
const interpretation = adapterResult.taskDraft;
```

该区间没有TaskInterpreter调用，所以通用catch无法将“TaskInterpreter失败”持久化为failed Task。

## 4. 属于当前B2正式架构还是历史实现

该契约属于B2前历史Runtime/测试Fixture。

历史用例：

```text
scripts/verify-task-lifecycle-001.mjs:171-178
```

历史Fixture将`TaskInterpreter`注入`AgentRuntime`，然后期望：

```text
/Task Interpreter/错误
Task.currentState=failed
```

当前Runtime已经改为确定性Adapter先行，不再通过该TaskInterpreter路径解释入口消息。

## 5. 能否在不恢复旧行为的前提下真实验证

不能。

若要构造CQ-003-B，只能采用至少一种被禁止或错误的方式：

1. 恢复旧`hello`/chat Task及TaskInterpreter调用；
2. 在Adapter决策前提前创建空Task；
3. Fixture手工把Task状态改为failed；
4. 用Provider或Verifier失败替代Interpreter失败。

这些方式均不代表当前正式架构的真实TaskInterpreter失败路径。

# 正式结论

```text
B. HISTORICAL_CONTRACT_DRIFT
```

处置：

- CQ-003-A可独立施工；
- CQ-003-B不得开始生产或Fixture实现；
- 不恢复旧行为；
- 不创建占位Task；
- 不手工写failed状态；
- CQ-003-B归属等待产品负责人重新裁定。
