# Active Task 问题治理记录

## AT-ROUTING-001：Active Task关键词抢跑导致明确新任务被误合并

- **问题编号：** AT-ROUTING-001
- **首次发现时间：** 2026-08-02
- **现象：** 明确文件读取任务“读取 E:\AI-Workbench\NEXT_STEP.md，告诉我当前最重要的目标。不要修改文件。”被当作旧任务补充，未创建新Job，也未进入Intent Router。
- **第一失败点：** `ActiveTaskController.classifyActiveTaskMessage()`在Intent Router之前仅因命中“不要修改”将消息分类为`correction`。
- **根因：** 旧分类器没有拆分动作、对象、期望结果、限制条件和任务关系；Active Task控制关键词优先于明确动作与对象。旧任务因对应Job写入另一IPC目录、始终未被Runtime领取，也未生成Result/失败/取消记录，故长期停留在`accepted`并污染同会话状态。
- **修复模块：** `agents/active-task-controller.mjs`
- **修复原则：** 明确动作+明确对象优先作为新任务；限制词不决定correction；仅有明确承接表达且没有独立动作/对象时才允许Active Task控制；歧义进入后续语义判断；无执行证据且超时的accepted任务视为stale，不得拦截。
- **自动化回归用例：** `scripts/verify-active-task-semantic-routing.mjs`，覆盖文件读取、删除、检查、打开、日志搜索、纠正、继续、暂停、取消、普通聊天，以及正常/completed/failed/stale Active Task状态。
- **防复发门禁：** 部署前必须执行上述脚本；每例记录action、target、expected_result、constraints、relation_to_active_task、最终分类、是否创建新Job、是否误合并旧任务。任一断言失败禁止部署。
- **关联提交：** `126fd00443dcb3e9513f5ab844f946c4561f5404`
- **是否再次发生：** 否。若同类问题再次出现，必须登记为“AT-ROUTING-001门禁失效”，不得新建独立Bug或仅追加关键词补丁。
