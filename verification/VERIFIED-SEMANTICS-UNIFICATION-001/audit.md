# VERIFIED-SEMANTICS-UNIFICATION-001 第一步审计

```text
baselineHead=7249188bb2fedb84d74fa6f4f7fa3f7e645b2add
productionCodeModified=false
producerCount=30
consumerCount=5
testAssertionCount=89
unclassifiedProducerCount=0
fourthRiskFound=false
knownRiskExpandedToNewProductionPaths=true
```

## 1. 审计边界

本步只扫描和设计迁移，没有修改生产代码、测试脚本、产品状态或运行协议。

重新扫描了：

- `verified`全部生产赋值、读取、序列化和条件；
- `verification.passed`、`verification.ok`与对外`verified`的边界；
- `handled/rendered/policyApplied/executionCompleted/completionStatus`等语义等价候选；
- `server.mjs`旧桌面/API路径；
- `agents/`、`channels/`、`execution/`、`capabilities/`；
- `scripts/`中的旧断言和Fixture。

机器清单：

- `producer-inventory.json`；
- `consumer-inventory.json`；
- `test-assertion-inventory.json`；
- `semantic-migration-map.json`；
- `raw-lexical-scan.json`。

## 2. 上一轮数字与本轮数字

上一轮词法清单为66项，其中生产33、测试/Fixture 33。该数字混合了`verified`和部分`passed`赋值，并且行号属于旧Commit。

本轮按“生产对外`verified`赋值”重新分类得到30个生产者，另有5个生产读取/序列化消费者和89条测试/Fixture相关行。统计口径不同，因此不能把30解释为有3项被删除；本步没有修改生产代码。

## 3. 风险分类结论

仍然只有三类产品风险：

1. `NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER`；
2. `LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING`；
3. `NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND`。

```text
fourthRiskFound=false
```

没有出现需要产品决定的新语义字段，`F. UNRESOLVED_REQUIRES_PRODUCT_DECISION`条目数为0。

## 4. 已知风险扩展到此前清单未完整描述的生产路径

三类风险的语义没有变化，但本轮完整扫描确认已知风险覆盖范围比`CURRENT_STATUS.md`列出的核心行更广：

### 4.1 `server.mjs`旧桌面/API路径

包括：

- 内建普通回复和澄清证据使用`verified:true`；
- 旧Run通过`verification.ok`直接写`run.verified`；
- `/api/runs`接受调用方`payload.verified`；
- `/api/runs/:id/verify`用旧`verifyRun()`结果直接写`verified`；
- Run规范化和上下文序列化继续传播旧字段。

这些路径没有Task/Run/权威revision/成功Final的统一绑定，归入既有`LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING`，不是第四类风险。

### 4.2 `execution/minimal-desktop-executor.mjs`

动作级文件后置检查给每个结果写`verified:true`。它实际表达的是文件存在和SHA-256后置观察，目标应为`postconditionObserved=true/verified=false`。归入既有LEGACY类别。

### 4.3 AgentRuntime非执行和旧执行路径

确认核心已知位置仍存在：

- control interception；
- clarification；
- confirmation；
- capability_unavailable写入和返回；
- non-execution renderer；
- process.stop；
- code execution；
- conversation answer。

## 5. Gateway、Delivery和UI消费者

本轮生产源码扫描没有发现Gateway或Delivery直接以`verified`决定交付成功、已处理、已渲染或重试。主要消费者位于：

- `server.mjs`旧Run规范化、上下文和API序列化；
- AgentRuntime terminalResult可信派生中的Final绑定读取。

因此第五步预计可与`USER_NOT_INFORMED_OF_EXECUTION_FAILURE_UNVERIFIED`解耦，不需要修改失败提示责任链、Delivery Fence、重试策略或飞书消息格式。

## 6. 缺失字段默认成功

发现的历史fail-open：

```text
finalResult?.verified !== false
```

已由上一工作包在terminalResult中修复，当前生产源码不再存在该表达式。

本轮仍需增加静态防复发检查，禁止任何等价“缺失即成功”消费者。

## 7. 测试断言问题

发现多项测试只断言`verified=true`，实际保护的是：

- 回复已渲染；
- clarification或confirmation已处置；
- capability_unavailable提示已生成；
- process.stop后置状态已观察；
- 代码执行器没有抛错；
- 非执行消息已幂等重放。

这些断言不得静默删除。迁移时必须改为`verified=false`并增加`handled/rendered/policyApplied/requiresUserInput/confirmationRequired/capabilityAvailable/executionCompleted/postconditionObserved`中的准确断言。

## 8. `verification.passed`与`result.verified`

`verification.passed`继续作为Result Verifier持久化证据内部字段保留。

对外`result.verified`只有在以下完整事实均可信绑定时才允许为true：

- completed Task且无failure；
- completed Run；
- `verification.passed===true`；
- verification Task/Run/revision绑定；
- 成功Final Task/Run/revision绑定；
- Run finalEvidence绑定；
- 无Fencing或身份冲突。

Provider成功、模型输出、renderer成功或后置观察均不能直接产生`verified=true`。

## 9. 迁移分组

全部生产写入和消费者均归入六个批准分组之一：

- A. TRUSTED_VERIFIER_RESULT；
- B. NON_EXECUTION_OR_CONTROL；
- C. LEGACY_EXECUTION_WITHOUT_BOUND_VERIFIER；
- D. NON_EXECUTION_RENDERER；
- E. CONSUMER_MIGRATION；
- F. UNRESOLVED_REQUIRES_PRODUCT_DECISION。

```text
unclassifiedProducerCount=0
F组条目=0
```

## 10. 下一施工边界

没有第四类风险，因此允许进入第二步建立共享可信派生边界。

后续必须覆盖本轮确认的扩展路径，但不得：

- 补造Verifier PASS；
- 补造成功Final；
- 新建占位Task或Run；
- 修改用户失败提示责任链；
- 改变Gateway/Delivery重试或消息格式；
- 启动M2/M3/M4、Production Path Smoke或部署。
