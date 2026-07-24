# DECISIONS.md

## 已定决策（不可推翻）

- 目标用户：普通人（要结果）+ 专业人（要省时间）。
- 护城河：极致零门槛 + 真办成事 + 死守简单。
- 全球产品方向：长期不只服务中国或海外某一个市场；不同国家和地区的语言、模型、合规和平台差异由后台逐步适配，用户入口保持一个输入框。
- 一个输入框：用户只表达目标，工作台后台承担上下文读取、任务拆解、模型选择、工具调用、检查、修复和最终交付。
- 用户状态波动补偿：用户睡眠、情绪、记忆和判断质量会波动；工作台必须保存长期目标、产品初衷、历史决策和当前进度，发现新决定与原方向冲突时主动提醒。
- 借用生态但掌握控制层：可以使用 GPT、Claude、DeepSeek、Hermes、OpenClaw、浏览器自动化和其他成熟产品作为杠杆；任务状态、长期记忆、任务分配、质量检查、失败恢复、成本控制、执行证据和最终结果审计必须由 AI Workbench 掌握。
- 跨平台执行边界：长期目标是在用户授权和平台规则范围内操作网站和电脑，完成阅读、收集、比较、填写、下载、上传、中断恢复和跨平台交接；不以绕过验证码、安全限制、平台权限或反自动化规则为产品目标。
- 去第三方依赖：三员工模型全经 18800。
- 共享 key 边界：真实模型 key 只允许 18800 服务端读取；前端、员工配置、OpenClaw/Hermes 只使用本机占位 token。用户本机 `DEEPSEEK_API_KEY` 优先，共享托管 key 作为开箱即用兜底。
- 上线最小集优先：先过 3 个硬骨头（陌生机器不崩 ✓、共享 key ✓、下载安装 ✓），模型分层/手机端/情报流水线可为上线让路。
- 后续候选路线：模型分层、手机端和情报流水线仍未实施，不是当前唯一下一步；当前唯一下一步以 `NEXT_STEP.md` 为准。
- 执行协议：所有大任务采用单一主线、分段执行、逐段验证、失败也留痕；产品负责人批准后才能进入下一阶段。固定规范见 `EXECUTION_PROTOCOL.md`。
- 发布分段：硬骨头3拆成 3A 候选安装包预验收和 3B GitHub Release 正式发布。3A 未通过时禁止 Release、禁止 tag、禁止把 LAUNCH 硬骨头3标记完成。
- 安装器策略：3A-R1.2 保持 NSIS oneClick per-user installer，不要求管理员权限；默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`，避免中文用户名环境下默认 per-user 安装目录不稳定落盘。该策略已通过本地 `npm.cmd run verify:install-release` 和 GitHub Actions Run `29935231224` 云端预验收。
- Actions 判绿策略：3A-R1.3 只有在恢复 GitHub CLI/Git 凭证、读取真实 Actions 日志/artifact，并取得新的 `windows-installer-preflight.yml` success run 后才能判绿。Run `29935231224` 已满足该条件；后续外部流程仍必须取得真实 run 结果后才能判绿。
- CI Electron runtime 策略：不要在 `package.json` 写死 `build.electronDist=node_modules/electron/dist`；CI 中由 electron-builder 自行解析/下载 Electron runtime，避免 `npm ci` 后该目录不存在导致云端安装包构建失败。
- shared_managed 生产架构：正式链路锁定为客户端/Workbench/Hermes/OpenClaw -> 本机 `127.0.0.1:18800` -> AI Workbench 自控远程 Managed Proxy -> DeepSeek 官方 API。真实 DeepSeek key 只能存远程服务端 Secret，禁止进入安装包、用户电脑、本机 `.env`、环境变量、日志或进程参数；不采用“Key 随包分发 + 消费限额”方案，限流、预算和紧急关闭只能作为远程服务保护措施。
- R2.0 历史结论：当时 `shared_managed` 机制测试 passed，但生产注入仍 blocked；该 blocked 已由 R2.1 Cloudflare 生产部署与真实验证解除。R2.1 前不得进入 3B Release、首屏示例、模型分层、手机端或情报流水线。
- R2.1 结论：Cloudflare Worker、D1、Secrets、生产 URL、真实 DeepSeek 上游、无本机 Key 18800、安装版零配置、刷新/吊销/限流/预算/紧急关闭/中文降级和安全扫描均已通过。R2.1 passed 只允许进入 3A 总验收，不等于 3A 总验收已完成，也不允许直接进入 3B Release。
- ③A 总验收结论：候选安装包真实安装、快捷方式、安装版后端启动、`managed_remote` 生产对话、中文降级、安全扫描、真实卸载和恢复日常安装版均已通过；证据见 `verification/3a-final/summary.json`。该阶段已完成，后续已进入并通过 ③B。
- ③B 发布结论：AI Workbench v0.4.6 Alpha 已创建公开 GitHub prerelease，annotated tag `v0.4.6` 指向 ③A 验收提交，安装包和 SHA256 文件已上传，公开下载回测 passed；证据见 `verification/3b-release/summary.json`。上线三大硬骨头整体完成，产品方向已收口，下一任务是产品资产备份与电脑清理审计。
