# OpenClaw 健康体检报告

日期：2026-07-20

范围：只读诊断 OpenClaw 安装、命令、gateway、配置和日志；未启动、停止、修复任何 OpenClaw 进程。

## 1. `openclaw status` 为什么会超时？

结论：`openclaw status` 超时的直接原因是本地 gateway 不可达；健康检查疑似卡在 gateway/model/channel 探测阶段，没有在期望的 `--timeout 5000` 内干净退出。

证据：

- 全局 npm 安装可见：`openclaw@2026.3.28`。
- 显式 shim 可执行：`%USERPROFILE%\AppData\Roaming\npm\openclaw.cmd --version` 返回 `OpenClaw 2026.3.28 (f9b1079)`。
- `where.exe openclaw` 找不到命令，说明 PATH 里未暴露 `openclaw`，当前工作台 adapter 依赖显式 shim 才可靠。
- `openclaw status --json --timeout 5000` 在外层 20-30 秒限制下仍超时。
- `openclaw channels status --probe` 返回：
  - `Gateway not reachable; showing config-only status.`
  - `Gateway target: ws://127.0.0.1:18789`
  - `Source: local loopback`
  - gateway 关闭码为 `1006 abnormal closure`
- `netstat` 未观察到 `127.0.0.1:18789` 监听。

判断：

`status` 命令本身不是完全坏掉，因为 `--version` 可用、`channels status --probe` 能读配置并输出 config-only 状态。卡点更可能是 status 尝试连接本地 gateway 或继续探测模型/渠道时没有及时失败。

修复建议：

1. 不要把 `openclaw status --json --timeout 5000` 作为唯一健康检查。拆成：
   - `openclaw --version`
   - 端口 `127.0.0.1:18789` 是否监听
   - gateway websocket 是否可连
   - channels status config-only
   - model provider 轻量探测
2. AI Workbench adapter 对 OpenClaw status 外层保留硬超时，超时后返回“gateway 不可达/探测超时”，不要阻塞版本矩阵采集。
3. 经用户确认后再执行 gateway 重启或修复，不应在诊断阶段自动拉起。

## 2. OpenClaw 进程是否稳定？有没有崩溃/重启记录？

结论：当前证据显示 OpenClaw CLI 稳定存在，但 gateway 当前不在可用状态；日志里没有看到标准运行日志或崩溃栈，只看到配置健康/审计记录。审计记录显示 gateway 曾经在 2026-06-01 和 2026-06-04 读取过配置，说明当时至少启动过 gateway 进程。

证据：

- OpenClaw 版本命令正常：`OpenClaw 2026.3.28 (f9b1079)`。
- gateway 启动脚本存在：`%USERPROFILE%\.openclaw\gateway.cmd`，内容指向 Node 运行 `openclaw\dist\index.js gateway --port 18789`。
- 当前没有观察到 `18789` 监听。
- `%USERPROFILE%\.openclaw\logs` 中仅发现：
  - `config-health.json`
  - `config-audit.jsonl`
- `openclaw logs --tail 200` 不支持 `--tail`，返回 unknown option。
- `config-audit.jsonl` 显示 gateway 进程曾以 `gateway --port 18789` 读取配置。
- `config-health.json` 记录当前配置相对最后良好配置存在 size drop：
  - last known good: `11553` bytes
  - latest suspicious signature: `11553 -> 4120`

判断：

现有证据不足以证明 OpenClaw 是“频繁崩溃重启”，但可以证明：

1. gateway 当前不可达。
2. gateway 没有在预期端口保持监听。
3. 配置曾被改写且显著变小，OpenClaw 自身健康记录把这个视为可疑。
4. 缺少可读的 gateway runtime 日志，导致崩溃原因不可直接定位。

修复建议：

1. 先备份 `.openclaw/openclaw.json`、`.openclaw/openclaw.json.clobbered.*`、`.openclaw/logs`。
2. 对比当前配置和 last-known-good/clobbered 配置，确认是否误删了 gateway/channel/model 配置段。
3. 经用户确认后手动运行 gateway，并把 stdout/stderr 重定向到专用日志文件，观察是否启动后立即退出。
4. 在 AI Workbench 中增加 OpenClaw gateway log path 检测；没有日志时明确提示“无运行日志”，不要假装有崩溃栈。
5. 如果 token 曾经进入命令历史或日志，应考虑轮换相关渠道/API 凭证。

## 3. OpenClaw 依赖什么？哪个环节最容易挂？

| 依赖 | 当前证据 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| Node.js | gateway.cmd 调用 `C:\Program Files\nodejs\node.exe` | 中 | Node 路径变化或版本不兼容会导致 gateway 起不来。 |
| npm 全局包 | `openclaw@2026.3.28` 安装在 Roaming npm 全局目录 | 中 | `where openclaw` 找不到，PATH 不可靠；应使用显式 shim。 |
| OpenClaw 配置 | `.openclaw/openclaw.json` 存在，gateway mode 为 local，bind 为 loopback | 高 | 配置曾显著 size drop；这可能影响 provider/channel/gateway 行为。 |
| gateway 本地端口 | 目标 `ws://127.0.0.1:18789` | 高 | 当前无监听，是 status 超时和不可用的直接原因。 |
| 模型 provider | 配置里有 DeepSeek、SenseNova 等外部 provider | 高 | 当前未走 AI Workbench `18800`，不可统一熔断、降级、提示。 |
| 渠道 provider | 配置里启用 Feishu、Telegram | 中高 | 平台 API、账号、token、网络任一异常都可能让 channels probe 慢或失败。 |
| 外部网络 | 模型和渠道都需要外网/API 可达 | 高 | 网络或第三方服务抖动会放大为 OpenClaw 不可用。 |
| 日志体系 | 仅发现 config audit/health，缺 gateway runtime 日志 | 中 | 没有足够证据定位启动失败，需要补日志。 |

最容易挂的环节排序：

1. gateway 端口/进程：当前已经不可达，是直接故障。
2. OpenClaw 配置完整性：配置 size drop 被健康记录标为可疑。
3. 外部模型 provider：未收敛到 `18800`，故障无法由工作台统一处置。
4. 渠道连接：Feishu/Telegram 受平台和账号状态影响。
5. PATH/shim：不致命，但会让诊断和自动化脚本不稳定。

## 4. 分项结论与修复建议

### A. status 命令超时

结论：不是 OpenClaw 未安装，而是 status 依赖的 gateway/model/channel 探测卡住。

建议：

- 工作台 health check 改为分层探测，并给每项硬超时。
- status 超时要降级为“OpenClaw gateway 不可达”，不影响其他员工版本矩阵采集。

### B. gateway 不可达

结论：`127.0.0.1:18789` 当前没有监听，channels probe 也确认 gateway not reachable。

建议：

- 经确认后运行 `.openclaw\gateway.cmd` 或 `openclaw gateway --port 18789`，观察是否立即退出。
- 启动时记录 gateway stdout/stderr 到 `.openclaw/logs/gateway-runtime.log`。
- 增加 watchdog：端口不通时提示或按用户授权重启。

### C. 配置可疑变小

结论：OpenClaw 自身健康记录显示当前配置相对 last-known-good 明显变小。这个信号不能直接等同于损坏，但必须纳入排查。

建议：

- 对比 `openclaw.json` 与 `openclaw.json.clobbered.*`。
- 若缺关键段，先从 last-known-good 恢复到临时副本验证。
- 恢复前必须备份当前文件，避免丢失渠道绑定。

### D. 模型调用未纳入 AI Workbench 18800

结论：OpenClaw 当前仍用自己的外部 provider 配置，和 Workbench/Hermes 模型链路不一致。

建议：

- 把 OpenClaw provider 改为 OpenAI-compatible local provider：`http://127.0.0.1:18800/v1`。
- OpenClaw 只保存本地占位 token。
- provider key、模型下线检测、fallback 统一交给 `18800`。

### E. 渠道探测可能拖慢整体健康

结论：Feishu/Telegram 的平台状态不应阻塞 OpenClaw 安装/版本/gateway 基础健康。

建议：

- health check 输出分项：installed、gateway、models、channels。
- channels 默认使用短超时；失败不等同于 OpenClaw 不可用，只标记“渠道不可用”。

### F. PATH 不可靠

结论：`where openclaw` 找不到，但 Roaming npm shim 可用。

建议：

- adapter 保持显式 shim 解析。
- 版本矩阵采集记录 install path。
- 需要用户手动使用 CLI 时，再建议把 `%APPDATA%\npm` 加入 PATH。

## 5. 建议的下一步操作

1. 先不改配置，补一次 gateway 启动日志采集，确认是启动失败、端口占用、配置缺失还是依赖异常。
2. 对比 current config 与 clobbered/last-known-good，判断 size drop 是否正常。
3. 工作台 OpenClaw health check 拆分，避免 status 超时拖垮版本矩阵。
4. 规划 OpenClaw 模型 provider 收敛到 `18800`。
5. 需要修复时按“备份 -> 启动日志 -> 临时配置验证 -> 正式改配置”的顺序执行。
