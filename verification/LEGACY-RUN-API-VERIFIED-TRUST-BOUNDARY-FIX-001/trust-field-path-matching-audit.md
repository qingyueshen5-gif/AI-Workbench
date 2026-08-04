# 可信字段协议路径匹配只读审计

## 定义与调用

`findClientSuppliedTrustFields()`位于`server.mjs:72`。调用点只有：

- `POST /api/runs`，`server.mjs:2176`：整个payload是一个正式Run根；
- `PUT /api/data`，`server.mjs:2313`：只有`payload.runs[]`是正式Run根。

没有其它调用方依赖当前全局递归行为。

## 修复前算法

算法递归遍历传入对象的所有数组和对象后代，通过任意深度键名匹配可信字段。它进入`input`、`output`、`evidence`、`errorRaw`、`errorUserMessage`和`memorySuggestions`等不透明业务字段，并会把其中普通用户数据误判为Run协议信任字段。

`offendingPaths`由当前遍历路径拼接生成，因此能显示位置，但其语义根并非协议感知。

## 正式Run协议根

- `POST /api/runs`：请求payload本身；
- `PUT /api/data`：`payload.runs`数组中的每一项。

不得通过对象具有`id`、`status`或`runId`等形状猜测Run。

## 对象与叶子边界

整体服务端专有对象：`verification`、`finalEvidence`、`trustedTask`。

精确叶子：`verified`、`verificationPassed`、`verificationResult`、`finalResult.verified`、`verifierId`、`verifiedAt`、`runEvidenceValidated`、`legacyVerifiedClaimObserved`。

`finalResult`本身不能整体拒绝；客户端普通`finalResult.summary`等字段可保留，只有`finalResult.verified`属于禁写路径。

## 统一策略建议

建立`shared/run-trust-field-policy.mjs`，同时供服务端和前端DTO导入。规则表达`scope`、`entityType`、`path`、`matchMode`、`serverOwned`、`clientWritable`、`opaqueBoundary`及原因。只支持`EXACT`与`SUBTREE`，禁止`ANY_DEPTH_KEY_NAME`。
