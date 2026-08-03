# AI Workbench 项目基准与权威索引

> 本文件只提供权威入口和事实归属，不复制产品、当前状态或当前任务正文。

## 新窗口读取顺序

1. `PRODUCT.md`
2. `CURRENT_STATUS.md`
3. `NEXT_STEP.md`
4. `PRINCIPLES.md`
5. `ARCHITECTURE.md`
6. `EXECUTION_PROTOCOL.md`
7. `TASKLOG.md`（仅在需要历史时读取）

`AI-Workbench-Handoff.md`只是上述顺序的自动生成轻量入口，不承载独有事实。

## 权威职责表

| 问题 | 唯一权威文件 |
| --- | --- |
| 产品是什么 | `PRODUCT.md` |
| 长期愿景 | `VISION.md` |
| 不可违反原则 | `PRINCIPLES.md` |
| 判断方法 | `THINKING.md` |
| 已拍板决策 | `DECISIONS.md` |
| 正式架构 | `ARCHITECTURE.md` |
| 当前真实状态 | `CURRENT_STATUS.md` |
| 当前唯一下一步 | `NEXT_STEP.md` |
| 施工和验收规则 | `EXECUTION_PROTOCOL.md` |
| 历史任务索引 | `TASKLOG.md` |
| 高层版本变化 | `CHANGELOG.md` |

## 解释边界

- `ARCHITECTURE.md`说明设计契约，不证明能力已经实现。
- `verification/`保存证据，不代表当前状态；证据只证明其任务、时间、commit和环境范围内的结论。
- `tasks/`保存历史，不代表当前任务。
- Handoff只能引用权威文件，不得复制另一套当前状态。
- `CURRENT_PROGRESS_AUDIT.md`和`CURRENT_TASK.md`是历史快照，不再定义现在。
- 新对话不得根据聊天记忆覆盖仓库权威文件。

## 版本与实现入口

- 当前版本号以`package.json`为准。
- Release事实以GitHub Release和对应`verification/`证据为准。
- 代码和运行入口以仓库真实文件为准；具体技术契约看`ARCHITECTURE.md`。
