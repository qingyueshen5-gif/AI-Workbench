# NEXT_STEP.md — 当前唯一下一步

<!-- AIW_NEXT_STEP_START -->
RUN-FENCING-001重新实现
<!-- AIW_NEXT_STEP_END -->

## 目标

为每一次业务Provider执行建立唯一、可持久化、可验证的runId身份链。

## 基线

- 实际开发基线：`579ae3c4592bec3de2c1c0c223db557641c1cc68`
- Checkpoint保护机制祖先：`bc43431e954f708d74d82b49ce367a73e07d0174`

## 执行顺序

1. TaskStore Run契约；
2. Provider绑定；
3. Progress、Verifier、Final绑定；
4. 取消、Lease接管和恢复；
5. D0-1A；
6. 完整回归；
7. 等待用户批准。

## 完成标准

- RUN-FENCING专项15/15；
- D0-1A `runtime.status`通过；
- D0-1A `file.read`通过；
- Critical/High通过；
- Mandatory Gates通过；
- `npm run verify`通过；
- 每阶段Checkpoint已提交、备份并推送；
- 不部署。

## 明确禁止

- D0-1B提前施工；
- Interpreter Adapter提前施工；
- 自动部署；
- 未保存成果时reset/clean。

本任务仅在用户再次明确确认后开始；本轮文档治理完成后必须停止。
