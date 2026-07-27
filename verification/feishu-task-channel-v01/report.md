# 飞书渠道适配最小闭环 v0.1 验收报告

状态：`feishu_channel_implementation_passed_live_smoke_blocked_by_credentials_or_permissions`

## SDK 和连接方式

- 官方 SDK 包名：`@larksuiteoapi/node-sdk`
- 安装版本：`1.71.1`
- 实测导出：`WSClient`、`EventDispatcher`、`Client`
- 实测事件类型：`im.message.receive_v1`
- 实测发送接口：`client.im.v1.message.create`
- 连接方式：飞书长连接 WebSocket。
- 是否需要公网入站地址：不需要；长连接由本地客户端主动连接飞书开放平台。

## 已实现

- 新增 `scripts/feishu-task-channel.mjs`。
- 新增 `scripts/verify-feishu-task-channel.mjs`。
- 新增 npm scripts：`feishu-channel:start`、`feishu-channel:check`、`verify:feishu-channel`。
- 新增 `.env.example`，只包含变量名和说明，不包含真实值。
- 飞书层只负责接收命令、鉴权、解析、调用任务网关、回复状态和发送摘要。
- 任务执行仍由 `scripts/task-gateway.mjs` 负责。

## 权限和配对

- 支持 `FEISHU_ALLOWED_OPEN_IDS` allowlist。
- 支持一次性配对码 `/gateway pair <code>`，配对码只在本地终端显示，有效期 10 分钟，成功后立即失效。
- 未授权用户不能 create、approve、run、cancel、cleanup、logs 或 bind-report。
- 未授权回复不包含仓库路径、HEAD、日志或错误堆栈。

## 支持命令

- `/gateway help`
- `/gateway ping`
- `/gateway whoami`
- `/gateway status`
- `/gateway pair <code>`
- `/gateway bind-report`
- `/gateway unbind-report`
- `/task create`
- `/task show <task-id>`
- `/task approve <task-id>`
- `/task reject <task-id>`
- `/task run <task-id>`
- `/task status <task-id>`
- `/task logs <task-id>`
- `/task cancel <task-id>`
- `/task cleanup <task-id>`

## 自动测试

- `npm.cmd run verify:feishu-channel`：passed。
- 覆盖文本命令解析、非文本拒绝、授权、配对、配对过期、一次性配对、重复事件去重、忽略机器人消息、忽略群普通消息、群 @ 触发、报告群绑定、禁止任意 chat_id、started/completed/failed/blocked/cancelled 通知、通知去重、通知失败不改变任务结果、脱敏、长消息截断、prompt 不进群通知、不执行任意 shell、渠道关闭后不能创建任务、不调用 GPT/Hermes、不自动 push/deploy。

## 真实飞书 smoke

未执行。

原因：当前本机环境未配置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`，无法建立真实飞书长连接，也无法完成机器人配对、报告群绑定和真实消息发送。

本轮没有读取或输出任何飞书 App Secret、access token、Cookie、Authorization、朋友平台凭据或 AI Link 凭据。

## 边界

本轮没有调用 GPT、Hermes、子 Agent 或朋友平台数字员工；没有启动 v0.4.7 工作包 A/E/G；没有修改 Managed Proxy、Cloudflare、D1、Secret、预算、模型路由或生产环境；没有部署；没有创建 Release。
