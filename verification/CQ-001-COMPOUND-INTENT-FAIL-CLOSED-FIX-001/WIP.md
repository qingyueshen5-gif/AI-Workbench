# CQ-001 影响面回归首失败

```text
task=CQ-001-COMPOUND-INTENT-FAIL-CLOSED-FIX-001
status=BLOCKED
classification=TEST_FIXTURE_CONTRACT_FAILURE
passed=9
failed=2
uniqueFailureRoots=1
```

## 已完成事实

CQ-001正式专项已经通过并保存：

```text
Checkpoint=TASK-LIFECYCLE-M1-CQ001-CLARIFY-CONTRACT-001
Commit=650c4ad88278d38f9455326d6ad44f57905946b0
```

## 影响面回归结果

PASS：

1. Interpreter Adapter抗变体专项；
2. 非执行消息幂等正式门禁；
3. S6终态业务Task专项；
4. B5 integration；
5. S1 Grounded证据专项；
6. S2 Verifier绑定专项；
7. S3 file.read边界专项；
8. S5多assignment fail-closed专项；
9. D0-1B Ground Truth专项。

FAIL：

1. 非执行旁路专项；
2. S4唯一执行路径专项。

二者是同一个根因：

```text
scripts/verify-interpreter-adapter-bypass-001.mjs:41
```

该Fixture将旧用户文案精确锁定为：

```js
{textIncludes:/两个任务/}
```

现行CQ-001批准契约输出为：

```text
我识别到多个任务：读取文件、检查Runtime状态。
当前版本一次只执行一个任务，尚未启动任何操作。
请指定先执行哪一个，或拆成两条消息发送。
```

现行输出保留并增强了全部安全语义，但不再包含精确短语“两个任务”。因此这是测试Fixture契约漂移，不是执行路径或安全不变量失败。S4只是调用非执行旁路专项，继承同一失败。

## 停止处置

任务明确要求B/C类失败保存成果并硬停止。本轮因此：

- 不修改失败Fixture；
- 不降低或删除断言；
- 不继续CQ-002；
- 不开始CQ-003、M2、M3、M4；
- 保存影响面回归证据和外部WIP Patch；
- 状态保持BLOCKED。
