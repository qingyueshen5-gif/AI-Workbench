# NEXT_STEP.md

上线硬骨头3A 当前下一步：等待 GitHub Actions 真实预验收结果。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1.2 本地修复证据见 `verification/install-release/repair1-2-summary.json`、`verification/install-release/repair1-2-report.md`、`verification/install-release/preflight-summary.json` 和 `verification/install-release/preflight-report.md`。

当前事实：

1. R1.2 已修复默认 NSIS 安装目录，固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
2. 本地 `npm.cmd run verify:install-release` 已通过。
3. 安装、快捷方式、卸载注册表项、安装版 smoke-test 和真实卸载均已通过。
4. GitHub Actions workflow 已改为失败也上传证据；必须 push 后取得真实 run 结果，未取得前状态只能是 pending。
5. `shared_managed` 生产注入继续记录为 blocked，不在安装链路修复中冒充 passed。

下一步：

1. push 后查看 Windows Installer Preflight Actions run。
2. 如果 Actions passed，交给产品负责人判断是否进入 3B：GitHub Release 正式发布。
3. 如果 Actions failed，下载 artifact/日志，继续修 3A，不创建 Release/tag。
