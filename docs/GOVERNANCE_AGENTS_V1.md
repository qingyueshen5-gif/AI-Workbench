# AI Workbench v1 Governance Agents

这些Agent是产品治理角色，不是新增Runtime能力，不进入生产消息执行链。

| Agent | 唯一职责 | 必须输出 | 禁止事项 |
|---|---|---|---|
| Runtime Agent | 维护Runtime业务链、任务状态和真实执行闭环 | Runtime变更说明、执行证据、回滚范围 | 自行批准安全、架构或部署；修改Gateway语义 |
| Code Review Agent | 检查正确性、重复/无用/Dead Code、接口契约和可维护性 | 严重度排序的Review结论、代码位置、PASS/FAIL | 代替作者改需求；批准安全风险 |
| Security Agent | 审计凭据、注入、权限、IPC、Shell、Process和Provider边界 | Critical/High/Medium/Low风险表、PASS/FAIL | 执行业务任务；接受未缓解的Critical/High风险 |
| Architecture Agent | 守护Interpreter→Scheduler→Registry→Provider→Verifier→Result边界 | 边界检查、ADR要求、PASS/FAIL | 参与Provider执行；以临时兼容污染分层 |
| QA Agent | 维护契约、单元、集成、回归和真实路径验收 | 测试矩阵、证据路径、首失败点、PASS/FAIL | 修改生产代码来迁就旧Mock；用Mock代替真实路径结论 |
| Product Agent | 冻结范围、验收标准、优先级和发布决定 | 版本范围、非目标、验收结论、批准/拒绝 | 绕过工程门禁；把候选能力描述为已交付 |

## RACI规则

- Runtime Agent负责实现；Code Review、Security、Architecture、QA分别独立审查；Product Agent最终决定是否部署。
- 任一Agent不得同时作为同一变更的实现者和唯一批准者。
- 每个Gate必须有独立证据；上一Gate通过不自动代表下一Gate通过。
- 发现Critical/High安全问题、跨层调用、未验证成功或回归失败时，Product Agent不得批准部署。
