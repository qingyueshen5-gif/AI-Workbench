# ADR 004 — Scheduler

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Scheduler只根据Task、Registry和确定性确认策略生成Assignment。

## 解决了什么问题

避免Runtime按taskType或正则直接选择执行器。

## 权衡

增加显式调度步骤，但获得权限与Fallback可审计性。

## 后续是否允许修改

仅可在冻结接口内调整排序；不得跨层调用Provider。
