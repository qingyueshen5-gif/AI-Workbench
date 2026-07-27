# 本地 Codex 任务网关 v0.1 验收报告

状态：`local_gateway_and_real_codex_smoke_passed`

## 本轮修复

- 原阻塞：Windows 环境直接 `spawn('codex.cmd', ...)` 在进程创建前返回 `spawn EINVAL`。
- 根因：Node/Windows 不能可靠直接启动 `.cmd` shim。
- 修复：Windows `.cmd/.bat` 通过 `%ComSpec% /d /s /c call "codex.cmd" ...` 受控启动，`shell: false`，`windowsVerbatimArguments: true`。
- prompt 仍通过 stdin 传入，不放入命令行参数。
- `codex-cli 0.144.4 exec` 实测不支持 `--ask-for-approval`，已从网关调用契约移除；人工批准仍由任务网关状态机强制执行。
- 后置 Git 检查补充 per-call `safe.directory`，不修改全局 Git 配置。

## 测试结果

- `npm.cmd run verify:task-gateway`：passed。
- `npm.cmd run verify`：passed。
- 无模型 `codex.cmd --version`：passed，输出 `codex-cli 0.144.4`。
- 无模型 `codex.cmd exec --help`：passed。
- 新增 launcher fixture 覆盖 `.cmd`、绝对路径、带空格路径、cwd、stdin、stdout、stderr、正常退出码、非零退出码、超时/取消、shell 注入防护和 prompt 不进入命令日志。

## 真实 Codex smoke

- task_id：`real-readonly-smoke-20260727-windows-launch`
- baseline：`e94bfd02e6ffd7facee3bbddecc019410251c79c`
- 新增真实 Codex 调用次数：1
- Codex 进程：已启动
- Codex 输出：已捕获
- worktree：已创建并清理
- 文件修改：无
- commit：无
- push：无
- deploy：无
- scope violation：无
- auth/quota/billing/upstream 错误：无
- 费用状态：`unknown`

Codex 只读输出摘要：

- `git status --short --branch`：`## task-gateway/real-readonly-smoke-20260727-windows-launch`
- `git rev-parse HEAD`：`e94bfd02e6ffd7facee3bbddecc019410251c79c`
- `git rev-parse origin/main`：`28c7911a1966003863bf7636674956ffe0eaaf49`
- 顶层目录包含 `.github`、`agents`、`assets`、`electron`、`managed-proxy`、`scripts`、`src`、`verification` 等。
- `package.json` scripts 包含 `verify`、`task-gateway`、`verify:task-gateway`、`docs:generate-handoff`、`verify:docs-consistency` 等。

说明：真实 smoke 第一次固定 launcher 后已经得到正确只读输出；随后网关后置验收因 Git `safe.directory` 被标为 failed。该问题已在网关 Git helper 中修复，并通过自动测试验证；未再次调用真实 Codex。

## 边界

本轮没有接入飞书、Hermes、子 Agent 或生产环境；没有读取 AI Link、Codex、飞书或其他登录凭据；没有启动 v0.4.7 工作包 A/E/G；没有修改 Cloudflare、D1、Secret、预算、模型路由或生产流量；没有部署；没有创建 Release。
