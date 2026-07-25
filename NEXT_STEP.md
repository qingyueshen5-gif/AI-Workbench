# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收 version 13 的 1% 生产灰度。未经批准不得将 version 13 切换到 100%，不得发起新的主动真实模型调用。
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
- run1 唯一一次注册后一次性脚本在聊天前预算读取阶段崩溃；Token 未打印未持久化且不可恢复。
- 产品负责人确认 run1 根因为 Windows Node 子进程错误调用 `.cmd` 文件，并批准 run2 复用 version 13 重新执行一次独立注册和一次真实聊天。
- run2 已移除 Token 进程中的所有子进程调用；D1 查询全部由父级终端直接执行。
- run2 注册 HTTP 200，聊天 HTTP 200，provider model `deepseek-v4-flash`，回答 `OK`，`reasoning_content` 为空。
- run2 预算预留 23 micro-USD；平台总账 21/1 -> 44/2，`deepseek-v4-flash` 明细不存在 -> 23/1，历史 `deepseek-chat` 保持 21/1。
- 产品负责人已验收 version 13 DeepSeek V4 Flash 非思考真实 Preview 链路，并批准执行 version 13 的 1% 正常生产灰度。
- 本轮复用现有 version 13，未上传新 version，未修改 Worker 代码、Wrangler 配置、Secrets 或 D1 schema。
- active deployment 已更新为 `9952d7cb-2d99-483a-85f7-c9ada1a09db4`；旧稳定 version `16333442-925a-4b11-a3d1-d6249d2492ba` 当前承载 99%，version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f` 当前承载 1%。
- 已完成 20 分钟主动观察和 5 分钟指标缓冲；生产 `/health` 和 `/v1/models` 均保持 HTTP 200，version 13 Preview GET 检查保持 HTTP 200。
- 未观察到候选 version 的自然 invocation，状态为 `version13_one_percent_canary_observation_limited_by_low_traffic`。
- 本轮 Codex 未主动注册 installation、未主动发起聊天或真实模型调用；预算仍为平台 44/2、历史 `deepseek-chat` 21/1、`deepseek-v4-flash` 23/1。

## 为什么停在 version 13 的 1% 生产灰度验收

- 真实预算预留已验证，但 provider 成功返回因已退役上游模型名失败。
- 本轮已先执行生产风险收敛：旧稳定 version 100%，失败候选 version 0%。
- 本地修复保持客户端逻辑模型 `deepseek-chat` 兼容，内部路由到 `deepseek-v4-flash`。
- 预算明细新路径按实际计费模型 `deepseek-v4-flash` 记录，既有 `deepseek-chat` 21 micro-USD 历史行保留。
- version 12 已通过无付费 Preview，但缺少显式非思考模式，不能代表 `deepseek-chat` 历史语义完整兼容。
- 新非思考兼容 version 已上传并通过无付费 Preview 和真实 Preview 链路。
- 真实 Preview 验证只证明 version 13 在专属 Preview URL 上可注册、可调用 DeepSeek V4 Flash、可写入预算账本。
- version 13 已加入 active production deployment，但仅承载 1% 正常生产流量。
- 本轮未修改 Secrets 或 D1 schema，未发起新的主动注册或真实聊天。
- 观察窗口没有发现候选异常，但也没有捕获足够自然候选 invocation，不能写成全量完成。

## 本轮允许范围

当前只允许：

- 等待产品负责人验收 version 13 的 1% 生产灰度；
- 查阅 `verification/deepseek-v4-flash-nonthinking-real-preview/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-nonthinking-compatibility/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-worker-preview-upload/summary.json` 和 `report.md`；
- 查阅 `verification/deepseek-v4-flash-route-migration/summary.json` 和 `report.md`；
- 查阅 `verification/monthly-budget-worker-controlled-real-canary/summary.json` 和 `report.md`；
- 如产品负责人提出验收问题，只回答本轮证据范围内的问题。

禁止：

- 把新预算 Worker 切换到 100% 正常生产流量；
- 执行 `wrangler deploy`、新的 `wrangler versions upload` 或 `wrangler versions deploy`；
- 将 version 13 切换到 100%；
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

验收批准后的候选下一步可能是将 version 13 切换到 100% 或其他处理方案。它不是本轮已执行内容，未经产品负责人批准不得开始。
