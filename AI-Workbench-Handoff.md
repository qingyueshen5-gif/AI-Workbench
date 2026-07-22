# AI Workbench 新对话交接包

生成时间：2026-07-22

用途：新对话框启动后，只读这一份文件即可快速理解当前真实状态、产品战略、当前任务和下一步动作。

交接必读文件：`EXECUTION_PROTOCOL.md`、`PRODUCT.md`、`VISION.md`、`CURRENT_TASK.md`、`LAUNCH.md`、`TASKLOG.md`、`CHANGELOG.md`、`CURRENT_PROGRESS_AUDIT.md`、`research/self-hosting-plan.md`、`research/unified-model-proxy-plan.md`。

# 第一部分：当前真实进度

# 当前真实进度清单

生成时间：2026-07-22

范围：只按当前仓库真实文件和已提交验收证据盘点；不按记忆猜测。

## 1. 根目录关键文件

| 文件 | 是否存在 | 大小 |
| --- | --- | ---: |
| `PRODUCT.md` | 存在 | 2399 bytes |
| `VISION.md` | 存在 | 7645 bytes |
| `CURRENT_TASK.md` | 存在 | 7898 bytes |
| `ARCHITECTURE.md` | 存在 | 13686 bytes |
| `CHANGELOG.md` | 存在 | 17978 bytes |
| `TASKLOG.md` | 存在 | 任务总账本，记录任务状态、验收产物和缺失文件原因。 |
| `EXECUTION_PROTOCOL.md` | 存在 | GPT / Codex / Claude / 其他执行助手的任务执行与验收协议。 |

版本号：

- `package.json` 当前版本：`0.4.5`
- `CHANGELOG.md` 最新版本条目：`Unreleased - 上线硬骨头3A：安装包候选版预验收`

## 2. `research/` 真实存在文件

| 文件 | 大小 | 对应任务 | 当前进度 |
| --- | ---: | --- | --- |
| `ai-link-analysis.md` | 19371 bytes | AI Link 本机实现调研，拆解 Electron、worker、模型/通道代理和可借鉴架构。 | 调研完成；作为微信/飞书通道和本地代理方案参考。 |
| `channel-connection-plan.md` | 16555 bytes | 多平台连接实施方案，覆盖微信、飞书、Telegram 的通道 adapter、扫码绑定和消息回传。 | 方案完成；尚未进入实现，下一阶段手机端/通道连接时使用。 |
| `hermes-one-ecosystem.md` | 4065 bytes | Hermes One 商业版产品形态对标，梳理员工、通道、技能、编排、记忆。 | 调研完成；结论是功能内置化，用户只见一个页面。 |
| `intel-pipeline-plan.md` | 23681 bytes | AI 行业情报采集流水线方案，覆盖 X、小红书、平台 AI、OpenClaw 浏览器辅助和合规边界。 | 方案完成；当前明确先不做，等 P0/P1 稳定后再推进。 |
| `openclaw-candidate-gateway-test.md` | 4903 bytes | OpenClaw candidate 配置 gateway 启动验证。 | 已完成；结论是 candidate 配置结构可用但不能解决 gateway 不监听，问题转向 runtime。 |
| `openclaw-config-diff.md` | 11594 bytes | OpenClaw 配置缩水对比诊断，对比当前配置和 last-known-good。 | 已完成；结论是 size drop 主要来自 JSON 序列化变紧，不是关键配置段丢失。 |
| `openclaw-health.md` | 8358 bytes | OpenClaw 安装、命令、gateway、配置和日志的只读健康体检。 | 已完成；早期结论是 gateway 不可达、status 不应作为唯一健康检查。 |
| `openclaw-runtime-gateway-diagnosis.md` | 5729 bytes | OpenClaw gateway runtime 深挖，直调 Node 入口并检查 lock/state/device/browser/channel 残留。 | 已完成；结论是清理残留后 gateway 可启动监听 `18789`，问题收敛为启动慢和常驻管理。 |
| `pc-health-report.md` | 6594 bytes | 电脑与冰灵代理体检，检查系统资源、磁盘、网络、工作台/Hermes/OpenClaw。 | 已完成；作为环境稳定性和代理问题记录。 |
| `self-hosting-plan.md` | 10203 bytes | 自主化与去第三方依赖方案，规划把模型和员工调用收敛到本机代理。 | 方案完成；其中 OpenClaw 收敛到 `18800` 已进入并完成一轮实现验收。 |
| `unified-model-proxy-plan.md` | 6286 bytes | 统一模型入口方案，把 Workbench、Hermes、OpenClaw 三员工模型调用统一经过 `18800`。 | 已补卡并完成；代码已实现、验收脚本已跑通、commit 已推送。 |
| `version-management-plan.md` | 8879 bytes | 全链版本管理方案，锁定工作台、员工、模型、运行配置和验收证据。 | 方案完成；`v0.4.5` 已落地版本矩阵和验证脚本。 |

## 3. 应该有但没有的文件

| 缺失文件 | 为什么应该有 | 当前处理 |
| --- | --- | --- |
| `verification/model-router/summary.json` | 对话中曾用它指代“模型分层/模型路由”验收产物。 | 当前仓库不存在；模型分层任务尚未执行，不补假验收。已有 `verification/unified-model-proxy/summary.json` 只代表“统一模型入口”。 |
| `research/market-intelligence.md` | 对话中提到它应记录“39 张小红书情报整理”，属于后续情报/市场材料。 | 当前仓库不存在；已明确 P3，不影响 P0/P1 和统一模型入口，不补内容、不猜。 |

说明：

- `research/unified-model-proxy-plan.md` 之前缺失，但已经在本次补卡中新建并提交。
- `research/hermes-one-ecosystem.md` 和 `research/channel-connection-plan.md` 当前都真实存在，不是缺失文件。

## 4. 当前真实进度

- 产品版本：`v0.4.5`
- 任务账本：`TASKLOG.md` 已补齐，后续每次任务都必须同步更新。
- 执行协议：`EXECUTION_PROTOCOL.md` 已补齐，所有新 AI / Codex 接手前必须读取。
- 上一步做完了什么：上线硬骨头2“共享 key 落地”已完成。18800 服务端支持共享托管 key 兜底，用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`；验收摘要在 `verification/shared-key/summary.json`。
- 统一模型入口：已完成代码实现和验收。`model-proxy.mjs` 已扩展为 provider registry；DeepSeek、Hermes、OpenClaw 三员工都已通过 `18800` 调用模型，验收摘要在 `verification/unified-model-proxy/summary.json`。
- 模型分层：尚未执行；不要用统一模型入口的验收产物冒充 `verification/model-router/summary.json`。
- 现在卡在什么：上线硬骨头3A 预验收未通过。候选包已生成，但 NSIS 静默安装未创建预期 per-user 安装目录/卸载器，packaged Electron smoke test 未完成，`shared_managed` 生产注入未验证；证据见 `verification/install-release/preflight-summary.json`。
- `research/` 里真实存在文件：见第 2 节，共 12 个 `.md` 文件。
- `research/` 里应该有但缺的文件：`market-intelligence.md`，原因见第 3 节。

## 5. 下一步

1. 修复上线硬骨头3A 失败项并重新跑预验收。
2. 只有 3A passed 后，才由产品负责人判断是否进入 3B：GitHub Release 正式发布。
3. 模型分层、手机端、情报流水线暂不抢跑，等上线最小集前三条稳定后继续。

## 交接重点

- 产品版本：v0.4.5。
- 当前形态：独立桌面应用，三个员工分别是 DeepSeek（理解/模型）、Hermes（终端/电脑执行）、OpenClaw（浏览器操作/长任务编排）。
- OpenClaw gateway 掉线问题已经修好到可启动：清理 runtime 残留后可监听 `127.0.0.1:18789`。
- Codex 执行器已经恢复，不再卡在 PowerShell/WSL spawn 超时。
- 统一模型入口已经完成：Workbench、Hermes、OpenClaw 三员工模型调用已统一经过本机 `18800` 代理。
- 共享 key 已落地在 18800 服务端边界内，前端和员工配置不保存真实 key。
- 下一步不是继续修 OpenClaw，也不是情报流水线；下一步是上线硬骨头3：打安装包并挂 GitHub Release 下载链接。

# 第二部分：产品战略（核心理解）

## 路径：F:\AI-Workbench\PRODUCT.md

# PRODUCT.md — 产品定义

## 愿景

做一个**自己每天都会用**的 AI 工作台。不做大而全，只做高频刚需。

## 目标用户定位

本产品只服务两种人，这是一切功能取舍的最高准绳：

- 普通人：不懂技术，只想要结果，一句话搞定。核心诉求是**零门槛**。
- 专业人：时间就是杠杆，用平台把效率拉满。核心诉求是**省时间**。

取舍铁律：任何新功能，先问“它是帮普通人拿结果，还是帮专业人省时间？”

两者都不是就不做。不追求吃下所有人，服务好这两类用户即可：普通人代表大多数，专业人代表高粘性和高回购。

## 核心原则

### 极简
- 功能少而精，每个功能都经高频使用验证
- 能用一个按钮解决的，不用两个

### 可组合
- 脚本之间可以串联，形成工作流
- 输入输出标准化，像搭积木一样

### 本地优先
- 数据存在本地，不上传第三方
- 离线也能用核心功能

## 产品战略 v2(2026-07-18)

- 使用与结果必须双优：页面好看但办不成事没有竞争力，能办事但难用也没有竞争力，两者都好才有资格上牌桌。
- 核心竞争力=零门槛：市面同类产品（如 Hermes One 连手机版）功能强但需要配置知识；我们把全部功能内置到工作台内部，用户只看到一个对话框，一句话完成一切，打破使用壁垒。
- 功能对标策略：同行已把功能前端展示出来（设备管理/通道绑定/任务编排），照着做，但客户永远只见一个页面。
- 最终标准：能不能办成事。工作台的意义=把人的话传给模型和 Agent，中间消化一切摩擦（环境/记忆/卡壳/壁垒），交付简单的结果；人只负责判断和决策。
- 节奏观：不急变现，先做正确的事、拿到真实反馈，持续上线持续调试，铁杵磨成针。

## 功能规划

### V1 — 基础工作台
- [ ] AI 对话终端（多模型切换）
- [ ] 提示词模板库
- [ ] 一键代码审查
- [ ] 文档速读与总结

### V2 — 自动化
- [ ] 定时任务调度
- [ ] 工作流编排（A → B → C）
- [ ] 结果通知推送

### V3 — 知识库
- [ ] 本地文档索引
- [ ] 对话历史检索
- [ ] 个人知识图谱

## 不做

- ❌ SaaS 服务
- ❌ 多人协作
- ❌ 复杂 UI
- ❌ 任何与"卖钱"有关的功能

## 路径：F:\AI-Workbench\VISION.md

# AI Workbench 构想备忘录 (VISION.md)

> 这份文件不是执行清单，是"想法仓库"，防止任何构想因为记忆重置、生活嘈杂而丢失。
> 想到什么就往里加，不用现在想清楚怎么落地。定期回看，成熟的想法才移进CONTEXT.md去排期。
> 这份文件允许很乱、很不完整，这正是它存在的意义。

---

## 一、产品的根本意义（不只是一个工具）

工作台要解决的不是"做出一个AI应用"，而是解决一个更根本的问题：人和AI打交道时，会不断被"重复解释、AI记不住、上下文断裂"这件事消耗。这个消耗本身，用户已经在做工作台这件事的过程中亲身体验了很多次——这既是问题的证据，也是产品存在的理由。

工作台承接的作用：把本该由某个AI大脑记住的东西，搬到AI大脑外面（GitHub/文档系统），让任何AI介入时都是"读取者"，不是"记忆的容器"。

## 二、向外连接的能力（长期方向，不是现在做）

工作台最终应该具备"调用外部平台/AI/工具"的能力，不只是内部任务管理：

- 连接GPT、Codex、Claude等多个AI，按任务性质自动分配给最合适的一个
- 连接Hermes、小龙虾等自动化执行工具，做浏览器操作、重复流程
- 长期设想：能否像插件一样连接更多外部平台/服务，让工作台成为"枢纽"而不是孤立系统
- 这需要API而不是网页版访问，涉及支付/账号体系问题（已知阻塞，见CONTEXT.md）

## 三、线下场景与业务的关系（未成型，先记录）

用户在思考换城市（海南/杭州/上海周边）时提到：希望居住地本身能带动线下业务，比如接触旅游、贸易相关的真实场景需求，反哺产品洞察。

当前判断（已达成共识）：这条线不该现在推进，避免让MVP范围蔓延。等v0.1.0-v0.3.0跑顺、产品在单一场景里验证有效后，再考虑要不要带着产品去验证"换个行业/地区是否依然成立"。

## 四、产品的迭代特性

产品每次迭代效果都不一样，这是正常的、需要被观察和保留的，不是bug。落地方式：

- 版本号规则见CONTEXT.md
- 每个版本都要保留：代码、截图、功能说明、已知问题、为什么改、下一步方向
- 目的：以后能回头比较"哪一版更好、哪里开始变复杂、哪个功能删错了"

## 五、用户行为习惯与偏好学习（Phase 5范畴）

工作台应该能记录用户的使用偏好、工作流习惯，并在合适的时候调整自己以适配用户，而不是要求用户学习工具。

已达成的安全共识：这类自动调整不应该是完全黑箱的——第一次调整应视为"中/高风险操作"，需要过一次人工确认，确认过的模式以后才能自动沿用。

## 六、安全/监管角色（尚未设计，先占位）

数字员工平台通常有独立的"安全员"角色专门监督其他员工。当前工作台v0.1.0阶段没有对应模块，暂时由用户本人承担这个角色。这个缺口必须在Phase 3/4（自动执行、AI调度）正式开始前补上。

## 七、Agent 双引擎与长期运行构想

2026-07-17 新增决策记录：

- Agent 双引擎规划：Hermes 作为主脑、记忆和长期助理；OpenClaw 作为多 Agent 工作流编排工具。两者是配合关系，不是二选一。执行顺序是先跑通 Hermes，等 Hermes 稳定后，再由 Hermes 协助安装和配置 OpenClaw。
- 部署愿景：工作台最终部署到云端，任何网络环境都能使用。调用国外模型涉及的代理、网络和出口问题，放在云端服务器层解决，用户本地不需要配置代理。
- 7x24 运行构想：未来考虑云服务器、NAS 等不关机设备，让 Agent 持续在线，承担长期助理和持续任务监控角色。

## 八、工具层扩展规划：按能力分层，谁好用接谁

工作台不绑定单一Agent，按能力分层接入市面最强工具：

- 主脑/记忆/调度层：Hermes（已接入）
- 多Agent工作流编排层：OpenClaw（待接入）
- 代码执行层：Codex（在用）、Claude Code（备选）
- 浏览器操作/数据抓取层：【空缺待补】Hermes自带Playwright仅基础能力，面对强反爬平台可能不足，需调研接入更强的抓取Agent
- 文档/表格/数据处理层：【空缺待评估】

现实约束：很多平台主动反爬，这是商业问题不是技术问题，没有工具能通吃所有平台，只有成功率高低之分。

## 九、市场判断与长期价值

2026-07-18 补充：

- 市场判断：大厂（字节豆包+扣子+生态接入）与同行（Hermes One 手机联动）都在做 AI 调度中枢，方向已被验证；他们不完美（门槛高）就是我们的机会。
- 工作台的长期意义：问题永远会存在，新问题不断出现，调和层永远有价值。

## 十、行业情报与护城河

2026-07-18 战略更新：

- 行业争论：“专业 Agent 是否必要”。多数观点认为 agent runtime 本身不是护城河，真正有价值的是专业数据、专家知识和评测体系。成本上，垂直任务用轻量模型加好 harness 即可，不必所有任务都上最强基模。
- 前沿方向：字节等团队在探索“自进化 Agent”，即模型自己改写 harness、自己改进执行流程；方向前沿，但落地难度高。
- 大厂动向：字节正在推进豆包+扣子 Coze，并接入 Claude、GPT、OpenClaw 等生态能力；飞书在妙记、Agent、Skill 方向上主打 AI 原生工作流、降低非技术用户门槛，并强调“审美即生产力”。这些方向与工作台高度趋同。
- 我们的护城河：不是软件本身，软件可以被复制；护城河是极致零门槛、真能办成事的闭环，以及死守简单的克制力。必须警惕“大厂中间态套壳产品”陷阱：看起来能力很多，实际用户仍然要配置、理解和管理复杂度。
- 同类参考：Hermes CN Desktop，形态是桌面 App + 本地代理 + 更新提示 + 飞书集成，全本地运行，不依赖第三方服务。

## 十一、战略支柱：去第三方依赖 + 平台品控

2026-07-18 战略更新：

- 现状风险：当前 Codex、模型调用和部分通道仍依赖 AI Link 等第三方中转。第三方一抖动，整条链路就可能瘫痪，2026-07-18 的链路中断已经验证了这个风险。产品概念再干净，底层调用受制于人，本质上就是随时可能被卡脖子。
- 终极形态：所有模型和 Agent 调用都走自主本机代理集中鉴权，绝不经过第三方服务器。Hermes CN Desktop 的本地 Rust 代理方案是重要参考；当前本机模型代理 `18800` 已经是第一步，后续要持续推进到完全自主。
- 平台品控理念：采用“胖东来式准入”。接入平台的每个模型和 Agent 都必须达标：稳定、可控、不依赖脆弱第三方、质量过硬。用户信任的不是某个模型，而是平台的筛选与把关。
- 过程观：从“部分依赖第三方”到“完全自主”是渐进过程。过程中会有妥协，但必须在妥协中守住产品形态与标准，持续朝自主逼近，而不是幻想一步到位。真正要找的是理想与现实之间能长期推进的平衡点。

## 十二、其他零散想法（持续增补区）

- 挣钱/token优化：还未展开，等待具体化
- AI代理人三要素：及时支付权、风险对冲、身份主体权——概念提出但未定义
- 版本号/问题列表/工作流命名：细节尚未定，等Phase 2收尾后再定

# 第三部分：当前任务清单

## 路径：F:\AI-Workbench\CURRENT_TASK.md

# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-19

## 当前阶段：让工作台从“只会指路”变成“真会干活”

## 明天路线图（2026-07-19）

- 战术优化：模型分层调用。理解、编排、关键决策用好模型；执行琐事、格式整理、重复查询用便宜模型，降低长期运行成本。
- 待办：OpenClaw 稳定性体检。当前健康检查频繁不可用，需要确认安装路径、CLI 状态、gateway/channel 状态和最小执行链路。
- 2026-07-20 结论：OpenClaw gateway 问题已定位到 runtime 残留状态。清理 `.openclaw`/`%TEMP%\openclaw` 下 lock/tmp/browser profile 残留后，直接 Node 入口启动 gateway 可在第 26 秒监听 `127.0.0.1:18789`；主配置未改。

### 路线图

1. 阶段1：桌面端执行闭环
   - 聊天入口能理解用户目标，并把“打开、查看、安装、清理”等电脑动作派给员工真实执行。
   - 优先清理欠账：体验三件套、版本管理落地、动作路由盲区。
2. 阶段2：手机App产品落地
   - 自建 iOS App，保留一个自然语言入口。
   - 通过电脑通道连接桌面工作台，让手机指令可以驱动电脑侧执行。
   - 建立双端更新机制，保证手机端和电脑端状态、任务、记忆同步。
3. 阶段3：生态扩展
   - 扩展技能/员工生态，让常用岗位能力和工具能力可复用。
   - 扩展多通道接入，把微信、飞书、Telegram、QQ、抖音、小红书等入口收束到同一个工作台。
   - 继续坚持功能内置化，用户只看见一个页面。

### 今天完成
- [x] 创建 GitHub 仓库 AI-Workbench
- [x] 建立四个基础文档（README / PRODUCT / PRINCIPLES / CURRENT_TASK）
- [x] Codex CLI 恢复正常工作
- [x] 按 `Codex任务卡_MVP工作台.md` 完成最小闭环：发指令 → 系统留痕 → 展示进度
- [x] 新增 React + Tailwind 本地网页
- [x] 新增 Node 本地 API，数据写入 `data/workbench.json`
- [x] 完成四个页面：首页、聊天页、任务状态页、历史记录页
- [x] 实现失败任务必须填写失败原因的强制规则
- [x] 新增 `CONTEXT.md` 作为项目最新基准文件
- [x] 新增 `VISION.md` 作为长期构想备忘录
- [x] 新增 `CHANGELOG.md` 记录 v0.1.0
- [x] 修复 Windows 下 `npm run dev` 一键启动问题
- [x] 新增自动验证脚本 `npm run verify`
- [x] v0.1.1 扩充显示面板：模型连接状态、用户偏好、存储状态、系统错误日志
- [x] 新增 DeepSeek API 连接测试入口
- [x] 打 `v0.1.1-stable` 备份标签并推送，作为大改前稳定回退点
- [x] v0.2.0 收缩为聊天中心界面，取消四个独立 tab
- [x] 新增 DeepSeek 聊天自动提炼：从自然语言识别今日目标、任务和偏好
- [x] 修复对话持久化：支持连续对话、标题推导和会话恢复
- [x] 上线通用搜索能力：DeepSeek 可通过工具调用执行实时联网搜索
- [x] 修复失败任务留痕体验：标记失败时自动生成失败原因，用户可再编辑
- [x] 优化任务列表视觉区分：任务卡片显示负责人、日期和短 ID
- [x] 完成 Hermes v0.17.0 安装收尾：清理重复 WSL 发行版，验证 Playwright Chromium 可运行，读取并归档 doctor 结果
- [x] 记录 Agent 双引擎、云端部署和 7x24 运行构想到 `VISION.md`
- [x] 停止 Hermes gateway，清理 `auth.lock` 和 `logs\.__agent.lock` 问题
- [x] 以普通 Windows 用户身份重新运行 `hermes doctor`，确认 lock 相关报错已消失
- [x] 完成 Hermes DeepSeek 最小对话验证：`deepseek-chat` 可正常回复
- [x] 完成 Hermes 四项实测：正式对话成功、联网回答成功、跨会话记忆未生效、文件读取 `CURRENT_TASK.md` 未成功
- [x] 完成 B 类 4 项遗留任务：视觉细节 5 项、开机自启动、Hermes 记忆可用确认、Hermes 文件读取能力修复

### 当前问题清单
- [x] P0：聊天→执行链路接通；理解层根治
- [ ] P1：聊天自愈/JSON崩溃消化/失败主动解释
- [x] P2：回复排版/右键粘贴/菜单栏中文化或隐藏
- [x] P3：电脑与冰灵代理体检
- [ ] P4：版本管理落地，避免安装包输出、版本号和验收记录分散
- [ ] P5：动作路由补盲，覆盖终端、文件夹、设置页和任意已安装应用

### 执行顺序
1. P0 与 P3 并行：已完成
2. P1
3. P4：版本管理落地优先清理
4. P5：动作路由补盲

### 本次改动文件
- `CONTEXT.md`：项目基准文档，供后续 GPT / Codex / Claude 新对话同步上下文
- `VISION.md`：构想备忘录，存放暂不进入执行排期的长期想法
- `CHANGELOG.md`：版本变更记录，记录 v0.1.0 功能、已知问题和下一步方向
- `package.json` / `package-lock.json`：项目脚本与依赖
- `index.html` / `vite.config.js` / `tailwind.config.js` / `postcss.config.js`：前端工程配置
- `server.mjs`：本地 JSON 存储 API
- `scripts/dev.mjs`：同时启动 API 与 Vite 开发服务器，兼容 Windows
- `scripts/verify.mjs`：自动验证本地持久化、失败原因必填规则、存储状态和无 API Key 错误日志
- `src/main.jsx` / `src/styles.css`：聊天中心工作台页面与样式
- `.gitignore`：忽略依赖、构建产物、本地缓存、运行数据和本地日志
- `hermes-doctor-2026-07-16.txt`：Hermes doctor 健康检查原始输出，用于后续排查配置问题
- `hermes-doctor-2026-07-17.txt`：lock 修复后的 Hermes doctor 输出，用于确认权限报错消失

### 验证结果
- [x] `npm.cmd install --cache .npm-cache`
- [x] `npm.cmd run build`
- [x] `node --check server.mjs`
- [x] API 校验：无失败原因的失败任务返回 400
- [x] 新增 `npm run verify`，自动校验 JSON 持久化和失败原因必填规则
- [x] `npm.cmd run dev` 可启动 API 与 Vite，本地访问地址为 `http://127.0.0.1:5173`
- [x] `npm run verify` 覆盖无 API Key 时的系统错误日志写入
- [x] DeepSeek API 真实调用已接入聊天自动提炼
- [x] Hermes doctor 输出已读取：主体安装可用，剩余为 `.env`、config、API key 和 lock 权限配置问题
- [x] `.wsl-cache/` 和 `.wsl/` 已加入 `.gitignore`，避免 Ubuntu 安装包和 WSL 运行目录进入项目文件监控/版本库
- [x] 2026-07-17 `hermes doctor` 退出码为 0，未再出现 `Permission denied`、`auth.lock`、`.__agent.lock` 或 `Logging error`
- [x] Hermes 首次正式对话：对“你好，请介绍一下你自己。”能正常介绍自身，显示当前连接模型为 DeepSeek Chat
- [x] Hermes 联网测试：对“今天的 AI 新闻”给出 3 条新闻和来源链接，但同时提示 Firecrawl API Key 未配置
- [x] Hermes 记忆测试：已确认正确用法为 `hermes chat -q "..." --toolsets memory,terminal`，内置 memory 可用
- [x] Hermes 文件执行测试：已修复 terminal backend 命中默认 WSL 的路径问题；Hermes 可读取 `F:\AI-Workbench\CURRENT_TASK.md` 并总结待办
- [x] 开机自启动验证：Windows 登录启动项已创建，后台脚本可拉起 API 与 Vite，本地访问 `http://127.0.0.1:5173`
- [x] 视觉细节验证：完成中文侧栏、版本徽标、正规图标、hover 时间戳和移动端对话入口
- [x] OpenClaw runtime 深挖：`npm.cmd run openclaw:runtime-deep-dive` 直调 Node 入口，备份并清理 lock/tmp/browser/devices/cron 残留后，gateway 成功监听 `127.0.0.1:18789`

### 下一步
1. 验收三条真实执行链路：下载爱奇艺、查看 C 盘剩余空间、打开记事本。（已完成）
2. 对失败和卡壳场景补齐自愈、重试和人话解释。
3. 收尾聊天回复排版、右键粘贴、菜单栏中文化或隐藏。

## 任务记录规则

- 每完成一个功能，在 tasks/ 下记一条
- 文件名格式：`YYYY-MM-DD-功能名.md`
- 内容：做了什么 + 为什么这样做 + 下次改进方向

# 第四部分：关键技术背景

## 路径：F:\AI-Workbench\research\self-hosting-plan.md

# AI Workbench 自主化与去第三方依赖方案

日期：2026-07-20

范围：只读盘点当前仓库与本机运行配置，形成路线方案；不改实现代码。

## 1. 现状盘点

核心判断：AI Workbench 已经有“本机模型代理集中入口”的雏形，但还没有完成“所有员工/模型调用统一收敛到自主本机代理”。当前状态是“应用壳和部分编排已自主，模型供应、部分员工通道、Codex 开发链路仍依赖外部服务”。

| 环节 | 当前证据 | 状态 | 结论 |
| --- | --- | --- | --- |
| AI Workbench 前端/API | 本地项目内运行，API 监听 `127.0.0.1:8787` | 已自主 | 工作台自身 UI/API 不依赖第三方中转才能启动。 |
| 本机模型代理 `18800` | `model-proxy.mjs` 监听 `127.0.0.1:18800`，只接受 loopback；默认 upstream 为 `https://api.deepseek.com/v1` | 半依赖 | 鉴权、日志、重试、员工归因已收敛到本机；实际推理仍依赖 DeepSeek 官方外部 API。 |
| Workbench DeepSeek 调用 | server 侧默认使用 `MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1` | 半依赖 | 工作台不直接把 key 暴露给前端，但仍依赖外部模型供应商可用性。 |
| Hermes 模型调用 | `agents/adapters/hermes.mjs` 写入 `OPENAI_BASE_URL=http://127.0.0.1:18800/v1`、本地占位 token、模型 `deepseek-chat` | 半依赖 | Hermes 已绕开 AI Link 等第三方中转，先走 AI Workbench 本机代理，再到 DeepSeek。 |
| OpenClaw 模型调用 | 本机 `.openclaw/openclaw.json` 的 provider 指向外部 provider URL，默认模型为 OpenClaw 自己的 DeepSeek provider；未统一指向 `18800` | 半依赖/未收敛 | OpenClaw gateway 是本地模式，但模型链路目前不受 AI Workbench 18800 统一管控。 |
| OpenClaw gateway | 配置为 `mode=local`、`bind=loopback`、端口 `18789`；当前健康检查显示 gateway 不可达 | 半依赖 | 控制面设计是本地 gateway，但稳定性不足；模型和渠道仍依赖外部服务。 |
| Codex 开发链路 | 当前仓库无法证明 Codex CLI/开发模型是否完全直连官方还是经过 AI Link/其他 relay | 完全外部依赖，归属待核验 | 这不是工作台内可控运行时。应作为“开发工具依赖”单独记录，不应混入产品运行 SLA。 |
| 飞书/Telegram 等渠道 | OpenClaw 配置里启用 feishu、telegram | 完全依赖第三方平台 | 消息通道天然依赖平台 API、账号状态、平台风控和网络。 |
| AI Link 相关链路 | 既往调研显示 AI Link 本地代理端口 `18765/18766`，真实 key 在桌面主进程 session；但 AI Link 自身后端/LiteLLM/登录体系仍可能是外部依赖 | 第三方中转风险 | 不能把 AI Link 当作最终自主底座，只能借鉴其“本地代理集中鉴权”的产品结构。 |

### DeepSeek 请求实际经过哪里？

当前 AI Workbench 自身与 Hermes 的 DeepSeek 请求路径：

```text
Workbench/Hermes -> http://127.0.0.1:18800/v1 -> https://api.deepseek.com/v1
```

这条路径没有证据显示经过 AI Link 中转；但它不是“完全自主”，因为最终推理仍依赖 DeepSeek 官方 API、网络、账号、额度和模型可用性。

OpenClaw 当前路径更像：

```text
OpenClaw -> OpenClaw 自己的 provider 配置 -> DeepSeek/SenseNova 等外部 API
```

它没有收敛到 `18800`，因此工作台无法统一做模型熔断、用量统计、key 管理、模型下线提示和供应商切换。

### 18800 是绕开第三方还是转发？

`18800` 已经绕开 AI Link 这类第三方中转，但它本质仍是本机转发代理：

- 自主部分：本机 loopback 入口、统一注入 `DEEPSEEK_API_KEY`、重试、日志、员工归因。
- 非自主部分：最终 upstream 默认是 DeepSeek 官方云 API；没有本地推理能力，也没有多 provider adapter 和自动降级矩阵。

因此状态应标为“半依赖”，不是“已完全自主”。

## 2. 参考方案：Hermes CN Desktop / 本地代理集中鉴权

可借鉴的不是某个具体供应商，而是架构原则：

1. 桌面主进程或本机守护进程持有真实 provider key。
2. 所有员工只访问 `127.0.0.1` 上的本机代理，不直接保存真实云端 key。
3. 员工使用短 token 或本地占位 token，代理负责鉴权、审计、限流、模型映射和错误归一化。
4. 代理提供 OpenAI-compatible endpoints，例如 `/v1/models`、`/v1/chat/completions`、`/v1/responses`，以兼容 Hermes、OpenClaw、Codex 类客户端。
5. 本机代理应有明确健康接口和日志：provider 可用性、账号额度、最近错误、模型是否下线、当前 fallback。
6. 外部服务只作为 provider，不作为不可替换的中转控制面。

对 AI Workbench 的直接借鉴：

- 把 `18800` 从“DeepSeek 单 provider 转发器”升级为“本机模型控制平面”。
- 所有员工配置只允许指向 `18800`，不允许散落 provider key。
- 用 provider adapter 隔离 DeepSeek、OpenAI、xAI、SenseNova、本地模型等差异。
- 把密钥放到用户数据目录或系统凭据管理器，项目仓库只保存占位 token 和路由名。
- 模型供应商不可用时，由代理输出面向用户的中文诊断，而不是让员工各自超时。

## 3. 自主化路线

### 第 0 步：依赖账本与运行时证据

工作量：0.5-1 天。

收益：先把“哪里受制于人”说清楚，避免把第三方故障误判为应用 bug。

兼容性：无侵入，只写诊断和版本矩阵。

交付物：

- `versions/current.json` 增加运行时 provider 证据字段。
- 运行健康页展示：Workbench、18800、Hermes、OpenClaw、provider、渠道。
- 日志中明确 `upstreamBaseUrl`，但不打印 key。

### 第 1 步：所有员工模型调用统一走 `18800`

工作量：1-2 天。

收益：OpenClaw、Hermes、Workbench 统一鉴权、限流、日志、模型下线提示和 fallback。

兼容性：高。Hermes 已完成雏形；OpenClaw 需要把 provider 配置改成 OpenAI-compatible local provider。

要点：

- OpenClaw provider 改为 `base_url=http://127.0.0.1:18800/v1`。
- 员工只保存 `aiw.<agent>.local` 形式本机 token。
- adapter health check 不再直接跑重型 status，而先查 `18800/health` 和 OpenClaw gateway 分项。

### 第 2 步：`18800` provider adapter 化

工作量：2-4 天。

收益：替换模型供应商不影响员工；可以做模型分层调用、成本控制、灰度切换。

兼容性：中。需要扩展 `model-proxy.mjs` 配置和 `/v1/models` 响应。

建议 adapter：

- `deepseek`: DeepSeek 官方 API。
- `openai`: OpenAI 官方 API。
- `xai`: xAI 官方 API。
- `sensenova`: SenseNova 官方 API。
- `local`: Ollama/vLLM/LM Studio 等本地模型。

### 第 3 步：模型可用性与下线检测

工作量：1-2 天。

收益：用户看到的是“模型不可用、是否切换”，不是员工超时或空白失败。

兼容性：高。可先做只读检测。

机制：

- 定时调用 provider `/models` 或轻量 completion。
- 对固定模型名如 `deepseek-chat` 建立“用户锁定策略”。
- 官方换代或下线时提示：
  - 保持当前模型：继续使用直到不可用。
  - 跟进新模型：写入矩阵与 lock。
  - 临时切换备用模型：仅本次或全局。

### 第 4 步：渠道与 gateway 自主化

工作量：3-7 天。

收益：OpenClaw/Hermes gateway 不再成为黑箱，渠道状态可观测、可恢复。

兼容性：中。需要拆出 channel adapter 和 watchdog。

要点：

- gateway 健康拆成进程、端口、平台连接、模型调用四项。
- 对飞书/Telegram/微信只保存平台 token，不让模型链路混在渠道配置里。
- Windows 计划任务或桌面 watchdog 负责开机恢复。

### 第 5 步：本地推理或自托管推理

工作量：1-3 周，取决于模型质量目标和硬件。

收益：关键任务可在断外网或供应商故障时降级运行。

兼容性：中低。需要模型下载、显存/内存检测、质量评测和任务分流。

现实判断：不建议一开始追求“所有任务本地化”。应先把轻任务、分类、去重、路由、摘要草稿放到便宜模型或本地模型；理解/编排/高价值输出仍可用强云模型。

## 4. 过程中的妥协与 adapter 封装

短期不得不保留第三方的环节：

| 环节 | 为什么短期保留 | 封装方式 |
| --- | --- | --- |
| 云模型 provider | 本地模型质量、速度、硬件门槛暂时无法覆盖所有任务 | 全部经 `18800` provider adapter；员工不感知 provider。 |
| Codex 开发模型 | Codex 是开发工具链，不属于产品运行时可完全控制范围 | 独立记录为开发依赖，不承诺产品可用性。 |
| 飞书/Telegram/微信/X/小红书 | 渠道天然依赖平台账号、API、风控和政策 | channel adapter + health check + 限速策略 + 可替换通道。 |
| npm/pip/winget 包源 | 员工安装、升级、回退需要外部包源 | 版本锁 + 本地安装包缓存 + 失败回退。 |
| AI Link 等历史链路 | 迁移期可能仍有账号、代理或员工资产依赖 | 写成 adapter，不让业务逻辑直接调用 AI Link。 |

adapter 设计原则：

1. 业务层只说“我要模型能力/渠道能力/员工能力”，不写具体供应商 URL。
2. adapter 必须暴露 `health()`、`invoke()`、`version()`、`capabilities()`。
3. adapter 错误必须归一化为 `unavailable`、`auth_failed`、`rate_limited`、`model_removed`、`network_failed`。
4. 所有 provider key 只存本机受控位置，不进入仓库、不进入前端、不进入员工日志。
5. 每次模型或员工版本变化写入版本矩阵，方便回退和复盘。

## 5. 推荐优先级

1. 先把 OpenClaw 模型配置收敛到 `18800`，这是当前最大断点。
2. 把 `18800` 抽象成 provider adapter，而不是继续写死 DeepSeek。
3. 增加模型下线检测和用户选择提示。
4. 增加本机 watchdog，分别看 `18800`、Hermes、OpenClaw gateway、外部 provider。
5. 最后再做本地模型 fallback；这一步价值大，但不应阻塞前面的链路自主化。

## 路径：F:\AI-Workbench\research\unified-model-proxy-plan.md

# 统一模型入口方案

日期：2026-07-21

范围：把 AI Workbench、Hermes、OpenClaw 三个员工的模型调用统一收敛到本机 `18800` 模型代理；方案覆盖配置改造、代理结构升级、验收标准和后续收益。

## 1. 目标

把 Workbench、Hermes、OpenClaw 三个员工的模型调用全部经过本机 `18800` 代理，让 `18800` 成为 provider 统一入口。

目标链路：

```text
Workbench / Hermes / OpenClaw
        |
        v
http://127.0.0.1:18800/v1
        |
        v
provider registry
        |
        v
DeepSeek / OpenAI / xAI / local 等供应商
```

短期先只接 `deepseek`，但结构必须能扩展到 `openai`、`xai`、`local` 等 provider。员工侧不保存真实供应商 key，只保存本机占位 token；真实 key、供应商路由、模型映射、重试和日志都由 `18800` 统一处理。

## 2. 当前状态

### 已收敛

- Workbench DeepSeek 调用已经默认走 `MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1`。
- Hermes adapter 会写入本地 Hermes runtime 配置：
  - `OPENAI_BASE_URL=http://127.0.0.1:18800/v1`
  - 本地占位 token：`aiw.hermes.local`
  - 默认模型：`deepseek-chat`
- `18800` 已提供 loopback-only 入口、重试、日志和员工归因。

### 未收敛的缺口

- OpenClaw 模型 provider 仍散落在自己的 `openclaw.json` 配置里。
- OpenClaw 当前 provider 直接指向外部 API，例如 DeepSeek / SenseNova，而不是 AI Workbench 的 `18800`。
- 这会导致工作台无法统一做模型熔断、用量统计、key 管理、模型下线提示和供应商切换。

## 3. 要做的：第二刀

### 3.1 OpenClaw 配置收敛到本地 provider

把 OpenClaw 配置改成 OpenAI-compatible 本地 provider：

```text
baseUrl: http://127.0.0.1:18800/v1
apiKey: aiw.openclaw.local
api: openai-completions
```

OpenClaw 保持它熟悉的模型命名：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

`18800` 负责把 OpenClaw 的模型别名归一到真实 provider 模型，例如：

- `deepseek-v4-flash` -> `deepseek-chat`
- `deepseek-v4-pro` -> `deepseek-chat`

配置改动必须先备份，验证结束后恢复用户原始 `%USERPROFILE%\.openclaw\openclaw.json`，避免验收脚本永久改写用户配置。

### 3.2 `18800` 升级成 provider registry

把 `model-proxy.mjs` 从单一 DeepSeek upstream 转成 provider registry：

- 默认 provider：`deepseek`
- provider 元数据：`id`、`name`、`type`、`baseUrl`、`apiKeyEnv`、`models`
- `/health` 返回 default provider、provider 配置状态、模型列表和 loopback-only 状态
- `/v1/models` 返回 OpenAI-compatible 模型列表
- `/v1/chat/completions` 根据 provider 和模型映射转发

当前只实现 `deepseek`，但结构保留后续扩展位：

- `openai`
- `xai`
- `sensenova`
- `local`，例如 Ollama / vLLM / LM Studio

### 3.3 三员工统一验证

新增统一验收脚本，验证三类员工都真实经过 `18800`：

1. DeepSeek adapter 直接调用 `18800`。
2. Hermes 通过本地 Hermes runtime 配置调用 `18800`。
3. OpenClaw 通过临时本地 provider 配置调用 `18800`。

验收脚本需要扫描：

- OpenClaw 模型 provider 不含外部模型 endpoint。
- OpenClaw 模型 provider 不含真实 API key。
- Hermes runtime 配置指向 `18800` 且使用本地占位 token。
- 代理日志中三类员工都有 `/chat/completions` 成功记录。

## 4. 验收标准

### a) OpenClaw 通过 `18800` 成功调用模型

验收证据：

- OpenClaw gateway 可启动并可连接。
- OpenClaw 员工执行最小任务成功。
- `18800` 代理日志出现：

```json
{
  "employee": "openclaw",
  "provider": "deepseek",
  "path": "/chat/completions",
  "statusCode": 200
}
```

### b) 三个员工配置都没有真实 API key 裸露

验收证据：

- Workbench / DeepSeek adapter 不保存真实 key，只请求本机代理。
- Hermes runtime 配置使用 `aiw.hermes.local`。
- OpenClaw 临时 provider 使用 `aiw.openclaw.local`。
- 仓库文件、Hermes runtime 配置、OpenClaw provider 配置均不得出现真实形态的 `sk-...` key。

### c) OpenClaw 六项健康检查正常

六项检查：

1. `installed`：OpenClaw shim 或 Node 入口可用。
2. `version`：`openclaw --version` 返回版本。
3. `gateway_port`：`127.0.0.1:18789` 端口监听。
4. `gateway_ws`：gateway websocket 可连接。
5. `channels`：通道探测有分项结果，超时不阻塞基础 gateway 可用性。
6. `models`：模型探测有分项结果，超时不阻塞基础 gateway 可用性；实际模型调用以 `18800` 代理日志为准。

健康检查不能再依赖单个重型 `openclaw status`。必须拆成分项，超时要被归一成可解释状态。

### d) commit + push

完成后必须：

1. 运行最小语法检查。
2. 运行 `npm.cmd run verify:model-proxy`。
3. 运行 `npm.cmd run verify:unified-model-proxy`。
4. 确认 `%USERPROFILE%\.openclaw\openclaw.json` 已恢复用户原配置。
5. 提交统一模型入口相关代码、方案和验收摘要。
6. `git push` 到当前分支。

## 5. 后续收益

统一模型入口完成后，工作台可以继续做：

- 模型分层：理解、编排、执行、摘要、去重分别用不同模型。
- 供应商切换：DeepSeek、OpenAI、xAI、本地模型可以在代理层切换，员工无感。
- 熔断降级：某个 provider 异常时，代理统一给出中文诊断或切备用模型。
- 成本控制：按员工、任务类型、模型记录调用日志和成本估算。
- 模型下线检测：固定模型不可用时，由代理提示用户保持、切换或跟进新模型。
- 密钥治理：真实 key 只在本机受控位置出现，不进入仓库、前端、员工配置或普通日志。

## 6. 当前完成记录

2026-07-21 已完成第二刀实现和验收：

- `model-proxy.mjs` 已扩展为 provider registry 结构。
- `scripts/verify-model-proxy.mjs` 已验证 `/health` 和 `/v1/models`。
- `scripts/verify-unified-model-proxy.mjs` 已验证 DeepSeek、Hermes、OpenClaw 三员工都通过 `18800` 调用模型。
- OpenClaw 验收运行期会临时写入本地 provider，结束后恢复用户原 `openclaw.json`。
- 验收摘要写入 `verification/unified-model-proxy/summary.json`。

# 第五部分：下一步指令

## 下一步：上线硬骨头3 下载安装

当前状态：上线硬骨头1“陌生机器不崩”和硬骨头2“共享 key 落地”已完成；Workbench/Hermes/OpenClaw 三个员工的模型调用已统一到 18800 代理，真实 key 只在 18800 服务端边界内读取。

下一步：打安装包并挂 GitHub Release，只给用户一个下载链接。

- 确认安装包包含 `dist/**`、Electron、`server.mjs`、`model-proxy.mjs`、`readiness.mjs`、`runtime-paths.mjs` 和必要运行目录。
- 在发布流程里明确共享 key 注入方式，不能把真实 key 写进仓库、前端、员工配置或公开日志。
- 产出 GitHub Release 下载链接，并保留安装版验收证据。

目标：普通用户只点一个链接下载、安装、打开，不需要配置 key，也不会因为缺依赖白屏。

新对话框的任务：

1. 确认能读这个综合文件。
2. 用大白话讲出：产品现在在哪（v0.4.5 独立应用三员工，硬骨头1/2已过）、下一步要做什么（下载安装包和 GitHub Release 下载链接）。
3. 开始检查打包配置、生成安装包、创建/更新 Release，并记录验收证据。
