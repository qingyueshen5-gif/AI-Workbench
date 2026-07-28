# AW-AILINK-READINESS-001｜AI Link单次受控生成前最小就绪核验

- 核验时间：2026-07-28 21:48–22:04 +08:00
- 任务性质：只读UI、Session、工作流落盘状态、应用代码路径与网络连接核验；形成操作卡；不执行生成。
- 最终结论：`blocked_proxy_path_unverified`
- 是否执行“让 AI 生成方案”：否。
- 是否创建工作流、员工或飞书群：否。
- 是否修改AI Link、代理、网络或产品代码：否。

## 1. 四项硬条件

| 条件 | 结果 | 证据 |
| --- | --- | --- |
| AI Link UI可用 | 通过 | AI Link v0.2.12窗口成功激活；页面完整；员工/协作群页签切换响应；协作群列表和草稿详情均可读取。 |
| 登录Session有效 | 通过 | 无登录页、重新认证、认证过期或权限错误；可访问数字员工、协作群、余额与今日用量；本机代理在线、ChatGPT 1/1已启用。未读取或输出Cookie/Token。 |
| workflow请求代理路径可证明 | 不通过 | 现有草稿证明历史生成成功，但当前应用实现为renderer→IPC `workflow:generate`→主进程→`127.0.0.1:18765/v1/chat/completions`→`ai-link-llm.lhmxrzs.cn`。核验时18765 diagnostics的`byPath`只有health/diagnostics，AI Link PID无到7890连接，且安装包代码未见外部7890 dispatcher；无法证明该上游请求经过7890。 |
| 一次提交保护 | 操作卡完成，但仅人工保护 | 基准、冻结规则、超时不重试、部分成功与费用检查方法已记录。 |

## 2. UI、Session与实例

- UI：`complete_and_interactive`。
- AI Link版本：0.2.12。
- 主实例数：1个主进程族；4个Electron父子进程不是4个实例。
- 监听：18765与18766均归属AI Link主进程并返回HTTP 200。
- Session：`valid_by_read_only_ui_evidence`。
- 无重新登录、短信、邮箱验证、认证过期或权限错误提示。
- 员工页可见6个员工且均显示运行中；这不是模型请求运行中计数。
- 协作群页显示2个工作流。

## 3. 当前两个工作流

1. `workflow-3da933e691b5`
   - 名称：AI Workbench v0.4.7首批开发协作群
   - 本任务中的业务标识：`AW-AILINK-GROUP-001`
   - 状态：`review_ready`
   - 阶段：`review`
   - 草稿版本：3
   - `confirmedAt=null`
   - `pendingBlueprint=null`
   - `lastError=null`
   - 群未创建；当前页面为“确认方案”。

2. `workflow-796150e78827`
   - 名称：AI Workbench 只读协作交付验证
   - 状态：`ready`
   - 阶段：`done`
   - 草稿版本：3
   - 已确认并已创建群。

工作流目录只有以上2个`workflow.json`。没有第三个工作流。

## 4. pending/running/unknown请求

- 工作流落盘状态没有`generating`、`pending`、`running`或未知状态工作流。
- 首个工作流的`review_ready/review`表示历史方案生成已完成、等待人工确认，不是正在生成。
- 两个工作流均`pendingBlueprint=null`且`lastError=null`。
- AI Link UI没有生成中Spinner、队列或等待响应提示。
- 但当前版本没有持久化请求ID、幂等键或独立请求账本；因此不能以强审计方式证明不存在已发出但未落盘的孤儿请求。人工放行标准采用fail-closed：此可观测缺口不能与代理路径缺口叠加放行。

## 5. workflow-creator计数与费用基准

### 18765本地模型代理

核验末次只读diagnostics：

- `totalRequests=14`
- `byPath=/health:12, /diagnostics:2`
- `recent=[]`
- 没有`/v1/chat/completions`事件。

说明：18765统计在本次AI Link进程启动后从0开始，不是持久历史总账，且只读health/diagnostics本身也会增加计数。本轮无法从它恢复历史`workflow-creator`累计次数。

### 18766 ai-workers代理

- `totalRequests=219`
- `byEmployee.worker-5100=219`
- 这是当前会话员工请求累计，不是workflow-creator计数，不能用于推断工作流生成点击次数。

### workflow-creator当前可审计计数

- `unknown_not_persisted`。
- 可审计替代基准：工作流落盘数量=2；首个草稿创建于2026-07-28T08:47:14.882Z、草稿版本3；第二个工作流已完成。

### 费用UI基准

只读UI显示：

- 余额：¥111.58
- 今日用量：¥43.42

该UI金额为核验时快照，不等于单次workflow生成费用。未执行生成，因此没有本轮新增生成费用。

## 6. 代理路径判定

最终状态：`proxy_path_unverified`。

### 已证明的应用请求链

从已安装AI Link v0.2.12的只读安装包代码确认：

1. Renderer的“让 AI 生成方案”调用`workflow:generate`。
2. Electron主进程调用`workflowOrchestrator.generate(description)`。
3. workflow creator请求发送到`http://127.0.0.1:18765/v1/chat/completions`，并带`x-aiw-employee: workflow-creator`。
4. 18765再使用主进程`fetch()`访问`https://ai-link-llm.lhmxrzs.cn`。

这证明workflow creator先走AI Link自己的18765本地代理，而不是直接使用18766。

### 仍未证明的部分

- AI Link进程启动参数没有显式代理flags。
- 代码未发现`ProxyAgent`、`EnvHttpProxyAgent`、`setGlobalDispatcher`或逐请求`dispatcher`。
- 核验时AI Link主进程与`150.109.83.12:443`直接建立TCP连接；该地址同时是AI Link API和LLM域名DNS结果。
- 核验时AI Link PID没有连接`127.0.0.1:7890`。
- 7890有其他进程连接，但不能归因给AI Link。
- 18765 diagnostics只显示health/diagnostics；没有可审计的历史workflow-creator recent事件。
- 既有工作流证明历史非付费/付费生成曾成功返回并落盘，但没有保留该次请求的网络路径证据。

因此不能把“7890监听中”“系统代理已启用”或“历史草稿存在”写成Electron/Node上游fetch已经过7890。

## 7. 单次受控生成操作卡（仅形成，不执行）

### A. 操作前基准

1. 产品负责人必须再次明确批准执行一次生成，并指定目标草稿文本。
2. AI Link主实例数=1；18765/18766 health=200。
3. 工作流目录数量=2；记录两个workflow ID、status、stage、updatedAt和文件哈希。
4. UI协作群计数=2；`AW-AILINK-GROUP-001`草稿仍为`review_ready/review`、草稿3。
5. 记录18765 diagnostics完整快照，区分health/diagnostics自增与chat-completions。
6. 记录余额¥111.58、今日用量¥43.42或执行当时的新快照。
7. 确认没有生成中UI、没有新增workflow目录、没有`pendingBlueprint`或`lastError`异常。
8. 在代理路径未验证前，本卡不得进入点击步骤。

### B. 一次提交锁

1. 仅一名操作者、一个AI Link窗口、一个目标草稿。
2. 点击前关闭任何可能触发相同动作的自动化；不刷新、不双击、不使用回车再次提交。
3. 只允许单击一次“让 AI 生成方案”。
4. 点击后立即记录本地时间，并人工宣布`SUBMIT_LOCKED`；直到完成状态核对前，任何人不得再次点击。
5. 即使按钮恢复、页面空白、UI卡死、出现超时或`fetch failed`，仍不得二次点击。

### C. 等待与超时

1. 首次点击后至少等待10分钟，期间只观察，不刷新、不返回、不关闭应用。
2. 10分钟未完成不等于失败；状态转为`unknown_after_submit`，继续禁止重试。
3. UI失去响应时，先检查进程、18765/18766、workflow目录、diagnostics和费用，不重开并重试。

### D. 部分成功检查

按以下顺序检查：

1. 工作流目录数量是否从2变3。
2. 是否出现新workflow ID、`review_ready`或其他已落盘状态。
3. 目标文本是否已成为新workflow的objective。
4. UI列表是否新增条目，即使页面曾报错。
5. 18765 diagnostics是否新增一次`/v1/chat/completions`且recent带`workflow-creator`。
6. 余额/今日用量是否变化。
7. 任一项表明上游可能已执行，则禁止重试，进入人工对账。

### E. 完成与失败判定

- 成功：只新增1个workflow目录；UI只新增1条；目标内容一致；请求计数与费用变化可解释。
- 明确失败且未产生副作用：只有在无新workflow、无chat-completions事件、无费用变化且有明确发送前失败证据时，才可提交新的重试审批；仍不自动重试。
- 未知/部分成功：任何证据冲突、UI失败但目录新增、计数变化但无落盘、费用变化但状态未知，立即停止并建立incident。

## 8. 任务重新分类

### A. 本次单次生成硬阻塞

- `AW-ENV-FIX-PROXY-001`：仅“证明workflow creator的18765→上游请求实际路由，并提供可审计证据”部分。

已在本轮满足、但正式点击前仍需即时复核：

- `AW-ENV-FIX-READINESS-001`：UI与Session最小核验部分。
- `AW-ENV-FIX-IDEMPOTENCY-001`：人工单次提交保护卡部分；不代表完整幂等已完成。

### B. 工作群创建后继续实施

- 完整幂等机制与持久请求账本；
- 网络抖动Checkpoint和续跑；
- 自动Preflight；
- AI Link单实例锁；
- 飞书自动重连；
- 结构化日志；
- Wi-Fi与热点受控对照；
- 完整国内外路由治理。

这些长期任务未删除、未标记完成，只是不全部阻塞本次受控生成。

## 9. 放行判定

不满足放行标准第7项：workflow请求代理路径没有得到充分证明，也没有保留可审计的同路径非付费成功证据。

最终判定：

`blocked_proxy_path_unverified`

不是：`ready_for_one_controlled_generation`。
