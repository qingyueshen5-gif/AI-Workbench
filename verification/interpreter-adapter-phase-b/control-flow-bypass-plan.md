# INTERPRETER-ADAPTER-PHASE-B-CONTROL-FLOW-BYPASS-001 · 最小改动方案

- 批准基线：`3d6daf8f64f820592c961dfc0a4678eaaafb8cb0`
- 分支：`candidate/interpreter-adapter-v1-work`
- 目标：在候选Runtime中增加位于业务Task/Run/Scheduler之前的确定性非执行决策旁路；不改变Gateway业务逻辑、生产IPC类型、Scheduler、Registry、Provider、Authorization、Verifier或RUN-FENCING。

## 1. 当前控制流事实

1. **原始消息进入Runtime入口**：`scripts/workbench-agent-runtime.mjs::executeClaimedJob()`调用`runtime.handle(job)`；候选Runtime入口为`agents/agent-runtime.mjs::AgentRuntime.handle(job)`。
2. **当前Interpreter调用位置**：`AgentRuntime.handle()`在创建Task并进入`interpreting`后调用`this.taskInterpreter.interpret(...)`。
3. **当前Task创建位置**：`AgentRuntime.handle()`中的`this.tasks.create({ ...job, taskId })`，当前发生于Interpreter之前。
4. **当前Run创建位置**：执行Provider前通过`executeWithRun()`调用`TaskStore.startRun()`；非执行旁路必须在到达该调用前返回。
5. **当前Scheduler调用位置**：`AgentRuntime.handle()`中的`this.scheduler.plan(...)`，位于旧clarification分支之后。
6. **当前models.express调用位置**：文件证据追问、code结果表达和chat/空能力回复分支；新`respond`不得进入这些分支。
7. **当前Final生成位置**：执行Task由`AgentRuntime.finalize()`绑定Task Final；`executeClaimedJob()`将`runtime.handle()`返回值机械封装后交给`completeJob()`形成IPC Result，Gateway只机械交付。

## 2. 新旁路插入点

插入点固定为：

```text
ActiveTaskController控制消息处理之后
→ extractGroundTruth(originalText)
→ interpreterAdapter.adapt({ originalText, groundTruth, semanticCandidate:null })
→ decision分流
   ├─ respond/clarify/unsupported：直接返回非执行Final
   └─ execute：继续现有Session/Task/Interpreter/Scheduler/Provider链
```

该位置在`this.tasks.create()`、`TaskStore.startRun()`和`this.scheduler.plan()`之前。Adapter本身不调用模型；首版仅从Ground Truth和原始文本做封闭映射。`semanticCandidate`为可选、不可信输入，候选Runtime本轮不为获得它而调用真实模型。

## 3. 显式映射表

| 原始事实/意图 | decision | taskType | requiredCapabilities | 是否创建Task/Run | 是否Scheduler |
| --- | --- | --- | --- | --- | --- |
| Runtime状态请求 | execute | system_diagnosis | `["runtime.status"]` | 是/仅Provider执行时创建Run | 是 |
| 唯一明确路径的只读文件请求 | execute | file_operation | `["file.read"]` | 是/仅Provider执行时创建Run | 是 |
| 文件读取但无路径或多个路径未指定 | clarify | 无 | 无 | 否/否 | 否 |
| 两个及以上独立可执行意图 | clarify | 无 | 无 | 否/否 | 否 |
| 问候和普通无执行交流 | respond | 无 | 无 | 否/否 | 否 |
| 未注册或本阶段非Allowlist能力 | unsupported | 无 | 无 | 否/否 | 否 |

自然语言Allowlist仅为`runtime.status`与`file.read`。`code.read/code.execute/code.modify/process.list/process.stop/conversation`即使已注册，也由Adapter收敛为`unsupported`。

## 4. 拟修改文件与函数

| 文件 | 函数/区域 | 修改前 | 修改后 |
| --- | --- | --- | --- |
| `agents/interpreter-adapter-contract.mjs` | 新文件 | 无四类decision契约 | 定义版本、decision、Allowlist、Task Schema形状校验和非执行Result构造器 |
| `agents/interpreter-adapter.mjs` | 新文件 | 无确定性Adapter | Ground Truth优先映射、Semantic Candidate危险字段剥离、riskSignals和确定性Renderer |
| `agents/agent-runtime.mjs` | constructor、`handle()` | Task在Interpreter前创建；除旧clarification外全部进入Scheduler | 注入/默认创建Adapter；在Task创建前执行decision；三类非execute直接返回，execute继续原链 |
| `scripts/workbench-agent-runtime.mjs` | `executeClaimedJob()` Result映射 | `activeTaskId`缺失时回填`job.messageId`，会把非执行消息伪装为Task | 仅在Runtime实际返回Task ID时写`activeTaskId`；非执行审计数据放入现有`classification`字段，不新增IPC类型 |
| `scripts/verify-interpreter-adapter-*.mjs` | 新测试 | 无旁路专项/变体/历史Fixture | 验证Task/Run/Scheduler/Provider/express零调用和execute回归 |
| `scripts/verify.mjs`及必要package脚本 | Mandatory接线 | 新门禁未接线 | 将Adapter专项纳入Mandatory Gates |
| `CURRENT_STATUS.md`、`NEXT_STEP.md`、`TASKLOG.md` | 文档收口 | A1旧结论仍可能被视为当前结论 | 保留历史证据并追加B1更正、候选状态和唯一下一步 |

原则上不修改Gateway、IPC目录/文件命名、Capability Registry、Scheduler、Provider、AuthorizationContext、Verifier或TaskStore状态/Run契约。

## 5. 非执行结果与幂等

- Runtime返回现有Final交付通道可承载的对象：`text/provider/toolUsed/verified/classification/metrics`。
- `classification`使用现有Result字段承载最小审计结构：`kind=non_execution`、`decision`、`originalMessageId`、`renderer`、`missingFields/questions/recognizedIntents`、`executionStarted=false`。
- 不生成`taskId`、`activeTaskId`或`runId`；`executeClaimedJob()`不再为缺失Task ID的结果伪造`job.messageId`。
- 消息幂等仍由既有Job/Claim/Result和`originalMessageId/messageId`控制；不新增第二套投递键，不修改Gateway去重逻辑。
- Session可记录用户和确定性assistant文本，但不得借此创建业务Task或Run。

## 6. execute路径保护

- 旁路只在Task创建前增加一个封闭decision闸门；`decision=execute`后仍使用原有Task创建、Interpreter、Scheduler、Authorization、Provider、Verifier、Progress、Final和RUN-FENCING代码。
- Adapter生成合法`taskDraft`作为候选Runtime的权威Interpretation，避免再次调用模型；接入时只替换execute的Interpretation来源，不修改Scheduler及以下执行链。
- `runtime.status`与`file.read`必须通过现有Registry→Scheduler→Provider→Verifier链；不得走旧regex/direct helper旁路。若现有代码仍有直接分支，B5只允许对这两类改为消费Scheduler assignment，不重构Scheduler内部。
- 既有旧`chat`和`clarification`代码保留兼容，但新Adapter旁路不会进入它们。

## 7. Gateway与IPC判定

- 现有`completeJob(job, result)`可机械持久化Runtime Result，Gateway按现有Result读取并回复`text`，不需要理解decision。
- 本方案不新增IPC文件类型、不改变Job/Claim/Result目录和租约、不要求Gateway识别`respond/clarify/unsupported`。
- 非执行审计字段复用既有`classification`字段；因此没有不可避免的生产IPC协议变化。
- 若实施测试证明Gateway/Result writer丢弃现有`classification`或无法承载无Task ID Final，则立即保存当前阶段并按`PRODUCT_OR_SECURITY_FAILURE`硬停止，不修改Gateway业务逻辑。

## 8. 安全边界

- Adapter不得调用模型、网络、Provider或工具，不选择Provider，不构造AuthorizationContext。
- Semantic Candidate中的`taskType/capability/requiredCapabilities/providerId/approved/authorized/authorizationContext/riskLevel/path`全部删除。
- riskSignals仅提示，不构成riskLevel或授权。
- 无可信`job.authorizationContexts[]`时，`code.execute/code.modify/process.stop`隔离Fixture必须在Provider启动前阻断；不修改正式Authorization规则。

## 9. 方案结论

该最小方案不要求修改生产IPC协议或execute内部Scheduler/Registry/Provider/Authorization/Verifier契约，可以进入B2实施。所有改动仅存在于候选Worktree；不部署、不切换生产Runtime、不启动真实模型Smoke。
