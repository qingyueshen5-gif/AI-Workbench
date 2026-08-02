# ADR 008 — Progress Protocol

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Progress与最终Result分离，只传安全阶段和可公开状态。

## 解决了什么问题

避免中间提示、秘密、内部推理或未验证结果被当作最终回复。

## 权衡

用户看到的是保守进度而非虚假百分比。

## 后续是否允许修改

可优化文案和节流，不得携带prompt、token、secret或业务结果。
