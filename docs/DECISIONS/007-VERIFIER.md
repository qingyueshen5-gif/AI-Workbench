# ADR 007 — Verifier

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Provider结果必须由独立Verifier按Capability与success criteria验证。

## 解决了什么问题

防止把Provider文本或退出当作已验证成功。

## 权衡

验证增加成本和延迟，但保证结果有证据。

## 后续是否允许修改

不得可选绕过；变更必须保持fail-closed。
