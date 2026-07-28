# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-28
> 当前任务文件只描述正在执行或最近完成的任务，不定义长期路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

任务编号：`AW-ENV-BASELINE-001`

任务名称：Environment Ops 只读运行环境基线建立。

任务性质：只读环境诊断、稳定性观察与纯文档交付。

## 本轮目标

在不修改系统、代理、网络、AI Link、飞书、产品代码或生产环境，不发起付费调用的前提下，形成可复现、可比较的电脑、进程、端口、代理、网络、AI Link、Session和飞书基线，并拆分后续独立修复任务草案。

## 完成状态

- `verification/environment-ops-readonly-baseline/`：基线报告和机器可读摘要已建立。
- 完成30分17秒、7个样本的稳定性观察；AI Link主进程族、18765/18766、7890和飞书活动连接在窗口内保持稳定。
- 网络判定为`route_dependent`，代理判定为`application_proxy_mismatch`；OpenAI/Google直连超时而代理路径到达服务端。
- AI Link后台为`healthy`，桌面UI和登录Session仍为`unknown/unverified`。
- 热点线索判定为`correlated_but_unconfirmed`；当前付费生成仍为`blocked`。
- 后续已拆分为13个独立修复/验证任务草案，未执行任何修复。

## 明确边界

本轮未修改产品代码、AI Link安装文件或配置、代理、DNS、网络、注册表、系统设置、飞书配置、账号安全设置、支付设置或生产环境；未结束正常进程；未发起付费模型调用；未创建员工、工作流或飞书群；未购买手机号或开通OpenAI/Anthropic API。

AI Link历史事故状态仍只能写为`temporarily_recovered`；本轮30分钟稳定窗口不构成`permanently_fixed`、`fully_resolved`或`network_root_cause_confirmed`。

## 当前唯一下一步

等待产品负责人验收 `AW-ENV-BASELINE-001`；不得自动进入任何修复、付费生成、员工或工作群创建。

完成本轮文档提交和推送后立即停止，等待产品负责人验收。
