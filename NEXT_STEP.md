# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收第 3B-2b2c 段 1% 生产灰度。未经批准不得将新预算 Worker 切换到 100% 流量，不得主动执行真实模型调用。
<!-- AIW_NEXT_STEP_END -->

## 当前状态

- AI Workbench v0.4.6 Alpha 已公开发布。
- 阶段性总审核（砍薄版）已由产品负责人验收通过。
- 生存体检已由产品负责人验收通过。
- 第 3A 段本地钱包刹车已由产品负责人验收通过。
- 第 3B-1 段生产预检与远端 D1 备份已由产品负责人验收通过。
- 第 3B-2a 段远端 D1 migration 已由产品负责人验收通过。
- 第 3B-2b1 段部署候选已由产品负责人验收通过。
- 第 3B-2b2a 段 Preview 上传验证已由产品负责人验收通过。
- 第 3B-2b2b 段零流量 deployment 已由产品负责人验收通过。
- 第 3B-2b2c 段 1% 生产灰度已完成，当前等待产品负责人验收。

## 为什么停在 3B-2b2c 验收

- 产品负责人已决定钱包刹车采用灰度切流量，不直接全量上线。
- 本轮只将新预算 Worker 调整为 1% 正常生产灰度，旧稳定 Worker 继续承载 99%。
- 本轮完成 20 分钟观察和 5 分钟指标缓冲，健康检查正常，但没有确认到自然候选版本 invocation，因此可信度受低流量限制。
- 本轮未修改 Secrets、未修改 D1 schema、未使用真实安装 Token、未主动调用真实 provider。
- 100% 全量切换属于后续段，必须等待产品负责人验收 3B-2b2c 并明确批准。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收第 3B-2b2c 段 1% 生产灰度；
- 查阅 `verification/monthly-budget-worker-one-percent-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy` 或新的 `wrangler versions deploy`；
- 修改 Worker 流量；
- 执行 rollback；
- 修改 Cloudflare Secrets；
- 调用真实模型；
- 注册测试安装；
- 写入预算表；
- 修改生产 D1；
- 自动进入 100% 全量切换、模型分层、上下文压缩或 v0.4.7；
- 自动进入首屏示例、反馈入口、安全告知、真实用户测试、手机端、完整多 Agent 调度或生态扩张；
- 删除文件、卸载软件、迁移活跃仓库或批量结束进程；
- 清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。

## 验收后

验收批准后的候选下一步是“新预算 Worker 100% 全量切换”。它不是本轮已执行内容，未经产品负责人批准不得开始。
