# AI Workbench 项目基准与权威索引

> 本文件只提供当前综合入口和事实归属索引，不复制产品、愿景、原则、架构、决定或路线正文。快速交接优先使用 `AI-Workbench-Handoff.md`。

## 当前版本

<!-- AIW_CURRENT_VERSION_START -->
当前版本：v0.4.6 Alpha
package.json.version：0.4.6
Release：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
Release 类型：public prerelease / Alpha
<!-- AIW_CURRENT_VERSION_END -->

当前版本号唯一权威是 `package.json`。Release 事实以 GitHub Release 和 `verification/3b-release/summary.json` 为准。

## 当前状态入口

- 已完成/未完成能力、阶段、优先级和模块路线：`CURRENT_PROGRESS_AUDIT.md`
- 正在执行或最近完成的任务：`CURRENT_TASK.md`
- 当前唯一下一步：`NEXT_STEP.md`
- 历史任务总账：`TASKLOG.md`
- 版本变化历史：`CHANGELOG.md`
- 验收证据：对应 `verification/<task>/`

## 事实归属表

每项事实只在一个权威文件写全，其他文件只引用。

| 事实类别 | 唯一权威文件 |
| --- | --- |
| 当前版本号 | `package.json` |
| 当前唯一下一步 | `NEXT_STEP.md` |
| 路线、阶段、优先级、完成度 | `CURRENT_PROGRESS_AUDIT.md` |
| 产品对象、体验、正式能力、运营与商业 | `PRODUCT.md` |
| 终极愿景与提前 3–5 步演进 | `VISION.md` |
| 当前阶段总方针、产品、安全、成本铁律 | `PRINCIPLES.md` |
| 系统架构、Agent、模型调度、诊断与恢复 | `ARCHITECTURE.md` |
| 已锁定决定 | `DECISIONS.md` |
| 判断原因、负责人状态和团队思考分工 | `THINKING.md` |
| 工程经验、证据、测试和项目连续性 | `EXECUTION_PROTOCOL.md` |
| 个人学习和成长 | `GROWTH_LOG.md` |
| 历史任务 | `TASKLOG.md`、`tasks/` |
| 历史变更 | `CHANGELOG.md` |
| 真实验收证据 | `verification/` |
| 调研和候选方案 | `research/` |
| 新对话最小快照 | `AI-Workbench-Handoff.md`（自动生成区不得承载独有事实） |

## 25 个知识模块索引

| # | 模块 | 权威文件 |
| ---: | --- | --- |
| 01 | 产品愿景 | `VISION.md` |
| 02 | 产品路线图 | `CURRENT_PROGRESS_AUDIT.md` |
| 03 | 产品原则 | `PRINCIPLES.md` |
| 04 | 产品架构 | `ARCHITECTURE.md` |
| 05 | Agent体系 | `ARCHITECTURE.md` |
| 06 | 模型调度 | `ARCHITECTURE.md` |
| 07 | 信息抓取与竞品观察 | `PRODUCT.md` |
| 08 | 用户理解 | `PRODUCT.md` |
| 09 | 虚拟人格 | `PRODUCT.md` |
| 10 | 用户体验 | `PRODUCT.md` |
| 11 | 故障诊断 | `ARCHITECTURE.md` |
| 12 | 环境兼容 | `ARCHITECTURE.md` |
| 13 | 工程经验 | `EXECUTION_PROTOCOL.md` |
| 14 | 安全 | `PRINCIPLES.md` |
| 15 | 成本控制 | `PRINCIPLES.md` |
| 16 | 日志与证据 | `EXECUTION_PROTOCOL.md` |
| 17 | 测试体系 | `EXECUTION_PROTOCOL.md` |
| 18 | 飞书/AI Link集成 | `ARCHITECTURE.md` |
| 19 | 产品运营与营销 | `PRODUCT.md` |
| 20 | 项目连续性 | `EXECUTION_PROTOCOL.md` |
| 21 | 故障恢复 | `ARCHITECTURE.md` |
| 22 | 产品演进 | `VISION.md` |
| 23 | 决策记录 | `DECISIONS.md` |
| 24 | 决策者与团队运作 | `THINKING.md` |
| 25 | 商业化与收款 | `PRODUCT.md` |

当前阶段总方针只在 `PRINCIPLES.md` 写全。

## 当前实现入口

代码和运行入口以仓库真实文件为准：

- 桌面前端：`src/`
- 本地服务：`server.mjs`
- 本地 Provider 入口：`model-proxy.mjs`
- Managed Proxy：`managed-proxy/`
- Agent adapters：`agents/`
- 任务网关与飞书适配：`scripts/task-gateway.mjs`、`scripts/feishu-task-channel.mjs`
- 版本与安装：`package.json`、`electron/`、`versions/`

具体技术边界统一见 `ARCHITECTURE.md`，不在本文件另立第二份架构。

## 新对话读取顺序

1. `AI-Workbench-Handoff.md`
2. `NEXT_STEP.md`
3. 与任务相关的权威模块文件
4. `CURRENT_PROGRESS_AUDIT.md`
5. 对应 `verification/` 或 `research/`

新对话不得根据聊天记忆覆盖仓库事实，也不得把历史记录误当当前状态。
