# CQ-003-A TaskInterpreter受限纠正失败专项

```text
status=PASS
sharedHistoricalSource=invalid-interpreter-fails-not-clarification
cq003BFeasibility=B. HISTORICAL_CONTRACT_DRIFT
```

## 交叉引用

CQ-003-A和CQ-003-B共同来源于：

```text
scripts/verify-task-lifecycle-001.mjs:171-178
invalid-interpreter-fails-not-clarification
```

拆分原因：TaskInterpreter自身的重试及错误契约，与历史Runtime failed Task持久化契约属于不同边界。CQ-003-B当前可行性证据：

```text
verification/task-lifecycle-contract-migration/CQ-003B-CONTROL-FLOW-FEASIBILITY.md
```

## Fixture与结果

- 使用进程内隔离Fixture模型；
- 第一次返回缺少`actions`等正式Schema字段的非法输出；
- 唯一一次纠正后返回`actions`类型错误的非法输出；
- 第三次调用被设计为立即抛错；
- 实际调用次数精确为2；
- 正式错误名为`TaskInterpretationError`；
- 内部稳定测试分类为`TASK_INTERPRETER_BOUNDED_CORRECTION_FAILED`；
- 错误匹配`/Task Interpreter/`；
- 没有被转换为clarification。

## 安全计数

```text
Scheduler=0
Provider=0
Task=0
Run=0
成功Final=0
可信授权=0
真实模型=0
```

两次非法输出均携带`providerId`、`approved`、`authorizationContext`等额外字段；这些字段没有进入专项观察到的内部错误协议。

## 隔离

- Fixture身份使用`randomUUID()`；
- 临时目录位于`os.tmpdir()`；
- `finally`递归清理；
- 不使用固定消息ID或历史持久化状态；
- 不调用Runtime、TaskStore、Scheduler或Provider。
