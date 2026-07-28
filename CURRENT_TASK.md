# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-28
> 当前任务文件只描述正在执行或最近完成的任务，不定义长期路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

任务编号：`AW-FOUNDATION-ISSUES-001`

任务名称：AI Workbench 基础环境、网络、代理、支付与账号问题资产化。

任务性质：纯文档治理与事故资产化。

## 本轮目标

把 2026-07-27 至 2026-07-28 发生的电脑、本地进程、网络、代理、AI Link、飞书、海外账号恢复、官方 API 支付路径和用户体验问题，写入项目权威体系，形成：

- 统一问题总表和故障时间线；
- 已确认事实、未确认假设、临时恢复和长期方向；
- Environment Ops（运行环境保障）永久横向能力；
- 统一 Incident 流程和付费/正式任务 Preflight；
- P0-P4 后续任务顺序；
- 索引、TASKLOG、CHANGELOG 和 Handoff 同步。

## 完成状态

- `ENVIRONMENT_OPS_ISSUES.md`：17项问题已归档，P0 5、P1 9、P2 2、P3 1。
- `ARCHITECTURE.md`：Environment Ops 已作为现有模块的横向能力写入，没有创建第二套一级模块。
- `EXECUTION_PROTOCOL.md`：Incident 处理流程、12项 Preflight 和一次安全复测边界已写入。
- `CURRENT_PROGRESS_AUDIT.md`：问题资产化状态、任务顺序和未解决风险已同步。
- `CONTEXT.md`、`README.md`：问题总表已进入现有索引。
- `TASKLOG.md`、`CHANGELOG.md`：本轮历史账本已更新。
- `AI-Workbench-Handoff.md`：由生成脚本刷新，不承载独有事实。

## 明确边界

本轮未修改产品代码、AI Link 安装文件、代理、网络、注册表、系统设置、账号安全设置、支付设置或生产环境；未发起付费模型调用；未创建员工、工作流或飞书群；未购买手机号或开通 OpenAI/Anthropic API。

AI Link 当前状态只能写为 `temporarily_recovered`，不得写成 `fully_fixed` 或 `permanently_resolved`。

## 当前唯一下一步

完成 Environment Ops 环境基线：只读采集电脑资源、唯一实例、端口、DNS/TCP/TLS、代理模式、国内外服务、飞书/AI Link/Provider 非付费健康、Session、预算保护和草稿保存状态；不做修复、不发起付费调用。

完成本轮文档提交和推送后立即停止，等待产品负责人验收。
