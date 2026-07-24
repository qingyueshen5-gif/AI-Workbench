# TASKLOG.md - 任务总账本

> 仓库文件是唯一事实来源。每个任务下达、完成、验收和交接都必须写回本仓库，不能只留在对话里。

最新更新：2026-07-24

## 当前一句话状态

AI Workbench 已完成统一模型入口、上线三大硬骨头、v0.4.6 Alpha 公开发布、产品方向收口、文档基准防漂移机制、电脑环境治理审计、产品定位修正、阶段性总审核（砍薄版）和生存体检。第一批安全清理遗留目录已在重启后处理，用户 npm 缓存仍因 `EPERM` 未清理；Windows 临时文件需产品负责人手动确认。当前等待产品负责人验收生存体检，未经批准不得实现平台月度总开销上限、自动熔断或其他后续任务。

## 已完成任务

| 任务 | 状态 | 做了什么 | 验收产物 |
| --- | --- | --- | --- |
| 统一模型入口 | 已完成 | Workbench、Hermes、OpenClaw 三个员工的模型调用统一收敛到本机 `18800` 代理；`model-proxy.mjs` 已扩展为 provider registry。 | `verification/unified-model-proxy/summary.json` |
| 硬骨头1：陌生机器不崩 | 已完成 | 启动路径改为缺依赖降级；首次运行自动创建 config/data/logs/evidence；18800/Hermes/OpenClaw/端口异常统一返回中文未就绪状态。 | `verification/clean-machine/summary.json`、`verification/clean-machine/readiness-report.md` |
| 硬骨头2：共享 key 落地 | 已完成 | 18800 网关支持共享托管 key 兜底；用户本机 key 优先；前端、Hermes、OpenClaw 和员工配置只使用本机占位 token。 | `verification/shared-key/summary.json` |
| 任务账本与进度口径校准 | 已完成 | 新增本文件作为总账本；明确当前缺失文件、真实进度和下一步；避免跨 AI 协作时混淆“统一模型入口”和“模型分层”。 | `TASKLOG.md` |
| 固化分段执行与验收协议 | 已完成 | 创建 `EXECUTION_PROTOCOL.md`，把单一主线、分段执行、真实验收、失败也留痕和产品负责人批准下一阶段写成固定规范；当前 3A 仍是唯一主线，未改变产品路线。 | `EXECUTION_PROTOCOL.md`、`tasks/2026-07-22-固化分段执行与验收协议.md` |
| 恢复本机安装版 | 已完成 | 将 F 盘候选安装包恢复为 Actions Run `29935231224` 通过验收的 hash 版本，重新安装 v0.4.6 到本机，修正桌面和开始菜单快捷方式，启动验证通过；未进入 R2/3B，未改代码。 | `tasks/2026-07-22-恢复本机安装版.md` |
| 今日收尾与产品距离核验 | 已完成 | 复核本机安装版、最近任务真实状态和产品距离；当时确认 3A-R1.3 passed、本机安装版已保留、生产注入和 3B Release 仍是核心阻塞；该生产注入阻塞已由 R2.1 解除。 | `verification/daily-closeout/summary.json`、`verification/daily-closeout/report.md`、`tasks/2026-07-23-今日收尾与产品距离核验.md` |
| 3A-R2.0：共享 Key 架构核验 | 已完成 | 审计当前 `shared_managed` 链路，确认当前只是本机环境兜底机制，不是生产远程注入；锁定正式架构为本机 18800 -> 自控远程 Managed Proxy -> DeepSeek 官方 API。 | `research/managed-proxy-production-plan.md`、`verification/managed-shared-key/architecture-summary.json`、`verification/managed-shared-key/architecture-report.md` |
| 3A-R2.1：Cloudflare 生产部署与真实验证 | 已完成 | Cloudflare Worker、D1、Secrets、生产 URL、真实 DeepSeek 调用、安装版零配置、刷新/吊销/限流/预算/紧急关闭/中文降级和安全扫描均通过；本阶段当时未创建 Release/tag，后续已进入并通过 ③A 总验收。 | `verification/managed-proxy-production/summary.json`、`verification/managed-proxy-production/report.md` |
| ③A 总验收 | 已完成 | 真实安装候选包、检查快捷方式、启动安装版后端、通过 `managed_remote` 生产链路完成模型对话、验证中文降级、安全扫描、真实卸载并恢复日常安装版。 | `verification/3a-final/summary.json`、`verification/3a-final/report.md` |
| ③B：v0.4.6 Alpha GitHub Release | 已完成 | 创建 annotated tag `v0.4.6`，创建公开 prerelease，上传安装包和 SHA256 文件，并从公开链接下载回测通过。 | `verification/3b-release/summary.json`、`verification/3b-release/report.md` |
| AI Workbench 产品方向收口 | 已完成 | 将全球愿景、一个输入框、用户状态波动补偿、借用生态但掌握控制层、跨平台执行边界和阶段路线整合进现有文档；未创建平行路线图。 | `tasks/2026-07-24-AI-Workbench产品方向收口.md` |
| 文档基准纠偏与防漂移机制 | 已完成 | 纠正当前状态文档漂移，建立事实单一归属规则，新增 Handoff 自动生成和文档一致性校验。 | `verification/docs-consistency/summary.json`、`verification/docs-consistency/report.md`、`tasks/2026-07-24-文档基准纠偏与防漂移机制.md` |
| 产品决策更新与任务顺序调整 | 已完成 | 写入产品效果与用户水平关系、可持续经营边界、合规情报边界、当前风险，并将下一任务调整为电脑环境治理。 | `tasks/2026-07-24-产品决策更新与任务顺序调整.md` |
| 电脑环境治理审计 | 已完成 | 完成产品资产备份、备份可恢复性验证、GitHub/Cloudflare/工具登录状态核查、磁盘/进程/缓存/安装包/自启项/软件盘点和清理候选清单。 | `verification/pc-environment-governance/summary.json`、`verification/pc-environment-governance/report.md`、`tasks/2026-07-24-电脑环境治理审计.md` |
| 电脑环境治理第一批安全清理 | 部分完成 | 已释放 F 盘约 3.06 GB；npm 缓存因 `EPERM` 未清理，Windows 临时文件改为人工确认，权限异常旧目录待重启后精确处理。 | `verification/pc-cleanup-batch1/summary.json`、`verification/pc-cleanup-batch1/report.md`、`tasks/2026-07-24-电脑环境治理第一批安全清理.md` |
| 产品定位修正与判断依据文档 | 已完成 | 将当前状态文档统一为“AI Workbench 是模型与 Agent 无关的调度框架；DeepSeek 是当前唯一生产实现且可替换”的口径；新增 `THINKING.md` 记录产品负责人判断依据；交接文件清单改为三份。 | `THINKING.md`、`tasks/2026-07-24-产品定位修正与判断依据文档.md` |
| 阶段性总审核（砍薄版） | 已完成 | 隔离恢复最新外部备份；扫描当前 Git tracked 内容和完整本地可达历史的凭据泄漏；核对 completed/passed/已完成声明与证据是否匹配；未发现确认的 Git 凭据泄漏或 confirmed fake completion，已修正 README、当前进度和 CONTEXT 的非关键过期表述。 | `verification/thin-stage-audit/summary.json`、`verification/thin-stage-audit/report.md` |
| 生存体检 | 已完成并修正场景边界 | 在 SSE 中断后先盘点现场，保护半成品，只做验证和交付收尾；随后修正 5/50/100 场景边界。当前限额正常路径月平台成本上界约 40.76 CNY，现金跑道约 7.96 个月；原 199.12 / 1686.24 / 3338.61 CNY 保留为 `uncapped_demand_pressure`，不代表当前生产限额下实际可发生的正常路径成本。钱包安全状态 unsafe，理论最坏成本 `unbounded` 的依据是失败/超时/并发逃逸路径不能证明 fail-closed。 | `verification/survival-cost-audit/summary.json`、`verification/survival-cost-audit/report.md` |

## 当前未完成任务

| 任务 | 当前状态 | 下一步 |
| --- | --- | --- |
| 硬骨头3：能下载能安装 | 已完成；v0.4.6 Alpha Release 已公开发布，下载回测通过 | 下一任务转入电脑环境治理。 |
| 打开后知道能干嘛 | 未完成 | 首屏放 3-5 条能点即跑的示例指令。 |
| 办不成时是人话不是崩 | 部分完成 | 已有 readiness 降级说明；后续继续补失败自愈、重试和人话解释。 |
| 反馈出口 + 一句安全告知 | 未完成 | 增加反馈渠道和基础安全告知。 |
| 模型分层调用 | 未开始/暂缓 | 等上线最小集前三条稳定后再做；不要抢跑。 |
| 手机端 | 未开始 | 等桌面上线闭环后再排期。 |
| 自动情报流水线 | 未开始/P3 | 后续再做，不阻塞上线。 |
| 电脑环境治理：产品资产备份、单点故障核查和清理候选盘点 | 已完成 | 已进入第一批安全清理，当前清理结果为 partial。 |
| 重启后处理第一批遗留空目录，并由产品负责人决定Windows临时文件及第二批软件清理 | 部分完成 | 已处理批准遗留目录；用户 npm 缓存仍因 `EPERM` 失败，Windows 临时文件仍需产品负责人手动确认；不得自动进入第二批清理。 |
| 平台月度总开销上限和自动熔断 | 未开始 | 只能在产品负责人验收生存体检并明确批准后执行；本轮未实现。 |

## 最新 3A-R1.3 结果

- 任务：上线硬骨头3A-R1.3：恢复 GitHub Actions 可观测性并完成云端预验收。
- 状态：passed。
- 本轮确认：GitHub CLI 已恢复，Run `29920336923` 的 artifact 已下载读取；`actions-build.log` 显示云端构建失败根因是 `package.json` 写死 `build.electronDist=node_modules/electron/dist`，而 Actions `npm ci` 后该目录不存在。
- 已做最小修复：删除 `electronDist`；预验收脚本不再读取旧 NSIS 证据；NSIS smoke runtime 改为唯一目录；workflow 增加 Step Summary 和 build/preflight/artifact gate；临时 Actions 下载目录加入 `.gitignore`。
- Run `29933834029`：云端安装包构建、安装、smoke-test、卸载和扫描均通过，artifact 内 `preflight-summary.json` 为 passed；但 job 仍 failure，原因是 electron-builder 在 CI 中尝试隐式 publish，报 `GH_TOKEN` 未设置。已追加 `--publish never`。
- Run `29935231224`：真实 conclusion 为 success；云端 build/install/smoke/uninstall/扫描均 passed。
- 本地验证：`node --check` 和 `npm.cmd run build` 通过；`npm.cmd run verify:install-release` 完成安装、smoke、卸载和扫描，但因本机旧 `win-unpacked` 被文件锁清理破坏仍为 failed。最终以新 Actions 干净环境 run 为准。
- 验收产物：`verification/install-release/repair1-3-summary.json`、`verification/install-release/repair1-3-report.md`。
- 结论：R1.3 已判绿。Run `29935231224` 真实 success，云端 build/install/smoke/uninstall/扫描通过；不自动进入 R2，不进入 3B。

## 缺失文件说明

| 缺失文件 | 是否需要现在补 | 原因 |
| --- | --- | --- |
| `verification/model-router/summary.json` | 不补 | 这个文件名对应“模型分层/模型路由”验收产物，但模型分层任务尚未正式执行。当前已有的是 `verification/unified-model-proxy/summary.json`，它只代表“统一模型入口”验收，不能冒充模型分层验收。 |
| `research/market-intelligence.md` | 暂不补 | 该文件对应后续市场/情报材料，当前仓库不存在；情报流水线是 P3，不阻塞上线硬骨头3。 |

## 留痕规则

- 每次下达或完成任务，都必须更新 `TASKLOG.md`、`CHANGELOG.md`、`CURRENT_TASK.md`。
- 每个新 AI / 新 Codex 接手前必须先读 `EXECUTION_PROTOCOL.md`。
- 涉及方案或调研时，必须写入 `research/` 下对应 `.md`。
- 涉及验收时，必须把摘要写入 `verification/<task-name>/summary.json`；有人工可读报告时写入同目录 `.md`。
- 完成后必须 `commit + push`，让本地 F 盘和 GitHub 同步。
- 不允许为了“补齐文件”伪造未执行任务的验收产物。

## 最新 3A 结果

- 任务：上线硬骨头3A：安装包候选版与发布前预验收。
- 最新修复轮：3A-R1.3，状态 passed。
- 候选安装包：`release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`，SHA256 `ca833403906e8ba82c267813ced701b39a83f9d7a7d9f3e9e857a011b6b9ab47`。
- 验收产物：`verification/install-release/preflight-summary.json`、`verification/install-release/preflight-report.md`、`verification/install-release/nsis-install-uninstall.json`、`verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/repair1-2-install.log`、`verification/install-release/repair1-2-smoke.log`、`verification/install-release/repair1-2-uninstall.log`。
- R1 已做：为 packaged smoke-test 禁用更多 GPU 路径并改为 HTTP renderer 探测；安装验证改为发现真实安装路径；尝试 assisted NSIS、默认 per-user、`/currentuser`、oneClick NSIS、`force-run` 和 60 秒等待。
- R1.2 根因：安装包 payload 有效；默认 per-user 安装目录在当前中文用户名环境下没有稳定落盘，只留下 updater 缓存副本。显式 `/D=` 到 ASCII 路径可落盘。
- R1.2 修复：新增 `build/installer.nsh`，将默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`；新增 `scripts/verify-nsis-install.mjs`，主 preflight 改用 Node helper 真实执行安装、安装版 smoke-test 和卸载。
- 本地结果：`npm.cmd run verify:install-release` 通过；NSIS `/S` 安装真实落盘，exe、卸载器、卸载注册表项、桌面/开始菜单快捷方式均存在；安装版 `--smoke-test` 退出码 0；卸载退出码 0。
- GitHub Actions：Run `29919498085` failure，失败在 build；Run `29919834193` 和 `29920088772` build 成功但 preflight 被 skipped；Run `29920336923` build 失败根因已定位；Run `29933834029` preflight passed 但隐式 publish 失败；Run `29935231224` 已真实 success。
- ③A 总验收：passed。候选安装包来自 Actions Run `30001627121` artifact，SHA256 `b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`；真实安装、快捷方式、安装版后端启动、生产对话、中文降级、安全扫描、卸载和恢复安装版均通过。
- ③B GitHub Release：passed。公开 Release、安装包、SHA256 文件和下载回测均已完成；上线硬骨头3已完成。
- 结论：3A-R1.3 已通过；本机安装版已恢复；3A-R2.0 架构核验已通过；3A-R2.1 Cloudflare 生产部署与真实验证已通过；③A 总验收已通过；③B GitHub Alpha Release 已通过；产品方向和文档防漂移机制已完成。下一任务是电脑环境治理：产品资产备份、单点故障核查和清理候选盘点。
