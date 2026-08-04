# 外部Agent Context入口与调用方审计

正式入口只有`POST /api/agents/hermes/invoke`。现有代码在解析请求后读取`payload.context`，并用`payload.context || buildTaskContextPackage(...)`选择Context。相同`taskContext`随后展开传给`agentRegistry.invoke()`并写入`Run.input.task_context`。

仓库未发现其它HTTP Agent invoke入口、WebSocket、IPC或内部RPC Context入口。候选字段`task_context`、`taskContext`、`agentContext`、`agent_context`、`runtimeContext`、`runtime_context`、`options.context`和`invokeOptions.context`均未被该请求协议读取，不能仅因命名相似而拒绝。正式禁写路径只有请求根级`context`。

仓库内直接HTTP调用方只有`scripts/verify-hermes-adapter.mjs`，它只提交`taskId`和`timeoutMs`，不提交Context，无兼容迁移依赖。未发现需要额外信息传递的真实需求，也不需要修改Gateway、Delivery、Authorization、Risk或失败提示责任链。

修复应在`readData()`、Task创建/patch、Agent调用、Run创建及写入之前，用own-property存在语义拒绝`context`；正常请求必须无条件调用`buildTaskContextPackage()`。不得静默忽略、合并、白名单补充或保留fallback。
