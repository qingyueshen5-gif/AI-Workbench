# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-28
> 当前任务文件只描述正在执行或最近完成的任务，不定义长期路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

任务编号：`AW-AILINK-ROUTE-AND-REVIEW-001`

任务名称：AI Link上游路由定性与已有协作方案只读审查。

任务性质：只读安装包、运行配置、非付费网络路径与现有工作流草稿审查；纯文档交付。

## 完成状态

### 路由定性

- workflow creator链路确认为renderer→IPC→workflow orchestrator→`127.0.0.1:18765/v1/chat/completions`→Node fetch→AI Link LLM上游。
- 当前上游是AI Link Session默认/下发的自有LLM网关域名，不是客户端直接访问单一Provider。
- 直连DNS、TCP、TLS和公开GET可达；经7890公开GET同样可达，未观察到证书、SNI或HTTP状态差异。
- 安装包未实现`session.setProxy`、代理命令行参数、Node代理dispatcher、域名分流表、超时重试或代理fallback。
- 没有证据表明该上游必须经过7890；“未连接7890”不再作为故障结论。
- 最终分类：`functional_but_unmanaged_route`。当前直连功能可用，但缺少明确策略、监控、fallback和权威设计文档。

### 版本3方案审查

- 当前工作流数量仍为2。
- `workflow-3da933e691b5`仍为`review_ready/review`、草稿3、`pendingBlueprint=null`、`lastError=null`。
- 五个角色全部存在：协调监工、A架构开发、E隐私开发、G测试验收、总集成。
- 协调监工是唯一入口，总集成是唯一最终集成角色，产品负责人拥有两个正式审批门。
- 飞书群运行逻辑为原生@才响应，未被@不调用模型。
- 方案禁止未经审批合并、生产部署、扩大范围和总集成代写；没有默认支付、Secret修改、删除或账号操作权限。
- 方案没有将产品写成DeepSeek客户端，符合模型中立定位。
- 审查分类：`review_passed_with_nonblocking_notes`。
- 结论：`new_generation_not_required`；不需要重新生成，创建前不强制人工修改。

## 非阻塞说明

1. 人工确认现有方案不等于正式开工审批；正式开发仍受方案内开工门控制。
2. 协调监工和G测试验收的员工分配仍待后续人工选择，这是确认流程状态，不是蓝图结构缺陷。
3. 正式开工前应在任务卡中明确AI Link本机代理端口与AI Workbench 18800在不同执行域中的实际入口，避免概念混用。

## 任务阻塞关系

- `AW-ENV-FIX-PROXY-001`不再硬阻塞现有版本3方案的人工确认；保留为长期路由治理与可观测性任务。
- 完整幂等、Checkpoint、自动Preflight、单实例锁、飞书重连、结构化日志、Wi-Fi/热点对照和完整路由治理均保留为后续工程。
- 本轮不确认方案，不准备员工，不绑定飞书，不创建群，不启动正式开发。

## 明确边界

本轮没有点击生成或调整草稿，没有发起模型调用，没有修改或确认工作流，没有创建员工或飞书群，没有修改AI Link、代理、网络、DNS、注册表、产品代码或生产配置。

## 当前唯一下一步

等待产品负责人验收 `AW-AILINK-ROUTE-AND-REVIEW-001`；验收通过后进入人工确认现有版本3方案的审批门，不重新生成。

完成文档提交和推送后立即停止，不自动进入下一阶段。
