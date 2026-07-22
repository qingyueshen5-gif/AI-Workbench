# OpenClaw Candidate 配置 Gateway 启动验证

日期：2026-07-20

范围：按方案 B 生成 candidate 配置并临时启动 OpenClaw gateway 验证。未正式替换 `%USERPROFILE%\.openclaw\openclaw.json`；测试后已还原当前配置。

## 1. Candidate 生成方式

来源：

- 基底：`%USERPROFILE%\.openclaw\openclaw.json.bak.3`，即 OpenClaw health 记录的 11553 bytes last-known-good。
- 合并项：当前 `openclaw.json` 中新增的 `channels.telegram`。
- 输出：`%USERPROFILE%\.openclaw\openclaw.json.candidate`

candidate 不提交到 Git，因为其中含渠道和 provider 凭证。仓库只提交脱敏 summary。

生成结果：

- candidate 大小：4098 bytes
- Feishu：存在
- Telegram：存在
- gateway：
  - `port=18789`
  - `mode=local`
  - `bind=loopback`
  - `auth.mode=token`
  - auth token 存在
- providers：
  - `custom-api-deepseek-com`
  - `custom-token-sensenova-cn`
- primary model：`custom-api-deepseek-com/deepseek-v4-pro`

离线校验结果：通过，未发现缺失字段。

## 2. 启动验证过程

脚本：

```text
npm.cmd run openclaw:candidate-diagnostics
```

脚本行为：

1. 备份当前 `openclaw.json` 和 last-known-good。
2. 生成 `openclaw.json.candidate`。
3. 临时把 candidate 复制为 `openclaw.json`。
4. 启动 `.openclaw\gateway.cmd`。
5. 连续 25 秒采样 `127.0.0.1:18789`。
6. 采集 gateway stdout/stderr。
7. 杀掉本次诊断启动的 gateway 进程。
8. 还原原始 `openclaw.json`。

本次备份：

```text
F:\AI-Workbench\evidence\openclaw-candidate-backups\2026-07-20T10-38-52-313Z
```

本次 gateway 日志：

```text
F:\AI-Workbench\evidence\openclaw-candidate\2026-07-20T10-38-52-313Z\gateway.stdout.log
F:\AI-Workbench\evidence\openclaw-candidate\2026-07-20T10-38-52-313Z\gateway.stderr.log
```

脱敏 summary：

```text
verification/openclaw-candidate/summary.json
```

## 3. 启动结果

结果：gateway 未成功监听 `18789`。

端口采样：

- 启动前：`connect ECONNREFUSED 127.0.0.1:18789`
- 启动后第 1-25 秒：全部 `connect ECONNREFUSED 127.0.0.1:18789`
- 25 秒后：仍未监听

进程状态：

- `gateway.cmd` 启动成功，获得 pid。
- 25 秒采样结束时进程仍未主动退出。
- 诊断脚本按设计杀掉该进程，避免留下后台 gateway。

stdout/stderr：

- stdout：空
- stderr 只有：

```text
Config observe anomaly: %USERPROFILE%\.openclaw\openclaw.json (size-drop-vs-last-good:11553->4098)
```

没有出现 `Config invalid`，也没有 Node 崩溃栈。

## 4. 中间修正记录

第一次 candidate 生成时，脚本往 `meta` 写入了：

- `candidateGeneratedAt`
- `candidateSource`

OpenClaw schema 不接受这两个额外字段，gateway stderr 报：

```text
Config invalid
Problem:
  - meta: Unrecognized keys: "candidateGeneratedAt", "candidateSource"
```

已修正：candidate 现在不再添加任何 OpenClaw schema 未认可的字段。修正后 candidate 通过离线结构校验，gateway 也不再报 `Config invalid`。

## 5. 判断

candidate 配置是可解析、字段完整、schema 未报错的，但 gateway 仍无法在 25 秒内监听 `18789`。

因此当前判断：

1. OpenClaw 不可用的主因不再指向“配置缺关键段”。
2. `11553 -> 4098/4120` 仍会触发 OpenClaw 的 size-drop anomaly，但它不是 gateway 启动失败的直接 schema 错误。
3. gateway 进程能启动但卡在监听前，问题更像：
   - gateway runtime 初始化卡住；
   - OpenClaw gateway 启动逻辑在监听前等待某个依赖；
   - 本地 state/lock/设备/浏览器/渠道初始化阻塞；
   - OpenClaw 对 size-drop anomaly 有运行期保护，虽然不报 invalid，但可能拒绝进入监听。

## 6. 下一步建议

先不要正式替换配置。

建议继续排查 gateway runtime，而不是恢复配置：

1. 直接运行 OpenClaw gateway 的 Node 入口，加更强日志：
   - `node ...\openclaw\dist\index.js gateway --port 18789`
   - 增加 `NODE_OPTIONS=--trace-uncaught`
   - 如 OpenClaw 支持，打开 debug/verbose 环境变量。
2. 检查 `.openclaw` 下 state/lock：
   - `agents`
   - `devices`
   - `browser`
   - `data`
   - `credentials`
   - `gateway` 相关 lock/pid/state
3. 临时禁用 channels/provider probe 做最小 gateway 启动验证。
4. 如果 OpenClaw 有 `doctor --fix`，先只跑 dry-run/doctor 诊断；不要直接 `--fix`。
5. 若确认 size-drop anomaly 会阻止 gateway 监听，再考虑重建配置并重置 OpenClaw 的 config-health last-known-good，而不是单纯覆盖 `openclaw.json`。

## 7. 当前选择建议

不要执行正式替换。

原因：candidate 已验证为“配置结构可用但 gateway 仍不监听”。正式替换当前配置不会解决 gateway 不可达，反而可能引入 channel/token 回退风险。下一步应转向 gateway runtime 诊断。
