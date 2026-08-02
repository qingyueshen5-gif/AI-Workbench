# TASK-INTERPRET-001：关键词分类无法覆盖开放式自然语言任务

- **问题编号：** TASK-INTERPRET-001
- **发现时间：** 2026-08-02
- **现象：** 同一目标可表达为“关掉”“退出”“不要后台运行”“处理掉”等不同自然语言；基于动作词和对象词列表的分类器无法稳定形成相同任务结构。
- **第一失败点：** 旧Runtime先依赖`ActiveTaskController`词汇规则决定action/target，再决定执行路径；未命中的系统操作会落入普通聊天，让语言模型直接生成拒绝文案。
- **根因：** 将开放式任务理解问题错误实现为封闭关键词匹配，并把理解、能力发现和Provider选择耦合。
- **治理方案：** 非纯聊天任务先通过Task Interpreter生成统一结构；Scheduler只根据`requiredCapabilities`查询Capability Registry并排序Provider；执行和验证另行完成。
- **防复发规则：** 新自然语言表达不得通过追加同义词列表改变最终intent；必须加入Task Interpreter结构化测试，验证goal、actions、targets、constraints、requiredCapabilities、successCriteria、risk和confidence。
- **安全门禁：** 低置信度必须澄清；高风险必须确认；Interpreter不得输出Provider、执行结果或因能力缺失直接拒绝。
