# NEXT_STEP.md

上线硬骨头3A 当前状态：`③A 总验收` 已 passed。3A-R1.3 安装链路、3A-R2.1 生产 Managed Proxy 链路、安装版零配置、中文降级、安全扫描、真实卸载和恢复安装版均已通过。

本机日常使用状态：v0.4.6 安装版已恢复并保留在 `%LOCALAPPDATA%\Programs\AIWorkbench`，桌面和开始菜单快捷方式已修正到当前安装目录；今日收尾已完成，不进入 R2 或 3B。

执行前必须先读 `EXECUTION_PROTOCOL.md`。下一轮只等待产品负责人明确批准是否进入 ③B；未获批准前，不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1.2 本地修复证据见 `verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/preflight-summary.json` 和 `verification/install-release/preflight-report.md`。

当前事实：

1. R1.2 已修复默认 NSIS 安装目录，固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
2. 本地 `npm.cmd run verify:install-release` 已通过。
3. 安装、快捷方式、卸载注册表项、安装版 smoke-test 和真实卸载均已通过。
4. GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`；日志/artifact 权限不足，已补 build log 上传。
5. GitHub Actions Run `29919834193` 和 `29920088772` build 成功，但 `Run install-release preflight` 被 workflow 条件跳过。
6. GitHub Actions Run `29920336923` build 成功且 preflight 已执行，但最终仍 failure。
7. GitHub CLI 已恢复，Run `29920336923` artifact 已下载读取。
8. `shared_managed` 的旧本机兜底已被 R2.1 远程 Managed Proxy 正式替代；生产注入已通过，不再记录为 blocked。
9. 3A-R1.3 根因已定位并修复：`package.json` 写死 `build.electronDist=node_modules/electron/dist` 导致 Run `29920336923` 未产出安装包；Run `29933834029` 又因 electron-builder 隐式 publish 失败；`dist:win` 已追加 `--publish never`，Run `29935231224` 已取得真实 success。

③A 总验收事实：

1. 总验收状态：passed。
2. 候选包：Actions Run `30001627121` artifact，路径 `.tmp-3a-actions-30001627121/ai-workbench-v0.4.6-installer-preflight/release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`。
3. SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
4. 证据：`verification/3a-final/summary.json`、`verification/3a-final/report.md`。

下一步：

1. 等待产品负责人明确批准是否进入 ③B：GitHub Release 正式发布。
2. 获得批准后，才创建 Release/tag 和正式下载链接。
3. 未获得批准前，不进入 3B，不创建 Release/tag。
