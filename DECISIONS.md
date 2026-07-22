# DECISIONS.md

## 已定决策（不可推翻）

- 目标用户：普通人（要结果）+ 专业人（要省时间）。
- 护城河：极致零门槛 + 真办成事 + 死守简单。
- 去第三方依赖：三员工模型全经 18800。
- 共享 key 边界：真实模型 key 只允许 18800 服务端读取；前端、员工配置、OpenClaw/Hermes 只使用本机占位 token。用户本机 `DEEPSEEK_API_KEY` 优先，共享托管 key 作为开箱即用兜底。
- 上线最小集优先：先过 3 个硬骨头（陌生机器不崩 ✓、共享 key、下载安装），模型分层/手机端/情报流水线可为上线让路。
- 五步走：①修 OpenClaw ✓ ②统一模型入口 ✓ ③模型分层（待继续）④手机端 ⑤情报流水线。
- 执行协议：所有大任务采用单一主线、分段执行、逐段验证、失败也留痕；产品负责人批准后才能进入下一阶段。固定规范见 `EXECUTION_PROTOCOL.md`。
- 发布分段：硬骨头3拆成 3A 候选安装包预验收和 3B GitHub Release 正式发布。3A 未通过时禁止 Release、禁止 tag、禁止把 LAUNCH 硬骨头3标记完成。
- 安装器策略：3A-R1.2 保持 NSIS oneClick per-user installer，不要求管理员权限；默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`，避免中文用户名环境下默认 per-user 安装目录不稳定落盘。该策略已通过本地 `npm.cmd run verify:install-release` 和 GitHub Actions Run `29935231224` 云端预验收。
- Actions 判绿策略：3A-R1.3 只有在恢复 GitHub CLI/Git 凭证、读取真实 Actions 日志/artifact，并取得新的 `windows-installer-preflight.yml` success run 后才能判绿。Run `29935231224` 已满足该条件；后续外部流程仍必须取得真实 run 结果后才能判绿。
- CI Electron runtime 策略：不要在 `package.json` 写死 `build.electronDist=node_modules/electron/dist`；CI 中由 electron-builder 自行解析/下载 Electron runtime，避免 `npm ci` 后该目录不存在导致云端安装包构建失败。
