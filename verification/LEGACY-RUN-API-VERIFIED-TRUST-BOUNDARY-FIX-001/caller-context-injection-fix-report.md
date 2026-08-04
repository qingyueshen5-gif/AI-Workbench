# 外部调用方Context注入修复与002收口报告

## 风险

`POST /api/agents/hermes/invoke`原先使用`payload.context || buildTaskContextPackage(...)`。外部调用方可令Agent和`Run.input.task_context`共同使用未经可信投影的对象，绕过`projectRunForAgentContext()`与`deriveBoundVerifierResult()`。

## 产品裁定实现

请求根级`context`被定义为唯一确认的外部禁写Context路径。服务端在`readData()`、Task创建/patch、Agent调用、Run创建和任何写入之前，使用own-property字段存在判断明确返回422。拒绝不依赖字段值，不反射内容，不静默忽略。

正常请求无条件执行`buildTaskContextPackage()`。相同`taskContext`变量既展开传给`agentRegistry.invoke()`，也写入`Run.input.task_context`。不存在fallback、merge、补充白名单或兼容后门。

## HTTP矩阵

`verify-agent-context-injection-rejection-001.mjs`使用隔离数据和PATH内测试Hermes替身，真实启动生产Server并调用正式HTTP入口。A—M全部PASS：完整伪造、空对象、null、false、0、空字符串和空数组均422；拒绝请求Agent/Provider调用、Task/Run创建和数据变化均为0；正常业务参数继续工作；服务端Context、Agent Context及Run记录来源一致。

## 状态

```text
resolvedRisk=UNTRUSTED_CALLER_CONTEXT_BYPASSES_TRUSTED_PROJECTION
riskStatus=RESOLVED_IN_FOCUSED_SCOPE
supersedes=LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-001
supersedesReason=INVALIDATED_BY_UNTRUSTED_CALLER_CONTEXT_BYPASS
gateScope=CONTEXT_TRUST_BOUNDARY_AND_CALLER_INJECTION_REJECTION
runtimeReadiness=BLOCKED_BY_REMAINING_STEP5_BOUNDARIES
parentWorkPackageStatus=BLOCKED_BY_FOURTH_RISK_REMEDIATION_IN_PROGRESS
finalAcceptance=false
deployment=NOT_DEPLOYED
overallSecurityStatus=BLOCKED
```

旧001 Checkpoint及其INVALIDATED状态永久保留。未修改Gateway、Delivery、失败提示责任链或其它禁止范围，未开始子步骤D。
