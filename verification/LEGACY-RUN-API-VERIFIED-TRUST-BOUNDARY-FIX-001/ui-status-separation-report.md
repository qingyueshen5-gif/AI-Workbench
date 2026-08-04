# UI状态分离实现与验收报告

新增生产纯模块`src/lib/run-status-view.js`，导出`deriveExecutionView()`、`deriveVerificationView()`和`deriveRunStatusView()`。模块只映射服务端结构化事实，不访问DOM/网络，不修改输入，不读取input/output/evidence同名字段，也不从执行字段推导verified。

执行结构支持`NOT_STARTED`、`RUNNING`、`TERMINAL_UNVERIFIED`、`VERIFIED_COMPLETED`、`FAILED`和`CANCELLED`。验收结构支持`VERIFIED`和`UNVERIFIED`。FAILED、CANCELLED或RUNNING与verified=true组合会fail-closed为UNVERIFIED并标记不一致。

Task历史、TodayPanel列表、Task列表和详情改为同时显示两个明确徽标/区域：“执行”和“验收”。done/completed只显示“执行已结束”；仅服务器可信verified显示“可信验收通过”。失败显示“执行失败”，取消显示“已取消”。TodayPanel进度改为明确的执行已结束比例，并单独显示可信验收通过数量。

未新增公共协议字段，未修改server.mjs、Context投影、DTO、Gateway、Delivery或失败提示责任链。

正式十项聚焦回归与构建均通过；状态矩阵A—L全部PASS。第四类主风险仍为HIGH/OPEN，本报告只证明UI状态分离聚焦范围。
