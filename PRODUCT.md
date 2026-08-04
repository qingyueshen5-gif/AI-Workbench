# AI Workbench 产品定义

```text
状态：CURRENT_PRODUCT_AUTHORITY
文件定位：产品定义的唯一现行权威文件
最后核验Commit：b9cfaac917f27cfebac7d0acb2c7e6c3a85b8c80
实时状态权威：CURRENT_STATUS.md
唯一下一步权威：NEXT_STEP.md
执行纪律权威：EXECUTION_PROTOCOL.md
最后更新任务：PRODUCT-DEFINITION-CONSOLIDATION-001
```

> 本文件回答产品是什么、不是什么、为谁服务、遵守什么原则、内部如何组织、能力边界和落地路线是什么。它不取代实时工程状态、唯一下一步、执行纪律或具体技术证据。
>
> 本文件中的当前实现事实核验于Commit `b9cfaac917f27cfebac7d0acb2c7e6c3a85b8c80`。状态会继续变化，实时结论必须以`CURRENT_STATUS.md`为准；下一项获准施工内容只看`NEXT_STEP.md`；技术结论必须回到对应`verification/`证据核验。

## 1. 产品定义

AI Workbench是一个帮人把事情真正办成的AI工作台。

用户只需要在一个输入框里表达：“我要什么。”系统在后台理解目标、拆解任务、选择合适能力、调动AI和工具、控制风险、检查结果，最后把真实结果交付给用户。

最容易理解的比喻是：**AI Workbench像一个总管。**

用户只负责说自己想要什么；工作台负责：

1. 听懂；
2. 找合适的人或工具；
3. 分配工作；
4. 监督执行；
5. 检查结果；
6. 失败时如实说明；
7. 最终交货。

AI Workbench不是某一个模型的外壳，而是一个调度和执行框架。后端模型、工具、Provider（实际提供某项能力的执行方）和执行器都可以接入、替换或升级，但用户入口和任务语义应保持稳定。

它不是普通聊天机器人。聊天只是入口之一。产品最终价值是真实地在电脑和数字环境中把事情完成，而不是只生成一段看起来像完成了的文字。

产品形态是Windows桌面应用。用户正常情况下始终只面对一个主要输入框。未来可以接入飞书等远程入口，但远程入口只是同一工作台的入口扩展，不是另一套产品。

## 2. 产品不是什么

AI Workbench不是：

- 某一个大模型的包装壳；
- 只会问答的聊天机器人；
- 要求普通用户配置API Key的开发工具；
- 让用户自己理解Agent、模型、Provider和插件的技术平台；
- 只生成计划但不执行的建议工具；
- 只运行命令但不核验结果的自动化脚本；
- 为了自动化而牺牲授权、安全和真实性的黑盒；
- 宣称完成但没有真实证据的“表演型AI”。

内部可以很复杂，但不能把复杂度转嫁给用户。

## 3. 服务对象

AI Workbench主要服务两类用户。

### 3.1 普通人

他们通常：

- 不懂技术；
- 不会配置模型；
- 不理解API；
- 不想管理工具链；
- 只关心事情有没有办成。

他们需要的是：

- 便宜；
- 简单；
- 可信；
- 不折腾；
- 一次安装后可以直接使用。

### 3.2 追求高效率的人

例如专业人士、创业者、公司负责人、研究者，以及需要处理大量信息和电脑任务的人。

他们需要：

- 节省时间；
- 减少重复操作；
- 获得稳定、高质量的交付；
- 将多模型、多工具和多执行器统一调度。

产品必须先从普通人做起。原因不仅是普通用户数量更大，更重要的是：普通人能否独立使用，是检验产品是否真正做到“零门槛”的最严格标准。如果只有开发者能够使用，说明它仍是工具链，还不是产品。

## 4. 三条产品铁律

### 4.1 第一条：极致零门槛

目标状态：

- 一次安装后即可使用；
- 用户不配置模型；
- 用户不理解Provider；
- 用户不填写API Key；
- 用户不学习命令行；
- 用户不需要知道后台用了什么工具。

任何必须让普通用户理解系统内部结构的设计，都应被视为产品债务。

### 4.2 第二条：真能把事情办成

系统不能只聊天。系统必须执行、观察、检查、交付。

做不成时必须明确告诉用户：

- 没有完成；
- 做到哪一步；
- 失败在哪个阶段；
- 已保存了什么；
- 是否可以重试；
- 下一步建议是什么。

永远不允许：

- 编造执行；
- 编造成功；
- 把失败说成成功；
- 把处理过说成验收通过；
- 把重放过说成verified；
- 因为不确定而默认成功。

### 4.3 第三条：死守简单

后台可以包含Interpreter、Adapter、Scheduler、Authorization、Risk、Verifier、Provider、Run、Task、Checkpoint、重放、幂等、模型、浏览器和命令执行。

但普通用户最终看到的产品仍应尽可能只有：

- 一个输入框；
- 清晰进度；
- 可信结果；
- 必要的授权提示。

产品内部复杂度增加，不能自然推导为用户界面复杂度增加。

## 5. 产品内部结构

整体结构可以用普通人能理解的方式概括为：

```text
入口
↓
AI Workbench总管
听懂话 → 派活 → 刹车 → 验收
↓
实际执行能力
↓
结果原路返回用户
```

### 5.1 入口

当前产品形态以Windows桌面输入框为核心。未来可以扩展飞书等远程入口。无论从哪里进入，都应进入同一个工作台任务语义和安全链路。

### 5.2 听懂话

作用是把用户自然语言变成合法、结构化、可检查的任务。

当前主要对应Interpreter Adapter。Interpreter表示“理解用户目标的组件”；Adapter表示“把语义翻译为系统允许的内部协议的确定性适配层”。

### 5.3 派活

作用是决定当前合法任务应该交给哪一种能力执行。

当前主要对应Capability Scheduler。Capability是系统正式登记、具有执行和验收边界的能力；Scheduler是根据能力需求选择合法执行方的调度器。

### 5.4 刹车

作用是识别风险、阻止越权、要求必要授权，并确保模型、Provider或用户输入不能伪造可信授权。

当前主要对应Authorization Gate与Risk。Authorization Gate是可信授权闸门；Risk是风险判断与安全策略。

### 5.5 验收

作用是检查任务是否真的完成，检查证据是否与当前Task、Run和验收版本绑定，并阻止系统凭感觉宣布成功。

当前主要对应Result Verifier。Task是用户业务任务的持久化身份；Run是该Task的一次正式执行；Verifier是独立核验执行结果和证据的验收者。

### 5.6 实际执行能力

工作台下面是实际干活的模型、工具和执行器。例如：

- DeepSeek等模型用于理解；
- Hermes或其他执行器用于命令和电脑操作；
- Codex用于代码任务；
- 浏览器用于网页任务；
- 本地Provider用于系统状态与文件读取。

以上是产品结构和目标能力说明，不表示每项已在当前自然语言生产入口开放；实际边界见第7章。

## 6. 核心架构概念

### 6.1 Adapter

Adapter把用户意图翻译成合法内部协议。

模型可以表达语义，但模型不允许直接决定：

- `taskType`；
- Capability；
- Provider；
- Allowlist；
- 授权状态；
- 可信风险结论。

这些决定必须由系统确定性代码掌握。

### 6.2 Ground Truth

Ground Truth是“原始事实”。用户原文中的路径、文件名、数字、参数和明确目标，是这些事实的唯一权威来源。

模型不得改写：

- 路径；
- 文件名；
- 数字；
- 命令参数；
- 用户明确指定的事实。

模型的推测不能覆盖Ground Truth。

### 6.3 四类决定

系统对输入至少分为四类：

- `execute`：合法进入Scheduler和执行链；
- `respond`：直接回复，不创建业务Task；
- `clarify`：没有完整听懂，必须询问用户，不得启动部分操作；
- `unsupported`：当前能力不支持，必须明确说明不可执行，不得假装完成。

只有`execute`可以进入Scheduler和执行链。

### 6.4 复合意图fail-closed

fail-closed表示“不确定时关闭执行，而不是冒险继续”。

当一条消息可能包含多个任务，或者系统只识别了其中一部分时：宁可询问，不可只执行识别到的后半部分，更不可假装已经完整理解。

### 6.5 两类重放

重放表示同一个已处理身份再次到达时复用持久化结果，而不是重复执行。

业务Task终态重放：

```text
taskReplayed=true
messageReplayed=false
```

非执行确定性消息重放：

```text
taskReplayed=false
messageReplayed=true
```

两类语义不得混用。

### 6.6 verified

`verified`的正式产品语义是：只有真实Verifier完成验收，并且Task ID、Run ID和权威验收revision全部绑定一致时，`verified`才允许为`true`。revision是执行和验收所绑定的正式版本号。

必须始终区分：

- 处理过 ≠ 验收通过；
- 生成了回复 ≠ 验收通过；
- 渲染成功 ≠ 业务任务完成；
- 重放过 ≠ verified；
- `completed`状态本身 ≠ verified；
- `failed`永远不能`verified=true`。

当前实现差距：全系统部分旧路径仍将`verified`作为“已处理”或“结果已生成”的通用标记使用。相关三项HIGH风险尚未统一修复，由`VERIFIED-SEMANTICS-UNIFICATION-001`在M2之前处理。在该工作包完成前，Deployment保持`BLOCKED`，不得宣称全系统verified语义可信。

## 7. 当前能力边界

本节核验基线：

```text
b9cfaac917f27cfebac7d0acb2c7e6c3a85b8c80
```

核验来源包括：

- `capabilities/capability-registry.mjs`；
- `capabilities/capability-scheduler.mjs`；
- `agents/interpreter-adapter.mjs`；
- `agents/task-interpreter.mjs`；
- 相关专项与`CURRENT_STATUS.md`。

实时状态以`CURRENT_STATUS.md`为准。

### 7.1 当前阶段正式开放

当前自然语言入口可以合法进入正式执行链的Capability只有：

| Capability | 当前用途 | 主要Provider | 验收方式 |
|---|---|---|---|
| `runtime.status` | 检查Runtime状态 | `local-runtime-state` | 真实状态文件证据 |
| `file.read` | 只读读取明确绝对路径的文件 | `local-tool-executor` | stat、SHA-256及受限路径边界 |

这是一项有意的安全收缩，不是最终产品能力范围。

### 7.2 已注册但当前自然语言入口未开放

Capability Registry实际已注册，但Interpreter Adapter明确收敛为`unsupported`或非业务执行回复的能力包括：

| Capability | Registry状态 | 当前自然语言入口状态 |
|---|---|---|
| `conversation` | 已注册、available | 普通回复走非执行`respond`，不作为当前业务Task能力开放 |
| `code.read` | 已注册、available | `unsupported` |
| `code.execute` | 已注册、available，要求确认 | `unsupported` |
| `code.modify` | 已注册、available，要求确认 | `unsupported` |
| `process.list` | Windows下主Provider可用 | `unsupported` |
| `process.stop` | Windows下主Provider可用，要求确认 | `unsupported` |

“Registry已注册”只证明系统存在能力声明，不等于用户当前可以通过自然语言入口使用。

### 7.3 Interpreter或历史提示中出现但没有正式注册

`agents/task-interpreter.mjs`的prompt或`agents/interpreter-adapter.mjs`的unsupported规则中出现、但当前Capability Registry没有正式注册的能力包括：

- `file.write`；
- `file.manage`；
- `computer.control`；
- `commerce.order`；
- `commerce.payment`及其他`commerce.*`；
- `media.video.create`；
- `web.research`；
- `system.diagnose`。

这些能力一律视为`unsupported`。Prompt中出现不代表系统正式拥有；产品路线中出现也不代表已经交付。

## 8. 产品落地路线

以下是产品批准的落地顺序，不表示后续步骤已经实施。

### 第一步：做完“听懂话”

即Interpreter Adapter阶段B。

目标是让自然语言稳定分为：

```text
execute
respond
clarify
unsupported
```

并确保只有合法`execute`进入执行链。

### 第二步：接一次真实模型

即Production Path Smoke（生产路径冒烟验证）。

目标不是大规模上线，而是证明真实远程入口、真实模型、Adapter、Scheduler、Provider、Verifier和交付链能够走通一次完整、可信、可审计的生产路径。

### 第三步：风险与授权收口

目标是集中Risk Policy，统一危险动作判断，保证危险行为必须经过可信授权，并使模型和Provider无法自行声明授权。

### 第四步：接入飞书并替代当前第三方AI Link AI

策略是旧通道与新通道并行。在新通道稳定承重之前，不剪断旧通道。

比喻是：**新绳子没有证明能承重之前，不能先剪断旧绳子。**

飞书是同一工作台的远程入口，不是另一套产品。

### 第五步：清除写死环境

包括清除或配置化：

- 本机绝对路径；
- 开发机专属配置；
- 固定账号；
- 固定目录；
- 固定环境假设。

目标是从“只在当前电脑能运行”变成“可以安装到另一台机器”。

### 第六步：陌生机器和非技术用户验证

至少在1至2台陌生机器上，由不懂项目内部结构的普通用户独立完成一件真实任务。

当前阶段唯一最终可判定的产品成功标准是：

> 一个非技术用户能够在陌生机器上，不依赖开发者现场指导，独立完成真实任务并获得可信结果。

## 9. 协作分工

### 9.1 产品负责人

负责：

- 决定产品方向；
- 决定什么问题最重要；
- 确定用户价值；
- 在产品冲突时拍板；
- 决定风险是否可以接受；
- 决定哪些技术债必须现在处理。

### 9.2 Claude

负责：

- 帮助产品负责人整理想法；
- 审查逻辑；
- 识别盲点；
- 讨论产品结构；
- 从产品和逻辑层提出风险；
- 在产品负责人不具备技术细节判断能力时，提出明确技术裁定建议并标注理由。

Claude的意见不能只留在聊天中。形成决定后必须写回仓库。

### 9.3 GPT

负责：

- 把产品方向转化为精确、可执行、有边界的工程指令；
- 审查执行报告；
- 检查技术证据是否支持结论；
- 识别指令内部冲突；
- 阻止错误扩大施工范围；
- 确保下一步是完整原子任务。

### 9.4 Codex / 恢复助手

负责：

- 读取权威文件；
- 实施代码或文档修改；
- 运行真实验证；
- 记录全部结果；
- 分类非零退出；
- 保存Checkpoint；
- 生成C盘Patch；
- 计算SHA-256；
- Commit；
- Push；
- 远端验证；
- 保持工作区干净。

### 9.5 总协作铁律

任何决定必须写回仓库文件，不得依赖人的记忆、单个聊天窗口、某一个模型的长期上下文或口头约定。

因为对话框会关闭，AI会更换，模型会遗忘，只有仓库会留下版本化证据。

### 9.6 工作节奏

- 一次只允许一条执行线真正施工；
- 可以并行思考，但不并行修改同一候选Worktree；
- 执行可以快，但不能免检；
- 脚本通过不等于产品通过；
- Checkpoint保存不等于最终验收。

产品负责人每天能够高度集中工作的时间有限。产品负责人的判断力、身体状态和持续性，是项目最难替代的输入。项目节奏必须保护这一资源，不能用大量低价值人工操作持续消耗产品负责人。

## 10. 已修复的关键缺陷

以下七项是专项测试或迁移测试真实发现并修复的问题，不是理论风险。Checkpoint表示成果被保存并可恢复，不等于产品已经部署或最终验收。

### 10.1 同一非执行消息产生重复回复

**缺陷名称：** `NON_EXECUTION_MESSAGE_IDEMPOTENCY_DEFECT`

**发现现象：** 同一`messageId/originalMessageId`重复或并发到达时，`respond`、`clarify`和`unsupported`会重复追加assistant回复；业务Task和Run均为0，但用户仍会收到重复消息。

**影响：** 破坏幂等，造成重复回复和潜在重复外部交付。

**修复方式：** 为非执行确定性消息建立持久化claim、结果和重放身份，使同一键最多一次渲染、一次结果和一次交付。

**正式Checkpoint：**

- `NON-EXECUTION-MESSAGE-IDEMPOTENCY-ATOMIC-001`；
- `NON-EXECUTION-MESSAGE-IDEMPOTENCY-GATE-001`。

**专项脚本：** `scripts/verify-non-execution-message-idempotency-001.mjs`。

**状态：** 已修复并有并发、崩溃恢复和不同消息同文案场景证据。

**相关开放风险：** 非执行renderer的`verified`字段语义仍属于`NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND`，不等同于幂等缺陷复发。

### 10.2 复合意图漏判并执行已识别部分

**缺陷名称：** CQ-001复合意图fail-closed缺口。

**发现现象：** 系统可能只识别后半句并执行已识别部分，却没有告诉用户前半句未被理解。

**影响：** 用户以为完整要求已被执行，实际只执行部分任务。

**修复方式：** 复合结构优先进入`clarify`，Task、Run、Scheduler、Provider和Model均为0，明确要求用户选择或拆分消息。

**正式Checkpoint：**

- `TASK-LIFECYCLE-M1-CQ001-CLARIFY-CONTRACT-001`；
- `CQ-001-COMPOUND-NOTICE-BEHAVIORAL-ASSERTION-FIX-001`；
- `CQ-001-COMPOUND-INTENT-IMPACT-REGRESSION-001`。

**专项脚本：**

- `scripts/verify-non-execution-clarify-contract-001.mjs`；
- `scripts/verify-interpreter-adapter-bypass-001.mjs`。

**状态：** 已修复。

**相关开放风险：** 多轮澄清上下文仍未实现，见实时状态中的`MULTI_TURN_CLARIFICATION_CONTEXT_NOT_SUPPORTED`。

### 10.3 模型输出可携带providerId进入内部协议

**缺陷名称：** TaskInterpreter额外顶层字段协议注入。

**发现现象：** 模型第二次纠正输出可以携带`providerId`和伪授权字段；旧验证只剥离部分授权字段，会保留任意额外顶层字段。

**影响：** 模型可能试图影响执行方或内部可信协议。

**修复方式：** `validateTaskInterpretation()`只投影正式Schema的11个必需字段，额外`providerId/approved/authorized/trusted/authorizationContext`不能进入最终解释协议。

**正式Checkpoint：**

- `TASK-LIFECYCLE-M1-CQ002-INTERPRETER-CORRECTION-SUCCESS-001`；
- `TASK-LIFECYCLE-M1-CQ002-IMPACT-REGRESSION-001`。

**专项脚本：** `scripts/verify-task-interpreter-bounded-correction-success-001.mjs`。

**生产修复Commit：** `78d27d45f7634d1cb73f8dbcd84d6e362fb5964a`。

**状态：** 已修复组件协议注入缺陷。

**相关开放风险：** `TASK_INTERPRETER_NO_LONGER_ON_PRODUCTION_PATH`仍为OPEN；组件契约通过不证明其位于当前生产调用链。

### 10.4 状态事实源不可读时仍可能返回成功

**缺陷名称：** runtime.status Grounded Evidence真实性缺口。

**发现现象：** 状态源不可读时，Provider仍可能生成`ok:true`、固定fallback文本和人工时间戳；旧Verifier不能证明真实状态源读取成功。

**影响：** 系统可能把猜测或fallback伪装成真实Runtime状态。

**修复方式：** 建立结构化、fail-closed的Grounded Evidence；状态来源不可读时返回失败，Verifier要求真实证据引用，并把核验结论绑定到Run。

**正式Checkpoint：** `INTERPRETER-ADAPTER-B5-S1-GROUNDED-EVIDENCE-001`。

**专项脚本：** `scripts/verify-interpreter-adapter-b5-s1-grounded-evidence-001.mjs`。

**状态：** 该具体真实性缺陷已修复。

**相关开放风险：** 全系统verified旧路径尚未统一，不能据此宣称所有状态或结果语义已可信。

### 10.5 file.read绕过allowedRoots或realpath containment

**缺陷名称：** file.read路径权限边界弱化。

**发现现象：** 新读取Provider曾直接使用裸`fs.readFile/fs.stat`，没有复用既有`allowedRoots`和realpath containment，可能通过解析后路径或链接越过允许根目录。

**影响：** 越权读取本不允许访问的文件。

**修复方式：** 统一使用受限读取边界，对原路径和真实解析路径做containment验证，并验证读取不修改文件。

**正式Checkpoint：** `INTERPRETER-ADAPTER-B5-S3-FILE-READ-BOUNDARY-001`。

**专项脚本：** `scripts/verify-interpreter-adapter-b5-s3-file-read-boundary-001.mjs`。

**状态：** 已修复当前正式`file.read`路径边界。

**相关开放风险：** 新能力不能自动继承此结论；每个文件能力仍需独立授权、风险和边界专项。

### 10.6 Task.failure缺少机器可理解的失败事实

**缺陷名称：** `FAILED_TASK_FAILURE_FACT_INCOMPLETE`

**发现现象：** Task失败时只保存原始异常`message/name`，缺少`errorCode`、`failureStage`、`failureClassification`、`taskId`、`runId`、`taskRevision`和`failedAt`。

**影响：** 无法可靠聚合、定位失败阶段、绑定失败Run或校验重放不可变性。

**修复方式：** Runtime用受控枚举和可信Run identity构造结构化Task.failure；保留稳定错误码、阶段、分类、身份、版本、时间和受控`causeCode`。

**正式Checkpoint：**

- `FAILED-TASK-FAILURE-FACT-AUDIT-001`；
- `FAILED-TASK-FAILURE-FACT-STRUCTURE-FIX-001`；
- `TASK-LIFECYCLE-M1-CQ003B-EXECUTION-FAILURE-REPLAY-001`。

**专项脚本：** `scripts/verify-failed-task-persistence-and-replay-001.mjs`。

**状态：** 已修复。

**相关开放风险：** `USER_NOT_INFORMED_OF_EXECUTION_FAILURE_UNVERIFIED`仍为OPEN；失败事实已保存不等于用户一定收到失败提示。

### 10.7 failed Task重放默认verified=true且分类缺失

**缺陷名称：**

- `TERMINAL_REPLAY_VERIFIED_DEFAULT_TRUE_ON_FAILED_TASK`；
- `TERMINAL_TASK_REPLAY_CLASSIFICATION_MISSING`。

**发现现象：** failed Task终态重放返回`verified=true`，并缺少`taskReplayed`和`messageReplayed`。

**影响：** 把“处理或重放过”误报为“验收通过”，同时无法可靠区分业务Task与非执行消息重放。

**修复方式：** terminalResult改为可信派生；failed、cancelled和capability_unavailable重放fail-closed。completed只有在真实Verifier及Task/Run/权威验收revision和Final绑定全部成立时才为true。业务Task重放显式返回`taskReplayed=true/messageReplayed=false`。

**正式Checkpoint：**

- `TERMINAL-TASK-REPLAY-VERIFICATION-CLASSIFICATION-FIX-002`；
- `TERMINAL-TASK-REPLAY-STATE-MATRIX-001`；
- `TASK-LIFECYCLE-M1-CQ003B-EXECUTION-FAILURE-REPLAY-001`；
- `TERMINAL-TASK-REPLAY-VERIFICATION-IMPACT-REGRESSION-001`。

**专项脚本：**

- `scripts/verify-terminal-task-replay-classification-001.mjs`；
- `scripts/verify-failed-task-persistence-and-replay-001.mjs`。

**状态：** 该具体terminalResult缺陷已修复，17项影响面回归有保存证据。

**相关开放风险：** 全系统verified语义仍有三项HIGH开放风险，不能写成“全系统验证语义已完成”。

## 11. 产品目标与当前实现差距

本节只记录对长期产品定义重要的差距。实时风险、当前阶段和最新阻断以`CURRENT_STATUS.md`为准。

### 11.1 verified语义尚未全系统统一

terminalResult已按可信Verifier和身份绑定规则修复，但以下路径仍存在系统性语义风险：

- `NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER`；
- `LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING`；
- `NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND`。

后续工作包：`VERIFIED-SEMANTICS-UNIFICATION-001`。

该工作包必须在M2之前完成。在完成前：

```text
Deployment=BLOCKED
finalAcceptance=false
```

不得声明全系统verified可信。

### 11.2 用户失败提示责任链尚未确认

风险：`USER_NOT_INFORMED_OF_EXECUTION_FAILURE_UNVERIFIED`。

当前Runtime执行失败时可能直接抛出结构化错误，但尚未确认Delivery或Gateway是否保证用户收到明确失败提示。不得把“Task.failure已保存”等同于“用户已经知道失败”。

### 11.3 TaskInterpreter当前不在正式生产路径

风险：`TASK_INTERPRETER_NO_LONGER_ON_PRODUCTION_PATH`。

AgentRuntime仍保留TaskInterpreter组件，但正式`handle()`路径当前通过Interpreter Adapter。CQ-002和CQ-003-A证明的是组件契约，不证明它当前位于生产调用链。

M4必须决定：

- 重新接入真实模型理解链；或
- 正式移除生产路径外代码，并同步处理专项和文档。

### 11.4 当前能力仍很窄

当前自然语言正式执行能力只有`runtime.status`和`file.read`。这是有意的安全收缩，不是最终产品能力。

后续能力必须逐项开放，每项都需要：

- 真实Capability注册；
- 授权边界；
- 风险策略；
- Provider；
- Verifier；
- 证据；
- 专项；
- 影响面回归。

### 11.5 产品形态和远程入口尚未完成

Windows桌面单输入框是正式产品形态；飞书是未来同一工作台的远程入口扩展。当前仓库存在历史飞书和AI Link资产，但不能把历史通道存在写成新产品入口已经稳定接入或已替代AI Link。

### 11.6 环境可迁移性尚未完成

当前仍有开发机绝对路径和环境假设风险。产品目标是可安装到陌生Windows机器；当前实现尚未达到这一状态，Deployment仍被阻断。

## 12. 新对话框接手顺序

### 12.1 场景一：只需要理解项目

按顺序读取：

1. `PRODUCT.md`：了解产品定义、架构、铁律、能力边界和落地路线；
2. `CURRENT_STATUS.md`：了解当前状态、开放风险、阻断项和阶段安全状态。

只读取这两个文件，足够恢复项目认知，但不足以直接开始施工。

### 12.2 场景二：准备继续执行任务

必须按顺序读取：

1. `PRODUCT.md`；
2. `CURRENT_STATUS.md`；
3. `NEXT_STEP.md`；
4. `EXECUTION_PROTOCOL.md`。

四个文件分别回答：

| 文件 | 回答的问题 |
|---|---|
| `PRODUCT.md` | 产品是什么 |
| `CURRENT_STATUS.md` | 现在处于什么状态 |
| `NEXT_STEP.md` | 下一步唯一允许做什么 |
| `EXECUTION_PROTOCOL.md` | 如何安全执行、保存、验证和停止 |

没有读取完四个文件，不得直接开始修改代码。

### 12.3 场景三：核验具体技术结论

在上述文件之外，按需读取对应`verification/`证据，不得默认加载整个verification目录。

当前建议的补充证据入口：

- `verification/task-lifecycle-contract-migration/MIGRATION-PLAN.md`；
- `verification/interpreter-adapter-phase-a/A1-CONTRACT-DISCOVERY.md`；
- `verification/task-lifecycle-contract-migration/historical-assertions/`；
- 当前任务对应的`report.md`、`summary.json`、`impact-regression.json`；
- 必要的`commands.log`、Checkpoint Manifest、Commit和Git diff。

结论：

- 两个文件负责恢复认知；
- 四个文件负责安全接手执行；
- `verification/`负责核验证据。

以上四个接手文件在核验基线均实际存在。

## 13. 已取代的历史决定

### 13.1 “当前第一目标是稳定替代AI Link”作为产品总定义

**状态：** `SUPERSEDED_BY_PRODUCT_DEFINITION_CONSOLIDATION_001`

**原位置：** 旧`PRODUCT.md`“AI Workbench：一页看懂”第23行。

**原表述：** “当前第一目标是稳定替代AI Link。”

**现行决定：** AI Workbench的稳定产品定义是Windows桌面AI工作台；替代AI Link属于落地路线中的远程入口迁移阶段，不是产品本体定义，也不是可跨阶段永久成立的第一目标。

**冲突：** 旧表述把阶段性迁移任务提升为产品总定义，容易让新接手者误以为AI Workbench是一项飞书通道替换工程。

**被取代理由：** 区分稳定产品身份与实时阶段任务；实时下一步只由`NEXT_STEP.md`决定。

**取代日期：** 2026-08-04。

**取代任务名：** `PRODUCT-DEFINITION-CONSOLIDATION-001`。

### 13.2 “当前先完成飞书/手机链路”作为现行产品形态

**状态：** `SUPERSEDED_BY_PRODUCT_DEFINITION_CONSOLIDATION_001`

**原位置：** 旧`PRODUCT.md`“AI Workbench：一页看懂”第24行。

**原表述：** “当前先完成‘飞书/手机下达任务—电脑执行—进度回传—结果交付’。”

**现行决定：** 产品形态以Windows桌面应用和单一主要输入框为核心；飞书是后续同一工作台的远程入口扩展。接入顺序受当前安全阶段和`NEXT_STEP.md`约束。

**冲突：** 旧表述把远程入口链路写成产品当前核心形态，并可能被误读为已经获准施工或已经实现。

**被取代理由：** 避免把路线图写成已交付能力，避免用阶段性通道方案覆盖桌面产品定义。

**取代日期：** 2026-08-04。

**取代任务名：** `PRODUCT-DEFINITION-CONSOLIDATION-001`。

### 13.3 “当前生产实现使用DeepSeek”作为不带边界的现行表述

**状态：** `SUPERSEDED_BY_PRODUCT_DEFINITION_CONSOLIDATION_001`

**原位置：** 旧`PRODUCT.md`“产品定义”第44行。

**原表述：** “当前生产实现使用DeepSeek，但它只是可替换的执行者，不是产品定位。”

**现行决定：** DeepSeek等模型是可替换的理解能力候选；具体生产运行版本、真实可达链路和部署状态必须以`CURRENT_STATUS.md`及生产证据为准。产品定义不能把模型配置或历史生产事实写成永久现行能力。

**冲突：** 旧句没有区分历史生产实现、候选链路和当前未部署状态，容易被新对话误读为当前候选已通过真实模型生产链。

**被取代理由：** 产品文件只保留模型无关架构决定；实时生产状态回归实时权威文件和验证证据。

**取代日期：** 2026-08-04。

**取代任务名：** `PRODUCT-DEFINITION-CONSOLIDATION-001`。

## 权威文件关系

- 产品定义：`PRODUCT.md`；
- 实时状态和开放风险：`CURRENT_STATUS.md`；
- 唯一下一步：`NEXT_STEP.md`；
- 执行纪律：`EXECUTION_PROTOCOL.md`；
- 具体技术结论、测试结果、失败证据和验收事实：`verification/`。

当文件之间出现冲突时，先判断事实类型，再回到对应权威；不得让历史对话或单个AI记忆覆盖仓库事实。
