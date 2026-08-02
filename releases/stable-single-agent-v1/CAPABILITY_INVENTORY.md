# Capability Inventory — stable-single-agent-v1

来源：`capabilities/capability-registry.mjs`与`agents/agent-runtime.mjs`，基线`ea5bec82a8a36ee8101c3317c0fe9e43550a01a8`。

## 已登记清单

| Capability | Provider | Fallback | Registry状态 | Runtime实际执行状态 |
|---|---|---|---|---|
| conversation | deepseek | 无 | available | **部分接入**：普通聊天真实使用DeepSeek表达，但未通过Provider Map执行Registry assignment |
| file.read | local-tool-executor | 无 | available | **部分接入**：真实本地读取并校验mtime/size/SHA-256，但入口仍依赖旧classification/正则，不执行Scheduler assignment |
| runtime.status | local-runtime-state | 无 | available | **部分接入**：读取真实状态文件，但入口仍依赖`statusPattern`，不执行Scheduler assignment |
| code.read | codex | 无 | available | **部分接入**：code任务统一调用Codex，但未按单项Capability执行与独立验证 |
| code.execute | codex | 无 | available | **部分接入**：同上 |
| code.modify | codex | 无 | available | **部分接入**：同上 |
| process.list | local-process-provider | fallback-process-provider | Windows available；Fallback unavailable | **已接入候选**：真实Provider调用和快照验证 |
| process.stop | local-process-provider | fallback-process-provider | Windows available；Fallback unavailable | **已接入候选**：精确PID/唯一名称、保护名单、停止后复查 |

## Provider Inventory

- `deepseek`：Task理解和最终表达；Registry执行接口尚未统一。
- `local-tool-executor`：文件工具子进程；当前验收仅覆盖`file.read`。
- `local-runtime-state`：读取Gateway、Runtime、Task实时状态文件。
- `codex`：官方订阅CLI代码执行Provider；当前代码路径绕过统一Provider Map。
- `local-process-provider`：Windows `tasklist.exe`/`taskkill.exe`进程Provider。
- `fallback-process-provider`：仅登记，默认`unavailable`，测试中使用受控替身验证Fallback选择。

## 当前缺失能力

Interpreter允许表达但Registry未登记或Runtime未执行的能力包括：`file.write`、`file.manage`、`computer.control`、`commerce.order`、`commerce.payment`、`media.video.create`、`web.research`、`system.diagnose`。这是明确的`capability_unavailable`，不是缺陷性伪成功。

## 冻结规则

- 本清单是v1唯一Capability Inventory；新增或删除条目必须经完整部署门禁。
- Registry entry只证明“已登记”，Runtime Assignment+Provider执行+Verifier证据才证明“可执行”。
- 未登记能力不得由DeepSeek或Codex自行伪装完成。
