# Context信任边界新风险停止证据

## 分类

```text
PRODUCT_OR_SECURITY_FAILURE
UNTRUSTED_CALLER_CONTEXT_BYPASSES_TRUSTED_PROJECTION
```

## 发现位置

`server.mjs`的`POST /api/agents/hermes/invoke`处理路径存在：

```js
const taskContext = payload.context || buildTaskContextPackage({ ...currentData, tasks }, task);
```

外部请求可提供任意`payload.context`，从而完全绕过`buildTaskContextPackage()`和`projectRunForAgentContext()`。该对象随后通过展开直接传给`agentRegistry.invoke()`，并作为`task_context`写入Run input。

## 影响

这构成新的不可信Context注入通道。调用方可提供与生产投影相同命名的：

- `recentRuns[].verified=true`；
- `recentRuns[].verificationStatus.trusted=true`；
- 将`executionCompleted`等执行事实包装成伪造验收状态；
- 任意覆盖生产Context字段。

此前A—L矩阵直接验证了生产投影函数，但没有覆盖该生产调用点的旁路，因此不能证明所有实际Agent Context均经过可信投影。已经创建的`LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-001`不能作为本子步骤最终验收依据。

## 停止裁定

该问题符合用户定义的新风险：

```text
Context出现新的不可信值升级通道
```

本轮不自行扩大范围修改Hermes invoke接口或其兼容契约。保存证据、WIP Checkpoint、外部Patch、SHA-256并推送后硬停止。

保持：

```text
finalAcceptance=false
deployment=NOT_DEPLOYED
overallSecurityStatus=BLOCKED
runtimeReadiness=BLOCKED_BY_UNTRUSTED_CONTEXT_BYPASS
parentWorkPackageStatus=BLOCKED_BY_FOURTH_RISK_REMEDIATION_IN_PROGRESS
```
