# 统一模型入口方案

日期：2026-07-21

范围：把 AI Workbench、Hermes、OpenClaw 三个员工的模型调用统一收敛到本机 `18800` 模型代理；方案覆盖配置改造、代理结构升级、验收标准和后续收益。

## 1. 目标

把 Workbench、Hermes、OpenClaw 三个员工的模型调用全部经过本机 `18800` 代理，让 `18800` 成为 provider 统一入口。

目标链路：

```text
Workbench / Hermes / OpenClaw
        |
        v
http://127.0.0.1:18800/v1
        |
        v
provider registry
        |
        v
DeepSeek / OpenAI / xAI / local 等供应商
```

短期先只接 `deepseek`，但结构必须能扩展到 `openai`、`xai`、`local` 等 provider。员工侧不保存真实供应商 key，只保存本机占位 token；真实 key、供应商路由、模型映射、重试和日志都由 `18800` 统一处理。

## 2. 当前状态

### 已收敛

- Workbench DeepSeek 调用已经默认走 `MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1`。
- Hermes adapter 会写入本地 Hermes runtime 配置：
  - `OPENAI_BASE_URL=http://127.0.0.1:18800/v1`
  - 本地占位 token：`aiw.hermes.local`
  - 默认模型：`deepseek-chat`
- `18800` 已提供 loopback-only 入口、重试、日志和员工归因。

### 未收敛的缺口

- OpenClaw 模型 provider 仍散落在自己的 `openclaw.json` 配置里。
- OpenClaw 当前 provider 直接指向外部 API，例如 DeepSeek / SenseNova，而不是 AI Workbench 的 `18800`。
- 这会导致工作台无法统一做模型熔断、用量统计、key 管理、模型下线提示和供应商切换。

## 3. 要做的：第二刀

### 3.1 OpenClaw 配置收敛到本地 provider

把 OpenClaw 配置改成 OpenAI-compatible 本地 provider：

```text
baseUrl: http://127.0.0.1:18800/v1
apiKey: aiw.openclaw.local
api: openai-completions
```

OpenClaw 保持它熟悉的模型命名：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

`18800` 负责把 OpenClaw 的模型别名归一到真实 provider 模型，例如：

- `deepseek-v4-flash` -> `deepseek-chat`
- `deepseek-v4-pro` -> `deepseek-chat`

配置改动必须先备份，验证结束后恢复用户原始 `C:\Users\胖胖虎\.openclaw\openclaw.json`，避免验收脚本永久改写用户配置。

### 3.2 `18800` 升级成 provider registry

把 `model-proxy.mjs` 从单一 DeepSeek upstream 转成 provider registry：

- 默认 provider：`deepseek`
- provider 元数据：`id`、`name`、`type`、`baseUrl`、`apiKeyEnv`、`models`
- `/health` 返回 default provider、provider 配置状态、模型列表和 loopback-only 状态
- `/v1/models` 返回 OpenAI-compatible 模型列表
- `/v1/chat/completions` 根据 provider 和模型映射转发

当前只实现 `deepseek`，但结构保留后续扩展位：

- `openai`
- `xai`
- `sensenova`
- `local`，例如 Ollama / vLLM / LM Studio

### 3.3 三员工统一验证

新增统一验收脚本，验证三类员工都真实经过 `18800`：

1. DeepSeek adapter 直接调用 `18800`。
2. Hermes 通过本地 Hermes runtime 配置调用 `18800`。
3. OpenClaw 通过临时本地 provider 配置调用 `18800`。

验收脚本需要扫描：

- OpenClaw 模型 provider 不含外部模型 endpoint。
- OpenClaw 模型 provider 不含真实 API key。
- Hermes runtime 配置指向 `18800` 且使用本地占位 token。
- 代理日志中三类员工都有 `/chat/completions` 成功记录。

## 4. 验收标准

### a) OpenClaw 通过 `18800` 成功调用模型

验收证据：

- OpenClaw gateway 可启动并可连接。
- OpenClaw 员工执行最小任务成功。
- `18800` 代理日志出现：

```json
{
  "employee": "openclaw",
  "provider": "deepseek",
  "path": "/chat/completions",
  "statusCode": 200
}
```

### b) 三个员工配置都没有真实 API key 裸露

验收证据：

- Workbench / DeepSeek adapter 不保存真实 key，只请求本机代理。
- Hermes runtime 配置使用 `aiw.hermes.local`。
- OpenClaw 临时 provider 使用 `aiw.openclaw.local`。
- 仓库文件、Hermes runtime 配置、OpenClaw provider 配置均不得出现真实形态的 `sk-...` key。

### c) OpenClaw 六项健康检查正常

六项检查：

1. `installed`：OpenClaw shim 或 Node 入口可用。
2. `version`：`openclaw --version` 返回版本。
3. `gateway_port`：`127.0.0.1:18789` 端口监听。
4. `gateway_ws`：gateway websocket 可连接。
5. `channels`：通道探测有分项结果，超时不阻塞基础 gateway 可用性。
6. `models`：模型探测有分项结果，超时不阻塞基础 gateway 可用性；实际模型调用以 `18800` 代理日志为准。

健康检查不能再依赖单个重型 `openclaw status`。必须拆成分项，超时要被归一成可解释状态。

### d) commit + push

完成后必须：

1. 运行最小语法检查。
2. 运行 `npm.cmd run verify:model-proxy`。
3. 运行 `npm.cmd run verify:unified-model-proxy`。
4. 确认 `C:\Users\胖胖虎\.openclaw\openclaw.json` 已恢复用户原配置。
5. 提交统一模型入口相关代码、方案和验收摘要。
6. `git push` 到当前分支。

## 5. 后续收益

统一模型入口完成后，工作台可以继续做：

- 模型分层：理解、编排、执行、摘要、去重分别用不同模型。
- 供应商切换：DeepSeek、OpenAI、xAI、本地模型可以在代理层切换，员工无感。
- 熔断降级：某个 provider 异常时，代理统一给出中文诊断或切备用模型。
- 成本控制：按员工、任务类型、模型记录调用日志和成本估算。
- 模型下线检测：固定模型不可用时，由代理提示用户保持、切换或跟进新模型。
- 密钥治理：真实 key 只在本机受控位置出现，不进入仓库、前端、员工配置或普通日志。

## 6. 当前完成记录

2026-07-21 已完成第二刀实现和验收：

- `model-proxy.mjs` 已扩展为 provider registry 结构。
- `scripts/verify-model-proxy.mjs` 已验证 `/health` 和 `/v1/models`。
- `scripts/verify-unified-model-proxy.mjs` 已验证 DeepSeek、Hermes、OpenClaw 三员工都通过 `18800` 调用模型。
- OpenClaw 验收运行期会临时写入本地 provider，结束后恢复用户原 `openclaw.json`。
- 验收摘要写入 `verification/unified-model-proxy/summary.json`。
