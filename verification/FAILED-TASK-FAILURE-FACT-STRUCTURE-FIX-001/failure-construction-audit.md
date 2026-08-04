# Failed Task failure事实构造审计

```text
baseline=52d18fab5e12b6b09a5d8752a71127a7f12150f2
conclusion=RUNTIME_ONLY_MINIMUM_FIX_SUFFICIENT
productionCodeModified=false
```

## 1. failTask定义

```text
agents/agent-runtime.mjs:173-179
```

当前逻辑先通过`TaskStore.patch()`写入仅含`message/name`的failure，再调用`transition(..., 'failed')`。

## 2. 全部调用点

全仓库正式调用点只有一个：

```text
agents/agent-runtime.mjs:419-421
AgentRuntime.handle()通用catch
```

## 3—6. 调用点状态、Run与可信上下文

| callSite | currentTaskState | runAvailable | trustedRunIdSource | failureStage | defaultErrorCode | failureClassification |
|---|---|---|---|---|---|---|
| `handle()`通用catch | Task创建前为null；创建后可处于accepted至verifying任一非终态 | 条件存在 | 执行失败时`executeWithRun()`局部`identity.runId`；无Run失败为null | 默认`runtime_internal`；`executeWithRun`应显式标记`provider_execution`或`verification` | `RUNTIME_INTERNAL_FAILED`；执行路径为`PROVIDER_EXECUTION_FAILED`或`VERIFICATION_FAILED` | `runtime_failure`；执行路径为`provider_failure`或`verification_failure` |

当前通用catch没有接收显式failure context，不能在`activeRunId`清空后可靠反查失败Run。

## 7. Run可用事实

正式Run包含：

```text
runId
taskId
taskRevision
status
failureReason
verification.verifierId
verification.verificationMethod
verification.failureReason
verification.verifiedAt
finishedAt
```

Task.failure只应归一化映射必要身份与分类，不应复制整个verification对象。

## 8. activeRunId清空时机

```text
channels/task-store.mjs:59
TaskStore.failRunVerification()
```

该方法先用可信`identity`定位active Run，然后将Run写为`failed`并设置：

```text
activeRunId=null
```

因此必须在`executeWithRun()`仍持有局部identity时，把可信runId写入Runtime拥有的failure context，再向外抛出。不得在通用catch中依赖`activeRunId`反查。

## 9. taskRevision规则

- `TaskStore.patch()`：`activeRunId`为空时revision加1，否则保持；
- `transitionTask()`：`activeRunId`为空时revision加1，否则保持；
- `failRunVerification()`清空activeRunId但不增加Task revision。

批准语义采用：

```text
先转移Task到failed
→ 再持久化Task.failure
→ failure.taskRevision等于failure patch成功后Task的正式revision
```

不能使用失败Run自身revision代替Task失败事实revision。

## 10. failedAt可信时钟

由AgentRuntime可信时钟产生：

```text
options.now || Date.now
```

首次失败持久化时写一次；重放不会再进入failTask，因此保持不变。

## 11—12. TaskStore支持

`TaskStore.patch()`已经允许持久化任意扩展failure对象；`failure`不是受保护字段。因此：

```text
TaskStore无需修改
仅修改AgentRuntime即可
```

## 受控枚举

```text
failureStage:
provider_execution
verification
runtime_internal

errorCode:
PROVIDER_EXECUTION_FAILED
VERIFICATION_FAILED
RUNTIME_INTERNAL_FAILED

failureClassification:
provider_failure
verification_failure
runtime_failure
```

`causeCode`只接受有长度上限的标识符字符串，不参与阶段、分类、授权、风险或Provider选择。
