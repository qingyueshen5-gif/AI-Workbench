# 飞书渠道适配 v0.1 人工配置清单

本清单用于 AI Workbench 自己控制的飞书企业自建应用。Codex 不代替产品负责人操作飞书开发者后台，不读取或保存 App Secret。

## 后台配置

1. 在飞书开放平台创建企业自建应用。
2. 开启应用机器人能力。
3. 获取应用的 App ID 和 App Secret，只保存到本机安全环境变量，不写入仓库。
4. 事件订阅方式选择长连接模式；长连接本地开发无需公网入站地址。
5. 添加事件：`im.message.receive_v1`，飞书后台名称通常显示为“接收消息 v2.0”。
6. 配置机器人接收单聊消息所需最小权限：获取用户发给机器人的单聊消息。
7. 配置群内控制所需最小权限：获取用户在群组中 @ 机器人的消息。
8. 配置机器人发送消息所需最小权限：`im:message:send_as_bot`。
9. 发布应用，使权限和事件配置生效。
10. 将机器人加入“工作台”群。

## 本地配置

1. 在本机环境变量中设置：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
2. 可选设置：
   - `FEISHU_ALLOWED_OPEN_IDS`
   - `FEISHU_DOMAIN`
   - `FEISHU_LOG_LEVEL`
3. 运行 `npm.cmd run feishu-channel:check`。
4. 运行 `npm.cmd run feishu-channel:start`。
5. 如果未配置 `FEISHU_ALLOWED_OPEN_IDS`，使用本地终端显示的一次性配对码，在机器人单聊发送 `/gateway pair <code>`。
6. 在“工作台”群中明确 @ 机器人并发送 `/gateway bind-report`。

## 真实闭环 smoke

1. 产品负责人在机器人私聊发送 `/gateway ping`。
2. 使用 `/task create` 创建只读任务。
3. 使用 `/task approve <task-id>` 批准任务；批准不能自动运行。
4. 使用 `/task run <task-id>` 启动任务。
5. 工作台群应收到 `started` 和最终 `completed` 或真实失败状态。
6. 检查 Codex 真实调用最多 1 次，`changed_files` 为空，无 commit、push、deploy 或生产变化。

## 禁止事项

- 不使用朋友平台现有飞书应用的 App ID 或 App Secret。
- 不把 App Secret、access token、Cookie、Authorization、Webhook 或真实消息正文写入仓库、日志或最终报告。
- 不申请读取整个群历史消息。
- 不让用户手工指定任意 `chat_id`。
- 不使用自定义 Webhook 代替应用机器人完整入口。
