# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收第 3B-2b2d 段候选 Versioned Preview 单笔真实预算链路失败后预留结果。未经批准不得将新预算 Worker 切换到 100% 流量，不得发起第二笔主动真实模型调用。
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
- 第 3B-2b2c 段 1% 生产灰度已由产品负责人验收通过。
- 第 3B-2b2d 段候选 Preview 单笔真实预算链路已执行，真实聊天返回 HTTP 400，预算预留已写入，当前等待产品负责人验收。

## 为什么停在 3B-2b2d 候选 Preview 验收

- 产品负责人已决定因 1% 灰度缺少自然请求样本，不直接切 100%，先尝试单笔受控真实预算链路验证。
- 本轮使用候选 version Preview URL，不依赖生产 hostname version override。
- 注册 1 次成功，唯一真实聊天 1 次返回 HTTP 400 `invalid_request_error`，无重试。
- 预算预留已写入，平台总账和模型明细各 +21 micro-USD、call_count +1。
- 该结果不能写成 passed，也不能写成 100% 全量验证。
- 本轮未修改 Secrets、未修改 D1 schema、未修改 Worker 代码、未触发回滚。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收第 3B-2b2d 候选 Preview 失败后预留结果；
- 查阅 `verification/monthly-budget-worker-controlled-real-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy` 或新的 `wrangler versions deploy`；
- 修改 Worker 流量；
- 执行 rollback；
- 修改 Cloudflare Secrets；
- 调用真实模型；
- 发起第二笔主动真实模型调用；
- 注册测试安装；
- 写入预算表；
- 修改生产 D1；
- 自动进入 100% 全量切换、模型分层、上下文压缩或 v0.4.7；
- 自动进入首屏示例、反馈入口、安全告知、真实用户测试、手机端、完整多 Agent 调度或生态扩张；
- 删除文件、卸载软件、迁移活跃仓库或批量结束进程；
- 清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。

## 验收后

验收批准后的候选下一步可能是分析 HTTP 400 原因、修正请求兼容性或继续灰度决策。它不是本轮已执行内容，未经产品负责人批准不得开始。
