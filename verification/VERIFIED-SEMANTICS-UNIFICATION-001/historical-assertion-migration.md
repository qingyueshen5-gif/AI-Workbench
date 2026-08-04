# verified历史断言迁移

本文件记录本工作包没有静默删除旧`verified=true`安全断言，而是把它们迁移到正式产品语义及替代字段。

| 旧文件/场景 | 旧断言真正保护的语义 | 新verified断言 | 新增替代断言 | 旧安全语义 |
|---|---|---|---|---|
| `verify-non-execution-clarify-contract-001.mjs` clarification | 澄清结果已确定性生成且未启动执行 | `verified=false` | `handled=true/rendered=true/requiresUserInput=true` | 保留 |
| `verify-non-execution-message-idempotency-001.mjs` respond/clarify/unsupported | 同一非执行消息只处理和渲染一次 | `verified=false` | `handled=true/rendered=true/messageReplayed`分类 | 保留 |
| `verify-interpreter-adapter-bypass-001.mjs` 非执行旁路 | Task/Run/Scheduler/Provider均不启动 | `verified=false` | `executionStarted=false`及零调用计数 | 保留 |
| AgentRuntime confirmation Fixture | 确认提示已生成且安全策略生效 | `verified=false` | `handled=true/rendered=true/policyApplied=true/confirmationRequired=true` | 保留 |
| AgentRuntime control interception Fixture | 控制动作已被确定性拦截 | `verified=false` | `handled=true/policyApplied=true` | 保留 |
| capability_unavailable Fixture | 不可用提示已生成，任务未执行 | `verified=false` | `handled=true/rendered=true/capabilityAvailable=false` | 保留 |
| `interpreter-adapter-contract` renderer Fixture | renderer生成了用户可见内容 | `verified=false` | `rendered=true/handled=true` | 保留 |
| process.stop Fixture | 执行尝试结束并观察到PID不存在 | `verified=false` | `executionStarted=true/executionCompleted=true/postconditionObserved=true` | 保留 |
| code execution Fixture | 执行器完成一次尝试并生成结果 | `verified=false` | `executionStarted=true/executionCompleted=true` | 保留 |
| `minimal-desktop-executor`文件结果 | 文件后置状态和SHA-256已观察 | `verified=false` | `executionCompleted=true/postconditionObserved=true` | 保留 |
| conversation answer Fixture | 普通回复已生成 | `verified=false` | `handled=true/rendered=true` | 保留 |
| `verify-terminal-task-replay-classification-001.mjs` completed正例 | 真实Verifier及Task/Run/revision/Final完整绑定 | `verified=true` | 保留`verification.passed=true`和所有身份绑定断言 | 保留并加强 |
| failed/cancelled replay Fixtures | 终态被重放但不是验收通过 | `verified=false` | `taskReplayed=true/messageReplayed=false` | 保留 |
| non-execution replay Fixtures | 确定性消息结果重放 | `verified=false` | `taskReplayed=false/messageReplayed=true` | 保留 |

## 迁移规则

1. 所有旧`verified=true`断言均不得只删除不补。
2. 非可信路径必须明确断言`verified=false`。
3. 原本保护处理、渲染、策略、执行或后置观察的测试，必须增加对应结构化字段。
4. 只有构造真实Task/Run/Verifier PASS/权威revision/成功Final完整绑定的正向Fixture，允许保留`verified=true`。
5. `verification.passed`属于Verifier证据内部字段，未删除、未改名。

完整逐行旧断言清单见：

```text
verification/VERIFIED-SEMANTICS-UNIFICATION-001/test-assertion-inventory.json
```
