# ③A-R2.0：shared_managed 阻塞核验与生产方案锁定

日期：2026-07-23

## 状态

R2.0：passed。

注意：这是架构审计和生产方案锁定 passed，不代表 `shared_managed` 生产调用已完成。生产注入仍是 blocked，需 R2.1 实现和验证。

## 当前 shared_managed 真实链路

当前运行链路：

```text
Workbench / Hermes / OpenClaw
  -> 127.0.0.1:18800
  -> 本机 model-proxy.mjs
  -> DeepSeek 官方 API
```

`18800` 实际运行位置：

- Electron main 进程启动 `model-proxy.mjs`。
- `model-proxy.mjs` 监听 `127.0.0.1:18800`。
- 只接受 loopback 请求。
- 安装包内包含 `model-proxy.mjs`，陌生机器上也是本机启动。

当前共享 key 从哪里读取：

- `DEEPSEEK_API_KEY`
- `AIW_SHARED_DEEPSEEK_API_KEY`
- `MODEL_PROXY_SHARED_API_KEY`
- 这些值来自本机进程环境，或本机 `.env` / `%APPDATA%\ai-workbench\.env`。

结论：当前 `shared_managed` 是本机环境兜底来源标签，不是远程托管生产服务。

## 当前 blocked 根因

生产 blocked 的根因：没有自控远程 Managed Proxy。

缺少项：

- 远程代理代码和部署配置；
- Cloudflare Worker 或等价托管环境；
- 服务端 Secret 中的真实 DeepSeek key；
- 安装实例 token 签发、过期、吊销；
- 单实例/IP 限流；
- 每日总预算；
- kill switch；
- 生产验证脚本和真实 run 证据。

## 真实 Key 是否会落到用户电脑

按当前安装包和扫描证据：没有真实 key 进入安装包。

但如果继续使用当前本机 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY` 方式做生产，真实 key 就会进入用户电脑的环境变量、`.env` 或进程内存。这不符合正式方案。

正式结论：

- 真实 DeepSeek key 禁止进入安装包；
- 真实 DeepSeek key 禁止进入用户电脑文件；
- 真实 DeepSeek key 禁止进入用户环境变量；
- 真实 DeepSeek key 禁止进入进程参数和日志；
- 真实 DeepSeek key 只能存在远程 Managed Proxy 的服务端 Secret。

## mock 证明了什么

证据：`verification/shared-key/summary.json`

mock 已证明：

- `model-proxy.mjs` 能识别 shared key 环境变量；
- `/health` 只暴露 `credentialSource: shared_managed`；
- 代理能把 shared key 发给 mock upstream；
- health、日志、进程输出不泄露 mock key。

mock 没证明：

- 陌生机器能自动拿到生产模型能力；
- 真实 DeepSeek key 存在安全远程 Secret；
- 生产远程代理可用；
- 生产限流、预算、吊销和 kill switch 可用；
- 正式 Release 用户可用。

## 锁定正式架构

```text
客户端 / Workbench / Hermes / OpenClaw
  -> 本机 127.0.0.1:18800
  -> AI Workbench 自控远程 Managed Proxy
  -> DeepSeek 官方 API
```

不采用：

```text
真实 Key 随安装包分发 + 消费限额
```

原因：即使有限额，key 仍会落到用户电脑，违反零门槛和安全边界。

## 推荐实现平台

R2.1 推荐使用 Cloudflare Workers。

理由：

- 支持服务端 Secrets；
- 可先用 `workers.dev` HTTPS 地址；
- 可做 per-instance / per-IP 限流；
- 运维负担低；
- 回滚简单；
- 足够承载 DeepSeek OpenAI-compatible 转发。

参考：

- Cloudflare Workers Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers routing / workers.dev: https://developers.cloudflare.com/workers/configuration/routing/
- Cloudflare Workers Rate Limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## R2.1 外部条件

产品负责人需要一次性准备：

1. Cloudflare 账号登录授权，允许部署 Workers。
2. 生产 DeepSeek API Key，只能输入 Cloudflare Secret，不能发聊天框，不能写仓库。
3. 允许先使用 `workers.dev`；若不用，则提供域名 DNS 权限。
4. 每日预算上限。
5. 单实例和单 IP 限流默认值。
6. 允许记录脱敏统计日志。
7. 允许 R2.1 使用 Wrangler。

## 下一步

下一次唯一任务：

`③A-R2.1：实现远程 Managed Proxy 并做真实生产注入验证`

R2.1 通过后才做 ③A 总验收。③A 总验收通过并经产品负责人批准后，才进入 ③B 正式 Release。
