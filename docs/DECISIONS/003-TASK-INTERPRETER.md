# ADR 003 — Task Interpreter

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

DeepSeek负责把用户语言转换为结构化Task，不直接授权执行。

## 解决了什么问题

避免关键词逐条匹配和自然语言直接驱动高权限操作。

## 权衡

模型理解灵活，但必须由确定性校验、置信度和策略约束。

## 后续是否允许修改

允许改进理解质量，不允许绕过Schema或直接执行。
