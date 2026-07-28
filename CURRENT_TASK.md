# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-28
> 当前任务文件只描述正在执行或最近完成的任务，不定义长期路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

任务编号：`AW-AILINK-READINESS-001`

任务名称：AI Link单次受控生成前最小就绪核验。

任务性质：只读UI、Session、工作流状态、请求路径与人工一次提交保护核验；纯文档交付。

## 本轮目标

在不执行生成、不创建员工或飞书群、不修改AI Link、代理、网络或产品代码的前提下，明确是否具备“一次且仅一次”的受控workflow生成条件。

## 完成状态

- AI Link v0.2.12 UI完整可交互；员工、协作群和现有草稿详情可读取。
- 登录Session根据只读页面状态判定有效；没有重新登录、认证过期或权限错误。
- 当前只有1个AI Link主进程族；18765/18766健康。
- 当前工作流数量为2：`AW-AILINK-GROUP-001`对应草稿为`review_ready/review`、草稿3；另一个工作流为`ready/done`。
- 没有落盘中的pending/running生成任务，但缺少持久请求ID，孤儿请求无法强审计排除。
- 已证明workflow creator调用链为UI→IPC→18765→AI Link LLM上游；未证明18765上游fetch经过7890。
- workflow-creator持久累计计数不可恢复；费用UI基准记录为余额¥111.58、今日用量¥43.42。
- “单次受控生成操作卡”已形成但未执行。
- 最终判定：`blocked_proxy_path_unverified`。

## 任务分类

本次单次生成唯一仍然硬阻塞：

- `AW-ENV-FIX-PROXY-001`中的workflow creator上游实际路由证明与可审计证据。

本轮已满足最小核验、正式执行前需即时复核：

- `AW-ENV-FIX-READINESS-001`中的UI和Session部分；
- `AW-ENV-FIX-IDEMPOTENCY-001`中的人工单次提交保护部分。

完整幂等、Checkpoint、自动Preflight、单实例锁、飞书自动重连、结构化日志、网络对照和完整路由治理移至后续工程，未删除也未标记完成。

## 明确边界

本轮没有点击“让 AI 生成方案”，没有发起付费workflow生成，没有创建或修改工作流、员工、飞书群，没有修改AI Link安装文件、系统代理、DNS、注册表、代理节点、产品代码或生产配置。

## 当前唯一下一步

等待产品负责人验收 `AW-AILINK-READINESS-001`；在workflow creator代理路径得到可审计证明前，不得执行受控生成。

完成文档提交和推送后立即停止，不自动进入下一阶段。
