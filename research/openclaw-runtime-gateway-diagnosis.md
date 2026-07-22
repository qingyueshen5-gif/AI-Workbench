# OpenClaw Gateway Runtime 深挖诊断

日期：2026-07-20

范围：不改主配置；直接调用 OpenClaw gateway 的 Node 入口，检查 `.openclaw` 下 lock/state/device/browser/channel 残留，并验证 gateway 是否能监听 `18789`。

## 1. 直接 Node 入口验证

直接入口：

```text
C:\Program Files\nodejs\node.exe %USERPROFILE%\AppData\Roaming\npm\node_modules\openclaw\dist\index.js gateway --port 18789
```

工作目录：

```text
%USERPROFILE%\.openclaw
```

### Trace 模式

日志目录：

```text
F:\AI-Workbench\evidence\openclaw-runtime\direct-20260720-185106
```

结果：

- 进程启动后未崩溃。
- 第 17 秒 `127.0.0.1:18789` 开始监听。
- stdout 关键日志：

```text
[gateway] feishu_doc: Registered feishu_doc, feishu_app_scopes
[gateway] feishu_chat: Registered feishu_chat tool
[gateway] feishu_wiki: Registered feishu_wiki tool
[gateway] feishu_drive: Registered feishu_drive tool
[gateway] feishu_perm: perm tool disabled in config (default: false)
[gateway] feishu_bitable: Registered bitable tools
[canvas] host mounted at http://127.0.0.1:18789/__openclaw__/canvas/
[heartbeat] started
[health-monitor] started
[gateway] agent model: custom-api-deepseek-com/deepseek-v4-pro
[gateway] listening on ws://127.0.0.1:18789, ws://[::1]:18789
```

### 普通模式

日志目录：

```text
F:\AI-Workbench\evidence\openclaw-runtime\direct-normal-20260720-185238
```

结果：

- 进程启动后未崩溃。
- 第 18 秒 `127.0.0.1:18789` 开始监听。
- stdout 关键日志：

```text
[gateway] feishu_doc: Registered feishu_doc, feishu_app_scopes
[gateway] feishu_chat: Registered feishu_chat tool
[gateway] feishu_wiki: Registered feishu_wiki tool
[gateway] feishu_drive: Registered feishu_drive tool
[gateway] feishu_bitable: Registered bitable tools
[canvas] host mounted at http://127.0.0.1:18789/__openclaw__/canvas/
[heartbeat] started
[health-monitor] started
[gateway] agent model: custom-api-deepseek-com/deepseek-v4-pro
[gateway] listening on ws://127.0.0.1:18789, ws://[::1]:18789
```

## 2. 结论：runtime 不是完全坏，启动较慢

之前判断“gateway 起不来”需要修正为：

> OpenClaw gateway 直接 Node 入口可以启动，但需要约 17-18 秒才开始监听 `18789`。之前 8-10 秒窗口的诊断会误判失败。

这也解释了为什么早期 `gateway-diagnostics` 和 `candidate-diagnostics` 会报告端口不可达：它们的采样窗口太短，且通过 shim/cmd 包装时日志采集不够直接。

## 3. 残留状态检查

新增脚本：

```text
npm.cmd run openclaw:runtime-inventory
```

输出：

```text
verification/openclaw-runtime/inventory.json
```

检查对象：

- `.lock`
- `.pid`
- `lock.json`
- `state*.json`
- `pending.json`
- `paired.json`
- `.tmp`
- `devices`
- `browser`
- `workspace` 下 OpenClaw 状态

结果：

- 未发现 `.openclaw` 根目录下 gateway pid/lock 僵尸文件。
- `devices\paired.json` 可解析。
- `devices\pending.json` 可解析。
- `workspace\.openclaw\workspace-state.json` 可解析。
- `workspace\.clawhub\lock.json` 可解析，结构包含 `skills`、`version`，更像 workspace/skills 状态锁，不是 gateway 进程锁。
- 发现若干 `.tmp`：
  - Chromium profile 下 JumpList/Network tmp
  - devices 下历史 tmp
  - cron jobs 原子写 tmp

判断：这些 tmp/cache/Chromium LOCK 文件不是 gateway 当前启动阻塞源。直接 Node gateway 已能监听，因此没有清理它们。

## 4. 本次是否清理残留

未清理。

原因：

1. 没有发现明确僵死的 gateway lock/pid。
2. state JSON 均可解析。
3. 直接 Node gateway 已经成功监听。
4. 清理 Chromium/browser/cache/tmp 可能影响后续浏览器自动化状态，收益不明确。

如果后续要做自动化清理，只建议清理“明确安全”的对象：

- `.openclaw\devices\*.tmp`
- `.openclaw\cron\*.tmp`

不建议自动清：

- browser profile 的 `LOCK`、LevelDB/SQLite cache、Chrome user-data
- workspace `.clawhub\lock.json`
- sessions/history

## 5. 对工作台的影响

当前工作台 OpenClaw health check 已经不再被 `openclaw status` 卡死，但 gateway 判断还要注意：

- 如果 gateway 没在运行，单纯检查 `18789` 会显示 closed，这是正确状态。
- 如果工作台要“启动并验证 gateway”，等待窗口至少应为 30-45 秒。
- `gateway_port` / `gateway_ws` 的即时探测适合判断“当前是否已运行”，不适合判断“能不能启动”。

## 6. 脚本修正

已调整：

- `scripts/openclaw-gateway-diagnostics.mjs`
  - 改为直接调用 OpenClaw Node 入口。
  - 默认 trace/uncaught/warnings 日志。
  - 端口采样窗口改为 45 秒。
- `scripts/openclaw-candidate-diagnostics.mjs`
  - 同样改为直接 Node 入口。
  - 端口采样窗口改为 45 秒。
- 新增 `scripts/openclaw-runtime-inventory.mjs`
  - 输出 runtime 残留盘点。

## 7. 下一步建议

建议下一步不是继续改配置，也不是清状态，而是：

1. 增加一个受控的 `openclaw:gateway-start` 或 watchdog：
   - 直接 Node 入口启动。
   - redirect stdout/stderr。
   - 等待 45 秒确认 `18789` 监听。
   - 成功后保持常驻。
2. 工作台 UI/health 中区分：
   - `installed`
   - `gateway_running`
   - `gateway_startable`
   - `channels`
   - `models`
3. 如果用户明确要自动修复，再加入最小残留清理：
   - 只清 `.tmp`；
   - 清前备份；
   - 不动主配置、不动 browser profile、不动 workspace lock。

本轮结论：OpenClaw gateway 可以直接启动，问题从“runtime 启动逻辑坏”收敛为“启动慢 + 诊断/health 等待窗口过短 + 没有常驻管理”。
