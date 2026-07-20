# OpenClaw 配置缩水对比诊断

日期：2026-07-20

范围：只读对比 `C:\Users\胖胖虎\.openclaw\openclaw.json` 与 last-known-good 备份；未恢复、未改写 OpenClaw 配置。所有密钥、token、secret 仅记录长度/存在性，不记录原值。

## 1. 对比对象

| 文件 | 大小 | 行数 | 说明 |
| --- | ---: | ---: | --- |
| `openclaw.json` | 4120 bytes | 170 | 当前配置 |
| `openclaw.json.bak.3` | 11553 bytes | 170 | OpenClaw health 记录的 last-known-good 对应备份 |

`config-health.json` 记录：

- last-known-good：11553 bytes，observed at `2026-05-30T05:02:58.095Z`
- 当前可疑签名：`size-drop-vs-last-good:11553->4120`

## 2. 逐段对比结论

核心结论：没有发现 gateway、provider、feishu、agent defaults 这几类关键配置段缺失。文件大小从 11553 降到 4120，主要来自 OpenClaw CLI 重写配置时改变了 JSON 序列化格式，空格显著减少；不是大面积删除配置。

字符统计：

| 指标 | 当前配置 | last-known-good |
| --- | ---: | ---: |
| 字符数 | 4114 | 11544 |
| 行数 | 170 | 170 |
| 空格数 | 1320 | 8750 |
| 反斜杠数 | 8 | 8 |
| Unicode escape | 0 | 0 |

压缩后再比较：

- 当前配置压缩后：2631 chars
- last-known-good 压缩后：2462 chars
- 当前配置去掉后来新增的 `telegram` 后：2474 chars
- 去掉 `telegram` 后与 last-known-good 只差 12 chars，差异基本来自属性顺序/极小字段序列化差异。

### gateway

未发现关键字段缺失。

| 字段 | 当前 | last-known-good |
| --- | --- | --- |
| `port` | `18789` | `18789` |
| `mode` | `local` | `local` |
| `bind` | `loopback` | `loopback` |
| `auth.mode` | `token` | `token` |
| `auth.token` | 存在，长度 48 | 存在，长度 48 |
| `nodes.denyCommands` | 7 项 | 7 项 |

判断：gateway 配置段本身没有丢。当前 gateway 不可达，更像是 gateway 进程启动/运行失败，或者 OpenClaw runtime 依赖卡住，而不是 `gateway` JSON 段缺失。

### models / providers

未发现 provider 段缺失。

| provider | 当前 | last-known-good |
| --- | --- | --- |
| `custom-api-deepseek-com` | 存在 | 存在 |
| `custom-token-sensenova-cn` | 存在 | 存在 |

DeepSeek provider：

- `baseUrl` 均为 `https://api.deepseek.com/v1`
- API key 均存在，长度一致
- models 均为 2 个：
  - `deepseek-v4-flash`
  - `deepseek-v4-pro`

SenseNova provider：

- `baseUrl` 均为 `https://token.sensenova.cn/v1`
- API key 均存在，长度一致
- models 均为 1 个：
  - `sensenova-6.7-flash-lite`

判断：模型 provider 配置没有因 11553→4120 而丢失。现状问题不是 provider 段缺失，而是 OpenClaw 未接入 AI Workbench `18800`，且 models probe 当前会超时。

### channels

差异集中在 channel 增量，不是缺失。

| channel | 当前 | last-known-good |
| --- | --- | --- |
| `feishu` | 存在且 enabled | 存在且 enabled |
| `telegram` | 存在 | 不存在 |

Feishu：

- `appId` 存在，长度一致
- `appSecret` 存在，长度一致
- `enabled=true` 两边一致
- `connectionMode`、`dmPolicy`、`groupPolicy` 等字段存在

Telegram：

- 当前配置新增了 `telegram`
- `botToken` 存在，长度 46
- 审计日志显示该段来自 `openclaw channels add --channel telegram ...`

判断：channel 不是缺失，而是当前比 last-known-good 多了 Telegram。Telegram 可能让 channels probe 多一个外部平台依赖，但不是 11553→4120 的根因。

### agents / defaults

未发现关键字段缺失。

- `agents.defaults.model.primary` 当前与 last-known-good 均为 `custom-api-deepseek-com/deepseek-v4-pro`
- `agents.defaults.models` 均包含：
  - `custom-api-deepseek-com/deepseek-v4-flash`
  - `custom-api-deepseek-com/deepseek-v4-pro`
  - `custom-token-sensenova-cn/sensenova-6.7-flash-lite`
- `agents.defaults.workspace` 均指向 `.openclaw\workspace`

判断：默认模型曾被改到 `xai/grok-4`，随后又改回 DeepSeek；当前 defaults 已回到 DeepSeek，不是配置缺失状态。

## 3. 为什么会缩水？

审计日志直接给出了触发源。

### 第一次缩水

时间：`2026-06-01T04:32:39.986Z`

事件：

```text
openclaw config set agents.defaults.model.primary xai/grok-4
```

结果：

```text
previousBytes: 11553
nextBytes: 3883
suspicious: size-drop:11553->3883
```

紧接着 gateway 读取该配置：

```text
gateway --port 18789
bytes: 3883
suspicious: size-drop-vs-last-good:11553->3883
```

### 后续改写

时间：`2026-06-01T04:34:14.421Z`

事件：再次执行同一个 `config set agents.defaults.model.primary xai/grok-4`，大小保持 3883。

时间：`2026-06-01T05:22:22.686Z`

事件：

```text
openclaw config set agents.defaults.model.primary custom-api-deepseek-com/deepseek-v4-pro
```

结果：3883 → 3912。

时间：`2026-06-04T14:16:27.626Z`

事件：

```text
openclaw channels add --channel telegram ...
```

结果：3912 → 4120。

### AI Link / watchdog 排查

已检查：

- AI Workbench 自己的 `scripts/ai-workbench-watchdog.ps1`：只检查/启动 `18800`、`8787`、`5173`，没有 `.openclaw` 或 `openclaw.json` 写入逻辑。
- AI Link 安装目录和用户数据目录中，未搜到针对 `.openclaw`、`openclaw.json`、`18789` 的写入命中。
- `C:\Users\胖胖虎\ai-workers` 下未发现 AI Link watchdog 脚本包含 `.openclaw`/`openclaw.json` 写入逻辑。
- OpenClaw `config-audit.jsonl` 记录的写入源均为 OpenClaw 自己的 CLI：`openclaw.mjs config set` 和 `openclaw.mjs channels add`。

当前进程中可见 AI Link 和 AI Workbench 进程，但没有证据显示它们正在持续改写 OpenClaw 配置。

## 4. 判断

更像“一次性/少数几次 OpenClaw CLI 正常改写造成的 size-drop 告警”，不是外部程序持续破坏。

理由：

1. 缩水发生在明确的 OpenClaw CLI 写操作之后，而不是未知进程。
2. 11553→3883 之后，多次 gateway read 只是记录 suspicious，没有继续扩大破坏。
3. 当前配置的 gateway、providers、feishu、agent defaults 关键段仍完整。
4. 当前与 last-known-good 行数相同，差异主要是空格数：8750 → 1320。
5. 去掉新增 telegram 后，压缩 JSON 长度只差 12 个字符。

但仍需注意：

- OpenClaw 自己把 size drop 标记为 suspicious，说明其 health 机制不信任这次重写。
- gateway 仍不可达，不能排除 OpenClaw runtime 对当前配置格式、某个 provider/channel、或本地 state 有其他运行期问题。
- 如果恢复配置，必须先备份当前 Telegram 配置，否则会丢失后来新增的 Telegram channel。

## 5. 两个可选方案

### 方案 A：直接用完整备份恢复配置

含义：把 `openclaw.json.bak.3` 直接恢复成当前 `openclaw.json`。

步骤：

1. 再备份当前 `openclaw.json`、`openclaw.json.bak*`、`openclaw.json.clobbered.*`、`logs`。
2. 停止可能正在运行的 OpenClaw gateway。
3. 将 `openclaw.json.bak.3` 复制为 `openclaw.json`。
4. 启动 gateway 并采 stdout/stderr。
5. 跑六项 health check。

收益：

- 最接近 OpenClaw 自己记录的 last-known-good。
- 能快速验证 size-drop 是否真是 gateway 不可达原因。

风险：

- 会丢失 2026-06-04 后新增的 Telegram channel 配置。
- 如果 last-known-good 中有旧模型/旧状态，可能回退到旧行为。
- 如果问题不在配置，而在 gateway runtime/依赖，恢复后仍可能不可达。

适用场景：

- 你想优先验证“是不是 size-drop 配置导致 gateway 不可达”。
- 可以接受先丢 Telegram，后续再补。

### 方案 B：基于备份重建一份干净配置

含义：不直接覆盖，而是以 `openclaw.json.bak.3` 为基准，合并当前新增但有价值的字段，例如 Telegram；同时保持格式干净、字段明确。

步骤：

1. 再备份当前所有 `.openclaw` 配置。
2. 生成临时候选配置 `openclaw.json.candidate`。
3. 从 last-known-good 继承：
   - gateway
   - providers
   - feishu
   - agents.defaults
   - workspace/session/tools/plugins/commands
4. 从当前配置合并：
   - Telegram channel
   - 后续确认仍需要的新增字段
5. 对 candidate 做 JSON parse、字段完整性检查、敏感字段存在性检查。
6. 用 candidate 临时启动 gateway 做诊断。
7. 确认通过后再决定是否替换正式 `openclaw.json`。

收益：

- 不丢 Telegram。
- 能避免把旧配置里的历史包袱全部带回来。
- 更符合“平台品控”：先生成候选、验证，再替换。

风险：

- 工作量比 A 大。
- 如果 OpenClaw 有隐藏字段或字段顺序依赖，需要额外验证。
- 仍不能解决 runtime/依赖层故障，只能排除配置层问题。

适用场景：

- 你想保留当前新增 channel。
- 你希望把 OpenClaw 配置整理成可解释、可回滚的干净状态。

## 6. 建议选择

建议先选方案 B。

原因：这次 11553→4120 并没有证明关键配置丢失，直接恢复方案 A 可能只是在回退格式，同时丢掉 Telegram。更稳的路径是先生成 candidate，做离线结构校验和 gateway 临时启动诊断。如果 candidate 仍然启动不了，就说明问题更可能在 OpenClaw gateway runtime、依赖、channel/model probe，而不是配置缩水本身。

如果你只是想最快验证 last-known-good 能不能让 gateway 活过来，可以选方案 A，但执行前必须确认是否接受 Telegram 配置回退。
