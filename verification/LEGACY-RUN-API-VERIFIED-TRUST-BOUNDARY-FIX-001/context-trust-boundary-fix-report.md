# Context可信投影实现报告

新增`shared/run-context-projection.mjs`，`buildTaskContextPackage()`对每条Run调用`projectRunForAgentContext()`。

`verified`和`verificationStatus`仅调用`agents/verified-semantics.mjs`中的`deriveBoundVerifierResult()`；没有复制绑定规则。字段所有权和不透明边界仅来自`shared/run-trust-field-policy.mjs`。

结构：

- `verified`：兼容根级严格boolean；
- `verificationStatus`：`verified/source/trusted/taskId/runId/taskRevision`；
- `executionFacts`：状态、执行开始/结束、postcondition、evidence检查、handled/rendered/policyApplied、结构化failure；
- `businessData`：input/output/evidence/errorRaw/errorUserMessage/memorySuggestions，保持独立且不展开；
- `legacyVerifiedClaimObserved`不进入Agent Context；
- verification、finalEvidence、finalResult等证据不直接暴露到Agent Context。

实际Hermes消费者仍通过`recentRuns`读取投影，未发现把执行事实当作验收结论的逻辑，无需修改消费者、Gateway、Delivery或用户失败提示责任链。

当前实现等待A—L矩阵，不在本Checkpoint宣称全面行为Gate通过。
