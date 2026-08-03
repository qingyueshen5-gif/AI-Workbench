# INTERPRETER-ADAPTER-PHASE-B-001 · B1真实契约与映射表

- 基线：`3989dc4c66a54fc0d01db1141d3e8d8209d136a3`
- 分支：`candidate/interpreter-adapter-v1-work`
- 阶段：B1只读发现；未进入B2实现
- 裁定结果：`NON_EXECUTION_RESPONSE_PATH_CONTRACT_MISMATCH`

## 1. B1五项继续条件

| 条件 | 真实代码结论 | 证据 |
| --- | --- | --- |
| 存在不经过Scheduler和Provider的普通Final回复路径 | **不成立** | `agents/agent-runtime.mjs:278-280`对所有非`clarification`解释先进入`scheduling`并调用`scheduler.plan()`；`371-377`中的`chat`/空能力回复在Scheduler之后调用`models.express()`。ActiveTaskController的控制拦截不是普通Adapter respond交付路径。 |
| clarification能够不进入执行Provider | 成立 | `agents/agent-runtime.mjs:266-275`直接写入`waiting_for_clarification`并返回，不进入Scheduler和执行Provider。 |
| execute是唯一进入Scheduler的decision | 当前不成立 | 当前Runtime不存在Adapter decision分支；除clarification外的Interpretation全部进入Scheduler。若继续B2必须修改Runtime控制流，但因第一项失败，本轮禁止自行扩大架构。 |
| 未注册Capability可在Adapter层直接阻断 | 设计上可独立实现，但当前未实现 | 可由独立Adapter映射表在输出前产生`unsupported`；当前代码只有Scheduler后的`capability_unavailable`兜底（`290-295`），不符合阶段B正常unsupported流程裁定。 |
| Adapter可独立于`task-interpreter.mjs`实现 | 成立 | Ground Truth由`agents/original-ground-truth-extractor.mjs`独立提供；独立Adapter可以只接收`originalText/groundTruth/semanticCandidate`，无需修改TaskInterpreter内部实现。Runtime接入仍需独立批准的控制流变更。 |

因为第一项不成立，且A1“chat/空能力可作为合法非执行回复”的描述遗漏了Scheduler和`models.express()`依赖，触发最高优先级硬停规则：保存B1成果后停止，不得继续B2—B5。

## 2. 当前真实Task与能力契约

合法`taskType`保持9项：

- `chat`
- `computer_operation`
- `file_operation`
- `information_research`
- `code_task`
- `media_creation`
- `commerce`
- `system_diagnosis`
- `clarification`

Registry唯一能力ID保持8项：

- `conversation`
- `file.read`
- `runtime.status`
- `code.read`
- `code.execute`
- `code.modify`
- `process.list`
- `process.stop`

阶段B首版自然语言执行Allowlist仍应仅为`runtime.status`和`file.read`；本B1没有开放任何能力。

## 3. 显式映射表（设计裁定，不是已接入实现）

| Ground Truth意图 | decision | taskType | requiredCapabilities | Scheduler | Provider |
| --- | --- | --- | --- | --- | --- |
| Runtime状态请求 | `execute` | `system_diagnosis` | `["runtime.status"]` | 允许 | 仅注册的Runtime状态Provider |
| 明确唯一原始路径的只读文件请求 | `execute` | `file_operation` | `["file.read"]` | 允许 | 仅注册的文件只读Provider |
| 文件读取但无路径或多路径未指定 | `clarify` | `clarification` | `[]` | 禁止 | 禁止 |
| 两个及以上独立可执行意图 | `clarify` | `clarification` | `[]` | 禁止 | 禁止 |
| 问候和普通无执行交流 | `respond` | 无 | 无 | 禁止 | 禁止；也禁止`models.express()` |
| 未注册能力或不在首版Allowlist | `unsupported` | 无 | 无 | 禁止 | 禁止 |
| 自然语言请求`code.*`、`process.*`或`conversation` | `unsupported` | 无 | 无 | 禁止 | 禁止 |

## 4. 预期Adapter契约边界

未来若获准修复Runtime非执行交付契约，独立模块应输出：

```json
{
  "version": "interpreter-adapter-v1",
  "decision": "execute | respond | clarify | unsupported",
  "taskDraft": null,
  "response": null,
  "riskSignals": [],
  "unresolved": [],
  "source": {
    "groundTruthVersion": "d0-1b-v1",
    "semanticCandidateVersion": "..."
  }
}
```

只有`execute`可拥有符合现有正式Task Schema的`taskDraft`并进入Scheduler。`respond`和`unsupported`必须使用`deterministic-v1`响应且`taskDraft=null`；`clarify`必须使用现有`clarification`结构并在Scheduler前进入`waiting_for_clarification`。

必须剥离Semantic Candidate中的：`riskLevel`、`approved`、`authorized`、`authorizationContext`、`providerId`、`requiredCapabilities`、`capability`、`taskType`和`path`。路径只能从已验证source span的Ground Truth读取。

## 5. Pending提议只读摘要

- ID：`f01a4d43`
- action：`patch`
- origin：`background_review`
- 目标Skill：`system-capability-readonly-audit`
- summary：`patch 'system-capability-readonly-audit' SKILL.md (+16/-3 lines)`
- 拟修改文件：该Skill的`SKILL.md`
- Diff摘要：拟在background gate provenance段落后增加“Native Skill write-approval governance”，内容涉及原生审批支持核验、六类动作覆盖、备份、临时HERMES_HOME测试、禁止Agent自批、临时冻结基线和漂移门禁；并调整相邻标题位置。
- 权限/风险判断：不涉及部署、删除、Authorization规则放行或降低既有门禁；包含治理规则扩充，但属于仓库外真实Skill修改提议，仍需产品负责人独立裁定。
- 本轮处理：未批准、未拒绝、未删除、未修改Pending。

## 6. 硬停止

本B1只增加契约发现证据。未创建`agents/interpreter-adapter.mjs`或`agents/interpreter-adapter-contract.mjs`，未修改Runtime，未调用模型，未进行网络调用，未启动Provider，未部署，未切换生产Runtime，未触碰生产IPC，未发送真人飞书消息。
