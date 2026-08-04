# Task Lifecycle CONTRACT_QUESTION 完整证据

> 只读证据导出。未修改源码、测试、Fixture、断言或既有文档；未执行回归或契约裁定。

## 统计

```text
STILL_VALID=7
OUTDATED_SAMPLE=2
CONTRACT_QUESTION=7
```

全部问题编号：

```text
CQ-001
CQ-002
CQ-003
CQ-004
CQ-005
CQ-006
CQ-007
```

---

## CQ-001

### 1. questionId

`CQ-001`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:151-157`

### 3. 所在测试名称

`clarification-requires-context-evidence`

### 4. 样本输入

```text
处理一下
```

### 5. 原测试目的

验证低置信度且缺少目标信息的请求会创建业务Task，进入`waiting_for_clarification`，并持久化结构化`missingFields`证据，而不是直接失败或继续执行。

### 6. 原生命周期语义

- waiting
- clarification
- waiting_for_clarification
- needs_clarification
- structured context evidence

### 7. 原断言

```js
assert.equal(result.schedulerStatus, 'needs_clarification');
assert.deepEqual((await tasks.load('clarify')).waitingFor.missingFields, ['target']);
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；B2以前Runtime没有确定性InterpreterAdapter决策层，请求直接进入TaskInterpreter。
- 创建Task：是。
- taskType：`clarification`，由ContractTaskInterpreter Fixture返回。
- Scheduler：不进入CapabilityScheduler；Runtime识别`taskType=clarification`后提前返回。
- Run：不创建。
- Provider：不启动业务Provider；assistant结果由`task-interpreter`分支生成。
- Final：不生成终态Final；Task停留在`waiting_for_clarification`。
- terminalResult：不进入。
- replayed：未验证；`waiting_for_clarification`不是终态。

### 9. B2以后真实执行路径

- Adapter decision：`respond`。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动。
- Final：只产生并复用非执行确定性消息结果，不产生业务Task Final。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时使用`messageReplayed`，不使用Task replay。

### 10. 为什么不能自动判定

未知的是**契约应该拆分，还是原断言应该退出当前Runtime生命周期矩阵**。当前Adapter把缺信息请求定义为非执行clarify/respond，Task=0；原断言则要求存在`waiting_for_clarification`业务Task。仅换成`runtime.status`或`file.read`会丢失waiting/clarification语义；手工写Task状态或伪造Scheduler结果又违反真实生命周期要求。当前Allowlist也没有能自然创建clarification业务Task的输入，因此不能自动判为单纯替换样本。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-002

### 1. questionId

`CQ-002`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:159-169`

### 3. 所在测试名称

`invalid-interpreter-one-correction-success`

### 4. 样本输入

```text
hello
```

### 5. 原测试目的

验证TaskInterpreter第一次输出非法JSON时只进行一次受限纠正，第二次返回合法chat解释后继续完成业务Task。

### 6. 原生命周期语义

- interpreter correction
- completed
- model validation
- single correction attempt

### 7. 原断言

```js
assert.equal(result.provider, 'deepseek');
assert.equal(calls, 2);
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；无确定性Adapter，TaskInterpreter第一次解析失败后执行一次correction prompt。
- 创建Task：是。
- taskType：`chat`，来自第二次TaskInterpreter输出。
- Scheduler：进入CapabilityScheduler；空`requiredCapabilities`形成ready计划。
- Run：旧chat路径不创建正式grounded业务Run。
- Provider：TaskInterpreter理解模型调用2次，随后DeepSeek express生成最终回复。
- Final：`Runtime.finalize`形成completed Task与finalResult。
- terminalResult：首次不进入；后续重放终态Task时可以进入。
- replayed：首次不是重放；该用例未断言第二次处理。

### 9. B2以后真实执行路径

- Adapter decision：`respond`，recognized intent为greeting。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动；TaskInterpreter和DeepSeek均不调用。
- Final：确定性Renderer消息结果，不生成业务Final。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

未知的是该测试应继续作为Runtime生命周期契约、改为TaskInterpreter直接单元契约，还是拆成两个契约。改用`runtime.status/file.read`只会验证grounded Task完成，无法保留`calls=2`和受限纠正语义；保留`hello`则正式Runtime根本不调用TaskInterpreter。因而不能只替换样本，也不能在未裁定时修改断言或绕过Adapter。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-003

### 1. questionId

`CQ-003`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:171-179`

### 3. 所在测试名称

`invalid-interpreter-fails-not-clarification`

### 4. 样本输入

```text
hello
```

### 5. 原测试目的

验证TaskInterpreter初次输出和一次受限纠正均无效时，业务Task确定性进入`failed`，而不是被误当成clarification。

### 6. 原生命周期语义

- failed
- interpreter failure
- not clarification
- failure fact preservation

### 7. 原断言

```js
await assert.rejects(
  () => runtime.handle({ messageId: 'bad', originalMessageId: 'bad', conversationId: 'bad-c', chatId: 'bad-c', text: 'hello' }),
  /Task Interpreter/
);
assert.equal((await tasks.load('bad')).currentState, 'failed');
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；请求直接进入TaskInterpreter。
- 创建Task：是。
- taskType：无法形成合法taskType；两次解释输出均非法。
- Scheduler：不进入。
- Run：不创建。
- Provider：TaskInterpreter理解模型调用两次；无业务Provider执行。
- Final：不生成成功Final；catch路径调用`failTask`并持久化失败事实。
- terminalResult：首次不进入；failed Task后续重放可由terminalResult返回。
- replayed：首次异常；该用例未断言第二次处理。

### 9. B2以后真实执行路径

- Adapter decision：`respond`，recognized intent为greeting。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动。
- Final：确定性非执行结果，不生成failed Task或业务Final。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

未知的是failed生命周期覆盖应继续绑定TaskInterpreter失败，还是改成独立的确定性Provider/Verifier失败业务Task，并把Interpreter纠错另拆门禁。后者能保留failed和终态重放，却不能保留原断言中的`Task Interpreter`错误与纠正机制；前者又无法经过当前正式Runtime Adapter路径。因此同时涉及样本、断言和契约拆分的归属，不能自动处理。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-004

### 1. questionId

`CQ-004`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:181-186`

### 3. 所在测试名称

`confirmation-transition`

### 4. 样本输入

```text
pay
```

### 5. 原测试目的

验证需要确认的高风险能力在执行前由Scheduler阻断，Task进入`waiting_for_confirmation`，且Provider尚未启动。

### 6. 原生命周期语义

- waiting
- needs_confirmation
- waiting_for_confirmation
- no provider before confirmation

### 7. 原断言

```js
assert.equal(result.schedulerStatus, 'needs_confirmation');
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；ContractTaskInterpreter返回commerce解释。
- 创建Task：是。
- taskType：`commerce`。
- Scheduler：进入CapabilityScheduler；`commerce.payment`缺少有效授权，返回`needs_confirmation`。
- Run：不创建。
- Provider：不启动。
- Final：不生成终态Final；Task进入`waiting_for_confirmation`。
- terminalResult：不进入。
- replayed：未验证；该状态不是终态。

### 9. B2以后真实执行路径

- Adapter decision：`respond`。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动。
- Final：确定性非执行消息结果。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

主要问题是**当前Allowlist无法表达原契约**。正式Allowlist仅有`runtime.status`和`file.read`，二者都不要求确认；`commerce.payment`又不允许进入当前Adapter执行路径。只换样本无法真实触发`needs_confirmation`，伪造Scheduler或AuthorizationContext则违反限制。因此必须裁定该确认契约应迁移到Scheduler直接门禁、保留为历史能力矩阵，还是等待未来获批能力重新承载。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-005

### 1. questionId

`CQ-005`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:188-194`

### 3. 所在测试名称

`capability-unavailable-terminal`

### 4. 样本输入

```text
video
```

### 5. 原测试目的

验证Task已经创建、但所需能力没有可用Provider时，Scheduler返回`capability_unavailable`并保存对应终态事实。

### 6. 原生命周期语义

- capability_unavailable
- terminal
- no provider execution
- failure-like final fact

### 7. 原断言

```js
assert.equal(result.schedulerStatus, 'capability_unavailable');
assert.equal((await tasks.load('unavailable')).currentState, 'capability_unavailable');
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；ContractTaskInterpreter返回media_creation解释。
- 创建Task：是。
- taskType：`media_creation`。
- Scheduler：进入CapabilityScheduler；`media.video.create`没有可用Provider，返回`capability_unavailable`。
- Run：不创建。
- Provider：不启动。
- Final：写入`capability-scheduler` finalResult；Task进入`capability_unavailable`终态。
- terminalResult：首次不进入；后续相同Task可以重放。
- replayed：首次未设置；该用例未执行第二次处理。

### 9. B2以后真实执行路径

- Adapter decision：`video`为`respond`；明确写成“创建视频”则为`unsupported`。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动。
- Final：非执行消息结果，不产生`capability_unavailable`业务Task Final。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

未知的是`capability_unavailable`应继续作为业务Task终态契约，还是已经被Adapter层`unsupported`非执行契约取代，或需要拆分为两个层次。当前Allowlist中的`runtime.status/file.read`都有可用Provider，不能构造相同终态；选择未开放能力又会被Adapter提前`unsupported`。换样本无法保留原断言，而修改断言属于产品契约裁定。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-006

### 1. questionId

`CQ-006`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:196-202`

### 3. 所在测试名称

`code-execution-terminal`

### 4. 样本输入

```text
修改代码并运行测试
```

### 5. 原测试目的

验证受信授权后的代码业务Task进入代码执行路径，调用Codex一次，并形成已验证的终态结果。

### 6. 原生命周期语义

- completed
- code execution
- authorized provider
- provider invocation
- terminal final

### 7. 原断言

```js
assert.equal(result.toolUsed, 'codex');
assert.equal(result.metrics.codexCalls, 1);
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；ContractTaskInterpreter返回`code_task`解释。
- 创建Task：是。
- taskType：`code_task`。
- Scheduler：进入CapabilityScheduler并选择`code.read/code.modify/code.execute` assignments，使用`trustedAuthorizations`。
- Run：旧代码路径不使用当前grounded `executeWithRun`业务Run结构。
- Provider：调用`models.execute`的Codex Fixture一次，随后`models.express`生成最终回复。
- Final：`Runtime.finalize`写入completed Task和finalResult。
- terminalResult：首次不进入；后续同终态Task可以进入。
- replayed：首次不是重放；该用例未执行第二次处理。

### 9. B2以后真实执行路径

- Adapter decision：`unsupported`，recognized intent为`code.modify`。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动，不调用Codex。
- Final：非执行unsupported确定性结果。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

未知的是该旧代码执行矩阵是否应继续属于当前阶段Task Lifecycle、迁移到代码能力直接门禁，还是由`unsupported`契约替代。当前Allowlist明确不含code能力，且本轮禁止真实模型；换成`runtime.status/file.read`会把代码执行语义改成grounded读取语义，保留原断言又必然失败。需要产品负责人决定契约归属和阶段边界。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```

---

## CQ-007

### 1. questionId

`CQ-007`

### 2. 所在文件

`scripts/verify-task-lifecycle-001.mjs:204-211`

### 3. 所在测试名称

`process-provider-terminal`

### 4. 样本输入

```text
停止受控进程
```

### 5. 原测试目的

验证受信授权后的`process.stop`业务Task进入正式Provider，停止精确目标并验证目标已经消失。

### 6. 原生命周期语义

- completed
- process.stop
- authorized provider
- verified side effect
- terminal final

### 7. 原断言

```js
assert.equal(result.toolUsed, 'process.stop');
assert.equal(result.metrics.processStopCalls, 1);
```

### 8. B2以前真实执行路径

- Adapter decision：不适用；ContractTaskInterpreter返回`computer_operation`解释。
- 创建Task：是。
- taskType：`computer_operation`。
- Scheduler：进入CapabilityScheduler并选择`process.list/process.stop`；受信授权用于`process.stop`。
- Run：旧process路径不使用当前grounded `executeWithRun`业务Run结构。
- Provider：调用隔离`local-process-provider`的list/stop Fixture。
- Final：验证`pidAbsent`后，`Runtime.finalize`写入completed Task和finalResult。
- terminalResult：首次不进入；后续同终态Task可以进入。
- replayed：首次不是重放；该用例未执行第二次处理。

### 9. B2以后真实执行路径

- Adapter decision：`unsupported`，recognized intent为`process.stop`。
- 创建Task：否。
- taskType：无。
- Scheduler：不进入。
- Run：不创建。
- Provider：不启动，不触发进程副作用。
- Final：非执行unsupported确定性结果。
- terminalResult：不进入。
- replayed：`taskReplayed=false`；重复时`messageReplayed=true`。

### 10. 为什么不能自动判定

未知的是`process.stop`生命周期测试应保留在当前阶段矩阵、迁移到能力专项，还是由Adapter的`unsupported`契约取代。`process.stop`超出当前Allowlist，任何能进入当前execute路径的替代样本都会改变原授权和副作用验证语义；恢复旧行为又会扩大Allowlist和生产范围。因此不能自动替换样本或修改断言。

### 11. 恢复助手建议

```text
D. 需要产品负责人裁定
```
