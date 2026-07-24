# Survival Cost Audit Report

Generated at: 2026-07-24T20:58:00+08:00

## Result

生存体检执行状态：passed。

钱包安全状态：unsafe。当前代码和验证证据没有平台月度金额硬上限，也没有自动成本熔断。当前理论最坏月度总成本无硬上限（unbounded）。这不等于规划压力场景没有数字；规划场景只是为了比较 5、50、100 个高活跃用户时的成本压力。

暂无真实用户用量，5/50/100 用户结果属于规划压力场景，不是实际用户平均成本。

## Scope Boundary

AI Workbench 是模型与 Agent 无关的调度框架。DeepSeek 只是当前唯一生产 provider，是可替换实现细节。本报告区分三层：

- 通用公式：token、provider 单价、调用次数、重试、基础设施和固定费用。
- 当前生产实现：当前代码允许 `deepseek-chat`，官方价格按 DeepSeek 当前兼容目标 `deepseek-v4-flash` 非思考模式计算。
- 可替换变量：更换 provider 后替换输入单价、输出单价、缓存价格、计费单位、币种、上下文/输出上限和 provider 侧规则。

本轮没有修改生产功能、Cloudflare、Managed Proxy、模型配置、限流，也没有实现月度总开销上限或自动熔断。

## Code Facts

事实来自 `managed-proxy/src/index.ts`、`managed-proxy/wrangler.jsonc`、`model-proxy.mjs`、`server.mjs` 和 `verification/managed-proxy-production/summary.json`。

- 当前生产 provider：DeepSeek。
- 当前代码模型：`deepseek-chat`。
- 当前 Worker allowlist：`deepseek-chat`。
- 单安装每日请求上限：40。
- 单 IP 每日请求上限：80。
- 平台每日请求上限：200。
- 平台每日 token 记录上限：200000。
- 最大请求体：65536 bytes。
- 最大输入字符：30000，代码按 `Math.ceil(inputChars / 4)` 估算输入 token。
- 最大输出 token：2048。
- 本地 18800 代理默认最多重试 3 次；Cloudflare Worker 本身不重试上游。
- 当前聊天工具路径最多可能出现 2 次上游模型调用：一次选择工具，一次根据工具结果汇报。
- 未发现平台月度金额硬上限或真正钱包刹车。

## Pricing Sources

- DeepSeek official API pricing: `https://api-docs.deepseek.com/quick_start/pricing-details-usd`
- Cloudflare Workers official pricing: `https://developers.cloudflare.com/workers/platform/pricing/`
- Cloudflare D1 official pricing: `https://developers.cloudflare.com/d1/platform/pricing/`
- USD/CNY conversion for runway planning: Federal Reserve H.10, `https://www.federalreserve.gov/releases/h10/hist/dat00_ch.htm`

USD 是 provider 账单口径；CNY 只用于现金跑道估算。

## Planning Assumptions

| Field | Value |
|---|---:|
| 每用户每日请求数 | 40 |
| 每次上游调用输入 token | 8000 |
| 每次上游调用输出 token | 2048 |
| 每次用户请求上游调用数 | 2 |
| 重试放大系数 | 1.2 |
| 每月天数 | 30 |
| 缓存命中率 | 0 |
| 当前基础月支出 | 8200 CNY |
| 当前跑道 | 8 months |
| 推算现金储备 | 65600 CNY |
| 汇率 | 1 USD = 6.776 CNY |

这些是假设，不是真实用户观测。Cloudflare 基础设施按 5 USD/月固定费用规划，变量费用暂按 0 USD，因为本轮场景预计仍在当前官方包含量级内；这不是永久免费保证，后续必须用真实 Cloudflare 账单校正。

## Cost Table

| 场景 | 用户数 | 每用户每日请求数 | 输入 token | 输出 token | 上游调用数 | 重试系数 | 单次用户请求成本 USD | 月度模型成本 USD | 月度基础设施 USD | 月度平台总成本 USD | 月度平台总成本 CNY | 加 8200 后月消耗 CNY | 估算跑道 | 数据类型 | 可信度 | 主要风险 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| planning_pressure_5_users | 5 | 40 | 8000 | 2048 | 2 | 1.2 | 0.004064 | 24.385536 | 5 | 29.385536 | 199.12 | 8399.12 | 7.81 | 规划假设 | medium | 无真实用户平均；高活跃行为和重试率是假设 |
| planning_pressure_50_users | 50 | 40 | 8000 | 2048 | 2 | 1.2 | 0.004064 | 243.85536 | 5 | 248.85536 | 1686.24 | 9886.24 | 6.64 | 规划假设 | medium | 无真实用户平均；高活跃行为和重试率是假设 |
| planning_pressure_100_users | 100 | 40 | 8000 | 2048 | 2 | 1.2 | 0.004064 | 487.71072 | 5 | 492.71072 | 3338.61 | 11538.61 | 5.69 | 规划假设 | medium | 无真实用户平均；高活跃行为和重试率是假设 |

## Manual Check: 50 Users

代入值：

- 输入价格：0.14 USD / 1M tokens。
- 输出价格：0.28 USD / 1M tokens。
- 输入 token：8000。
- 输出 token：2048。
- 每用户请求上游调用数：2。
- 重试系数：1.2。
- 每用户每日请求数：40。
- 用户数：50。
- 每月天数：30。
- 基础设施：5 USD/月。
- 汇率：6.776 CNY/USD。
- 现金储备估算：8200 * 8 = 65600 CNY。

复算：

1. 单次上游调用成本 = 8000 * 0.14 / 1000000 + 2048 * 0.28 / 1000000 = 0.00169344 USD。
2. 单次用户请求成本 = 0.00169344 * 2 * 1.2 = 0.004064256 USD。
3. 每用户每月模型成本 = 40 * 30 * 0.004064256 = 4.8771072 USD。
4. 50 用户模型月成本 = 50 * 4.8771072 = 243.85536 USD。
5. 平台月总成本 = 243.85536 + 5 = 248.85536 USD。
6. 平台月总成本 CNY = 248.85536 * 6.776 = 1686.24 CNY。
7. 加入当前 8200 后月总消耗 = 8200 + 1686.24 = 9886.24 CNY。
8. 估算剩余跑道 = 65600 / 9886.24 = 6.64 months。

手工结果与脚本 `cost-results.json` 在舍入误差内一致。

## Answers

1. 当前理论最坏月度成本是否有限：不有限，`unbounded`，因为没有平台月度金额硬上限。
2. 5、50、100 用户的平台月度总成本：199.12 CNY、1686.24 CNY、3338.61 CNY。
3. 估算现金跑道：7.81、6.64、5.69 个月。
4. 每新增一个高活跃用户规划月增量模型成本：约 4.877107 USD，即约 33.05 CNY。不含固定 Cloudflare 5 USD/月，因为固定项不随单个用户线性增长。
5. 最大成本驱动因素：请求次数 * 上游调用次数 * 输出 token 上限 * 重试系数。provider 单价是可替换变量，但会直接乘到模型成本上。
6. 当前是否存在真正平台月度钱包刹车：不存在。当前只有每日请求/token 限制和开关，不是月度金额硬上限。
7. 代码和官方价格：provider、模型、日限、token 限、重试、输入/输出上限来自代码和 verification；价格来自官方 DeepSeek、Cloudflare、Federal Reserve 来源。规划压力场景中的请求量、token、缓存命中率和重试系数是假设。
8. 为什么无法得到真实用户平均成本：当前尚无真实用户；production verification 是测试样本，不能冒充真实用户行为。
9. 下一步为什么应是平台月度总开销上限和自动熔断：当前钱包状态 unsafe，理论最坏成本 unbounded；必须先建立平台级金额刹车，再继续扩大测试或进入后续功能。

## Validation

- 成本脚本正常运行两次，`cost-results.json` SHA256 一致。
- 缺失字段、负数 token、无效 JSON 测试均非零退出。
- 四个既有 JSON 已解析通过。
- 50 用户场景已手工复核。
- 未调用真实模型，未产生模型费用。
- 未修改生产功能、Cloudflare、Managed Proxy、模型配置或限流。
