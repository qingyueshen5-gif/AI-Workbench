# Task Lifecycle 契约迁移施工图

## 1. 本轮边界

本文件是产品裁定后的施工图和契约定稿，不是迁移实施记录。

```text
测试迁移=未开始
生产代码修改=无
新门禁实现=无
Allowlist扩大=无
完整回归=未运行
部署=NOT_DEPLOYED
```

当前Allowlist：

```text
runtime.status
file.read
```

M1、M2、M3、M4必须作为四个独立原子工作包执行，不得合并施工。

---

## 2. 七项产品裁定

### CQ-001 · 非执行clarify契约

#### 现行契约

- `clarify`属于非执行消息；
- 不创建Task；
- 不进入`waiting_for_clarification`；
- Task、Run、Scheduler、Provider、Model均为0；
- 必须保留结构化`missingFields`和`questions`证据；
- 重投由`messageReplayed`契约处理，不伪装成业务Task replay。

#### 历史契约处置

原`waiting_for_clarification` Task断言状态：

```text
SUPERSEDED_BY_NON_EXECUTION_CLARIFY_CONTRACT
```

历史源码和断言必须逐字存档，但不得继续作为现行正式门禁执行。本轮未进行存档迁移，只定义下一轮施工要求。

#### 迁移目标

```text
非执行clarify契约专项
```

#### 技术债

```text
MEDIUM · MULTI_TURN_CLARIFICATION_CONTEXT_NOT_SUPPORTED
```

当前仅定义单条非执行clarify及结构化证据，不支持跨消息、多轮澄清上下文恢复。

### CQ-002 · TaskInterpreter受限纠正成功

迁移目标：

```text
TaskInterpreter受限纠正成功专项
```

必须保留：

- 模型调用次数`=2`；
- 只能纠正一次；
- 第二次合法输出必须通过；
- 不得通过恢复`hello`创建chat业务Task来实现。

### CQ-003 · 拆分为两个独立契约

#### CQ-003-A

```text
TaskInterpreter受限纠正失败专项
```

必须保留：

- `/Task Interpreter/`错误；
- 一次受限纠正后仍失败；
- 不得伪装成clarification。

#### CQ-003-B

```text
Runtime failed Task事实持久化和终态重放专项
```

必须保留：

- failed事实真实持久化；
- 第二次处理`replayed=true`；
- 不新增Run、Provider、Final或回复；
- 不通过直接构造`terminalResult()`绕过正式TaskStore终态路径。

### CQ-004 · Authorization/Confirmation Boundary

迁移目标：

```text
Authorization/Confirmation Boundary专项
```

专项状态：

```text
ACTIVE_SECURITY_GATE
```

必须始终执行，不得封存。必须保留：

```text
needs_confirmation
Provider=0
Run=0
sideEffects=0
```

专项未运行或未通过时：

```text
Deployment BLOCKED
```

### CQ-005 · Adapter/Scheduler双层契约

#### Adapter层

未注册或未开放能力：

```text
decision=unsupported
Task=0
Scheduler=0
Run=0
Provider=0
```

#### Scheduler层安全兜底

使用独立的直接Scheduler输入，验证未注册能力：

```text
schedulerStatus=capability_unavailable
Provider=0
Run=0
终态事实可重放
```

Scheduler兜底专项状态：

```text
ACTIVE_SECURITY_GATE
```

该专项不因能力未对用户开放而封存；未运行或未通过均阻断Deployment。

### CQ-006 · code能力专项

迁移目标：

```text
code能力专项
```

当前状态：

```text
NOT_APPLICABLE_CAPABILITY_DISABLED
```

必须完整保存历史源码和断言：

```text
toolUsed=codex
codexCalls=1
trusted authorization
verified terminal result
```

激活规则：

```text
code.read/code.modify/code.execute任一对应契约进入Allowlist
→ 专项自动转为REQUIRED
→ 必须执行并PASS
→ 否则Deployment BLOCKED
```

### CQ-007 · process能力专项

迁移目标：

```text
process能力专项
```

当前状态：

```text
NOT_APPLICABLE_CAPABILITY_DISABLED
```

必须完整保存历史源码和断言：

```text
toolUsed=process.stop
processStopCalls=1
trusted authorization
verified side effect
```

激活规则：

```text
process.list/process.stop进入Allowlist
→ 专项自动转为REQUIRED
→ 必须执行并PASS
→ 否则Deployment BLOCKED
```

---

## 3. 能力专项状态机（定义，未实现）

### ACTIVE_SECURITY_GATE

含义：即使相关能力未面向用户开放，安全边界专项仍必须运行。

适用：

- CQ-004 Authorization/Confirmation Boundary；
- CQ-005 Scheduler `capability_unavailable`兜底。

机器判定：

```text
ACTIVE_SECURITY_GATE未运行
OR ACTIVE_SECURITY_GATE未通过
→ Deployment BLOCKED
```

### NOT_APPLICABLE_CAPABILITY_DISABLED

含义：能力尚未进入Allowlist，因此不执行业务副作用测试。

规则：

- 不计作PASS；
- 总报告必须单独显示能力名称；
- 总报告必须显示处于该状态的能力数量；
- 不得把该状态转换成“总门禁全部PASS”；
- 不得形成登记后即可跳过的通道。

### REQUIRED

含义：能力已进入Allowlist，对应专项恢复为强制执行。

机器判定：

```text
capability在Allowlist
AND 专项仍为NOT_APPLICABLE_CAPABILITY_DISABLED
→ FAIL
→ Deployment BLOCKED
```

```text
专项状态=REQUIRED
AND（未运行 OR 未PASS）
→ Deployment BLOCKED
```

正式禁止：

```text
DEFERRED_PENDING_ALLOWLIST
登记后跳过且总门禁仍视为全部PASS
```

---

## 4. 后续原子工作包

## M1 · Clarify与Interpreter契约迁移

范围：`CQ-001`、`CQ-002`、`CQ-003`。

### 拟修改文件

- `scripts/verify-task-lifecycle-001.mjs`
- `scripts/verify-task-interpreter.mjs`
- `scripts/verify-task-interpreter-fixture-contracts.mjs`
- `scripts/task-interpreter-contract-fixtures.mjs`

### 拟新增测试/存档文件

- `scripts/verify-non-execution-clarify-contract-001.mjs`
- `scripts/verify-task-interpreter-bounded-correction-001.mjs`
- `scripts/verify-runtime-failed-task-replay-001.mjs`
- `verification/task-lifecycle-contract-migration/archive/CQ-001-waiting-for-clarification-historical-fixture.mjs.txt`

### 保留原断言

- `missingFields/questions`结构化证据；
- 模型调用次数`=2`；
- 仅一次纠正；
- 第二次合法输出通过；
- `/Task Interpreter/`错误；
- Interpreter失败不得伪装成clarification；
- failed事实持久化并可重放。

### 被产品新契约正式取代的旧断言

```text
CQ-001在当前正式Runtime门禁内创建waiting_for_clarification Task
→ SUPERSEDED_BY_NON_EXECUTION_CLARIFY_CONTRACT
```

旧断言必须存档，不得删除历史证据。

### 安全边界

- clarify继续保持Task/Run/Scheduler/Provider/Model均为0；
- 不恢复chat业务Task旧路径；
- failed replay必须使用真实持久化failed Task；
- 不允许直接调用`terminalResult()`制造PASS。

### 专项验收指标

- clarify保留`missingFields/questions`；
- clarify消息幂等通过；
- Interpreter成功纠正调用2次且只能纠正一次；
- Interpreter失败保留错误与非clarification约束；
- failed第二次处理`replayed=true`，新增Run/Provider/Final/回复均为0。

### 预计Checkpoint

```text
TASK-LIFECYCLE-CONTRACT-MIGRATION-M1-CLARIFY-INTERPRETER-001
```

---

## M2 · 安全边界专项

范围：`CQ-004`、`CQ-005`。

### 拟修改文件

- `scripts/verify-task-lifecycle-001.mjs`
- `scripts/verify-authorization-boundary-001.mjs`
- `scripts/authorization-context-fixtures.mjs`

### 拟新增测试文件

- `scripts/verify-authorization-confirmation-boundary-001.mjs`
- `scripts/verify-scheduler-capability-unavailable-fallback-001.mjs`

### 保留原断言

- `needs_confirmation`；
- Provider=0；
- Run=0；
- sideEffects=0；
- `capability_unavailable`；
- 终态`capability_unavailable`事实可重放。

### 被产品新契约正式取代的旧断言

```text
pay/video用户消息仍可作为当前Runtime的Scheduler层输入
```

现行契约改为：Adapter层前置拒绝与Scheduler层直接安全兜底分别验证。

### 安全边界

- 两项均为`ACTIVE_SECURITY_GATE`；
- 直接Scheduler Fixture不得扩大Adapter Allowlist；
- 不得启动Provider或消费授权；
- ACTIVE_SECURITY_GATE不得封存或登记为不适用。

### 专项验收指标

- confirmation专项始终运行；
- 返回`needs_confirmation`；
- Provider/Run/sideEffects均为0；
- Scheduler直接未注册能力输入返回`capability_unavailable`；
- Provider和Run均为0；
- 终态事实可重放；
- 未运行或失败时Deployment BLOCKED。

### 预计Checkpoint

```text
TASK-LIFECYCLE-CONTRACT-MIGRATION-M2-SECURITY-BOUNDARIES-001
```

---

## M3 · 能力封存专项与机器阻断

范围：`CQ-006`、`CQ-007`。

### 拟修改文件

- `scripts/verify-task-lifecycle-001.mjs`
- `scripts/run-mandatory-gates.mjs`
- `CURRENT_STATUS.md`

### 拟新增测试/存档文件

- `scripts/verify-disabled-capability-gate-state-001.mjs`
- `scripts/verify-code-capability-contract-001.mjs`
- `scripts/verify-process-capability-contract-001.mjs`
- `verification/task-lifecycle-contract-migration/archive/CQ-006-code-execution-historical-fixture.mjs.txt`
- `verification/task-lifecycle-contract-migration/archive/CQ-007-process-stop-historical-fixture.mjs.txt`

### 保留原断言

- `toolUsed=codex`；
- `codexCalls=1`；
- code trusted authorization；
- code verified terminal result；
- `toolUsed=process.stop`；
- `processStopCalls=1`；
- process trusted authorization；
- process verified side effect。

### 被产品新契约正式取代的旧断言

```text
code/process能力禁用期间仍在当前Task Lifecycle总门禁中执行副作用测试
```

### 安全边界

- `NOT_APPLICABLE_CAPABILITY_DISABLED`不计PASS；
- 总报告明确列出禁用能力名称与数量；
- 能力进入Allowlist但专项仍为禁用状态时必须FAIL；
- REQUIRED专项失败阻断Deployment；
- 禁止登记后跳过且总报告仍全PASS。

### 专项验收指标

- code/process禁用状态单独显示；
- passCount不因禁用状态增加；
- Allowlist激活可自动转为REQUIRED；
- 活跃能力处于禁用状态时机器判定FAIL；
- 历史源码和断言逐字保存；
- REQUIRED未通过时Deployment BLOCKED。

### 预计Checkpoint

```text
TASK-LIFECYCLE-CONTRACT-MIGRATION-M3-CAPABILITY-GATE-STATES-001
```

---

## M4 · OUTDATED_SAMPLE修正、Task Lifecycle重跑、阶段回归和契约收口

范围：

- `cancel-control-transition`；
- `restart-recovery-replays-terminal-result`；
- Task Lifecycle正式重跑；
- 用户指定的全部阶段回归；
- Task replay与非执行消息幂等契约收口。

M1—M3全部独立完成并PASS后，M4才允许开始。

### 拟修改文件

- `scripts/verify-task-lifecycle-001.mjs`
- `verification/task-replay-and-message-idempotency/CONTRACT.md`
- `verification/TASK-REPLAY-AND-NON-EXECUTION-IDEMPOTENCY-CONTRACT-001/report.md`
- `CURRENT_STATUS.md`

### 拟新增测试文件

原则上不新增；如果生命周期Fixture必须抽取，只允许新增完全隔离的测试辅助文件。

### 保留原断言

- `second.replayed === true`；
- completed/failed/cancelled覆盖；
- Provider/Run/Final/Progress/assistant回复零重复；
- `activeRunId`终态约束；
- 原`finalResult`保持一致。

### 被产品新契约正式取代的旧断言

- `hello`作为业务Task replay样本；
- 仅通过直接`TaskStore.create`构造取消前置，而未先创建真实业务Task。

### 安全边界

- `runtime.status`使用隔离状态源；
- `file.read`使用`os.tmpdir()`及隔离`allowedRoots`；
- cancellation必须通过正式取消入口；
- 不操作生产Runtime或生产IPC；
- 不得在M1—M3未PASS时提前开始。

### 专项验收指标

- 两项OUTDATED_SAMPLE保留原生命周期语义；
- Task Lifecycle退出0；
- 指定阶段回归全部PASS；
- Task replay与message idempotency契约报告完成；
- Checkpoint后worktree和staging clean。

### 预计Checkpoint

```text
TASK-LIFECYCLE-CONTRACT-MIGRATION-M4-LIFECYCLE-REGRESSION-CLOSEOUT-001
```

---

## 5. 当前判定

```text
七项产品裁定=已固化为施工图
M1=未开始
M2=未开始
M3=未开始
M4=未开始
测试迁移=未开始
生产修改=无
当前状态=BLOCKED
完整回归=禁止进入
阶段B最终收口=禁止进入
Deployment=NOT_DEPLOYED
```
