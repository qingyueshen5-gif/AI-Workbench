# 本地 Codex 任务网关 v0.1 验收报告

状态：`local_gateway_passed_real_codex_smoke_blocked`

## 已完成

- 新增 `scripts/task-gateway.mjs`。
- 新增 `scripts/verify-task-gateway.mjs`。
- 新增 npm 命令 `task-gateway` 和 `verify:task-gateway`。
- 确认本机 Codex CLI：`codex-cli 0.144.4`。
- 确认正式非交互入口：`codex.cmd exec`。
- 支持 stdin、`--cd`、`--json`、`--sandbox`、`--ask-for-approval`、`--output-last-message` 和退出码。

## 网关能力

- 任务卡创建、查看、列表。
- 固定状态机。
- 人工批准 gate。
- 独立 branch 和 worktree。
- Codex adapter。
- stdout/stderr 捕获。
- 超时、取消和最大运行次数。
- 并发限制。
- 追加式 JSONL 事件账本。
- 日志脱敏。
- LocalCLIChannel 和 future FeishuChannel 边界。

## 测试结果

- `npm.cmd run verify:task-gateway`：passed。
- `npm.cmd run verify`：passed。
- 未批准任务运行：被拦截。
- baseline mismatch：blocked。
- quota/billing mock：正确分类。
- forbidden paths：正确拦截。
- cleanup：通过。

## 真实 Codex smoke

唯一真实只读 smoke：

- task_id：`real-readonly-smoke-20260727`
- baseline：`38fbc320e8ec24ac216704d70ab2c5c9cf68a86a`
- Codex 启动次数：1
- worktree：已创建并清理
- 文件修改：无
- push：无
- deploy：无
- scope violation：无
- 费用状态：`unknown`

结果：

- 在 Windows `.cmd` shim 进程启动阶段返回 `spawn EINVAL`。
- 未得到真实只读任务输出。
- 按“最多 1 次真实本地 Codex 任务”边界停止，没有第二次真实调用。
- 后续已将适配器改为通过 `cmd.exe /d /s /c codex.cmd` 启动，但本轮不再重跑真实 smoke。

## 边界

本轮没有接入飞书、Hermes、子 Agent 或生产环境；没有读取 AI Link、Codex、飞书或其他登录凭据；没有启动 v0.4.7 工作包 A/E/G；没有修改 Cloudflare、D1、Secret、预算、模型路由或生产流量；没有部署；没有创建 Release。
