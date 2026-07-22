# NEXT_STEP.md

上线硬骨头3A 下一修复轮：继续修复 Windows 安装包候选版安装链路。

执行前必须先读 `EXECUTION_PROTOCOL.md`。本轮只做候选安装包、本地预验收、Actions 预验收工作流和验收证据；不创建 GitHub Release，不创建正式 tag，不进入 3B。

当前 3A-R1 失败证据见 `verification/install-release/repair1-summary.json` 和 `verification/install-release/repair1-report.md`。

下一轮优先处理：

1. 查清 NSIS 安装器为何退出码 0 但只复制到 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe`，没有执行 `installApplicationFiles`。
2. 在干净 Windows 环境或 GitHub Actions 上复现，排除本机旧快捷方式/旧 updater 状态干扰。
3. 修复后必须重新验证真实安装目录、`AI Workbench.exe`、卸载器、卸载注册表项、桌面/开始菜单快捷方式、packaged smoke-test 退出码 0 和真实卸载。
4. `shared_managed` 生产注入继续记录为 blocked，不在安装链路修复中冒充 passed。
