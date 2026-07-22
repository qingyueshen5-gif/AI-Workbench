# NEXT_STEP.md

上线硬骨头3A 当前下一步：提交 R1.3 云端构建修复并取得新的 GitHub Actions success run。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1.2 本地修复证据见 `verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/preflight-summary.json` 和 `verification/install-release/preflight-report.md`。

当前事实：

1. R1.2 已修复默认 NSIS 安装目录，固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
2. 本地 `npm.cmd run verify:install-release` 已通过。
3. 安装、快捷方式、卸载注册表项、安装版 smoke-test 和真实卸载均已通过。
4. GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`；日志/artifact 权限不足，已补 build log 上传。
5. GitHub Actions Run `29919834193` 和 `29920088772` build 成功，但 `Run install-release preflight` 被 workflow 条件跳过。
6. GitHub Actions Run `29920336923` build 成功且 preflight 已执行，但最终仍 failure。
7. GitHub CLI 已恢复，Run `29920336923` artifact 已下载读取。
8. `shared_managed` 生产注入继续记录为 blocked，不在安装链路修复中冒充 passed。
9. 3A-R1.3 根因已定位：`package.json` 写死 `build.electronDist=node_modules/electron/dist`，Actions 环境中该目录不存在，导致 electron-builder 未产出安装包。Run `29933834029` 已证明预验收 passed，但 electron-builder 隐式 publish 导致 job failure；已追加 `--publish never`，等待下一次 Actions success。

下一步：

1. commit + push R1.3 修复。
2. 触发并观察新的 `Windows Installer Preflight` run。
3. 下载新 run artifact，确认云端 build/install/smoke/uninstall/扫描真实通过。
4. 不创建 Release/tag，不进入 R2 或 3B。
