# CQ-001 复合通知行为断言修复报告

```text
task=CQ-001-COMPOUND-NOTICE-BEHAVIORAL-ASSERTION-FIX-001
behavioralAssertion=PASS
impactRegression=11/11 PASS
cq001Blocked=false
cq002=NOT_STARTED
```

## 修复范围

只修改：

```text
scripts/verify-interpreter-adapter-bypass-001.mjs
```

将复合意图用例从用户文案精确匹配：

```js
{textIncludes:/两个任务/}
```

迁移为结构化行为断言。

未修改：

- Adapter决策逻辑；
- 复合意图fail-closed规则；
- 用户可见文案；
- Scheduler、Provider、Verifier、Authorization、Risk；
- Gateway或IPC；
- taskType、Capability、Allowlist。

## 行为断言

- `decision=clarify`；
- Task、Run、Scheduler、Provider、Model均为0；
- `missingFields`包含`selectedIntent`；
- `questions`非空；
- `recognizedIntents=['读取文件','检查Runtime状态']`；
- 一次只执行一个任务；
- 尚未启动任何操作；
- 要求选择优先任务或拆分消息；
- `executionStarted=false`；
- 首次`messageReplayed=false`；
- 重放`messageReplayed=true`；
- `taskReplayed=false`；
- assistant没有重复追加；
- 不产生成功业务Final。

## 影响面回归

真实运行11项正式脚本，全部退出0，包括S4唯一执行路径专项。机器证据：

```text
verification/CQ-001-COMPOUND-NOTICE-BEHAVIORAL-ASSERTION-FIX-001/impact-regression.json
```

## 其它证据

```text
verification/task-lifecycle-contract-migration/historical-assertions/BYPASS-COMPOUND-NOTICE.md
verification/CQ-001-COMPOUND-NOTICE-BEHAVIORAL-ASSERTION-FIX-001/literal-text-assertion-inventory.json
```

同类盘点：

```text
total=353
userFacingCount=80
fileCount=68
```

当前CQ-001影响面阻断已解除。本轮按范围硬停止，不开始CQ-002。
