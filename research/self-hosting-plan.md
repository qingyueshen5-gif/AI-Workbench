# AI Workbench 自主化与去第三方依赖方案

日期：2026-07-20

范围：只读盘点当前仓库与本机运行配置，形成路线方案；不改实现代码。

## 1. 现状盘点

核心判断：AI Workbench 已经有“本机模型代理集中入口”的雏形，但还没有完成“所有员工/模型调用统一收敛到自主本机代理”。当前状态是“应用壳和部分编排已自主，模型供应、部分员工通道、Codex 开发链路仍依赖外部服务”。

| 环节 | 当前证据 | 状态 | 结论 |
| --- | --- | --- | --- |
| AI Workbench 前端/API | 本地项目内运行，API 监听 `127.0.0.1:8787` | 已自主 | 工作台自身 UI/API 不依赖第三方中转才能启动。 |
| 本机模型代理 `18800` | `model-proxy.mjs` 监听 `127.0.0.1:18800`，只接受 loopback；默认 upstream 为 `https://api.deepseek.com/v1` | 半依赖 | 鉴权、日志、重试、员工归因已收敛到本机；实际推理仍依赖 DeepSeek 官方外部 API。 |
| Workbench DeepSeek 调用 | server 侧默认使用 `MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1` | 半依赖 | 工作台不直接把 key 暴露给前端，但仍依赖外部模型供应商可用性。 |
| Hermes 模型调用 | `agents/adapters/hermes.mjs` 写入 `OPENAI_BASE_URL=http://127.0.0.1:18800/v1`、本地占位 token、模型 `deepseek-chat` | 半依赖 | Hermes 已绕开 AI Link 等第三方中转，先走 AI Workbench 本机代理，再到 DeepSeek。 |
| OpenClaw 模型调用 | 本机 `.openclaw/openclaw.json` 的 provider 指向外部 provider URL，默认模型为 OpenClaw 自己的 DeepSeek provider；未统一指向 `18800` | 半依赖/未收敛 | OpenClaw gateway 是本地模式，但模型链路目前不受 AI Workbench 18800 统一管控。 |
| OpenClaw gateway | 配置为 `mode=local`、`bind=loopback`、端口 `18789`；当前健康检查显示 gateway 不可达 | 半依赖 | 控制面设计是本地 gateway，但稳定性不足；模型和渠道仍依赖外部服务。 |
| Codex 开发链路 | 当前仓库无法证明 Codex CLI/开发模型是否完全直连官方还是经过 AI Link/其他 relay | 完全外部依赖，归属待核验 | 这不是工作台内可控运行时。应作为“开发工具依赖”单独记录，不应混入产品运行 SLA。 |
| 飞书/Telegram 等渠道 | OpenClaw 配置里启用 feishu、telegram | 完全依赖第三方平台 | 消息通道天然依赖平台 API、账号状态、平台风控和网络。 |
| AI Link 相关链路 | 既往调研显示 AI Link 本地代理端口 `18765/18766`，真实 key 在桌面主进程 session；但 AI Link 自身后端/LiteLLM/登录体系仍可能是外部依赖 | 第三方中转风险 | 不能把 AI Link 当作最终自主底座，只能借鉴其“本地代理集中鉴权”的产品结构。 |

### DeepSeek 请求实际经过哪里？

当前 AI Workbench 自身与 Hermes 的 DeepSeek 请求路径：

```text
Workbench/Hermes -> http://127.0.0.1:18800/v1 -> https://api.deepseek.com/v1
```

这条路径没有证据显示经过 AI Link 中转；但它不是“完全自主”，因为最终推理仍依赖 DeepSeek 官方 API、网络、账号、额度和模型可用性。

OpenClaw 当前路径更像：

```text
OpenClaw -> OpenClaw 自己的 provider 配置 -> DeepSeek/SenseNova 等外部 API
```

它没有收敛到 `18800`，因此工作台无法统一做模型熔断、用量统计、key 管理、模型下线提示和供应商切换。

### 18800 是绕开第三方还是转发？

`18800` 已经绕开 AI Link 这类第三方中转，但它本质仍是本机转发代理：

- 自主部分：本机 loopback 入口、统一注入 `DEEPSEEK_API_KEY`、重试、日志、员工归因。
- 非自主部分：最终 upstream 默认是 DeepSeek 官方云 API；没有本地推理能力，也没有多 provider adapter 和自动降级矩阵。

因此状态应标为“半依赖”，不是“已完全自主”。

## 2. 参考方案：Hermes CN Desktop / 本地代理集中鉴权

可借鉴的不是某个具体供应商，而是架构原则：

1. 桌面主进程或本机守护进程持有真实 provider key。
2. 所有员工只访问 `127.0.0.1` 上的本机代理，不直接保存真实云端 key。
3. 员工使用短 token 或本地占位 token，代理负责鉴权、审计、限流、模型映射和错误归一化。
4. 代理提供 OpenAI-compatible endpoints，例如 `/v1/models`、`/v1/chat/completions`、`/v1/responses`，以兼容 Hermes、OpenClaw、Codex 类客户端。
5. 本机代理应有明确健康接口和日志：provider 可用性、账号额度、最近错误、模型是否下线、当前 fallback。
6. 外部服务只作为 provider，不作为不可替换的中转控制面。

对 AI Workbench 的直接借鉴：

- 把 `18800` 从“DeepSeek 单 provider 转发器”升级为“本机模型控制平面”。
- 所有员工配置只允许指向 `18800`，不允许散落 provider key。
- 用 provider adapter 隔离 DeepSeek、OpenAI、xAI、SenseNova、本地模型等差异。
- 把密钥放到用户数据目录或系统凭据管理器，项目仓库只保存占位 token 和路由名。
- 模型供应商不可用时，由代理输出面向用户的中文诊断，而不是让员工各自超时。

## 3. 自主化路线

### 第 0 步：依赖账本与运行时证据

工作量：0.5-1 天。

收益：先把“哪里受制于人”说清楚，避免把第三方故障误判为应用 bug。

兼容性：无侵入，只写诊断和版本矩阵。

交付物：

- `versions/current.json` 增加运行时 provider 证据字段。
- 运行健康页展示：Workbench、18800、Hermes、OpenClaw、provider、渠道。
- 日志中明确 `upstreamBaseUrl`，但不打印 key。

### 第 1 步：所有员工模型调用统一走 `18800`

工作量：1-2 天。

收益：OpenClaw、Hermes、Workbench 统一鉴权、限流、日志、模型下线提示和 fallback。

兼容性：高。Hermes 已完成雏形；OpenClaw 需要把 provider 配置改成 OpenAI-compatible local provider。

要点：

- OpenClaw provider 改为 `base_url=http://127.0.0.1:18800/v1`。
- 员工只保存 `aiw.<agent>.local` 形式本机 token。
- adapter health check 不再直接跑重型 status，而先查 `18800/health` 和 OpenClaw gateway 分项。

### 第 2 步：`18800` provider adapter 化

工作量：2-4 天。

收益：替换模型供应商不影响员工；可以做模型分层调用、成本控制、灰度切换。

兼容性：中。需要扩展 `model-proxy.mjs` 配置和 `/v1/models` 响应。

建议 adapter：

- `deepseek`: DeepSeek 官方 API。
- `openai`: OpenAI 官方 API。
- `xai`: xAI 官方 API。
- `sensenova`: SenseNova 官方 API。
- `local`: Ollama/vLLM/LM Studio 等本地模型。

### 第 3 步：模型可用性与下线检测

工作量：1-2 天。

收益：用户看到的是“模型不可用、是否切换”，不是员工超时或空白失败。

兼容性：高。可先做只读检测。

机制：

- 定时调用 provider `/models` 或轻量 completion。
- 对固定模型名如 `deepseek-chat` 建立“用户锁定策略”。
- 官方换代或下线时提示：
  - 保持当前模型：继续使用直到不可用。
  - 跟进新模型：写入矩阵与 lock。
  - 临时切换备用模型：仅本次或全局。

### 第 4 步：渠道与 gateway 自主化

工作量：3-7 天。

收益：OpenClaw/Hermes gateway 不再成为黑箱，渠道状态可观测、可恢复。

兼容性：中。需要拆出 channel adapter 和 watchdog。

要点：

- gateway 健康拆成进程、端口、平台连接、模型调用四项。
- 对飞书/Telegram/微信只保存平台 token，不让模型链路混在渠道配置里。
- Windows 计划任务或桌面 watchdog 负责开机恢复。

### 第 5 步：本地推理或自托管推理

工作量：1-3 周，取决于模型质量目标和硬件。

收益：关键任务可在断外网或供应商故障时降级运行。

兼容性：中低。需要模型下载、显存/内存检测、质量评测和任务分流。

现实判断：不建议一开始追求“所有任务本地化”。应先把轻任务、分类、去重、路由、摘要草稿放到便宜模型或本地模型；理解/编排/高价值输出仍可用强云模型。

## 4. 过程中的妥协与 adapter 封装

短期不得不保留第三方的环节：

| 环节 | 为什么短期保留 | 封装方式 |
| --- | --- | --- |
| 云模型 provider | 本地模型质量、速度、硬件门槛暂时无法覆盖所有任务 | 全部经 `18800` provider adapter；员工不感知 provider。 |
| Codex 开发模型 | Codex 是开发工具链，不属于产品运行时可完全控制范围 | 独立记录为开发依赖，不承诺产品可用性。 |
| 飞书/Telegram/微信/X/小红书 | 渠道天然依赖平台账号、API、风控和政策 | channel adapter + health check + 限速策略 + 可替换通道。 |
| npm/pip/winget 包源 | 员工安装、升级、回退需要外部包源 | 版本锁 + 本地安装包缓存 + 失败回退。 |
| AI Link 等历史链路 | 迁移期可能仍有账号、代理或员工资产依赖 | 写成 adapter，不让业务逻辑直接调用 AI Link。 |

adapter 设计原则：

1. 业务层只说“我要模型能力/渠道能力/员工能力”，不写具体供应商 URL。
2. adapter 必须暴露 `health()`、`invoke()`、`version()`、`capabilities()`。
3. adapter 错误必须归一化为 `unavailable`、`auth_failed`、`rate_limited`、`model_removed`、`network_failed`。
4. 所有 provider key 只存本机受控位置，不进入仓库、不进入前端、不进入员工日志。
5. 每次模型或员工版本变化写入版本矩阵，方便回退和复盘。

## 5. 推荐优先级

1. 先把 OpenClaw 模型配置收敛到 `18800`，这是当前最大断点。
2. 把 `18800` 抽象成 provider adapter，而不是继续写死 DeepSeek。
3. 增加模型下线检测和用户选择提示。
4. 增加本机 watchdog，分别看 `18800`、Hermes、OpenClaw gateway、外部 provider。
5. 最后再做本地模型 fallback；这一步价值大，但不应阻塞前面的链路自主化。
