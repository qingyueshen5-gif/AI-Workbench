# AI Workbench 任务执行与验收协议

## 1. 角色分工

产品负责人：

- 定产品方向；
- 定优先级；
- 决定是否改变当前唯一任务；
- 接受或拒绝风险；
- 最终拍板阶段是否通过。

Claude：

- 帮助产品负责人梳理想法；
- 将想法结构化；
- 从产品角度进行把关；
- 对完整产品阶段做最终独立验收；
- 根据 GitHub 可访问证据给出 `PASS / CONDITIONAL_PASS / BLOCKED`；
- 不声称访问实际无权访问的本地或生产环境。

GPT：

- 统一跨对话上下文；
- 判断当前唯一任务；
- 防止任务线漂移；
- 把产品负责人的决定转化为完整、可执行、有边界的 Codex 指令；
- 根据 Codex 回报帮助产品负责人理解当前进度；
- 不替代产品负责人最终拍板。

Codex / 执行助手：

- 在授权范围内执行；
- 修改代码或文档；
- 运行测试；
- 检查基线；
- 发现基线冲突、证据不足或风险时停止；
- 不擅自假设；
- 生成 verification；
- commit 和 push；
- 如实汇报 `passed / failed / blocked`；
- 不自行宣布完整产品阶段最终通过。

## 2. 唯一事实来源

唯一事实来源：

- 本地仓库 `F:\AI-Workbench`
- GitHub `origin/main`

禁止：

- 依赖聊天记忆判断任务已经完成；
- 根据用户口头提到的文件名假设文件存在；
- 根据计划文件推断代码已经实现；
- 根据 mock 结果推断生产已经可用；
- 根据本地成功推断 GitHub Actions 已成功。

每轮开始必须真实确认：

- 当前分支；
- `git status`；
- 本地 HEAD；
- `origin/main` HEAD；
- 工作区修改；
- 必读文件是否存在；
- 文件是否被 Git 跟踪；
- 上次 push 是否已经到达 GitHub。

## 2.1 事实单一归属规则

当前状态不得在多个文件里各自维护独立事实。需要展示时只能引用或由脚本生成快照。

- 当前版本：唯一权威是 `package.json` 的 `version`。`CONTEXT.md` 可展示当前版本，但必须自动校验一致；其他文件不得自行维护版本状态。
- 当前唯一下一步：唯一权威是 `NEXT_STEP.md`。其他文件只能引用，不得另立；`CURRENT_TASK.md` 只描述正在执行或最近完成的任务，不定义后续路线。
- 已完成/未完成能力：唯一权威是 `CURRENT_PROGRESS_AUDIT.md`。
- 产品方向：`PRODUCT.md` 定义产品与边界，`VISION.md` 记录长期愿景，`PRINCIPLES.md` 记录铁律，`DECISIONS.md` 记录已锁定决策，`THINKING.md` 记录产品负责人判断依据和“为什么”。
- Release 事实：以 GitHub Release 和 `verification/3b-release/summary.json` 为准。
- 历史记录：`TASKLOG.md`、`CHANGELOG.md`、`tasks/`、`verification/`、`research/` 属于历史证据，允许保留旧版本号和当时状态；严禁为统一当前口径而篡改历史。
- Handoff 职责：`AI-Workbench-Handoff.md` 只承载自动生成的最小快照和权威文件索引，不承载任何独有事实，不手工复制源文档正文。
- 文档防漂移：修改当前状态文件后必须运行 `npm.cmd run docs:generate-handoff` 和 `npm.cmd run verify:docs-consistency`。

## 2.2 新对话交接规则

- 普通新对话：默认提供五份文件：
  1. `AI-Workbench-Handoff.md`
  2. `NEXT_STEP.md`
  3. `THINKING.md`
  4. `PRINCIPLES.md`
  5. `GROWTH_LOG.md`
- 新对话如需理解决策背景，必须阅读 `THINKING.md`、`PRINCIPLES.md` 和 `GROWTH_LOG.md`。
- 需要判断某项具体验收时，再读取对应 `verification/<task>/summary.json`、`verification/<task>/report.md`、必要的 `commands.log`、对应 commit 和 Git diff。
- 新对话不需要默认读取全部 `verification/` 目录。只有当前任务相关证据才需要增加。
- 对方无法访问本机仓库时，必须提供文件内容或 GitHub 链接，不能只给本地路径。
- 任何新决策、任务结论和验收结果都必须回写仓库，不得只留在聊天里。

## 3. 单一主线原则

每次只推进一个主线任务。

支持该主线所必需的文档更新、验收脚本、安全扫描、构建配置和交接留痕，可以在同一任务内完成。

不得趁机加入新功能、后续路线、无关重构、UI 美化或未经排期的技术实验。

下一阶段必须由产品负责人明确批准后才能开始。

## 4. 所有大任务必须分段执行

标准阶段固定为：

- 阶段0：仓库状态审计
- 阶段1：现有链路和真实能力检查
- 阶段2：制定最小修改方案
- 阶段3：实施最小修改
- 阶段4：构建或运行目标产物
- 阶段5：本地预验收和安全扫描
- 阶段6：外部环境验证
- 阶段7：生成 verification 证据
- 阶段8：更新任务、版本和交接文档
- 阶段9：git diff 检查、commit、push
- 阶段10：确认工作区干净、HEAD 与 origin/main 一致
- 阶段11：汇报并停止

不得一口气盲跑到结束。

每个阶段必须记录状态、做了什么、使用的命令、退出码、产物路径、失败原因、是否允许进入下一阶段。

阶段状态只允许使用：

- `passed`：真实执行并通过；
- `failed`：真实执行但未通过；
- `blocked`：缺少必要外部条件，当前无法继续；
- `partial`：仅完成部分内容；
- `pending`：等待外部结果；
- `not_run`：尚未执行；
- `skipped`：有明确理由跳过。

禁止用 `planned`、`expected`、`should work` 等推测代替真实结果。

## 5. 技术决策与授权

普通技术选择由 Codex 按以下优先级直接处理：

1. 当前仓库事实；
2. 已有架构；
3. 产品三条铁律；
4. 最小修改；
5. 最低风险；
6. 可验证和可回滚。

不得为了普通技术细节反复让产品负责人选择。

只有以下情况才要求产品负责人介入：

- 支付；
- API Key 或账号凭证；
- 删除不可恢复的数据；
- 覆盖重要成果；
- 发布到外部；
- 正式 Release；
- 正式 tag；
- 系统要求的管理员权限；
- 其他高风险或不可逆操作。

系统弹出网络、安装 exe、卸载或 `git push` 授权时：

- 说明将执行的具体命令；
- 说明实际风险；
- 给出推荐；
- 获得授权后继续。

## 6. 外部验证不能提前判绿

GitHub Actions：

- 本轮可以创建、修改并提交 workflow；
- 如果 push 后没有取得真实 Actions 运行结果，状态必须写 `pending` 或 `not_run`，不得写 `passed`；
- 只有拿到真实 run ID、结论和日志后，才能写 `passed` 或 `failed`。

任何云端、第三方平台、下载链接、Release、远程服务同理。

“代码已经写好”不能证明“外部流程已经成功”。

## 7. mock 与生产验证必须分开

mock、临时环境变量和本地替代服务只用于证明：

- 代码路径可以运行；
- 接口结构正确；
- 失败处理有效；
- 验收脚本本身可用。

mock 不能证明：

- 生产共享 Key 已真实注入；
- 陌生机器可以访问正式共享服务；
- 正式上游额度和权限可用；
- 正式 Release 已可下载。

验收报告必须明确区分：

- `mechanism_test`：机制测试；
- `production_test`：生产验证。

如果 `shared_managed` 的生产注入方式尚未实现，状态写 `failed` 或 `blocked`，写清阻塞点，不得把 mock 结果写成生产可用。

## 8. 安装和卸载验证

Windows NSIS 安装包优先使用真实静默参数验证。

安装优先尝试：

```text
/S
```

卸载优先尝试卸载程序支持的静默参数。

必须记录实际命令、退出码、安装目录、快捷方式、启动结果、卸载结果、卸载后残留。

如果静默安装或卸载不可用，可使用 GUI 手动验证；报告中必须写明是 GUI 验证，保存截图或其他真实证据，不得伪装成自动验收。

没有实际完成卸载，`uninstall` 不得写 `passed`。

## 9. 失败任务也必须形成完整留痕

如果任何核心项失败：

- 不得伪造绿色；
- 不得进入下一阶段；
- 仍需在安全可行的情况下生成候选产物、写 `summary.json`、写 `report.md`、保存真实日志、更新任务文档、commit + push。

summary 状态写 `failed`、`blocked`、`partial` 或 `pending`。

失败本身也是有效验收结果。

## 10. 文件放置规则

长期产品定义：

- `PRODUCT.md`
- `VISION.md`
- `PRINCIPLES.md`

执行规范：

- `EXECUTION_PROTOCOL.md`

当前任务和交接：

- `CURRENT_TASK.md`
- `TASKLOG.md`
- `NEXT_STEP.md`
- `DECISIONS.md`
- `CURRENT_PROGRESS_AUDIT.md`
- `AI-Workbench-Handoff.md`
- `THINKING.md`

上线最小集：

- `LAUNCH.md`

版本记录：

- `CHANGELOG.md`
- `versions/current.json`
- `versions/lock.json`
- `versions/releases/*.json`

任务记录：

- `tasks/YYYY-MM-DD-任务名.md`

方案与调研：

- `research/xxx-plan.md`
- `research/xxx-analysis.md`
- `research/xxx-report.md`

验收证据：

- `verification/<任务名>/summary.json`
- `verification/<任务名>/report.md`
- `verification/<任务名>/*.log`
- `verification/<任务名>/*.png`

安装包候选版：

- `release-v版本号-installer/`

候选 exe 不提交 Git。正式安装包通过 GitHub Release 发布。

本地数据、缓存和密钥不得提交：

- `.env`
- `data/`
- `logs/`
- `evidence/`
- `node_modules/`
- `.npm-cache/`
- `.electron-cache/`
- `.tmp-*`
- 用户运行目录
- 安装包 exe
- 本地凭证

## 11. 每个任务的固定结构

以后每份 Codex 指令都必须包含：

1. 当前事实；
2. 本轮唯一目标；
3. 明确禁止事项；
4. 开始前仓库审计；
5. 要读取和检查的文件；
6. 最小实施方案；
7. 分段执行顺序；
8. 要修改的代码和文档；
9. 要生成的验收产物；
10. 要运行的验证命令；
11. 状态判定标准；
12. 交接文档更新；
13. commit + push；
14. Git 同步检查；
15. 固定最终汇报格式；
16. 完成后停止。

## 12. 完成状态判定

一个任务只有同时满足以下条件，才能标记完成：

1. 代码或文档真实写入 `F:\AI-Workbench`；
2. 必须的产物真实存在；
3. 验收使用真实命令、文件、退出码和扫描结果；
4. `summary.json` 明确记录 `passed`；
5. `TASKLOG.md` 已更新；
6. `CHANGELOG.md` 已更新；
7. `CURRENT_TASK.md` 已更新；
8. 需要的交接文件已更新；
9. `git diff` 已检查；
10. commit 已生成；
11. push 成功；
12. 工作区干净；
13. 本地 HEAD 与 `origin/main` 一致；
14. 外部任务有真实外部结果。

任一条件未满足，只能标记 `partial`、`failed`、`blocked`、`pending` 或 `not_run`。

## 13. 最终汇报固定格式

每次最终汇报必须包含：

1. 本轮任务状态；
2. 各执行阶段状态；
3. 做了什么；
4. 产物路径；
5. 真实验收结果；
6. 外部验证状态；
7. 失败项和已知问题；
8. 修改文件；
9. commit ID；
10. push 是否成功；
11. 当前工作区是否干净；
12. 本地 HEAD 是否等于 `origin/main`；
13. 是否具备进入下一阶段的条件；
14. 下一步建议；
15. 明确声明没有自动继续下一阶段。

## 14. 执行验收与阶段验收

执行验收是 Codex 单轮任务完成后的自检和交付。Codex 每轮完成后必须：

- 给出执行状态；
- 列出修改内容；
- 列出未做事项；
- 提供测试结果；
- 提供 verification 路径；
- 提供 commit 和 push；
- 确认工作区 clean；
- 停止等待产品负责人。

阶段验收是一个完整产品阶段结束时的独立验收，不能由 Codex 自己宣布完成。独立验收应从 GitHub 读取证据，交叉核对代码、测试、verification 和权威文档，并输出：

- 已完成；
- 未完成；
- 严重阻塞；
- 非阻塞问题；
- 结论 `PASS / CONDITIONAL_PASS / BLOCKED`；
- 是否允许结束阶段。

阶段没有通过独立验收和产品负责人批准，不得宣布阶段结束，不得进入下一阶段。

## 15. 专业工作流地图

本节是专业岗位和协作归属的权威地图。岗位可以由人、GPT/Claude/Codex 或外部 Agent 辅助承担，但 `main` 集成、测试、commit 和 push 只能由 Codex 在授权范围内统一执行。

| 岗位/能力 | 负责模块 | 具体任务 | 必读文件 | 可用工具或 Agent | 能否并行 | 不可多人同时改 | 输出交给谁 | 集成者 | 验收者 | 当前启用 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 产品负责人 | 全部 | 定方向、优先级、关键取舍、风险接受、阶段拍板。 | `AI-Workbench-Handoff.md`、`NEXT_STEP.md`、`THINKING.md`、`PRINCIPLES.md`、`GROWTH_LOG.md` | GPT、Claude、Codex 回报 | 思考可并行，拍板串行 | `NEXT_STEP.md`、已锁定决策 | GPT/Codex | 产品负责人 | 产品负责人 | 是 |
| 产品经理 | 产品定义、路线、v0.4.7、真人试用 | 把用户问题转成范围、验收和优先级建议。 | `PRODUCT.md`、`DECISIONS.md`、`CURRENT_PROGRESS_AUDIT.md` | GPT、Claude | 可并行研究 | `PRODUCT.md`、`DECISIONS.md` | 产品负责人 | Codex | 产品负责人/Claude | 需要时 |
| 用户研究 | 真人试用、反馈、市场验证 | 访谈、试用任务、用户画像、流失关口。 | `PRODUCT.md`、`THINKING.md`、`CURRENT_PROGRESS_AUDIT.md` | Claude、表格、问卷工具 | 可并行 | 用户反馈原始资料 | 产品负责人 | Codex 整理 | 产品负责人 | 待启用 |
| UI 设计 | 基础体验、官网、桌面/Web/移动 | 一个输入框、状态、错误、视觉质量。 | `PRODUCT.md`、`PRINCIPLES.md` | 截图审查、虚拟人格 | 可并行出方案 | `src/` 同一页面 | 产品负责人 | Codex | 产品负责人/Claude | 待启用 |
| UX 设计 | 任务流程、权限、失败恢复 | 首次使用、确认、拒绝、恢复、清除。 | `PRODUCT.md`、`THINKING.md`、`PRINCIPLES.md` | GPT、Claude | 可并行 | 产品流程文档 | 产品负责人 | Codex | 产品负责人 | 待启用 |
| 前端工程 | 桌面渲染层、状态和交互 | 输入、消息、附件、错误、反馈入口。 | `PRODUCT.md`、`ARCHITECTURE.md`、`src/` | Codex、Playwright | 隔离分支可并行 | `src/` | Codex | Codex | Codex/QA | 未启用 |
| 桌面端工程 | Windows 安装、启动、更新、卸载 | Electron、NSIS、watchdog、兼容性。 | `package.json`、`electron/`、`SETUP.md` | Codex、GitHub Actions | 部分可并行 | `electron/`、打包配置 | Codex | Codex | Codex/QA | 未启用 |
| Web 工程 | Web 端和同步 | 浏览器访问、账户、部署、会话一致性。 | `PRODUCT.md`、`ARCHITECTURE.md` | Codex、Cloudflare | 研究可并行 | Web/API 文件 | Codex | Codex | 产品负责人 | 当前不启用 |
| 移动端工程 | iOS/Android/鸿蒙 | 移动输入、图片、通知、商店发布。 | `PRODUCT.md`、`VISION.md` | 移动框架调研 | 研究可并行 | 移动端代码 | 产品负责人 | Codex 或专门工程 | 产品负责人 | 当前不启用 |
| 后端工程 | API、任务、记忆、错误 | 本地 API、状态、数据、恢复。 | `ARCHITECTURE.md`、`server.mjs` | Codex、自动化测试 | 隔离可并行 | `server.mjs`、数据 schema | Codex | Codex | Codex/QA | 未启用 |
| API 工程 | Provider、通道、工具接口 | 统一接口、错误码、兼容性。 | `ARCHITECTURE.md`、`managed-proxy/README.md` | Codex、官方文档 | 可并行研究 | API 契约 | Codex | Codex | Codex/Claude | 未启用 |
| AI 和模型调度工程 | 模型/Agent/工具调度、模型分层 | 路由、质量/成本权衡、fallback。 | `ARCHITECTURE.md`、`DECISIONS.md` | GPT、Codex、测试模型 | 方案可并行 | `model-proxy.mjs`、`managed-proxy/src/` | 产品负责人 | Codex | 产品负责人/Claude | 当前不启用 |
| Agent 工作流工程 | 多 Agent、任务拆解、执行恢复 | 编排、状态、并行和冲突处理。 | `ARCHITECTURE.md`、`EXECUTION_PROTOCOL.md` | GPT、Claude、外部 Agent | 研究可并行 | 工作流核心代码 | Codex | Codex | 产品负责人 | 当前不启用 |
| 上下文和记忆工程 | 会话、记忆、压缩 | 防串线、摘要、清除、恢复。 | `ARCHITECTURE.md`、`THINKING.md` | GPT、Codex | 方案可并行 | 记忆数据结构 | Codex | Codex | 产品负责人/QA | 当前不启用 |
| 多模态工程 | 图片和文件 | 上传、解析、模型能力、隐私。 | `PRODUCT.md`、`PRINCIPLES.md` | 模型文档、Codex | 研究可并行 | 附件和上传代码 | Codex | Codex | 产品负责人/QA | 当前不启用 |
| 数据工程 | 埋点、日志、反馈分析 | 事件 schema、存储、查询、脱敏。 | `DECISIONS.md`、`PRODUCT.md` | 数据工具、Codex | 方案可并行 | 日志/事件 schema | 产品负责人 | Codex | 隐私/产品负责人 | 当前不启用 |
| 埋点和日志工程 | v0.4.7 反馈机制 | 最小元数据、错误码、关闭/清除。 | `DECISIONS.md`、`GROWTH_LOG.md` | Codex、QA | 方案可并行 | 采集代码和 schema | 产品负责人 | Codex | 隐私/QA | 当前不启用 |
| 安全工程 | 防御性安全、权限、供应链 | Secret、依赖、Prompt Injection、安装包完整性。 | `PRINCIPLES.md`、`CURRENT_PROGRESS_AUDIT.md` | 安全扫描、Codex | 审查可并行 | 安全配置、Secrets 相关文件 | Codex | Codex | 独立审计 | 候选 |
| 隐私和合规 | 数据、权限、支付、跨平台 | 告知、同意、撤回、保存周期、平台规则。 | `PRINCIPLES.md`、`DECISIONS.md` | Claude、法律/平台文档 | 可并行研究 | 隐私文案和数据字段 | 产品负责人 | Codex | 产品负责人/Claude | 候选 |
| 测试和质量保证 | 全模块 | 验收场景、回归、真实用户检查。 | `EXECUTION_PROTOCOL.md`、`verification/` | Codex、Playwright、虚拟人格 | 可并行设计 | verification 同一目录 | Codex | Codex | 产品负责人/Claude | 需要时 |
| 自动化测试 | 回归和 CI | 脚本、日志、可重复验证。 | `package.json`、`scripts/` | Codex、GitHub Actions | 可并行设计 | `scripts/` 同一脚本 | Codex | Codex | Codex | 需要时 |
| DevOps | 构建、发布、部署 | CI、Release、环境变量、回滚。 | `package.json`、`CHANGELOG.md` | Codex、GitHub、Cloudflare | 研究可并行，部署串行 | CI/Release/Cloudflare 配置 | 产品负责人 | Codex | 产品负责人 | 未启用 |
| Cloudflare 和基础设施 | Managed Proxy、D1、Worker | Worker、D1、Secrets、流量、监控。 | `managed-proxy/`、`verification/managed-proxy-production/summary.json` | Codex、Wrangler | 只读审计可并行，生产操作串行 | `managed-proxy/`、Cloudflare 配置 | 产品负责人 | Codex | 独立审计/产品负责人 | 当前不操作 |
| 打包和发布 | 安装包、Release、应用商店 | NSIS、签名、哈希、发布记录。 | `package.json`、`CHANGELOG.md` | Codex、GitHub Actions | 研究可并行，发布串行 | Release 和 tag | 产品负责人 | Codex | 产品负责人 | 未启用 |
| 支付和商业化 | 免费额度、收费、自带 Key | 方案、合规、账单、退款、欺诈。 | `DECISIONS.md`、`GROWTH_LOG.md` | 支付产品研究 | 可并行研究 | 支付配置和用户数据 | 产品负责人 | Codex | 产品负责人/合规 | 当前不启用 |
| 加密支付研究 | 加密支付 | 法律、平台规则、资产安全、替代方案。 | `VISION.md`、`GROWTH_LOG.md` | 公开资料、合规审查 | 只研究 | 不改代码 | 产品负责人 | 无 | 产品负责人 | 战略研究 |
| 品牌 | 定位、命名、视觉 | 可信、简单、不过度承诺。 | `PRODUCT.md`、`VISION.md` | Claude、设计工具 | 可并行 | 品牌文案 | 产品负责人 | Codex | 产品负责人 | 未启用 |
| 宣传页面 | 官网、下载页、演示 | 只宣传已完成能力，提供下载和案例。 | `README.md`、`PRODUCT.md`、`CURRENT_PROGRESS_AUDIT.md` | 前端、截图 | 可并行草案 | 公开页面 | Codex | Codex | 产品负责人 | 当前不启用 |
| 内容营销 | 内容、案例、社媒 | 用户教育、真实案例、边界说明。 | `PRODUCT.md`、`THINKING.md` | Claude/GPT | 可并行 | 公开文案 | 产品负责人 | Codex | 产品负责人 | 当前不启用 |
| 市场营销 | 渠道、增长、国际市场 | 找真实用户，不夸大能力。 | `PRODUCT.md`、`VISION.md` | 市场调研工具 | 可并行研究 | 市场计划 | 产品负责人 | Codex 整理 | 产品负责人 | 当前不启用 |
| 用户运营 | 试用、反馈、支持 | 招募、跟进、问题分类。 | `PRODUCT.md`、`CURRENT_PROGRESS_AUDIT.md` | 表格/问卷 | 可并行 | 用户反馈原始数据 | 产品负责人 | Codex 整理 | 产品负责人 | 待启用 |
| 客户支持 | 问题解释、恢复路径 | 安装失败、预算到顶、崩溃、卸载。 | `PRODUCT.md`、`SETUP.md` | FAQ、日志 | 可并行 | 支持话术 | 产品负责人 | Codex | 产品负责人 | 待启用 |
| 国际化和本地化 | 多语言、多地区 | 语言、日期、地区规则、支付。 | `VISION.md` | 翻译/地区资料 | 可并行研究 | i18n 资源 | Codex | Codex | 产品负责人 | 当前不启用 |
| 生态合作 | 模型/Agent/工具合作 | 接入、准入、质量、合规。 | `VISION.md`、`PRINCIPLES.md` | 公开资料、商务记录 | 可并行研究 | 合作决策 | 产品负责人 | Codex | 产品负责人 | 长期 |
| 成本和预算管理 | 钱包、安全、跑道 | 成本测算、预算刹车、用量观察。 | `CURRENT_PROGRESS_AUDIT.md`、`verification/` | 计算脚本、Cloudflare 证据 | 分析可并行，生产变更串行 | 预算配置和算法 | 产品负责人 | Codex | 独立审计 | 底座完成，持续观察 |
| 技术文档 | 架构、交接、任务记录 | 权威归属、Handoff、任务地图。 | 全部权威文档 | Codex | 可并行审阅，写回串行 | `CONTEXT.md`、`TASKLOG.md`、`CURRENT_PROGRESS_AUDIT.md` | 产品负责人 | Codex | 产品负责人/Claude | 是 |
| 独立审计和验收 | 阶段封板 | GitHub 证据审计、diff、verification 核对。 | `EXECUTION_PROTOCOL.md`、对应 verification | Claude/GPT | 可独立并行 | 不直接改 main | 产品负责人 | 无 | 产品负责人 | 阶段结束时 |

## 16. 多 Agent 并行和文件边界

多 Agent 可以并行存在于研究、方案、测试和审计层，但不能并行失控修改产品核心链路。

固定原则：

- 一个产品阶段；
- 一个最终决策入口；
- 阶段内多个隔离模块可以并行；
- 每个 Agent 只负责一个模块；
- 使用相同 baseline；
- 不基于其他未合并分支继续开发；
- 不直接 push main；
- Codex 是唯一代码集成人；
- 合并后运行完整测试；
- GPT 审核技术证据；
- Claude 复核产品逻辑；
- 产品负责人最终拍板。

允许并行：

- 市场、用户、竞品、合规、支付和生态研究；
- UI/UX 草案、虚拟人格测试、测试用例设计；
- 不同 Agent 在隔离分支或补丁文件中产出候选方案；
- Claude/GPT 对已 push 的 GitHub 证据做独立审计。

必须串行集成：

- `NEXT_STEP.md` 当前唯一下一步；
- `DECISIONS.md` 已锁定决策；
- `CURRENT_PROGRESS_AUDIT.md` 当前状态；
- `PRODUCT.md` 产品定义；
- `PRINCIPLES.md` 铁律；
- `managed-proxy/src/`、`model-proxy.mjs`、`src/`、D1 schema、Cloudflare 配置、预算、模型路由、Release、安装包。

绝对不能由多个 Agent 同时直接修改的文件包括：

- `NEXT_STEP.md`
- `DECISIONS.md`
- `CURRENT_PROGRESS_AUDIT.md`
- `CONTEXT.md`
- `TASKLOG.md`
- `CHANGELOG.md`
- `AI-Workbench-Handoff.md`
- `PRODUCT.md`
- `PRINCIPLES.md`
- `EXECUTION_PROTOCOL.md`
- `package.json`
- `model-proxy.mjs`
- `managed-proxy/src/`
- `managed-proxy/wrangler.jsonc`
- D1 schema、Secrets、Release、安装包和生产流量配置。

外部多 Agent 不得直接 push 到 `main`，不得读取未授权 Secret 或用户数据。Codex 是唯一代码集成人：负责合并候选、运行测试、生成证据、commit 和 push。产品负责人仍只对一个产品阶段作最终批准。

## 17. 文件驱动协调 Agent

统一名称：文件驱动、无隐藏长期记忆的协调 Agent。

它只负责：

- 读取当前任务目标；
- 读取任务账本；
- 分配任务；
- 跟踪状态；
- 汇总结果；
- 把需要决策的事项交给产品负责人。

它不能：

- 改变产品方向；
- 批准支付；
- 批准删除；
- 部署生产；
- push main；
- 自己接受风险；
- 免除后续验收。

项目记忆必须写回仓库文件。任何没有写回仓库的协调状态，都不能作为下一轮事实依据。

## 18. 并行任务开工门槛

任何并行线开工前必须填齐：

1. 任务目标；
2. 预算上限；
3. 安全边界；
4. 文件或系统权限范围；
5. 输出内容；
6. 验收标准；
7. 停止条件；
8. 由谁最终集成。

任一为空，状态写 `not_ready_to_start`，不得开工。

当前三类计划：

- 主线：v0.4.7 市场基础可用性，仍需产品负责人批准后才能启动。
- 辅助研究线：国内/国际内部研发指挥入口、虚拟人格测试设计、成熟产品研究、信息收集方案、多 Agent 成本测算。
- 辅助线不得阻塞 v0.4.7，不得改变 `NEXT_STEP.md` 当前唯一下一步。

## 19. 执行快但不能免检

执行可以快，但结果不能免检：

- Agent 结果不得直接进入 main；
- Codex 统一集成；
- 运行测试；
- 检查真实产品；
- GPT 审技术证据；
- Claude 审产品逻辑；
- 产品负责人最终批准；
- 脚本通过不自动等于产品通过。

这条规则适用于 v0.4.7、通讯入口、多 Agent、模型分层、上下文压缩、支付、生产部署和所有后续阶段。
