# ADR 010 — Version Freeze v1

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

stable-single-agent-v1冻结架构链、Capability Inventory、治理门禁和恢复标识。

## 解决了什么问题

为正式使用提供可追溯、可恢复、可审计的稳定基线。

## 权衡

冻结限制快速变更；后续新能力必须进入新版本。

## 后续是否允许修改

Critical/High安全修复允许；架构和能力变更必须创建后续版本。
