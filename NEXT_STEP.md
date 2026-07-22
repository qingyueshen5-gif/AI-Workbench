# NEXT_STEP.md

上线硬骨头3A 当前下一步：修复 GitHub Actions preflight 被跳过。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1.2 本地修复证据见 `verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/preflight-summary.json` 和 `verification/install-release/preflight-report.md`。

当前事实：

1. R1.2 已修复默认 NSIS 安装目录，固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
2. 本地 `npm.cmd run verify:install-release` 已通过。
3. 安装、快捷方式、卸载注册表项、安装版 smoke-test 和真实卸载均已通过。
4. GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`；日志/artifact 权限不足，已补 build log 上传。
5. GitHub Actions Run `29919834193` build 成功，但 `Run install-release preflight` 被 workflow 条件跳过，最终失败在 `Fail when preflight failed`。
6. `shared_managed` 生产注入继续记录为 blocked，不在安装链路修复中冒充 passed。

下一步：

1. push workflow 条件修复，触发新的 Windows Installer Preflight run。
2. 确认新 run 真正执行 `Run install-release preflight`。
3. 如果 Actions passed，交给产品负责人判断是否进入 3B：GitHub Release 正式发布。
4. 不创建 Release/tag。
