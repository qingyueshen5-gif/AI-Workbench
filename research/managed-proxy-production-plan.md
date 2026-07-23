# Managed Proxy 生产共享 Key 方案

日期：2026-07-23

## 1. 当前真实链路

当前安装版运行链路：

```text
Workbench / Hermes / OpenClaw
  -> http://127.0.0.1:18800/v1
  -> model-proxy.mjs 本机进程
  -> https://api.deepseek.com/v1
```

`18800` 的真实运行位置：

- `electron/main.cjs` 在应用启动时用 `process.execPath` 启动 `model-proxy.mjs`。
- `model-proxy.mjs` 监听 `127.0.0.1:${MODEL_PROXY_PORT || 18800}`。
- 代理只接受 loopback 请求，非本机请求返回 403。
- Workbench API 默认通过 `MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1` 调用它。
- Hermes / OpenClaw 员工侧只使用 `aiw.<employee>.local` 形式的占位 token。

当前共享 Key 读取方式：

1. `model-proxy.mjs` 启动时会读取两个本机 `.env`：
   - 运行时目录：`%APPDATA%\ai-workbench\.env`
   - 仓库/安装应用根目录：`.env`
2. `providerApiKey()` 优先读用户本机 `DEEPSEEK_API_KEY`。
3. 如果没有本机 key，则读：
   - `AIW_SHARED_DEEPSEEK_API_KEY`
   - `MODEL_PROXY_SHARED_API_KEY`
4. 读到后，`/health` 只暴露 `credentialSource: "shared_managed"`，不返回 key 值。
5. `/v1/chat/completions` 转发到 DeepSeek 官方 API 时使用 `Authorization: Bearer <key>`。

当前安装包和陌生机器如何获得该 Key：

- 没有生产获得方式。
- 当前安装包不会携带真实 key。
- 陌生机器只有在本机环境变量或本机 `.env` 已存在 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY` 时，才会进入 `shared_managed`。
- 这不满足“用户开箱即用，不配置 key”的产品铁律。

## 2. 历史阻塞与当前状态

`shared_managed` 机制测试已经通过；2026-07-24 续跑 R2.1 后，真实 Cloudflare 生产注入也已通过。

当前 mock 证明了：

- 当 `AIW_SHARED_DEEPSEEK_API_KEY` 出现在 `model-proxy.mjs` 的进程环境里时，`18800` 能把它识别为 `shared_managed`。
- `/health` 不泄露 key。
- 代理日志和进程输出不泄露测试 key。
- 员工和前端可以继续只拿本机占位 token。

当前 mock 没证明：

- 陌生机器可以在不配置 key 的情况下拿到生产凭证。
- 真实 DeepSeek key 有安全的服务端存放位置。
- 远程额度、限流、预算和紧急关闭可控。
- 正式共享服务已部署、可访问、可回滚。
- 安装包发布后真实用户的请求能完成生产调用。

R2.1 执行前 blocked 的具体原因，以及续跑后的状态：

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 代码 | passed | 本机 18800 已支持 `managed_remote`，安装版内置公开生产 Worker URL，并保留本机 `DEEPSEEK_API_KEY` 优先级。 |
| 部署环境 | passed | Cloudflare Worker 已部署到 `https://ai-workbench-managed-proxy.qingyueshen5.workers.dev`。 |
| 云账号 | passed | Wrangler 已登录并完成 Worker/D1 部署。 |
| 域名 | optional | 最快上线可先用 `workers.dev`，正式可后续绑定自有域名。 |
| Secret | passed | `DEEPSEEK_API_KEY`、`TOKEN_SIGNING_SECRET`、`INSTALLATION_HASH_SALT` 已配置为 Cloudflare Secret，值未进入仓库或本机日志。 |
| 正式 Key | passed | DeepSeek key 已通过交互式 Wrangler Secret 写入 Cloudflare。 |

真实 key 当前是否会进入用户电脑：

- 当前安装包扫描没有发现真实 key。
- 如果把生产 shared key 写入安装包、用户环境变量、本机 `.env`、进程参数或日志，就会进入用户电脑，这是正式方案禁止的。
- 当前代码若使用 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`，该 key 会存在本机进程环境和内存中；这只能用于机制测试或开发，不允许作为正式上线方案。

## 3. 正式架构决策

按产品铁律锁定正式架构：

```text
Workbench / Hermes / OpenClaw
  -> 本机 127.0.0.1:18800
  -> AI Workbench 自控远程 Managed Proxy
  -> DeepSeek 官方 API
```

正式边界：

- 真实 DeepSeek key 只存远程服务端 Secret。
- 安装包不包含真实 key。
- 用户电脑不保存真实 shared key。
- 本机 `18800` 不再直接持有生产 shared key。
- 本机 `18800` 只持有匿名/半匿名安装实例令牌。
- 不采用“Key 随包分发 + 消费限额”作为正式方案。
- 限流、预算、模型白名单、紧急关闭都放在远程 Managed Proxy。

## 4. 托管平台选择

R2.1 推荐使用 Cloudflare Workers。

选择理由：

- 支持服务端 Secrets，官方文档明确不应把敏感值写入普通 vars，应使用 secrets。
- 默认提供 HTTPS 和 `workers.dev` 子域，最快可以不买域名先跑通。
- 支持 Rate Limiting binding，可按实例/IP/路径限流。
- 部署和回滚比自建服务器更轻，符合“尽快上线拿反馈”。
- Worker 作为 OpenAI-compatible 转发层足够承载最小实现。

参考：

- Cloudflare Workers Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers routing / workers.dev: https://developers.cloudflare.com/workers/configuration/routing/
- Cloudflare Workers Rate Limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## 5. 远程代理最小实现

新增远程服务：

```text
managed-proxy/
  src/index.ts
  wrangler.jsonc
```

最小接口：

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses` 可先返回 501 或后续补齐
- `POST /v1/instance/register`
- `POST /v1/instance/revoke` 管理接口，可先仅服务端脚本使用

远程 Secret：

- `DEEPSEEK_API_KEY`
- `AIW_INSTANCE_SIGNING_SECRET`
- `AIW_ADMIN_TOKEN`
- 可选：`AIW_KILL_SWITCH`

远程普通配置：

- `DEEPSEEK_BASE_URL=https://api.deepseek.com/v1`
- `MODEL_ALLOWLIST=deepseek-chat,deepseek-reasoner`
- `DAILY_BUDGET_CNY=<数字>`
- `PER_INSTANCE_RPM=<数字>`
- `PER_IP_RPM=<数字>`
- `MAX_INPUT_CHARS=<数字>`

## 6. 客户端鉴权

客户端不拿 DeepSeek key，只拿安装实例令牌。

注册流程：

1. 首次运行时，本机 `18800` 生成随机 `installationId`。
2. 本机生成 `devicePublicId`，只做限流和撤销定位，不含机器隐私信息。
3. 调用远程 `POST /v1/instance/register`。
4. 远程返回短期实例 token，例如 7 天过期。
5. 本机把实例 token 存入 `%APPDATA%\ai-workbench\config\managed-proxy.json`。
6. 后续模型请求：

```text
Authorization: Bearer <instance-token>
x-aiw-installation-id: <installationId>
x-aiw-client-version: 0.4.6
```

过期和续期：

- token 过期前静默续期。
- 续期失败时，工作台仍打开，显示中文说明：“共享模型服务暂时不可用，工作台可以先打开。”

吊销：

- 远程按 `installationId` 或 token id 加入撤销表。
- 被撤销实例返回 401/403，客户端清除 token 并进入中文未就绪状态。

## 7. 模型白名单

R2.1 最小白名单：

- `deepseek-chat`
- `deepseek-reasoner`

模型别名仍由本机 `18800` 负责映射：

- `deepseek-v4-flash -> deepseek-chat`
- `deepseek-v4-pro -> deepseek-chat`

远程 Managed Proxy 必须拒绝白名单外模型，避免客户端伪造高成本模型请求。

## 8. 限流、预算和紧急关闭

单实例/IP 限流：

- 按 installation id 限制 RPM。
- 按 IP 限制 RPM。
- 对 `/v1/chat/completions` 和 `/v1/responses` 单独限流。

每日总预算：

- 远程记录每日请求数、输入/输出 token 估算和粗略成本。
- 超过预算后返回 429，中文 message：“共享模型额度今天已用完，请稍后再试。”

紧急关闭：

- `AIW_KILL_SWITCH=1` 时，所有模型转发返回 503。
- 本机 18800 收到 503 后保持应用可打开，并给中文说明。

## 9. 日志脱敏

远程日志允许记录：

- 时间
- installation id 哈希
- IP 哈希或前缀
- path
- model
- statusCode
- durationMs
- token 估算
- error category

远程日志禁止记录：

- DeepSeek key
- instance token 原文
- Authorization header
- 用户完整 prompt / response
- 本地用户名、绝对路径
- 机器指纹原文

## 10. 部署、回滚和验证

部署：

1. 产品负责人完成 Cloudflare 登录或提供项目授权。
2. R2.1 新增 `managed-proxy/`。
3. 使用 Wrangler 设置远程 Secrets。
4. 部署到 `workers.dev`。
5. 将远程 URL 写入本机 `18800` 的 managed proxy 配置。

回滚：

- 保留上一个 Worker 版本。
- 出现异常时回滚 Worker。
- 客户端无需更新安装包即可恢复，只要本机 18800 指向同一正式 URL。

验证：

1. 本机不设置 `DEEPSEEK_API_KEY`。
2. 本机不设置 `AIW_SHARED_DEEPSEEK_API_KEY`。
3. 本机不设置 `MODEL_PROXY_SHARED_API_KEY`。
4. 安装包和解包目录扫描无真实 key。
5. 本机 18800 通过实例 token 调远程 Managed Proxy。
6. 远程 Managed Proxy 使用 Secret 调 DeepSeek 官方 API。
7. `/health` 不返回 key/token。
8. 远程日志不含 Authorization、prompt 全文和 key。
9. 限流、预算、kill switch 均有机制测试。

## 11. 预计改动文件

R2.1 预计新增：

- `managed-proxy/src/index.ts`
- `managed-proxy/package.json`
- `managed-proxy/wrangler.jsonc`
- `scripts/verify-managed-proxy-production.mjs`
- `verification/managed-shared-key/production-summary.json`
- `verification/managed-shared-key/production-report.md`

R2.1 预计修改：

- `model-proxy.mjs`
- `runtime-paths.mjs`
- `readiness.mjs`
- `electron/main.cjs`
- `package.json`
- `.gitignore`
- `SETUP.md`
- `research/managed-proxy-production-plan.md`
- 任务和交接文档

## 12. 预计执行时间

保守估计：4-8 小时。

- 远程 Worker 最小实现：1.5-2.5 小时
- 本机 18800 调远程 Managed Proxy：1-2 小时
- 实例 token 存储、续期和中文降级：1-2 小时
- 验证脚本、扫描、文档、commit/push：1-1.5 小时

如果 Cloudflare 登录、DeepSeek 正式 key 或外部网络授权卡住，任务会变为 blocked。

## 13. 产品负责人需要提供的外部条件

一次列全：

1. Cloudflare 账号登录授权，允许创建/部署 Workers。
2. 一个可用于生产的 DeepSeek API Key，只能输入到 Cloudflare Worker Secret，不能发到聊天框，不能写入仓库。
3. 允许使用 `workers.dev` 临时域名；如果必须用自有域名，则还需 Cloudflare 托管域名或域名 DNS 管理权限。
4. 每日预算上限，例如先设人民币 20/50/100 元。
5. 单实例默认限流，例如 10 RPM；单 IP 默认限流，例如 60 RPM。
6. 是否允许记录脱敏请求统计，用于预算和故障排查。
7. R2.1 执行时允许安装/使用 Wrangler 或使用仓库本地 devDependency 运行 `npx wrangler`。

默认拍板：

- R2.1 先使用 Cloudflare Workers + workers.dev。
- 首版只支持 DeepSeek 官方 API。
- 首版只开放 `deepseek-chat` 和 `deepseek-reasoner`。
- 不做用户登录、不做付费、不做配置页面。
- 不发布 GitHub Release，不创建 tag。

## 14. R2.1 实际生产结果

2026-07-24 续跑 R2.1 后，生产注入已通过：

- Worker URL：`https://ai-workbench-managed-proxy.qingyueshen5.workers.dev`
- D1：`aiw-managed-proxy` / `202583b9-817f-4115-9ab1-41e136133de8`
- Secrets：`DEEPSEEK_API_KEY`、`TOKEN_SIGNING_SECRET`、`INSTALLATION_HASH_SALT` 只存在 Cloudflare
- 真实生产对话：无本机 Key 的 18800 和安装版均返回 `生产共享模型调用成功`
- 覆盖项：刷新、吊销、单实例限流、单 IP 限流、全局限流、预算限额、紧急关闭/恢复、中文降级、安全扫描
- 验收证据：`verification/managed-proxy-production/summary.json`

该结果只代表 R2.1 passed；不代表 3A 总验收或 3B Release 已完成。
