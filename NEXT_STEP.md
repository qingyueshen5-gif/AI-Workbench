# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收 DeepSeek V4 Flash 路由迁移本地候选。未经批准不得上传或部署新 Worker version，不得发起新的真实模型调用。
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
- 第 3B-2b2d 段候选 Preview 单笔真实预算链路已执行，真实聊天返回 HTTP 400，预算预留已写入；产品负责人已确认根因为旧 DeepSeek 上游模型名退役。
- 已将已知失败候选流量撤回到 0%，旧稳定 Worker 恢复 100%。
- DeepSeek V4 Flash 路由迁移已在本地完成并通过测试，尚未上传或部署。

## 为什么停在 DeepSeek V4 Flash 路由迁移本地候选验收

- 真实预算预留已验证，但 provider 成功返回因已退役上游模型名失败。
- 本轮已先执行生产风险收敛：旧稳定 version 100%，失败候选 version 0%。
- 本地修复保持客户端逻辑模型 `deepseek-chat` 兼容，内部路由到 `deepseek-v4-flash`。
- 预算明细新路径按实际计费模型 `deepseek-v4-flash` 记录，既有 `deepseek-chat` 21 micro-USD 历史行保留。
- 本轮未上传新 Worker version，未部署生产修复，未修改 Secrets 或 D1 schema，未发起新的真实模型调用。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收 DeepSeek V4 Flash 路由迁移本地候选；
- 查阅 `verification/deepseek-v4-flash-route-migration/summary.json` 和 `report.md`；
- 查阅 `verification/monthly-budget-worker-controlled-real-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy`、`wrangler versions upload` 或新的 `wrangler versions deploy`；
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

验收批准后的候选下一步可能是上传新候选、Preview 验证或重新执行最多一笔真实链路验证。它不是本轮已执行内容，未经产品负责人批准不得开始。
