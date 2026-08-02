# ADR 002 — Runtime Unified Task Schema

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

所有任务使用统一Task Schema进入执行链。

## 解决了什么问题

替代requiresExecution/task/answer旧Decision协议和按场景分裂的数据结构。

## 权衡

Schema更严格，fixture和Provider必须完整实现契约。

## 后续是否允许修改

字段演进只能向后兼容并经过Architecture、QA Gate。
