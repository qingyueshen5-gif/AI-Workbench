# 服务端可信事实保留专项报告

## 范围

本报告仅覆盖`LEGACY-RUN-API-STEP5-SERVER-FACT-PRESERVATION-001`。未修改`src/main.jsx`，未开始UI DTO、Context、UI状态、Gateway/Delivery、旧测试、Mandatory Gates或完整回归。

## 实现

`preserveServerOwnedRunFacts()`不再复制裸`verified`，也不复制整个旧Run。处理顺序：

1. 外部payload如含服务端专有可信字段，入口先返回结构化422；
2. 对仍存在的同ID Run比较`taskId`、`taskRevision`及现有不可变`agentId`；
3. 冲突时返回409 `RUN_IDENTITY_CONFLICT`，整包不写入；
4. 身份一致时，仅从当前服务端存储保留批准字段；
5. 使用共享`deriveBoundVerifierResult()`重新计算`verified`；
6. 历史裸`verified=true`无完整证据时保持`verified=false`，并保留`legacyVerifiedClaimObserved=true`；
7. payload中完全缺失的旧Run不会被重新插入，删除语义不变。

## 字段分类

机器清单：`server-fact-preservation-map.json`。

- `BUSINESS_VERIFICATION_AUTHORITY`：`trustedTask`、`verification`、`finalEvidence`、`finalResult`。
- 派生结果：`verified`，禁止直接复制。
- `SERVER_OWNED_NON_VERIFICATION_FACT`：`verifierId`、`verifiedAt`、`verificationResult`、`runEvidenceValidated`、`legacyVerifiedClaimObserved`。
- 其余列入清单的Run普通字段为`CLIENT_WRITABLE_BUSINESS_FIELD`，不能单独参与业务verified派生。

## 专项结果

`verify-server-owned-run-fact-preservation-001.mjs`场景A—J全部PASS：

- 同身份普通更新保留可信证据并重新派生true；
- 客户端verified注入422；
- 无可信事实及新Run均为false；
- 历史裸值fail-closed；
- taskId/revision冲突409；
- 缺少runId不得获得旧可信事实；
- 正式删除不产生幽灵Run；
- 混合整包冲突原子拒绝，前后SHA-256一致。

最新原子性哈希：

```text
before=b8389fb1bb0b2b0f2f3108b769e4a3dc40bd639a428586e40ea248a7dcb8c166
after=b8389fb1bb0b2b0f2f3108b769e4a3dc40bd639a428586e40ea248a7dcb8c166
```

四项聚焦回归也全部PASS：外部注入拒绝、整库原子拒绝、历史存量fail-closed、孤立Run验证分离。

## 状态

```text
fourthRisk=OPEN
finalAcceptance=false
deployment=NOT_DEPLOYED
overallSecurityStatus=BLOCKED
runtimeReadiness=BLOCKED_BY_UI_WRITABLE_DTO_INCOMPLETE
parentWorkPackageStatus=BLOCKED_BY_FOURTH_RISK_REMEDIATION_IN_PROGRESS
```

没有发现第五类风险。应用整体仍不可宣称可运行，因为已保存的`src/main.jsx`半成品属于下一子步骤B。
