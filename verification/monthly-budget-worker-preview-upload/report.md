# 第 3B-2b2a 段 Preview 上传验证报告

## 结论

- 执行状态：`preview_upload_verified`
- 已上传新的 Worker Preview version：`483e4fae-3af8-40fa-ab83-4551f08b519e`，version number `11`。
- Preview alias：`budget-candidate-3b2b2a`
- Preview host：`budget-candidate-3b2b2a-ai-workbench-managed-proxy.<redacted>.workers.dev`
- Preview host SHA256：`8E0B40C5A1D58A94FE1FBF2EF67E5EFDABFB89D4FD72A3EA45F882AF8C7318B2`
- 纠偏说明：完整 Preview URL 曾存在于已推送历史提交；本轮不重写 Git 历史，不 force push。Preview URL 不是 Secret，但今后不得把完整 Preview URL 写入公开 evidence。
- 本轮未部署 Worker，未修改生产流量，未修改 Secrets，未调用真实 provider。
- 生产 active deployment 仍为 `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`，100% 流量仍指向稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba`。
- 生产 D1 两张预算表仍存在且为空：`monthly_platform_budget = 0`，`monthly_model_budget = 0`。

## 上传结果

中断前已执行 version upload，恢复后用 Cloudflare API 只读查询确认：

- Worker：`ai-workbench-managed-proxy`
- 上传版本：`483e4fae-3af8-40fa-ab83-4551f08b519e`
- version number：`11`
- 创建时间：`2026-07-25T04:19:41.368218Z`
- Preview alias：`budget-candidate-3b2b2a`
- 触发类型：`version_upload`

未执行部署命令，未将新 version 加入 active deployment。

## Preview 验证

| 路径 | 方法 | 结果 |
| --- | --- | --- |
| `/health` | GET | HTTP 200，返回 `ok=true`、service 名和 `deepseek-chat` |
| `/v1/models` | GET | HTTP 200，返回当前允许模型 `deepseek-chat` |
| `/v1/chat/completions` | POST，未认证 | HTTP 401，code `missing_token`，在认证阶段拒绝 |

未认证聊天请求没有携带真实安装 Token，因此不会进入 provider 调用路径。

## 生产状态

恢复后再次只读查询 active deployment：

- 基线 active deployment：`61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`
- 当前 active deployment：`61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`
- 基线 active version：`16333442-925a-4b11-a3d1-d6249d2492ba`
- 当前 active version：`16333442-925a-4b11-a3d1-d6249d2492ba`
- 流量：100%

结论：active deployment 和生产流量完全不变。

## D1 预算表

远端 D1 只读查询：

- `monthly_platform_budget` 行数：0
- `monthly_model_budget` 行数：0
- `rows_written`：0
- `changed_db`：false

本轮没有写入预算表，没有执行 migration，没有写入测试预算记录。

## 边界

- 未部署 Worker。
- 未修改 Secrets。
- 未调用 `/v1/chat/completions` 的认证路径。
- 未使用真实安装 Token。
- 未调用真实 provider。
- 未进入下一段。
