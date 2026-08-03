# S6 Task Replay 根因归因

## 结论

```text
classification=A
classificationName=REGRESSION_INTRODUCED_BY_B5
confidence=HIGH
testContractChangeRequired=false
```

## 正式契约

- `scripts/verify-task-lifecycle-001.mjs:59-69`要求同一终态Task第二次处理返回`replayed=true`，且assistant回复仍只有一条。
- `scripts/verify-task-lifecycle-001.mjs:197-208`要求进程重启后，同一终态Task仍返回`replayed=true`。
- `agents/agent-runtime.mjs:139-153`的`terminalResult()`是`replayed=true`的正式生产者。
- `AgentRuntime.handle()`在入口使用`job.taskId || job.messageId`读取Task，命中终态后提前返回`terminalResult()`。

## 精确路径

### B5前

`hello`进入chat业务Task路径：

```text
Task lookup miss
→ create Task dup-task
→ interpret chat
→生成finalResult
→Task completed
→第二次lookup命中completed Task
→terminalResult
→replayed=true
```

在归因阶段，将`96718be^`源码解包到临时目录并直接运行：

```text
node scripts/verify-task-lifecycle-001.mjs
exitCode=0
cases=16
```

### B2/B5后

B2在Task创建前加入Adapter非执行旁路。Fixture输入`hello`现在被判定为`respond`：

```text
Task lookup miss
→Adapter respond
→deterministic non-execution result
→不创建Task
→第二次Task lookup仍miss
→再次Adapter respond
→返回对象没有replayed
```

当前正式专项真实退出：

```text
node scripts/verify-task-lifecycle-001.mjs
exitCode=1
expected=true
actual=undefined
line=65
```

## 身份判断

本失败中：

```text
messageId=taskId=originalMessageId=dup-task
```

因此不是ID不一致造成。根因是Job重放从“终态业务Task重放”变成了“无Task的非执行结果重复处理”。它也不是Final交付重放或completed Run问题；失败路径没有创建Run。

## 推荐最小边界

只在`AgentRuntime.handle()`非执行旁路处理消息级幂等：

- 首次仍保持Task=0、Run=0、Scheduler=0、Provider=0、Model=0；
- 持久化或复用现有Session中的确定性非执行结果；
- 第二次同messageId返回已有结果并增加`replayed=true`；
- 不重复追加user/assistant Session消息；
- 不制造业务Task，不修改Task Lifecycle断言。

详细机器证据见`s6-task-replay-root-cause.json`。
