# NEXT_STEP.md

上线硬骨头3A 当前下一步：先恢复本机 GitHub CLI/Git 凭证，再取得 GitHub Actions artifact/log 权限并定位云端 preflight failure。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1.2 本地修复证据见 `verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/preflight-summary.json` 和 `verification/install-release/preflight-report.md`。

当前事实：

1. R1.2 已修复默认 NSIS 安装目录，固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
2. 本地 `npm.cmd run verify:install-release` 已通过。
3. 安装、快捷方式、卸载注册表项、安装版 smoke-test 和真实卸载均已通过。
4. GitHub Actions Run `29919498085` 真实结果 failure，失败在 `Build installer candidate`；日志/artifact 权限不足，已补 build log 上传。
5. GitHub Actions Run `29919834193` 和 `29920088772` build 成功，但 `Run install-release preflight` 被 workflow 条件跳过。
6. GitHub Actions Run `29920336923` build 成功且 preflight 已执行，但最终仍 failure。
7. 当前 `gh` token invalid，日志 403、artifact 下载 401，无法读取云端失败详情。
8. `shared_managed` 生产注入继续记录为 blocked，不在安装链路修复中冒充 passed。
9. 3A-R1.3 已尝试恢复 `gh` 权限但授权未完成；当前 `gh auth status` 未登录，`git fetch origin` 因 GitHub 凭证缺失失败。证据见 `verification/install-release/repair1-3-summary.json`。

下一步：

1. 完成 `gh auth login --hostname github.com --git-protocol https --web --clipboard --scopes "repo,workflow"` 浏览器/设备授权。
2. 验证 `gh auth status`、`gh api user --jq .login` 和 `git fetch origin`。
3. 读取 artifact 中的 `verification/install-release/preflight-summary.json`、`preflight-report.md` 和 `actions-build.log`。
4. 按真实云端失败原因继续修 3A。
5. 不创建 Release/tag。
