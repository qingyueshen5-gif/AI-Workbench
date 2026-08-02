# ADR 005 — Capability Registry

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Registry是Capability、Provider、风险、确认和验证方法的声明权威。

## 解决了什么问题

解决声明与运行权限不一致及能力不可盘点。

## 权衡

静态声明需要健康状态和Runtime消费保持一致。

## 后续是否允许修改

v1清单冻结；新增/删除Capability必须进入新版本审批。
