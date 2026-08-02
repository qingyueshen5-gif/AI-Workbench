# Security Report — stable-single-agent-v1

## 总结

- **Critical：0**
- **High：0**
- **Medium：4（不阻止本轮部署）**
- **Low：2**
- **Security Gate：PASS**
- **部署裁决：GO**

审计未读取或记录任何真实Token/API Key值。

## Critical / High关闭证据

1. 本地HTTP控制面已使用启动时高熵HttpOnly会话令牌，统一校验Host和Origin；任意Origin及DNS rebinding请求被拒绝；`setup-env`使用固定允许列表。
2. Feishu入口在ACK、accepted和Job之前按`open_id`执行fail-closed允许列表，并对群聊要求mention；空列表拒绝启动。
3. Registry的`code.execute`、`code.modify`和`process.stop`由Scheduler确定性要求确认；仅受控测试上下文可以预授权。
4. Codex会话绑定workspace、sandbox和policy hash；策略变化时不resume旧会话。
5. `scripts/verify-v1-critical-high-gates.mjs`和真实HTTP smoke验证以上控制。

## Medium

1. **文件允许根可能被symlink/junction绕过。** 路径校验使用词法`resolve/relative`，没有`realpath`或Windows reparse point检查。
2. **IPC、Session和Task文件未显式收紧ACL。** IPC根只要求绝对路径，可指向不安全位置；accepted/job包含openId和聊天文本。
3. **Electron禁用Chromium sandbox并无条件打开外部URL。** 应启用sandbox并只允许批准协议/域名。
4. **Prompt和工具授权依赖模型结构。** 缺少模型输出之后的确定性Policy Compiler。

## Low

1. 原始消息、事件和状态文件缺少统一脱敏、轮转及保留期限。
2. DeepSeek健康检查会发送真实“只回复OK”模型请求，属于成本和最小权限风险。

## 已验证的正向控制

- 文件工具使用严格JSON Schema和`shell:false`子进程。
- Progress禁止prompt、token、PID、API Key、secret和内部推理。
- process.stop要求精确PID或唯一精确名称，多个同名拒绝，保护名单拒绝，停止后复查。
- 部分旧通道已有owner授权，可作为当前Feishu入口整改参考。
- 未发现源码中的明显Token/API Key字面值。

## Security Gate

Critical=0且High=0，安全回归通过，**Security Gate=PASS**。
