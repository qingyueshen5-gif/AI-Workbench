# 多平台连接实施方案

日期：2026-07-19

目标：把工作台从“只在桌面聊天框可用”扩展成“桌面端总控 + 多平台消息通道接入”。用户只看到“连接微信 / 连接飞书 / 连接 Telegram”按钮，扫码或授权后即可在手机端发消息，工作台在电脑上调度 Hermes、OpenClaw 等员工执行，再把结果回传到原消息平台。

## 1. 总体判断

可行方向已经被 AI Link 证明：手机端交互不是做移动 App，也不是远程投屏桌面 UI，而是让消息平台进入本机 gateway。微信、飞书、Telegram 都应被视为“消息通道 adapter”，真正的理解、调度、执行仍由 AI Workbench 核心负责。

推荐架构：

```text
微信 / 飞书 / Telegram
        |
        v
channel adapter
        |
        v
AI Workbench channel gateway
        |
        v
统一聊天入口 / Function Calling 调度
        |
        v
Hermes / OpenClaw / DeepSeek / 其他员工
        |
        v
channel adapter 回传结果
```

原则：

- 桌面端是总控，负责绑定、凭证保存、状态展示、进程守护和升级。
- 通道层只负责收发消息和身份映射，不直接决定任务怎么做。
- 凭证只保存在本机运行目录，前端和日志不展示 token / secret。
- 每个平台必须有统一状态机：未连接、等待扫码、已扫码待确认、已连接、已过期、异常、重连中。
- 用户零配置：不让用户填 app_id、secret、webhook、端口、命令行。

## 2. 微信接入

### 2.1 技术可行路径

本仓库 `research/ai-link-analysis.md` 已确认 AI Link 的微信路径：

- 绑定脚本是 `resources\worker-assets\scripts\weixin_bind.py`。
- `begin` 调用 Hermes 微信平台接口，参数包括 `ILINK_BASE_URL`、`EP_GET_BOT_QR`、`bot_type=3`。
- 生成 iLink bot 二维码，状态写入 `HERMES_HOME\pairing\aiw_weixin_qr_state.json` 和 `aiw_weixin_qr.png`。
- `poll` 调用 `EP_GET_QR_STATUS`，处理 `wait`、`scaned_but_redirect`、`confirmed`、`expired`。
- confirmed 后取得 `ilink_bot_id`、`bot_token`、`baseurl`、`ilink_user_id`。
- 写入 Hermes 账号文件和 `.env`：`WEIXIN_ACCOUNT_ID`、`WEIXIN_TOKEN`、`WEIXIN_BASE_URL`、`WEIXIN_DM_POLICY`、`WEIXIN_GROUP_POLICY`、可选 `WEIXIN_HOME_CHANNEL`。
- gateway 读取这些凭证后启动 `hermes gateway run`，平台消息进入 Hermes gateway。

这说明微信接入不是完全从零开始。可行路线有两条：

1. 复用 AI Link / Hermes 的微信绑定机制。
   - 优点：已有扫码、轮询、账号文件、gateway 经验。
   - 难点：确认 AI Link 的 iLink 后端接口是否允许 AI Workbench 使用；确认 Hermes 当前安装版是否暴露同等微信 platform adapter。

2. 通过 OpenClaw 做微信通道。
   - 当前 OpenClaw 员工能力表已有 `mobile_channel`、`chat_channel`、`gateway`，但本仓库现有定义里列出的具体平台是飞书、Telegram、Discord、Slack，未明确写微信。
   - 本轮只读执行 `openclaw status --json --timeout 5000` 超时，不能把 OpenClaw 微信能力视作已验证事实。
   - 结论：OpenClaw 可作为未来通道网关候选，但微信第一版更应先验证 Hermes / AI Link 路径。

当前判断：

- Hermes / AI Link 微信路径：技术上最接近可复用。
- OpenClaw 微信路径：需要先跑 `openclaw status` 和通道插件清单确认，不能直接承诺。

### 2.2 扫码绑定流程

用户流程必须是：

1. 用户打开工作台，点击“连接微信”。
2. 工作台调用后端 `/api/channels/weixin/begin`。
3. 后端启动或调用 `weixin_bind.py begin` 等价逻辑。
4. 后端拿到二维码图片或二维码 URL，写入本机运行目录：
   - `runtime/channels/weixin/pairing-state.json`
   - `runtime/channels/weixin/qr.png`
5. 前端弹出二维码，不显示任何技术字段。
6. 用户用手机微信扫码。
7. 前端每 2 秒调用 `/api/channels/weixin/poll`。
8. 状态变化：
   - `waiting`：继续显示二维码。
   - `scanned`：提示“已扫码，请在手机上确认”。
   - `redirected`：后端切换 base_url 后继续轮询，用户无感。
   - `confirmed`：后端保存凭证并重启通道 gateway。
   - `expired`：提示“二维码过期，点这里重新生成”。
9. confirmed 后前端显示“微信已连接”，同时展示最后健康检查时间。

凭证保存：

- 保存到工作台运行目录，而不是仓库目录。
- 推荐路径：`%APPDATA%\ai-workbench\channels\weixin\account.json` 和 `.env` 风格密钥文件。
- token / base_url / account_id 不进入 UI、不进入普通日志、不进入 git。

### 2.3 消息双向

消息进入：

1. 微信私聊或允许的群聊收到消息。
2. 微信 adapter / Hermes gateway 把消息转成统一入站事件：

```json
{
  "channel": "weixin",
  "conversationId": "weixin:dm:<target>",
  "sender": {
    "platformUserId": "...",
    "displayName": "..."
  },
  "text": "帮我打开腾讯页面",
  "receivedAt": "2026-07-19T..."
}
```

3. 工作台写入 channel inbox。
4. 工作台复用现有 `/api/chat-message` 的 Function Calling 调度，不为微信另写一套理解层。
5. 如果是电脑操作，派 Hermes / OpenClaw；如果是当前信息，走 `web_search`；纯知识走 DeepSeek。

结果回传：

1. 执行完成后生成中文结果。
2. 通道层按原始 `channelMessageId` 或 `conversationId` 找回微信会话。
3. 调用微信 adapter `sendMessage()` 回传。
4. 如果任务较长，先回传进度：`已收到，我正在让 Hermes 执行。`
5. 失败时回传人话原因和建议，不回传 traceback。

### 2.4 风险与限制

微信是最高风险通道，必须如实标注：

- 微信个人号自动化、非官方 Web 协议、bot 中转服务都可能违反微信平台规则。
- 可能出现扫码失败、频繁掉线、消息收发延迟、风控、限制登录、甚至账号封禁。
- 如果依赖 AI Link / iLink 后端，本质上还依赖第三方服务可用性和政策变化。
- 企业微信 / 微信客服 / 公众号等官方路径更合规，但能力、触达方式和用户体验不同，不一定能做到“用户个人微信扫码即用”。
- 第一版建议默认只开私聊，不开放群聊；群聊必须默认 require mention，且限制允许名单。
- 禁止自动发送敏感内容、批量群发、营销、骚扰、账号安全操作。

建议产品呈现：

- “微信连接”为实验能力。
- UI 明示“该能力依赖微信平台策略，可能需要重新扫码或失效”。
- 默认低频、私聊、单用户绑定，不做群控和批量消息。

## 3. 飞书接入

### 3.1 最短路径

飞书是地基最近、最快可落地的平台。

依据：

- OpenClaw 员工能力表已包含 `feishu`、`chat_channel`、`gateway`。
- AI Link 报告显示飞书绑定模式清晰：`feishu_bind.py begin/poll`，拿 `device_code`、`qr_url`、`interval`、`expire_in`，confirmed 后写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_DOMAIN`、`FEISHU_CONNECTION_MODE=websocket`。
- 飞书有更明确的企业应用授权和 websocket 连接模式，合规性通常比个人微信协议更好。

最短实现：

1. 先确认本机 OpenClaw 飞书通道健康：
   - `openclaw status --json --timeout 30000`
   - 查看 `channelSummary` 是否包含 feishu。
   - 如果 status 慢或超时，先修 gateway 健康检查和超时策略。
2. 新增工作台后端 channel API：
   - `POST /api/channels/feishu/begin`
   - `GET /api/channels/feishu/poll`
   - `POST /api/channels/feishu/restart`
   - `GET /api/channels/feishu/status`
3. 后端优先调用 OpenClaw 现有飞书通道；如果 OpenClaw 缺少绑定命令，则复刻 AI Link 的 `feishu_bind.py` 状态机。
4. confirmed 后写入运行目录并重启 OpenClaw gateway。
5. 收到飞书消息后转成统一入站事件，调用工作台 `/api/chat-message` 或内部同等函数。
6. 将执行结果通过飞书 adapter 发回原会话。

### 3.2 扫码零配置流程

用户流程：

1. 点击“连接飞书”。
2. 工作台显示二维码或飞书授权 URL。
3. 用户扫码/授权。
4. 工作台显示“绑定中”。
5. 绑定完成后显示 bot 名称、连接状态、接收范围。

默认策略：

- 单聊默认开放。
- 群聊默认关闭。
- 如果开启群聊，默认必须 @ 工作台。
- 管理员/用户不需要填写 App ID 或 Secret；这些由绑定流程写入本机凭证。

## 4. Telegram 接入

Telegram 本轮不是第一优先，但适合做通道抽象验证。

原因：

- OpenClaw 能力表已有 `telegram`。
- Telegram bot API 相对稳定，封号/风控风险低于个人微信协议。
- 缺点是国内用户使用门槛高，不适合作为用户第一优先入口。

建议：

- 作为第二阶段验证 adapter 抽象的样板。
- 如果 OpenClaw Telegram 已配好，可先接 `receiveMessage/sendMessage/status`，但 UI 主入口仍优先放微信和飞书。

## 5. 统一通道抽象

工作台核心不应认识微信、飞书、Telegram 的协议细节。新增平台只加 adapter。

### 5.1 Channel Adapter 接口

```ts
interface ChannelAdapter {
  id: 'weixin' | 'feishu' | 'telegram';
  displayName: string;
  beginBind(): Promise<BindState>;
  pollBind(bindId: string): Promise<BindState>;
  activate(bindId: string): Promise<ChannelStatus>;
  healthCheck(): Promise<ChannelStatus>;
  receive(event: RawPlatformEvent): Promise<InboundMessage>;
  sendMessage(target: ChannelTarget, message: OutboundMessage): Promise<SendResult>;
  restart(): Promise<ChannelStatus>;
  disconnect(): Promise<void>;
}
```

### 5.2 统一数据结构

`channels`：

```json
{
  "id": "weixin",
  "status": "connected",
  "displayName": "微信",
  "bindState": "confirmed",
  "lastHealthCheckAt": "",
  "lastMessageAt": "",
  "gatewayPid": null,
  "credentialRef": "channels/weixin/account.json",
  "capabilities": ["dm", "group_optional", "qr_bind"]
}
```

`channel_targets`：

```json
{
  "id": "weixin:dm:xxx",
  "channelId": "weixin",
  "type": "dm",
  "displayName": "用户微信",
  "policy": {
    "enabled": true,
    "requireMention": false,
    "allowExecuteComputerActions": true
  }
}
```

`channel_messages`：

```json
{
  "id": "msg-...",
  "channelId": "feishu",
  "targetId": "feishu:dm:...",
  "direction": "inbound",
  "text": "帮我看看C盘空间",
  "taskId": "",
  "runId": "",
  "status": "processed",
  "createdAt": ""
}
```

### 5.3 后端 API

- `GET /api/channels`
- `POST /api/channels/:id/begin-bind`
- `GET /api/channels/:id/bind-status?bindId=...`
- `POST /api/channels/:id/restart`
- `POST /api/channels/:id/disconnect`
- `GET /api/channels/:id/health`
- `POST /api/channels/:id/inbound`

`/inbound` 可以先只允许本机 gateway 访问：`127.0.0.1` + 本机 token。

### 5.4 和现有聊天入口的关系

不要给通道单独写一套大脑。通道消息进入后，统一调用工作台内部函数：

```text
handleUserMessage({
  source: 'channel',
  channelId,
  targetId,
  userText
})
```

这个函数复用桌面聊天框同一套 Function Calling 调度和执行验证。这样“微信里说帮我打开腾讯页面”和“桌面聊天框说帮我打开腾讯页面”行为一致。

## 6. 零门槛落地体验

用户看到：

1. 左侧或设置页出现“多平台连接”。
2. 卡片：
   - 微信：连接 / 重新扫码 / 断开
   - 飞书：连接 / 重新授权 / 断开
   - Telegram：连接 / 断开
3. 用户点击“连接微信”。
4. 弹二维码。
5. 用户扫码。
6. 状态变成“已连接”。
7. 页面给一个测试入口：“在微信发一句：帮我看看C盘还剩多少空间”。
8. 工作台收到后自动执行并回微信。

用户不需要知道：

- Hermes gateway
- OpenClaw gateway
- app_id / secret
- `.env`
- webhook
- 端口
- token

## 7. 最小可用版建议

### 7.1 最小闭环定义

第一版只做一个平台、一个方向闭环：

```text
手机发消息 -> 工作台收到 -> 电脑执行 -> 结果回手机
```

不做：

- 群聊复杂权限
- 多用户团队管理
- 富文本卡片
- 文件/图片消息
- 语音消息
- 主动定时推送

### 7.2 推荐优先级

推荐先做飞书 MVP，再做微信。

原因：

- 飞书绑定和 websocket 模式更规范，封号风险低。
- OpenClaw 已声明支持飞书能力，AI Link 也有清晰绑定状态机可参考。
- 飞书通道可先验证统一 adapter、gateway、inbound/outbound、状态机和 UI 体验。
- 微信作为用户第一优先，但政策和账号风险更高，适合在通道层稳定后接入。

如果产品必须先微信：

- 先做微信私聊单用户实验版。
- 明确标注实验能力。
- 默认不开群聊。
- 先复用 AI Link / Hermes 的 `weixin_bind.py` 机制，确认账号不泄漏、日志脱敏、重启恢复可用后再扩大。

### 7.3 工作量预估

飞书单向 MVP：

- OpenClaw/飞书健康确认和命令封装：0.5-1 天。
- `channels` 数据结构和后端 API：1 天。
- 飞书绑定 begin/poll/restart 状态机：1-2 天。
- gateway inbound -> 工作台聊天调度：1 天。
- outbound 回传飞书：0.5-1 天。
- 前端“连接飞书”二维码/状态 UI：1 天。
- 验收、日志脱敏、失败自愈：1 天。

合计：5-7 天。

微信单向 MVP：

- 确认 Hermes / AI Link 微信接口是否可复用：1-2 天。
- 复刻/封装 `weixin_bind.py` begin/poll/confirmed：1-2 天。
- 凭证保存、gateway restart、健康检查：1-2 天。
- inbound/outbound 私聊闭环：1-2 天。
- 前端“连接微信”二维码/状态 UI：1 天。
- 风险提示、限频、私聊白名单、日志脱敏：1 天。
- 真实账号稳定性测试：2-3 天。

合计：8-12 天。

统一通道抽象基础：

- Adapter 接口、状态表、消息表、通道 API：2-3 天。
- 如果和飞书 MVP 一起做，可重叠，不额外全量增加。

## 8. 里程碑

### M1：通道地基

- 新增 `channels` / `channel_targets` / `channel_messages`。
- 新增 channel adapter 接口。
- 新增前端“多平台连接”入口。
- OpenClaw status 超时问题单独体检，确认飞书/Telegram 当前可用性。

### M2：飞书 MVP

- “连接飞书”扫码。
- 手机飞书发：“帮我看看C盘还剩多少空间”。
- 工作台派 Hermes 查询。
- 结果回飞书。

验收：

- 二维码生成。
- 扫码确认。
- 通道状态 connected。
- 手机消息入站记录可查。
- 电脑执行 run 记录 verified。
- 飞书收到中文结果。

### M3：微信实验版

- “连接微信”扫码。
- 微信私聊发：“帮我打开腾讯页面”。
- 工作台执行并回传结果。

验收：

- 二维码生成。
- 扫码确认。
- 凭证写入运行目录。
- gateway connected。
- 微信私聊入站。
- 执行结果回微信。
- 日志不出现 token / secret。

### M4：通道自愈

- 启动时自动检查通道。
- 掉线自动重启 gateway。
- 二维码过期自动提示重新扫码。
- 回传失败自动重试。
- 通道异常在 UI 用人话解释。

## 9. 关键风险清单

- 微信政策风险：个人微信自动化可能被限制或封号。
- 第三方依赖风险：如果复用 iLink 后端，服务变化会影响绑定。
- OpenClaw 状态不确定：本轮 `openclaw status --json --timeout 5000` 超时，实施前必须专项修复或提高超时并确认 gateway 健康。
- 凭证安全：token / secret 必须只存在本机运行目录，日志脱敏。
- 多入口一致性：桌面、微信、飞书都必须走同一套 Function Calling 调度，避免三套行为不一致。
- 用户误触风险：手机端发出的电脑操作指令会真实执行，需沿用工作台高风险边界；删除、付费、发消息给他人、账号权限修改仍需确认。

## 10. 结论

最稳路线：

1. 先做统一通道抽象。
2. 先用飞书打通单向 MVP，因为 OpenClaw/AI Link 线索更成熟、合规风险低。
3. 微信作为用户第一优先入口并行调研 Hermes / AI Link 复用路径，但第一版限定私聊、单用户、实验能力。
4. 所有通道都只做 adapter，工作台核心继续只认统一消息事件和统一员工调度。

最终产品体验应保持一句话：用户在工作台点“连接微信”，扫二维码，然后就能在微信里说“帮我看看C盘还剩多少空间”，工作台自动在电脑上执行，并把数字发回微信。
