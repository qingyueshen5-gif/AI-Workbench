# AI Workbench Architecture v1 Freeze

- **冻结名称：** `stable-single-agent-v1`
- **基线提交：** `ea5bec82a8a36ee8101c3317c0fe9e43550a01a8`
- **冻结日期：** 2026-08-02
- **状态：** 架构边界已定义；正式部署需通过 `docs/DEPLOYMENT_CHECKLIST_V1.md` 的全部门禁。

## 1. 唯一业务执行链

```text
Task Interpreter
  ↓ Task Interpretation Schema
Scheduler
  ↓ Execution Plan
Capability Registry
  ↓ Provider Assignment
Provider
  ↓ Execution Evidence
Verifier
  ↓ Verified Result
Result
```

Gateway与IPC位于业务链之外，只承担传输、持久化、幂等、领取、进度和结果交付，不理解任务语义，不选择Provider，不生成业务结果。

## 2. 各层唯一职责

### Task Interpreter
只将用户原话、受控上下文和环境事实转换为统一任务结构：`taskType`、`goal`、`actions`、`targets`、`context`、`constraints`、`riskLevel`、`requiredCapabilities`、`successCriteria`、`requiresConfirmation`、`confidence`。不得选Provider、执行操作或声称完成。

### Scheduler
只根据解释结果和Registry状态返回`ready`、`needs_confirmation`或`capability_unavailable`，并形成主Provider/Fallback计划。不得执行Provider或伪造结果。

### Capability Registry
是Capability、Provider、Fallback、风险、可用性和验证方法的唯一登记权威。未登记能力不得执行；登记不等于真实可用。

### Provider
只执行被Scheduler授权的单项Capability，返回结构化结果和证据。不得重解释用户意图、绕过风险确认或直接生成最终成功回复。

### Verifier
只根据Capability验证规则和执行证据判定成功或失败。未经验证不得进入“已完成”。

### Result
只表达已验证事实，明确失败、未执行、需确认或需澄清状态。不得把模型文本当作执行证据。

## 3. 禁止的跨层调用

- Gateway/IPC调用Interpreter、Scheduler、Registry或Provider。
- Interpreter选择具体Provider或根据工具缺失拒绝任务。
- Runtime在Scheduler之外按关键词直接决定最终能力。
- Runtime绕过Registry直接选择Provider。
- Provider直接生成最终“已完成”。
- Result绕过Verifier使用未经验证的执行输出。
- 测试替身使用与生产Task Schema不同的协议。

## 4. 已识别的冻结偏差

以下为正式部署前必须关闭的架构偏差，不在本轮治理文档中修改业务代码：

1. `agents/agent-runtime.mjs`仍以`statusPattern`、旧`classification`和文件扩展名决定状态查询/直接文件读取路径，未完全以Task Interpretation和Scheduler Assignment驱动。
2. code任务直接调用`models.execute()`并固定`writable:true`，未通过统一Provider Map执行Scheduler选出的Provider；目标、约束和success criteria没有编译到权限，Verifier也未验证diff/tests。
3. process能力在Runtime中按Capability ID硬编码分支；`process.list`不能独立交付，Provider调用接口尚未抽象为统一执行契约。
4. conversation任务以空`requiredCapabilities`进入表达路径，Registry中的`conversation/deepseek`未形成真实Scheduler Assignment。
5. Registry登记的Provider与Runtime Provider Map不一致；Fallback默认没有可执行Provider实例，静态availability也未由启动健康状态更新。
6. `ActiveTaskController`位于Interpreter之前；暂停/取消只更新状态，不能终止运行中Provider或阻止旧revision Result交付。
7. Gateway入站存在dedupe/accept/enqueue多权威和崩溃窗口；已有reconciliation函数尚未接入生产启动路径。
8. Electron实际启动的`server.mjs`仍维护独立关键词路由、Provider选择、工具执行和验证链，与飞书Runtime构成第二套生产架构。
9. DeepSeek存在本地Managed Proxy与direct Provider两套传输实现，Provider ID和预算/审计边界不唯一。

上述偏差不否定v1目标边界定义，但会阻止`Architecture Gate=PASS`。

## 5. 变更规则

- v1冻结后，任何跨层调用、Schema字段变更、Capability/Provider新增或风险策略变化，必须提交Architecture Decision Record并依次通过Code Review、Security、Architecture、QA。
- 修复重大架构缺陷时只允许缩小偏差，不得顺手增加能力。
- Gateway、IPC、Progress协议保持独立稳定；业务Runtime升级不得要求替换固定Gateway。
