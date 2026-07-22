# NEXT_STEP.md

上线硬骨头3A 修复轮：修复 Windows 安装包候选版预验收失败项后重新跑 3A。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A 失败证据见 `verification/install-release/preflight-summary.json`。优先修复：NSIS 静默安装未创建预期 per-user 安装目录/卸载器；packaged Electron smoke test 未完成；`shared_managed` 生产注入未验证。
