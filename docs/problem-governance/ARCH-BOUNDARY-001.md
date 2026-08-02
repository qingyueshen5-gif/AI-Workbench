# ARCH-BOUNDARY-001：Gateway缓存业务逻辑导致Runtime升级不生效

- **问题编号：** ARCH-BOUNDARY-001
- **首次发现时间：** 2026-08-02
- **现象：** Runtime已经切换到包含新Active Task分类器的提交，但真人消息仍由未重启Gateway中缓存的旧分类器拦截并生成控制回复，新Runtime没有领取Job。
- **第一失败点：** 固定Gateway在持久化accepted之后、创建Job之前调用进程内`ActiveTaskController`，导致业务版本由Gateway生命周期决定。
- **根因：** Gateway与Runtime只做了进程拆分，没有做职责拆分；真实入口和自动化测试入口不同。
- **修复模块：** `scripts/workbench-feishu-adapter.mjs`、`agents/agent-runtime.mjs`、`scripts/workbench-agent-runtime.mjs`。
- **修复原则：** Gateway只负责通信、持久化、队列和交付；所有Active Task和Intent语义必须在Runtime领取Job后执行。
- **自动化回归用例：** `scripts/verify-gateway-runtime-business-boundary.mjs`。
- **防复发门禁：** Gateway源码禁止导入或引用ActiveTaskController、Intent Router、control语义；合法文本必须无条件写入一个原始Job；Runtime切换测试必须使用`AgentRuntime.handle`这一真实Job入口验证新业务逻辑立即生效。
- **关联提交：** 待候选提交后回填。
- **是否再次发生：** 否。再次出现时按本门禁失效处理，不得只重启Gateway或追加关键词补丁。
