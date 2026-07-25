# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收第 3B-2b2b 段零流量 deployment。未经批准不得把新预算 Worker 切换到正常生产流量。
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
- 第 3B-2b2b 段零流量 deployment 已完成，当前等待产品负责人验收。

## 为什么停在 3B-2b2b 验收

- 本轮只把新预算 Worker version 加入 active deployment，但正常生产流量为 0%。
- 本轮确认旧稳定 version 继续承载 100% 正常生产流量，远端预算表仍为空。
- 本轮通过 production hostname 的 version override 验证新预算 version 的健康、模型列表和未认证聊天拒绝路径。
- 本轮未部署 Cloudflare Worker、未修改 Secrets、未使用真实安装 Token、未调用真实 provider。
- 新预算 Worker 已加入 deployment，但生产钱包刹车尚未对正常生产流量生效；正常流量切换属于后续段，必须等待产品负责人验收 3B-2b2b 并明确批准。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收第 3B-2b2b 段零流量 deployment；
- 查阅 `verification/monthly-budget-worker-zero-traffic-deployment/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到任何大于 0% 的正常生产流量；
- 执行 `wrangler deploy` 或新的 `wrangler versions deploy`；
- 修改 Worker 流量；
- 执行 rollback；
- 修改 Cloudflare Secrets；
- 调用真实模型；
- 注册测试安装；
- 写入预算表；
- 修改生产 D1；
- 自动进入后续流量切换、模型分层、上下文压缩或 v0.4.7；
- 自动进入首屏示例、反馈入口、安全告知、真实用户测试、手机端、完整多 Agent 调度或生态扩张；
- 删除文件、卸载软件、迁移活跃仓库或批量结束进程；
- 清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。

## 验收后

验收批准后的候选下一步是“新预算 Worker 正常生产流量切换”。它不是本轮已执行内容，未经产品负责人批准不得开始。
