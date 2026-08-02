# ADR 006 — Provider

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Provider只执行Assignment批准的单一领域能力，并返回证据。

## 解决了什么问题

隔离模型、CLI、本机工具和进程操作实现。

## 权衡

统一接口限制实现自由，但降低跨层耦合和权限漂移。

## 后续是否允许修改

允许修复实现，不得自行扩大Capability或权限。
