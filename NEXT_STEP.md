# NEXT_STEP.md

上线硬骨头3A 当前下一步：`③A-R2.1：实现远程 Managed Proxy 并做真实生产注入验证`。必须由产品负责人明确批准后才开始。

本机日常使用状态：v0.4.6 安装版已恢复并保留在 `%LOCALAPPDATA%\Programs\AIWorkbench`，桌面和开始菜单快捷方式已修正到当前安装目录；今日收尾已完成，不进入 R2 或 3B。

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
9. 3A-R1.3 根因已定位并修复：`package.json` 写死 `build.electronDist=node_modules/electron/dist` 导致 Run `29920336923` 未产出安装包；Run `29933834029` 又因 electron-builder 隐式 publish 失败；`dist:win` 已追加 `--publish never`，Run `29935231224` 已取得真实 success。

下一步：

1. 产品负责人明确批准后，进入 `③A-R2.1：实现远程 Managed Proxy 并做真实生产注入验证`。
2. R2.1 通过后再做 ③A 总验收。
3. ③A 总验收通过并经产品负责人批准后，才进入 ③B：GitHub Release 正式发布。
4. 未获得批准前，不进入 R2 或 3B，不创建 Release/tag。
