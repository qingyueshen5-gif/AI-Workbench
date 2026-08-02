# Problem Governance Index — stable-single-agent-v1

## 已有问题

| 编号 | 问题 | 状态 |
|---|---|---|
| ARCH-BOUNDARY-001 | Gateway缓存业务逻辑导致Runtime升级不生效 | 已治理/持续回归 |
| AT-ROUTING-001 | Active Task语义路由错误 | 已治理/持续回归 |
| TASK-INTERPRET-001 | 关键词分类无法覆盖开放式自然语言任务 | 已治理/持续回归 |

## Open部署阻断问题

| 编号 | 等级 | 问题 |
|---|---|---|
| SEC-LOCAL-API-001 | Critical | 本地HTTP API无认证且CORS允许任意Origin访问高权限接口 |
| SEC-FEISHU-AUTH-001 | High | 当前Feishu Runtime缺少发送者、群聊和mention授权门禁 |
| SEC-POLICY-001 | High | 中风险Capability缺少确定性确认与Policy Compiler |
| SEC-CODE-RESUME-001 | High | Codex resume未绑定当前workspace、sandbox和policy hash |
| ARCH-CAPABILITY-001 | P0/High | code、file、status、conversation没有全部由Scheduler Assignment驱动 |
| IPC-ACCEPT-001 | P0/High | accepted后、enqueue前崩溃可造成永久丢消息，恢复函数未接入 |
| RUN-CANCEL-001 | P0/High | 暂停/取消不能终止运行中Provider，也不抑制陈旧Result |
| ARCH-DUAL-RUNTIME-001 | High | 桌面server与飞书Runtime存在两套解释、调度和执行架构 |
| VERIFY-CODE-001 | High | code能力缺少diff、退出码、测试和验收条件独立验证 |
| REGISTRY-CONSUME-001 | Medium | Registry声明、Provider Map、健康状态和实际消费不一致 |
| PROC-LIST-001 | Medium | process.list无法独立交付 |
| FALLBACK-EXEC-001 | Medium | Fallback仅有选择测试，没有默认生产Provider执行链 |
| FILE-REALPATH-001 | Medium | 文件允许根可能被symlink/junction绕过 |
| IPC-PERM-001 | Medium | IPC、Session和Task路径/ACL/保留期未完成治理 |
| QA-ENTRY-001 | Medium | 核心Runtime/Gateway/Capability回归未纳入标准verify入口 |

## 防复发原则

- 入站去重只有一个持久化权威；accepted必须最终进入Job、Result、Delivered或显式Archive。
- Scheduler Assignment必须是Provider执行的唯一依据。
- 模型不得授予权限或降低风险；确认由确定性策略决定。
- `verified=true`必须来自Capability专用Verifier证据。
- 暂停/取消必须在执行器层生效并阻止旧revision交付。
- 所有用户入口必须调用同一个Runtime Application API。
- 每个兼容路径必须记录owner、replacement、sunsetVersion和removalTest。
