# Survival Cost Audit Report

Generated at: 2026-07-24T21:34:00+08:00

## Result

生存体检执行状态：passed_after_boundary_correction。

本次修正原因：原报告里的 5/50/100 用户规划数字算术正确，但没有套用当前生产限额，容易被误读成“当前限额下可实际发生的最坏月成本”。本轮保留原数字，并把它们重新命名为 `uncapped_demand_pressure`。

钱包安全状态仍为 unsafe。原因不是当前正常路径成本很高，而是异常/并发逃逸路径没有 fail-closed 的金额边界，且没有平台月度金额硬上限或自动熔断。

暂无真实用户用量，所有 5/50/100 用户结果仍属于规划场景，不是实际用户平均成本。

## Three Cost Layers

### 1. current_enforced_normal_path

当前成功调用按正常路径记录用量，并受代码中每日请求和 token 限制约束。

关键代码事实：

- `DAILY_INSTALL_LIMIT=40`：单安装每日 Managed Proxy 请求上限。
- `DAILY_GLOBAL_LIMIT=200`：平台每日 Managed Proxy 请求上限。
- `DAILY_TOKEN_LIMIT=200000`：平台每日记录 token 上限。
- 注册请求会调用 `recordUsage(..., 0, 0)`，因此也占 `request_count`。
- 限额统计的是进入 Managed Proxy 的请求，不是前端用户输入次数。
- 当前工具路径中，一个前端任务可能需要 1 次或 2 次模型调用。

在本次 token 假设下：

- 单次 Managed Proxy 模型调用 token = 8000 input + 2048 output = 10048。
- DAILY_TOKEN_LIMIT 下顺序正常路径最多可接受 `ceil(200000 / 10048) = 20` 次模型调用/日。
- DAILY_GLOBAL_LIMIT 是 200 次/日，因此在当前 token 假设下先撞到 `DAILY_TOKEN_LIMIT`，不是 `DAILY_GLOBAL_LIMIT`。
- 如果每个前端任务需要 2 次模型调用，平台每天最多完整完成 `floor(20 / 2) = 10` 个前端任务。
- 如果每个前端任务只需要 1 次模型调用，平台每天最多完整完成 20 个前端任务。
- 5、50、100 个注册用户都共享同一个平台上限，因此当前正常路径成本不会随用户数线性增长。

当前限额下正常路径月成本上界：

| 注册用户数 | 每日成功模型调用上界 | 2 调用任务每日完成上界 | 月模型成本 USD | 月基础设施 USD | 月平台总成本 USD | 月平台总成本 CNY | 估算跑道 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | 20 | 10 | 1.016064 | 5 | 6.016064 | 40.76 | 7.96 |
| 50 | 20 | 10 | 1.016064 | 5 | 6.016064 | 40.76 | 7.96 |
| 100 | 20 | 10 | 1.016064 | 5 | 6.016064 | 40.76 | 7.96 |

说明：注册请求在首日占 request_count，但 5/50/100 注册请求均未把日请求余量压到 20 以下，因此在当前 token 假设下不改变模型调用上界。若未来 token 假设下降，DAILY_GLOBAL_LIMIT 可能重新成为瓶颈。

### Manual Check: current_enforced_normal_path, 50 users

代入值：

- 输入价格：0.14 USD / 1M tokens。
- 输出价格：0.28 USD / 1M tokens。
- 输入 token：8000。
- 输出 token：2048。
- 每日 token 限额：200000。
- 每日平台请求限额：200。
- 每月天数：30。
- Cloudflare 固定规划基础设施：5 USD/月。
- 汇率：6.776 CNY/USD。

复算：

1. 单次模型调用成本 = 8000 * 0.14 / 1000000 + 2048 * 0.28 / 1000000 = 0.00169344 USD。
2. 单次模型调用 token = 8000 + 2048 = 10048。
3. token 限制下每日模型调用上界 = ceil(200000 / 10048) = 20。
4. 请求限制下每日模型调用上界 = 200；因此先撞 `DAILY_TOKEN_LIMIT`。
5. 每月模型调用上界 = 20 * 30 = 600。
6. 月模型成本上界 = 600 * 0.00169344 = 1.016064 USD。
7. 月平台总成本上界 = 1.016064 + 5 = 6.016064 USD。
8. 月平台总成本 CNY = 6.016064 * 6.776 = 40.76 CNY。
9. 加入当前 8200 后月总消耗 = 8240.76 CNY。
10. 估算跑道 = 65600 / 8240.76 = 7.96 months。

手工结果与脚本 `cost-results.json` 一致。

### 2. uncapped_demand_pressure

以下数字保留原始计算结果，但含义改为：未来扩容或放宽现有限额后，高活跃用户需求全部得到满足时的规划压力成本。它们不是当前生产限额下可实际发生的正常路径成本。

| 场景 | 用户数 | 每用户每日前端请求 | 每前端请求上游调用 | 月平台总成本 CNY | 估算跑道 |
|---|---:|---:|---:|---:|---:|
| uncapped_demand_pressure_5_users | 5 | 40 | 2 | 199.12 | 7.81 |
| uncapped_demand_pressure_50_users | 50 | 40 | 2 | 1686.24 | 6.64 |
| uncapped_demand_pressure_100_users | 100 | 40 | 2 | 3338.61 | 5.69 |

为什么不能代表当前限额下实际成本：

- 1 个用户每天 40 个前端请求、每个 2 次上游调用，会产生 80 次 Managed Proxy 模型调用，超过单安装每日 40 次 Managed Proxy 请求上限。
- 5 用户同样假设会产生 400 次 Managed Proxy 模型调用/日，超过平台每日 200 次请求上限。
- 在当前 token 假设下，20 次模型调用/日已经触及 `DAILY_TOKEN_LIMIT` 的正常路径瓶颈。

### 3. failure_or_concurrency_escape_risk

`theoretical_worst_case` 仍为 `unbounded`，但依据不是“没有月度金额字段就数学无穷”，而是以下异常路径尚未 fail-closed：

- 限额是在上游调用前读取 D1 历史累计值。
- 用量是在上游返回后才写入 D1。
- 如果上游超时、网络失败或 fetch 抛错，Worker catch 路径返回 502，但不会调用 `recordUsage`。
- 本地 18800 代理默认最多尝试 3 次。
- 并发请求可能同时基于同一份旧 D1 累计值通过调用前检查。
- provider 对失败/超时/中断尝试是否计费，仓库证据无法确认。

结论：`cannot_determine_but_not_fail_closed`。没有观察到真实失控账单，但当前设计不能证明异常路径下有可靠金额上界。

## Data Sources And Assumptions

代码和验证证据：

- `managed-proxy/src/index.ts`
- `managed-proxy/wrangler.jsonc`
- `model-proxy.mjs`
- `server.mjs`
- `verification/managed-proxy-production/summary.json`

官方价格来源沿用原生存体检证据，没有重新调查：

- DeepSeek official API pricing: `https://api-docs.deepseek.com/quick_start/pricing-details-usd`
- Cloudflare Workers official pricing: `https://developers.cloudflare.com/workers/platform/pricing/`
- Cloudflare D1 official pricing: `https://developers.cloudflare.com/d1/platform/pricing/`
- USD/CNY conversion: Federal Reserve H.10, `https://www.federalreserve.gov/releases/h10/hist/dat00_ch.htm`

假设边界：

- 当前没有真实用户用量。
- token、请求量、缓存命中率和重试系数是规划假设。
- Cloudflare 5 USD/月是规划基础设施成本，不是永久免费保证。

## Validation

- 正常运行成本脚本两次，结果 SHA256 一致。
- 原 `uncapped_demand_pressure` 5/50/100 数字保持 199.12 / 1686.24 / 3338.61 CNY。
- 50 用户当前限额正常路径已手工复核。
- 报告不再把压力数字描述为当前生产可实现成本。
- 未调用真实模型，未产生模型费用。
- 未修改生产功能、Cloudflare、Managed Proxy、模型配置或限流。
