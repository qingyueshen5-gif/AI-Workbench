# CQ-001—CQ-006 产品裁定输入补充

> 本文件只补充“实际能力、是否属于当前Allowlist、建议归类”三项产品裁定输入。它引用而不替换已经保存的`CONTRACT-QUESTION-DETAILS.md`和`contract-question-details.json`，不修改任何测试、源码、Fixture或断言。

当前Allowlist：

```text
runtime.status
file.read
```

已正式作废且未实施：

```text
DEFERRED_PENDING_ALLOWLIST
统一挂起且正式门禁仍exitCode=0
```

原因：该方式会形成“登记即可跳过”的降级通道。

## CQ-001

- 实际能力：`clarification / structured missing-context handling`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**D. 需要重新定义产品契约**
- 理由：当前clarify/respond被正式定义为非执行、Task=0；旧断言却要求`waiting_for_clarification`业务Task。当前Allowlist没有表达该生命周期的能力。在确认“澄清是否属于业务Task”之前，不能只替换样本、迁移或删除。

## CQ-002

- 实际能力：`TaskInterpreter structured-output correction + chat completion`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**B. 迁移到独立能力专项**
- 理由：真正被验证的是TaskInterpreter受限纠错和`calls=2`，不是当前Task replay。确定性Adapter阻止`hello`进入TaskInterpreter；直接Interpreter专项才能保留原能力和断言，而无需恢复旧chat Task路径。

## CQ-003

- 实际能力：`TaskInterpreter bounded-correction failure + failed-Task recording`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**B. 迁移到独立能力专项**
- 理由：原断言要求`Task Interpreter`错误和failed事实。改用grounded Provider/Verifier失败只会验证另一个失败边界。应由Interpreter失败专项保留原纠错失败能力；failed终态业务Task重放继续由S6专项负责。

## CQ-004

- 实际能力：`commerce.payment confirmation gating`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**B. 迁移到独立能力专项**
- 理由：`needs_confirmation`属于确认/授权能力边界。当前`runtime.status/file.read`均无需确认，不能替代commerce确认语义。未来该能力启用时，由独立确认专项恢复执行并在Deployment前PASS。

## CQ-005

- 实际能力：`media.video.create unavailable-capability scheduling`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**D. 需要重新定义产品契约**
- 理由：这里存在两个不同产品契约：未开放能力是在Adapter前置判为`unsupported`、Task=0，还是创建Task后以`capability_unavailable`终止。当前实现选择前者，旧断言要求后者。必须先由产品负责人定义哪个层次是权威，不能直接迁移或改断言。

## CQ-006

- 实际能力：`code.read + code.modify + code.execute / Codex`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**B. 迁移到独立能力专项**
- 理由：原断言明确要求`toolUsed=codex`和一次代码执行；`runtime.status/file.read`不能替代。代码能力未开放期间专项可记录为能力未启用，但不得形成正式门禁的跳过通道；代码能力重新进入Allowlist时必须自动恢复执行，并在Deployment前PASS。

## 已有CQ-007裁定记录

- 实际能力：`process.list + process.stop`
- 是否属于本阶段Allowlist：**NO**
- 建议归类：**B. 迁移到独立能力专项**
- 本轮只记录已有裁定，未修改或覆盖原CQ-007证据。

## 后续方向（仅记录，未设计、未实施）

未开放能力未来可能由独立专项表示`NOT_APPLICABLE_CAPABILITY_DISABLED`；能力进入Allowlist后专项自动恢复执行，且Deployment前必须PASS，否则Deployment BLOCKED。本轮没有新增门禁、修改脚本或实施状态机制。
