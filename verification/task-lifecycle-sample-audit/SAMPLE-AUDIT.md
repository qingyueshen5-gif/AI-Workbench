# Task Lifecycle 全量样本审计

## 结论

```text
样本总数=16
STILL_VALID=7
OUTDATED_SAMPLE=2
CONTRACT_QUESTION=7
```

由于`CONTRACT_QUESTION > 0`，根据任务规则，本轮不得继续修改测试或生产代码。审计证据保存后硬停止。

机器清单：`sample-inventory.json`。

## 判定表

| sampleId | 输入/前置 | 原覆盖语义 | B2后真实入口 | 判定 |
|---|---|---|---|---|
| one-task-per-original-message | TaskStore t1/m1→t2/m2 | originalMessageId一对一 | Store约束，不经过Adapter | STILL_VALID |
| exactly-once-final-result | 当前Gateway、Runtime和任务状态是什么 | completed、终态重放、零重复 | execute→runtime.status | STILL_VALID |
| direct-read-terminal-binding | 只读查看临时文件 | completed、file.read证据 | execute→file.read | STILL_VALID |
| status-query-uses-health-plus-task-store | 当前Runtime状态 | completed、状态证据 | execute→runtime.status | STILL_VALID |
| progress-control | 进度怎么样了+活动Task | progress控制 | ActiveTaskController先于Adapter拦截 | STILL_VALID |
| cancel-control-transition | 取消当前任务+手工accepted Task | 正式取消→cancelled | 控制入口仍有效，但前置不满足“真实业务Task”新要求 | OUTDATED_SAMPLE |
| pause-control-transition | 暂停当前任务+活动Task | paused | ActiveTaskController拦截 | STILL_VALID |
| continue-control-transition | 继续当前任务+paused Task | 恢复interpreting | ActiveTaskController拦截 | STILL_VALID |
| clarification-requires-context-evidence | 处理一下 | waiting_for_clarification | respond，Task=0 | CONTRACT_QUESTION |
| invalid-interpreter-one-correction-success | hello | Interpreter纠错后completed | respond，TaskInterpreter不再进入 | CONTRACT_QUESTION |
| invalid-interpreter-fails-not-clarification | hello | Interpreter确定失败→failed | respond，TaskInterpreter不再进入 | CONTRACT_QUESTION |
| confirmation-transition | pay | needs_confirmation | respond，Task=0 | CONTRACT_QUESTION |
| capability-unavailable-terminal | video | capability_unavailable Task | respond；“创建视频”则unsupported且Task=0 | CONTRACT_QUESTION |
| code-execution-terminal | 修改代码并运行测试 | code Task/Codex/completed | unsupported，Task=0 | CONTRACT_QUESTION |
| process-provider-terminal | 停止受控进程 | process.stop Task/completed | unsupported，Task=0 | CONTRACT_QUESTION |
| restart-recovery-replays-terminal-result | hello+共享TaskStore | completed重启重放 | respond，Task=0 | OUTDATED_SAMPLE |

## 核心证据

### B2后仍有效的业务Task样本

`runtime.status`和隔离`file.read`均由当前Adapter判定为`execute`，可真实经过Task、Scheduler、Provider、Run、Verifier和Final。

### 明确过时且可安全替换

1. `cancel-control-transition`：控制文本仍正确，但其Task前置通过`TaskStore.create()`直接构造。新要求规定必须先创建真实业务Task，再走正式取消入口。
2. `restart-recovery-replays-terminal-result`：`hello`不再创建Task，可替换为共享TaskStore上的隔离`runtime.status`或`file.read`，完整保留重启终态重放语义。

### 必须由产品负责人裁定的样本

1. **waiting_for_clarification**：当前Adapter的`clarify`是非执行结果，Task=0；当前Allowlist内没有可安全创建clarification业务Task的输入。成功`runtime.status/file.read`不能替代该状态。
2. **TaskInterpreter纠错成功/失败**：确定性Adapter已经成为Runtime任务草案来源。将输入换为grounded Task不会保留“模型输出无效后纠错”这一原语义。需裁定移至TaskInterpreter直接契约，还是删除Runtime层旧语义。
3. **needs_confirmation**：当前Allowlist仅`runtime.status/file.read`，均不需要确认。不得伪造Scheduler输出或扩Allowlist。
4. **capability_unavailable**：当前未开放目标在Adapter层直接`unsupported`且Task=0；没有获批业务能力可稳定进入Task后的`capability_unavailable`。
5. **code.execute/process.stop**：均被当前Adapter判为`unsupported`，且超出本阶段Allowlist；真实模型调用也被禁止。样本级修改无法保留旧执行语义。

## 建议替换策略

- cancel：先通过隔离runtime.status/file.read创建真实Task，再在可控生命周期点使用正式取消入口。
- restart replay：使用隔离runtime.status完成Task，以共享TaskStore重建Runtime并验证`replayed=true`。
- clarification/confirmation/unavailable/interpreter-correction/code/process：等待产品负责人明确这些语义应迁移到哪个直接契约门禁，或批准一个不扩大生产Allowlist的专用测试入口；当前不得修改。

## 覆盖保护

审计未修改：

- `second.replayed === true`；
- Provider/Run/Final/Progress/assistant零重复断言；
- completed/failed/cancelled/waiting/confirmation用例；
- 生产代码；
- Gateway、IPC、Authorization、Risk或Verifier。
