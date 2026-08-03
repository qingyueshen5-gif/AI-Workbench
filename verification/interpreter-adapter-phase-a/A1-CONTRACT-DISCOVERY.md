# INTERPRETER-ADAPTER-PHASE-A-001 — A1只读契约发现

- 调查基线：`0a14e07952de49a97070ed3cd89caffd6ef5059e`
- 分支：`candidate/interpreter-adapter-v1-work`
- 结论：本阶段只记录现有契约和阶段B边界，不实现Adapter，不改变生产Runtime、Gateway或IPC。

## 1. Interpreter真实输入与输出

入口为`TaskInterpreter.interpret({ text, conversationContext = [], environmentContext = {} })`。模型收到system prompt及一个JSON用户消息：`userMessage`、`conversationContext`、`environmentContext`。模型最多执行一次受限纠正重试。

有效输出必须包含：

- `taskType`
- `goal`
- `actions[]`
- `targets[]`
- `context{}`
- `constraints[]`
- `riskLevel`
- `requiredCapabilities[]`
- `successCriteria[]`
- `requiresConfirmation`
- `confidence`

Interpreter不能选择Provider、不能生成完成结果、不能输出可信Authorization。`stripInterpretationAuthorization()`会递归移除模型输出中的批准/授权暗示字段。

## 2. taskType全量清单

当前允许值共9个：

1. `chat`
2. `computer_operation`
3. `file_operation`
4. `information_research`
5. `code_task`
6. `media_creation`
7. `commerce`
8. `system_diagnosis`
9. `clarification`

没有`respond`或`unsupported` taskType。

## 3. 非执行回复合法落点

存在合法非执行回复分支：

- `chat`或`requiredCapabilities=[]`：Scheduler返回ready后由`models.express()`生成自然回复，`toolUsed=''`。
- `clarification`：要求`context.missingFields[]`、`context.questions[]`且`confidence<0.65`，进入`waiting_for_clarification`并返回问题。
- `needs_confirmation`：Scheduler发现缺少可信控制面授权，进入`waiting_for_confirmation`。
- `capability_unavailable`：返回缺失能力，进入`capability_unavailable`，不执行Provider。
- ActiveTaskController的status/pause/resume/cancel等控制回复可在Interpreter前被拦截。

因此阶段B若引入`respond`/`unsupported`语义，应映射到以上现有交付链，而不应凭空增加未经状态机支持的最终枚举。

## 4. Capability Registry全量清单

当前注册能力ID共8个：

- `conversation` → `deepseek`
- `file.read` → `local-tool-executor`
- `runtime.status` → `local-runtime-state`
- `code.read` → `codex`
- `code.execute` → `codex`
- `code.modify` → `codex`
- `process.list` → `local-process-provider`，另有不可用fallback
- `process.stop` → `local-process-provider`，另有不可用fallback

按唯一ID计8项，按Provider注册项计10项。Interpreter prompt中还列举了`file.write`、`file.manage`、`computer.control`、`commerce.*`、`media.video.create`、`web.research`、`system.diagnose`等抽象ID，但它们当前不在Registry中，会形成`capability_unavailable`，不得宣称已接通。

## 5. Scheduler输入输出契约

输入：

- 已验证的Interpretation；
- `taskId`；
- `userId`；
- `authorizationContexts[]`。

前置约束：`clarification`或`confidence<0.65`禁止进入Scheduler。

输出状态：

- `ready`
- `needs_confirmation`
- `capability_unavailable`

`ready`包含`assignments[]`，每项包含`capabilityId`、primary/fallback Provider及Authorization结果。Provider排序依据历史成功率、延迟、成本、风险和确认惩罚。

## 6. Risk Policy边界

仓库没有独立`RiskPolicy`模块。当前风险政策分散在：

- Interpreter验证：`riskLevel=high`必须`requiresConfirmation=true`；
- Registry：每个Provider声明`riskLevel`与`requiresConfirmation`；
- Scheduler：Interpretation要求确认，或任一Registry条目要求确认/为high时，必须匹配可信Authorization；
- Runtime：process/code执行前再次调用`assertProviderAuthorized()`。

阶段B不得把模型给出的风险或确认声明当作可信授权，也不得通过Normalizer降低Registry要求。

## 7. Authorization边界

可信Authorization只能从`job.authorizationContexts[]`进入Scheduler，绑定：

- `taskId`
- `userId`
- `capabilityId`
- `scope`
- `approvedAt`
- `approvedBy`
- `expiresAt`
- `nonce`

必须匹配任务、用户、能力、有效时间，nonce至少16字符。Interpreter输出中的`preauthorized`、`controlled_test`、`approved`、`confirmed`、`trusted`、`authorizationContext`等字段均被剥离，模型无授权权力。

## 8. 复合意图与clarify承载

当前Schema只允许一个`taskType`，复合意图通过`actions[]`、`targets[]`、`requiredCapabilities[]`、`successCriteria[]`表达。缺少对象、路径、范围或期望结果时，必须整体落到`taskType=clarification`，并在`context.missingFields[]`和`context.questions[]`承载。现有状态机没有“部分执行后再澄清剩余意图”的独立协议。

## 9. respond与unsupported交付链结论

- `respond`语义：映射为`chat`或空能力集，走`models.express`→Verifier→Final Result。
- `unsupported`语义：不应由Interpreter直接拒绝；Interpreter仍输出抽象能力，Scheduler通过Registry得到`capability_unavailable`并形成非执行终态回复。
- `clarify`语义：映射为现有`clarification` taskType和`waiting_for_clarification`状态。

## 10. 阶段B预计修改文件

阶段B尚未获准实施。预计最小修改面：

- 新增`agents/interpreter-adapter.mjs`：仅做确定性归一化、原始事实绑定和内部Schema构造；
- 修改`agents/agent-runtime.mjs`：在TaskInterpreter与Scheduler之间接入Adapter；
- 可能修改`agents/task-interpreter.mjs`：仅当需要明确候选模型输出契约，不能赋予其Provider/Authorization权力；
- 可能新增`agents/interpreter-adapter-contract.mjs`或等价Schema模块；
- 新增阶段B专项fixture/verification脚本；
- 更新`verify-mandatory-gates-001.mjs`接入新门禁；
- 若Capability ID契约需收口，审查`capabilities/capability-registry.mjs`与`capabilities/capability-scheduler.mjs`，但不得为适配模型而虚构未接通能力。

明确不应修改：生产Gateway传输职责、生产IPC协议、可信Authorization来源、Provider执行边界、已验证的Result/Verifier契约，除非后续发现并单独批准真实契约缺口。

## 11. 硬停止边界

A1完成后停止。禁止创建或接入Interpreter Adapter阶段B实现；禁止部署或切换生产Runtime。
