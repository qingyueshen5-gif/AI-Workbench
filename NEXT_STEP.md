# NEXT_STEP.md — 当前唯一下一步

<!-- AIW_NEXT_STEP_START -->
等待用户批准Interpreter Adapter
<!-- AIW_NEXT_STEP_END -->

## 目标

基于已完成的D0-1B确定性原始事实提取器，等待用户明确批准后再设计和施工Interpreter Adapter。

## 基线

- RUN-FENCING验收候选：`c2ed8c13e42b5c006a6c30a943b08975cff6c3a5`
- D0-1B候选：以当前分支最终标签为准。

## 执行顺序

1. 停止自动施工；
2. 等待用户验收D0-1B；
3. 仅在用户明确批准后开始Interpreter Adapter。

## 完成标准

- 用户明确批准Interpreter Adapter的施工范围、输入输出契约和验收门禁。

## 明确禁止

- Interpreter Adapter提前施工；
- 自动部署；
- 切换生产Runtime或触碰生产IPC；
- 未保存成果时reset/clean。

Interpreter Adapter仅在用户再次明确确认后开始；本轮D0-1B完成后必须停止。
