# 第 3B-2b2b 段零流量 deployment 验证报告

## 结论

- 执行状态：`zero_traffic_deployment_verified`
- 新 active deployment：`063b83c3-974f-43fb-84f2-9da0d574f745`
- 旧稳定 version：`16333442-925a-4b11-a3d1-d6249d2492ba`，正常生产流量 100%
- 新预算 version：`483e4fae-3af8-40fa-ab83-4551f08b519e`，正常生产流量 0%
- version override 三项验证通过：`/health` HTTP 200，`/v1/models` HTTP 200，未认证聊天 HTTP 401 `missing_token`
- 两张预算表仍为空，未调用真实 provider，未修改 Secrets，未执行回滚。

## 基线说明

本轮开始时曾因严格基线检查 blocked：当时指令要求 HEAD 等于 `657ace41faf534ede8f7f50df5153ecc6d9d2733`，但仓库已经有后续文档提交 `37ab9c28a451dcdc858ce783293ef09448b7bc34`。产品负责人确认该提交只改战略文档，未修改 Managed Proxy 功能代码、Wrangler 生产配置、预算算法、Worker version、D1 schema 或当前唯一下一步，并批准以 `37ab9c2` 作为第 3B-2b2b 新执行基线。

复核结果：`657ace4..37ab9c2` 之间 `managed-proxy` 无差异。

## Deployment

使用 `wrangler versions deploy` 创建 deployment：

- `16333442-925a-4b11-a3d1-d6249d2492ba@100`
- `483e4fae-3af8-40fa-ab83-4551f08b519e@0`

未使用普通 `wrangler deploy`，未上传新 Worker version，未修改 Secrets、routes、domains、triggers 或 D1 schema。

deployment 后只读确认：

- active deployment 从 `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e` 更新为 `063b83c3-974f-43fb-84f2-9da0d574f745`
- 旧稳定 version 仍为 100%
- 新预算 version 为 0%
- 没有其他 version 获得流量

## Version Override

使用 Cloudflare version override header 将 production hostname 请求定向到候选 version `483e4fae-3af8-40fa-ab83-4551f08b519e`。

| 请求 | 结果 |
| --- | --- |
| `GET /health` | HTTP 200 |
| `GET /v1/models` | HTTP 200 |
| 未认证 `POST /v1/chat/completions` | HTTP 401，code `missing_token` |

未认证聊天请求不带真实安装 Token，在认证阶段拒绝，因此不会调用 provider。

说明：Worker 响应没有暴露 version stamp。可复核依据是当前 active deployment 已包含候选 version 且候选正常流量为 0%，请求使用官方 version override header 明确指定候选 version，并取得预期 endpoint 响应。

## 预算表

deployment 前、deployment 后和 version override 后均只读查询：

- `monthly_platform_budget`：0 行，预留 0 micro-USD
- `monthly_model_budget`：0 行，预留 0 micro-USD

本轮没有写入预算记录，没有注册 installation，没有进入认证聊天路径。

## Preview URL 脱敏纠偏

上一段曾把完整 Preview URL 写入公开 verification。本轮已将当前文件改为：

- Preview alias：`budget-candidate-3b2b2a`
- 脱敏 host：`budget-candidate-3b2b2a-ai-workbench-managed-proxy.<redacted>.workers.dev`
- host SHA256：`8E0B40C5A1D58A94FE1FBF2EF67E5EFDABFB89D4FD72A3EA45F882AF8C7318B2`

完整 URL 曾存在于已推送历史提交。本轮不重写 Git 历史，不 force push。Preview URL 不是 Secret，但今后不得把完整 Preview URL 写入公开 evidence。

## 边界

- 新预算 Worker 已加入 deployment，但正常生产流量仍为 0%。
- 生产钱包刹车尚未对正常生产流量生效。
- 未调用真实 provider。
- 未修改 Secrets。
- 未进入下一段。
