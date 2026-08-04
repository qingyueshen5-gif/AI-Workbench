# UI执行状态与可信验收状态只读审计

UI没有独立Run列表或Run详情；状态展示集中在任务历史、TodayPanel和TaskPanel。现有`statusText/statusClass`把`done`显示为绿色“已完成”，Task摘要回退为“这件事已经完成”，TodayPanel还把done计入绿色进度条，均会让生命周期终态产生业务成功含义。Task详情只有单一“状态”行，没有可信验收状态。失败有红色徽标和失败说明；cancelled没有显式语义，落入通用样式。

未发现前端根据`status`、`executionCompleted`或证据字段自行生成`verified=true`，因为当前UI根本没有展示verified。但缺少可信验收展示本身导致done承担了成功语义。没有状态筛选或成功排序；唯一混淆统计是TodayPanel的doneCount。

TopBar的`currentStage=completed`是WorkBench运行阶段，不是Task/Run业务结果；`latestSuccessfulTask`是runtime API提供的运维摘要，本轮不修改公共协议。聊天流中的自然语言回复也不是Task/Run状态组件，且失败提示责任链明确禁止修改。

可在纯前端完成：新增`src/lib/run-status-view.js`，消费Task及关联Run的服务器字段，输出独立execution和verification结构；JSX使用两个明确徽标/详情行；TodayPanel进度明确标注为执行已结束比例，并单独显示可信验收数量。无需修改server.mjs、Gateway、Delivery或失败提示责任链。
