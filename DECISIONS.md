# DECISIONS.md — 已锁定决策

> 本文件是已拍板决定的唯一权威。这里只保留决定、状态、范围和简短理由；产品定义、原则、愿景和论证分别引用对应权威文件。

## 记录规则

- `locked`：已生效，除非产品负责人明确替代，不得擅自推翻。
- `deferred`：方向认可，但当前未批准开工。
- `superseded`：已被后续决定替代，保留引用关系，不删除历史证据。
- 每项决定只在本文件写全；其他当前文档只引用编号。

## 已锁定决定

### D-001 双核心用户与普通人优先

- 状态：`locked`
- 决定：服务普通人和专业人，普通人是当前优先基本盘。
- 产品定义：`PRODUCT.md`

### D-002 一个输入框与后台承担复杂度

- 状态：`locked`
- 决定：用户表达目标，系统负责上下文、拆解、调度、执行、检查、恢复和交付；不要求用户选择模型或管理环境。
- 原则：`PRINCIPLES.md`

### D-003 模型和 Agent 无关

- 状态：`locked`
- 决定：DeepSeek 是当前生产实现，不是产品定位；核心对多 Provider、多 Agent 和工具保持开放。
- 架构：`ARCHITECTURE.md`

### D-004 控制层必须自持

- 状态：`locked`
- 决定：任务状态、中央记忆、权限、调度、质量检查、失败恢复、成本控制和证据审计归 AI Workbench 所有。
- 架构：`ARCHITECTURE.md`

### D-005 共享 Key 与 Managed Proxy

- 状态：`locked`
- 决定：用户本机 Key 优先，平台可提供受控共享 Key 兜底；真实生产 Key 只存在受控 Secret，不进入安装包、前端、用户电脑或公开仓库。
- 当前实现证据：`verification/managed-proxy-production/summary.json`

### D-006 成本走可控通道

- 状态：`locked`
- 决定：生产模型调用必须经过可预算、可审计、可限流的 AI Workbench 受控通道；开工前先估成本，未知费用写 `unknown`。
- 原则：`PRINCIPLES.md`

### D-007 第3阶段钱包刹车

- 状态：`locked`
- 决定：平台模型调用月度硬上限为 40 USD；平台总账是硬刹车，模型明细用于审计。预算异常必须 fail closed，不能调用 Provider 后再补账。
- 证据：`verification/monthly-budget-circuit-breaker-local/`、`verification/version13-full-production-promotion/`

### D-008 v0.4.7 范围边界

- 状态：`locked`
- 决定：v0.4.7 当前是可执行施工图，尚未自动开工；范围包括首批市场基础及格线、反馈/埋点/错误日志候选和测试验收。任何工作包须单独满足预算、安全、权限、输出、验收和集成条件。
- 进度：`CURRENT_PROGRESS_AUDIT.md`

### D-009 v0.4.7 数据最小化

- 状态：`locked`
- 决定：只允许最小必要的工作台内部交互元数据和错误信息候选；原始用户输入、模型回答正文及工作台外行为未获批准采集。必须提供告知、关闭和清除能力。
- 安全原则：`PRINCIPLES.md`

### D-010 图片和文件进入产品及格线

- 状态：`locked`
- 决定：图片和文件能力属于正式产品基本项，但是否进入具体版本，以 `CURRENT_PROGRESS_AUDIT.md` 的路线状态为准。
- 产品定义：`PRODUCT.md`

### D-011 通讯入口与核心解耦

- 状态：`locked`
- 决定：飞书、微信、Telegram、WhatsApp、Discord 等只是入口适配器，均不得成为核心调度系统的唯一依赖。
- 架构：`ARCHITECTURE.md`

### D-012 内外通讯线分离

- 状态：`locked`
- 决定：内部研发指挥入口和外部用户通讯入口是两条独立产品线；内部入口可先准备，但必须先计算日成本和权限风险。外部入口不因内部工具完成而视为完成。
- 当前状态：`CURRENT_PROGRESS_AUDIT.md`

### D-013 飞书内部入口边界

- 状态：`locked`
- 决定：使用 AI Workbench 自己控制的飞书企业自建应用和官方 SDK；凭据只在本机安全配置；渠道只调用任务网关，不直接操作 Git、Codex、生产或预算。
- 架构：`ARCHITECTURE.md`

### D-014 高风险动作逐次确认

- 状态：`locked`
- 决定：支付、删除、对外发消息、跨账号和权限变更每次单独确认，不允许永久或模糊授权。
- 原则：`PRINCIPLES.md`

### D-015 合规信息获取

- 状态：`locked`
- 决定：信息抓取只使用公开渠道、官方 API、合法授权和合规开源；不绕验证码、登录和技术保护，不偷数据，不追踪工作台外行为。
- 产品定义：`PRODUCT.md`

### D-016 收费暂缓但商业化不能缺席

- 状态：`locked`
- 决定：当前不以收费和利润最大化为主线，先验证真实用户价值；商业化、国内外收款、定价和盈亏平衡是正式产品必备模块，待路线批准后实施。
- 产品定义：`PRODUCT.md`

### D-017 文件驱动的无隐藏记忆协调

- 状态：`locked`
- 决定：协调 Agent 只派活、跟踪和汇总；项目记忆写回仓库，高风险交还产品负责人，执行结果必须独立验收。
- 架构：`ARCHITECTURE.md`
- 执行：`EXECUTION_PROTOCOL.md`

### D-018 快速推进但不免检

- 状态：`locked`
- 决定：当前优先推进和快速上线，先完成可靠及格线；任何结果仍需真实验证，细节进入后续迭代。
- 原则：`PRINCIPLES.md`

## 未改变的当前状态

当前版本、完成度和下一步不在本文件维护：版本以 `package.json` 为准，进度以 `CURRENT_PROGRESS_AUDIT.md` 为准，唯一下一步以 `NEXT_STEP.md` 为准。
