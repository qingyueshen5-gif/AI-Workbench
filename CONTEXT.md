# AI Workbench 项目基准文档 (CONTEXT.md)

> 使用方法：新对话需要完整基准时，提供本文件内容或 GitHub 链接；需要快速交接时优先提供 `AI-Workbench-Handoff.md`、`NEXT_STEP.md` 和 `THINKING.md`。
> 当前版本号以 `package.json` 的 `version` 为唯一权威，本文件只展示脚本可校验的当前口径。
> 新电脑迁移或重装环境时，先看仓库根目录的 `SETUP.md`。

---

## 当前状态

<!-- AIW_CURRENT_VERSION_START -->
当前版本：v0.4.6 Alpha
package.json.version：0.4.6
Release：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
Release 类型：public prerelease / Alpha
<!-- AIW_CURRENT_VERSION_END -->

AI Workbench v0.4.6 Alpha 已公开发布。③A 总验收和 ③B GitHub Release 均已 passed，公开安装包下载回测通过。上线三大硬骨头整体完成，产品方向已收口。

当前尚无真实用户。模型调用成本由平台承担，且平台月度金额硬上限尚未建立；现金跑道约 8 个月，月支出约 8200。当前目标是盈亏平衡和知名度，不是收费或利润最大化。

生存体检和第 3A 段本地钱包刹车均已由产品负责人验收通过。3A 已完成平台合计预算纠偏和 mock 验证：平台月度总预算政策上限 50 USD，所有 provider/模型合计的模型调用硬上限 40 USD，基础设施及价格波动预留 10 USD；Managed Proxy 使用整数 micro-USD，在调用 provider 前按模型价格保守预留，由 `monthly_platform_budget(month_key)` 平台总账执行唯一 D1 条件原子更新，成功后才允许上游调用。`monthly_model_budget(month_key, model)` 只做模型明细账和审计用途，不决定硬上限。失败/超时/500 不退款，缺价格或预算账本不可用时 fail closed。证据见 `verification/monthly-budget-circuit-breaker-local/summary.json`。

第 3B-1 段生产预检与远端 D1 部署前备份已完成：生产变更前必须核对 Cloudflare 身份、Worker、D1 binding、目标数据库和既有生产 evidence，并在仓库外完成远端 D1 完整导出备份。当前备份位于 `D:\AI-Workbench-Backups\2026-07-24-managed-proxy-budget-predeploy\`，证据见 `verification/monthly-budget-production-preflight/summary.json`。本轮未执行远端 D1 migration，未部署生产 Cloudflare Worker，未修改 Secrets，未调用真实 provider。

第 3B-2a 段远端 D1 migration 已完成：生产 D1 `aiw-managed-proxy` 现已存在 `monthly_platform_budget` 和 `monthly_model_budget` 两张预算表，原有 `daily_usage`、`installations`、`revoked_tokens` 保持存在；两张预算表当前行数均为 0。证据见 `verification/monthly-budget-production-migration/summary.json`。本轮未部署 Worker，未修改 Secrets，未调用真实 provider；预算表已创建但生产钱包刹车尚未生效。

## 当前架构

```text
Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider
```

产品定位是模型与 Agent 无关的调度框架，不是 DeepSeek 客户端。DeepSeek 是当前唯一已接入的生产实现；架构必须保持 provider registry 和 Managed Proxy 可替换，后续可接入其他模型 provider、Agent 和成熟工具。

当前生产链路的真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包、用户电脑、前端、员工配置、日志或公开仓库。

## 已完成能力摘要

详细能力状态以 `CURRENT_PROGRESS_AUDIT.md` 为唯一权威。本文件只展示摘要：

- Windows 安装、启动、快捷方式和卸载已通过真实验收。
- 陌生机器缺依赖时不白屏、不崩栈，提供中文未就绪说明。
- 用户安装后无需填写模型 API Key；当前生产实现通过 AI Workbench Managed Proxy 调用 DeepSeek `deepseek-chat`，架构保持多 provider 可替换。
- Cloudflare Managed Proxy 生产部署、D1、Secrets、限流、预算、令牌刷新/吊销和紧急关闭已通过验证。
- ③A 总验收 passed，③B GitHub Release passed，v0.4.6 Alpha 已公开下载。

## 未完成能力摘要

详细未完成清单以 `CURRENT_PROGRESS_AUDIT.md` 为唯一权威。本文件只展示摘要：

- 电脑环境治理审计已完成；第一批安全清理仍为 partial，用户 npm 缓存仍因 `EPERM` 未清理，Windows 临时文件仍需产品负责人手动确认。
- 第 3B-2a 段远端 D1 migration 已完成，当前等待产品负责人验收；未经批准不得部署 Worker 或进入第 3B-2b 段。
- 首屏 3-5 条示例指令、反馈入口、安全和隐私告知尚未完成。
- 3-5 名真实用户测试尚未开始。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配尚未完成。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规尚未实施。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为唯一权威：

等待产品负责人验收第 3B-2a 段远端 D1 migration。未经批准不得部署 Worker 或进入第 3B-2b 段。

不得部署 Cloudflare Worker、修改 Secrets、进入第 3B-2b 段、实际电脑清理、首屏示例、反馈入口、安全告知、真实用户测试、模型分层、上下文压缩、手机端、情报流水线或任何新功能开发。

## 产品方向文件索引

- `PRODUCT.md`：产品定义、目标用户、一个输入框、产品边界和阶段路线。
- `VISION.md`：全球愿景、质量基线、人机共同打磨和长期方向。
- `THINKING.md`：产品负责人判断依据，解释关键结论背后的原因。
- `PRINCIPLES.md`：简单、高质量、快速、低损耗、真实完成和透明可追溯。
- `DECISIONS.md`：已锁定决策，包括借用生态但掌握控制层、跨平台执行边界和用户状态波动补偿。
- `CURRENT_PROGRESS_AUDIT.md`：已完成/未完成能力的唯一权威。
- `NEXT_STEP.md`：当前唯一下一步的唯一权威。
- `verification/3b-release/summary.json`：v0.4.6 Release 事实权威证据。

## 协作分工

| 角色 | 负责什么 |
|---|---|
| 用户（产品负责人） | 产品方向、优先级拍板、是否进入下一阶段、最终验收判断 |
| GPT | 产品方向、路线规划、任务拆分、检查 Codex 返回结果 |
| Codex | 代码/文档执行、验证、证据生成、commit + push、真实汇报 |
| Claude | 口头想法结构化、代码调试、Review、日常执行协调 |
| Hermes / OpenClaw | 未来由工作台调度的电脑、浏览器和长任务执行工具 |

## 验收协议

- 执行规范以 `EXECUTION_PROTOCOL.md` 为准。
- AI 不负责宣布成功，AI 负责提供证据；用户负责最终验收。
- 外部流程必须取得真实外部结果后才能判绿。
- 任何任务结论、验收结果和新决策都必须写回仓库，不得只留在聊天里。
- 历史记录不得为统一当前口径而篡改；历史文件可保留当时版本号和当时状态。

## 环境层已知问题

工作台应用问题与电脑开发环境问题要分开看：

- 工作台出问题：改代码、改功能，是 Codex 的活。
- 环境出问题：例如登录掉了、路径不对、权限报错，是地基层问题，不等同于工作台功能失败。

已发生过的环境问题记录：

| 问题 | 原因 | 解决方式 |
|---|---|---|
| git push 报 `dubious ownership` | 外接硬盘的文件系统不记录归属权 | `git config --global --add safe.directory F:/AI-Workbench` |
| git push/fetch 报 `SEC_E_NO_CREDENTIALS` | 本机 Git 登录凭证失效/未设置 | 在系统终端执行 `gh auth login --web --git-protocol https`，走浏览器授权 |
| Codex 沙盒内 push 超时/授权卡住 | Codex 运行环境隔离，浏览器跳转登录容易失败 | 换到电脑自带终端执行登录和 push |
| Codex 窗口断连后不知道怎么重开 | 正常操作，不是故障 | 在 `F:\AI-Workbench` 打开终端，输入 `codex` 回车 |
| Codex 任务量太大导致 502/连接中断 | 一次性任务过大 | 拆小任务，分批发送 |
| Hermes / WSL / OpenClaw 历史环境问题 | 见任务记录和历史文档 | 不在当前任务中重复排查，按对应历史留痕处理 |

## 第三方 Agent/工具升级管理规则

1. 不在任务进行中升级，任何升级都单独立项、单独验证。
2. 升级前必须先看官方 Release Notes，确认有没有破坏性变更。
3. 升级前记录当前可用版本号，出问题能回退。
4. 升级后必须重跑核心能力验证：对话、记忆、文件执行、联网。
5. 定期检查重要更新，不被提示框推着走。

## 历史版本记录

以下是历史版本口径，不代表当前版本：

- v0.1.0：功能显性版。
- v0.1.1：显示面板扩充和 DeepSeek 连接测试入口。
- v0.2.0：聊天为中心和自动信息提炼，当时属于 Phase 3 第一步。
- v0.3.0：MVP 架构闭环。
- v0.4.0-v0.4.5：桌面发行、执行底座、动作路由、版本管理和体验修复。
- v0.4.6 Alpha：公开 Alpha Release，当前版本。

## 对话管理原则

- 不依赖任何 AI 记住整段对话历史。
- 一个对话框只聊一个主线任务。
- 新对话默认提供 `AI-Workbench-Handoff.md`、`NEXT_STEP.md` 和 `THINKING.md`；需要完整基准时再提供本文件。
- 任何决策、结论、进度变化必须写回仓库。
