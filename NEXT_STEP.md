# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收第 3B-2b2d 阻塞恢复结果。未经批准不得将新预算 Worker 切换到 100% 流量，不得重试注册或发起真实模型调用。
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
- 第 3B-2b2d 段单笔真实预算链路验证已执行到调用前阻塞；阻塞恢复诊断已完成，当前等待产品负责人验收。

## 为什么停在 3B-2b2d 阻塞恢复验收

- 产品负责人已决定因 1% 灰度缺少自然请求样本，不直接切 100%，先尝试单笔受控真实预算链路验证。
- 本轮预留金额计算为 21 micro-USD，满足付费调用前门槛。
- 一次性临时脚本的唯一注册尝试未返回 HTTP 状态、未取得 Token，因此没有执行真实聊天请求。
- 本轮无付费诊断确认本地 Node 内置 fetch 未显式使用代理时连接超时，显式 ProxyAgent 后可取得 HTTP 响应。
- 由于未取得独立证据证明 version override 命中新预算 version，本轮没有进行第二次注册。
- 本轮未修改 Secrets、未修改 D1 schema、未调用真实 provider、未触发回滚。
- 100% 全量切换或重试真实调用都必须等待产品负责人验收本段并明确批准。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收第 3B-2b2d 阻塞恢复结果；
- 查阅 `verification/monthly-budget-worker-controlled-real-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy` 或新的 `wrangler versions deploy`；
- 修改 Worker 流量；
- 执行 rollback；
- 修改 Cloudflare Secrets；
- 调用真实模型；
- 重试注册；
- 注册测试安装；
- 写入预算表；
- 修改生产 D1；
- 自动进入 100% 全量切换、模型分层、上下文压缩或 v0.4.7；
- 自动进入首屏示例、反馈入口、安全告知、真实用户测试、手机端、完整多 Agent 调度或生态扩张；
- 删除文件、卸载软件、迁移活跃仓库或批量结束进程；
- 清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。

## 验收后

验收批准后的候选下一步可能是“处理注册阻塞后重试单笔真实预算链路”或“继续灰度决策”。它不是本轮已执行内容，未经产品负责人批准不得开始。
