# 可信字段路径匹配修复与UI DTO验收报告

## 结论

`OVERBROAD_TRUST_FIELD_PATH_MATCHING`已在聚焦范围内修复。服务端和前端DTO共同导入`shared/run-trust-field-policy.mjs`，只扫描正式Run根和精确协议路径，不再按任意深度键名匹配。

## Run根与不透明边界

- `POST /api/runs`：payload是Run根；
- `PUT /api/data`：仅`payload.runs[]`是Run根；
- 不使用对象形状猜测Run；
- `input`、`output`、`evidence`、`errorRaw`、`errorUserMessage`和`memorySuggestions`被声明为不透明边界。

## 策略规则

`verification`、`finalEvidence`和`trustedTask`使用`SUBTREE`；`verified`、`verificationPassed`、`verificationResult`、`finalResult.verified`、`verifierId`、`verifiedAt`、`runEvidenceValidated`和`legacyVerifiedClaimObserved`使用`EXACT`。

## 双向验证

- Run根正式可信字段全部422；
- false、null、空对象和空数组不绕过；
- 不透明业务数据中的同名字段放行并保持；
- output中的Run形状对象不被识别为协议Run；
- `offendingPaths`返回精确协议路径；
- 服务端、DTO与权威证据归一化后缺失/多余/模式/范围/边界差异均为0；
- PUT拒绝前后数据SHA-256一致。

## UI DTO

`src/lib/writable-data-dto.js`保持协议路径感知算法；`src/main.jsx`实际调用同一模块。专项A—J全部PASS，场景G确认DTO后的合法更新被服务端接受，普通字段和不透明同名数据保留，服务端事实保留逻辑重新派生`verified=true`，不是客户端回写所得。

## 状态

```text
supersedesFailure=OVERBROAD_TRUST_FIELD_PATH_MATCHING
failureStatus=RESOLVED_IN_FOCUSED_SCOPE
fourthRisk=OPEN
runtimeReadiness=BLOCKED_BY_REMAINING_STEP5_BOUNDARIES
parentWorkPackageStatus=BLOCKED_BY_FOURTH_RISK_REMEDIATION_IN_PROGRESS
finalAcceptance=false
deployment=NOT_DEPLOYED
overallSecurityStatus=BLOCKED
```
