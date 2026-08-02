# ADR 009 — Active Task Boundary

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Active Task状态、继续/暂停/取消由Runtime拥有，Gateway不理解语义。

## 解决了什么问题

解决旧任务阻塞新任务、控制消息误路由和陈旧Result投递。

## 权衡

需要revision、abort和suppression协作，状态管理更严格。

## 后续是否允许修改

允许修复控制语义，不允许把业务状态迁回Gateway。
