# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人处理 DeepSeek V4 Flash 非思考真实 Preview 验证阻断。新 version 13 已上传但未加入 production deployment；本轮已消耗唯一一次注册且未执行真实聊天，未经批准不得第二次注册、不得发起真实模型调用、不得把新 version 加入 production deployment、不得切换 1% 或 100%。
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
- DeepSeek V4 Flash 路由迁移已在本地完成并通过测试。
- 新修复 Worker version `a7eb385b-84df-4a45-b554-0aca40b6b407` 已上传，version number 为 `12`，Preview alias 为 `budget-v4-flash-candidate`。
- 新修复 version 未加入 active production deployment，正常生产流量仍为 0%。
- Preview `/health` HTTP 200，`/v1/models` HTTP 200，未认证聊天 HTTP 401 `missing_token`。
- 本轮未注册 installation，未发起已认证聊天，未调用真实 provider，两张预算表仍保持 21 micro-USD / call_count 1。
- 产品负责人已验收第 3B-2b2e Worker Preview 上传验证通过。
- 付费验证前复核发现 version 12 未显式固定 `deepseek-chat` 的非思考语义；version 12 不用于付费真实验证。
- 本地已新增 `thinkingMode: "disabled"` 路由配置，服务端强制向上游发送 `thinking: { "type": "disabled" }`。
- 新非思考兼容 Worker version `cf002344-57ee-4c3f-86a6-115ca66c8b5f` 已上传，version number 为 `13`，Preview alias 为 `budget-v4-nt-real-candidate`。
- 新 version 未加入 active production deployment，正常生产流量为 0%。
- 无付费 Preview 安全门已通过，预算未变化。
- 唯一一次注册后一次性脚本在聊天前预算读取阶段崩溃；Token 未打印未持久化且不可恢复。
- 本轮真实聊天 0 次，provider 调用 0 次，预算预留 0；平台预算仍 21/1，历史 `deepseek-chat` 仍 21/1，无 `deepseek-v4-flash` 行。

## 为什么停在 DeepSeek V4 Flash 非思考真实 Preview 阻断

- 真实预算预留已验证，但 provider 成功返回因已退役上游模型名失败。
- 本轮已先执行生产风险收敛：旧稳定 version 100%，失败候选 version 0%。
- 本地修复保持客户端逻辑模型 `deepseek-chat` 兼容，内部路由到 `deepseek-v4-flash`。
- 预算明细新路径按实际计费模型 `deepseek-v4-flash` 记录，既有 `deepseek-chat` 21 micro-USD 历史行保留。
- version 12 已通过无付费 Preview，但缺少显式非思考模式，不能代表 `deepseek-chat` 历史语义完整兼容。
- 新非思考兼容 version 已上传并通过无付费 Preview，但真实 provider 成功链路尚未验证。
- 本轮唯一一次注册已被消耗；聊天前脚本崩溃导致 Token 不可恢复。
- 为遵守“一次且仅一次注册和一次真实模型调用”的批准边界，本轮不能第二次注册，不能继续真实聊天。
- 本轮未修改 Secrets 或 D1 schema，未改变生产流量，未发起真实模型调用。

## 本轮允许范围

当前只允许：

- 等待产品负责人处理 DeepSeek V4 Flash 非思考真实 Preview 验证阻断；
- 查阅 `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-nonthinking-compatibility/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-worker-preview-upload/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-route-migration/summary.json` 和 `report.md`；
- 查阅 `verification/monthly-budget-worker-controlled-real-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy`、新的 `wrangler versions upload` 或 `wrangler versions deploy`；
- 把新修复 version 13 加入 production deployment；
- 使用 version 12 发起付费真实验证；
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

验收批准后的候选下一步只能是产品负责人明确授权的新一轮单次注册/真实链路验证，或另行指定的处理方案。它不是本轮已执行内容，未经产品负责人批准不得开始。
