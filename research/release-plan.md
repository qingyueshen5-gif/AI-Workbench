# AI Workbench 上线硬骨头3：安装包与发布方案

日期：2026-07-22

## 目标

让陌生 Windows 用户最终只拿到一个下载链接，下载 `AI-Workbench-Setup-v0.4.6-x64.exe` 后可以安装、打开、使用；缺依赖或服务异常时看到中文人话，不白屏、不暴露内部错误栈。

## 分段

### 3A：安装包候选版与发布前预验收

当前阶段。只生成候选安装包并完成本地/自动化预验收。

3A 不做：

- GitHub Release 正式发布；
- 正式 tag；
- 官网；
- 模型分层；
- 手机端；
- 自动情报流水线；
- 新配置页面；
- UI 新功能；
- `verification/model-router/summary.json`。

3A 产物：

- `release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`
- `verification/install-release/preflight-summary.json`
- `verification/install-release/preflight-report.md`
- 必要日志：`verification/install-release/*.log`

候选 exe 不提交 Git。

### 3B：GitHub Release 正式发布

只有 3A 通过且产品负责人批准后才能开始。

3B 目标：

- 创建正式 tag；
- 创建 GitHub Release；
- 上传安装包；
- 验证下载链接；
- 将 LAUNCH 硬骨头3标记为完成。

## 四条现实约束

1. GitHub Actions workflow 本轮可以创建并提交。没有真实 Actions 运行结果时，Actions 状态写 `pending` 或 `not_run`，不得写 `passed`。
2. `shared_managed` mock 只能证明机制。真实生产注入未实现时必须写 `failed` 或 `blocked`，不得用 mock 结果冒充生产可用。
3. 安装和卸载优先使用 NSIS 静默参数。静默不可用可使用 GUI，但必须写清实际验证方式；没实际卸载不能写 `passed`。
4. 即使核心项失败，仍生成候选安装包、`preflight-summary.json`、`preflight-report.md`、交接文档并 commit + push；总状态如实写 `failed`、`blocked` 或 `partial`，不进入 3B。

## 安全边界

安装包、解包目录和提交内容不得包含：

- `.env`
- 真实 API Key
- 本地用户数据
- `.git`
- 开发日志
- 历史安装包
- `%USERPROFILE%`
- `F:\AI-Workbench`
- 开发机专属绝对路径

扫描关键词：

- `sk-`
- `DEEPSEEK_API_KEY=`
- `SERPER_API_KEY=`
- `AIW_SHARED_DEEPSEEK_API_KEY=`
- `MODEL_PROXY_SHARED_API_KEY=`
- `%USERPROFILE%`
- `F:\AI-Workbench`

不得在报告中输出完整密钥。

## 验收标准

核心五项：

- a. 无硬编码开发机路径；
- b. 首次运行自动创建 config/data/logs/evidence；
- c. 依赖缺失时不崩、不白屏、给中文人话；
- d. 端口冲突有兜底；
- e. 就绪报告完整，有真实命令、退出码或文件证据。

补充项：

- 安装成功；
- 安装后应用能打开；
- 卸载成功；
- SHA256 生成；
- 安装包无真实 Key；
- 用户全程不需要配置 Key。

## 当前状态

3A-R1 状态：failed。

R1 已完成的修复尝试：

- Electron packaged smoke-test 增加 GPU 禁用参数，针对 `0x80000003` / Chromium GPU 进程崩溃做规避。
- smoke-test 改为通过内部 HTTP 检查 renderer 产物，不再依赖隐藏 BrowserWindow。
- 安装验证改为不假设固定路径，而是采集卸载注册表、快捷方式、真实 exe、真实卸载器和用户上下文。
- NSIS 从 assisted installer 调整为 oneClick per-user installer，保持不要求管理员权限。

R1 真实结果：

- `AI-Workbench-Setup-v0.4.6-x64.exe /S /currentuser` 退出码为 0。
- 安装器只复制自身到 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe`，SHA256 与候选安装包一致。
- 没有创建真实安装目录、卸载注册表项、`AI Workbench.exe` 或 `Uninstall AI Workbench.exe`。
- 桌面和开始菜单快捷方式仍指向历史坏路径。
- packaged smoke-test 未运行，卸载未实际执行。
- `shared_managed` 生产验证继续 blocked，本轮不处理、不冒充 passed。
- GitHub Actions Run `29912255523` 已完成，结论 failure；失败日志读取受 GitHub 权限限制返回 HTTP 403。

R1 结论：必须先查清 NSIS 为什么只写 updater 副本但不执行 `installApplicationFiles`，优先在 GitHub Actions 干净 Windows 环境复现，排除本机旧快捷方式和旧 updater 状态干扰。3A 通过前不得进入 3B。

## 3A-R1.2：NSIS 安装器修复

3A-R1.2 状态：local passed / Actions failed。

根因：

- 安装包 payload 有效，`win-unpacked` 可运行，显式 `/D=` 到 ASCII 路径可真实落盘。
- 默认 per-user 安装目录在当前中文用户名环境下没有稳定落盘，表现为只留下 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe`。

修复：

- 新增 `build/installer.nsh`，通过 electron-builder 的 NSIS include 将默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
- 新增 `scripts/verify-nsis-install.mjs`，真实执行 NSIS `/S` 安装、安装版 `--smoke-test` 和卸载。
- 主 preflight `scripts/verify-install-release.mjs` 改为调用 Node helper，避免 PowerShell 大脚本超时导致假失败。
- GitHub Actions preflight workflow 改为失败时也 `always()` 上传 installer、builder-debug 和 verification 证据。

本地验收：

- `npm.cmd run verify:install-release` 已通过。
- NSIS `/S` 安装真实落盘到 `%LOCALAPPDATA%\Programs\AIWorkbench`。
- `AI Workbench.exe`、`Uninstall AI Workbench.exe`、卸载注册表项、桌面快捷方式、开始菜单快捷方式均真实存在。
- 安装版 `--smoke-test` 退出码 0，未复现 `0x80000003`。
- 真实卸载退出码 0，安装目录和快捷方式清除。

待确认：

- GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`，preflight 未执行。
- 当前 gh 日志权限 403、artifact 下载 401；已补 workflow 诊断让下一次 run 上传 `actions-build.log`。
- 未取得真实 Actions passed 前，不能把 3A 云端预验收写成 passed。
- `shared_managed` 生产注入仍为 blocked，本轮不处理、不冒充 passed。

证据以 `verification/install-release/repair1-summary.json` 和 `verification/install-release/repair1-report.md` 为准。

## 3A-R1.3：Actions 云端预验收可观测性

3A-R1.3 状态：passed。

目标：

- 恢复 GitHub CLI 权限；
- 读取 Run `29920336923` 失败日志和 artifact；
- 按真实云端失败原因最小修复；
- 取得一次新的 `windows-installer-preflight.yml` success run。

本轮实际结果：

- GitHub CLI 已恢复。
- Run `29920336923` artifact 已下载读取。
- 根因是 `package.json` 写死 `build.electronDist=node_modules/electron/dist`，Actions 环境中该目录不存在，electron-builder 未产出安装包。
- 次要问题是 preflight 脚本在 artifact 缺失时读取旧 NSIS 证据，造成报告混乱。
- 已删除 `electronDist`，修复 preflight 旧证据读取，增强 workflow gate 和 Step Summary。
- Run `29933834029` 的 artifact 证明云端 build/install/smoke/uninstall/扫描已 passed；job failure 的剩余原因是 electron-builder 在 CI 中隐式 publish，报 `GH_TOKEN` 未设置。3A 禁止发布，已在 `dist:win` 增加 `--publish never`。
- Run `29935231224` 真实 conclusion 为 success；云端 build/install/smoke/uninstall/扫描均通过，artifact summary 为 passed。

结论：

- R1.3 已完成。
- 下一步是否进入 `③A-R2 shared key 生产注入修复/验证` 必须等待产品负责人批准。
- 当前仍不进入 3B，不创建 Release/tag。
