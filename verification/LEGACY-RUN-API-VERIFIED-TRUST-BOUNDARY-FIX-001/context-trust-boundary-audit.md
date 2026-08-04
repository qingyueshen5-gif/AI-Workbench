# Context信任边界只读审计

`buildTaskContextPackage()`位于`server.mjs:415`。调用点：工作台工具执行、Hermes invoke默认Context、`GET /api/tasks/:id/context`。

整改前Context包含`policy`、Task摘要、memories和`recentRuns`。Run投影字段为：`id`、`taskId`、`agentId`、`status`、`verified`、`handled`、`rendered`、`executionCompleted`、`postconditionObserved`、`errorUserMessage`、`verificationResult`。

问题：`verified`直接来自`run.verified === true`，没有调用`agents/verified-semantics.mjs`中的`deriveBoundVerifierResult()`，构成第三份近似可信规则。当前Context不包含完整`verification`、`finalEvidence`或`finalResult`，但持久化Run已具备完成共享派生所需的`trustedTask`、revision及证据字段。

`runEvidenceValidated`和`legacyVerifiedClaimObserved`当前未进入Context；`executionStarted`、`policyApplied`、结构化failure、input/output/evidence等真实事实也未完整投影。

实际消费者`agents/adapters/hermes.mjs:compactContextForPrompt()`将`recentRuns`结构保留在紧凑Context中；现有Prompt只显式输出Context ID和memory keys，没有以执行字段判断业务验收。无需修改Gateway/Delivery或失败提示责任链。

建议最小投影：每个Run保留严格派生的根级`verified`兼容字段，同时增加`verificationStatus`；把执行事实放入`executionFacts`；不透明业务数据放入`businessData`，不展开到信任根；默认移除`legacyVerifiedClaimObserved`。
