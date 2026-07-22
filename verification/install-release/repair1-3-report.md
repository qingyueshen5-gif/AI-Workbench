# 上线硬骨头3A-R1.3：Actions 云端预验收可观测性

生成时间：2026-07-22 23:20 +08:00

## 状态

- 本轮状态：passed
- Run `29920336923` 失败根因：已定位
- 修复：已完成并推送，Run `29935231224` 已取得真实 success
- 是否进入 3B：否
- `shared_managed` 生产验证：blocked，本轮未处理

## Run 29920336923 真实根因

已成功下载 artifact `ai-workbench-v0.4.6-installer-preflight`，Artifact ID `8529650090`。

`actions-build.log` 显示 GitHub Actions 构建失败：

```text
The specified electronDist does not exist: D:\a\AI-Workbench\AI-Workbench\node_modules\electron\dist
```

根因是 `package.json` 写死了 `build.electronDist = node_modules/electron/dist`。在 `windows-latest` 的 `npm ci` 后该目录不存在，electron-builder 直接失败，没有产出安装包或 `win-unpacked`。

artifact 中的 `preflight-summary.json` 同步证明：

- `artifactExists: false`
- `unpackedExists: false`
- `artifactPath: ""`
- `sha256: ""`
- `fiveCriteria.e_readinessReportComplete: false`

另一个次要问题：`scripts/verify-install-release.mjs` 在 artifact 缺失时仍读取仓库旧的 `nsis-install-uninstall.json`，导致报告里出现“安装/卸载 passed 但安装包 missing”的混乱证据。

## 本轮最小修复

- `package.json`：删除 `build.electronDist`，让 electron-builder 在 CI 中自行解析/下载 Electron runtime。
- `package.json`：`dist:win` 增加 `--publish never`，禁止 electron-builder 在 CI 中隐式发布；3A 不创建 Release。
- `scripts/verify-install-release.mjs`：预验收开始先删除旧 `nsis-install-uninstall.json`；只有本轮 NSIS helper 真实运行后才读取该证据；扫描解包目录遇到不可读目录时跳过而不是崩溃。
- `scripts/verify-nsis-install.mjs`：每次使用唯一 installed smoke runtime 目录，避免旧 runtime 清理失败。
- `scripts/clean-release-output.mjs`：新增当前版本候选输出清理脚本，并接入 `npm run dist:win`。
- `.github/workflows/windows-installer-preflight.yml`：增加 Step Summary；final gate 同时检查 build、preflight 和 installer 是否存在。
- `.gitignore`：忽略临时下载的 Actions artifact inspection 目录。

## 本地验证

| 验证 | 状态 | 说明 |
| --- | --- | --- |
| `node --check scripts/verify-install-release.mjs` | passed | 语法通过 |
| `node --check scripts/clean-release-output.mjs` | passed | 语法通过 |
| `npm.cmd run build` | passed | Vite 构建通过 |
| `npm.cmd run dist:win` | failed | 本机旧 `release-v0.4.6-installer\win-unpacked` 残留被文件系统拒绝删除；CI 干净环境需以新 run 为准 |
| `npm.cmd run verify:install-release` | failed | 已真实完成 NSIS 安装、安装版 smoke-test、卸载、依赖降级、端口兜底和扫描；失败项是本机 `win-unpacked` 已被前序清理破坏，`unpackedExists=false` |

## Run 29933834029 结果

- Run ID：`29933834029`
- URL：https://github.com/qingyueshen5-gif/AI-Workbench/actions/runs/29933834029
- Job conclusion：failure
- artifact 下载：成功
- artifact 内 `preflight-summary.json`：passed
- 云端 build 产物：`release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`
- SHA256：`b774e44137ac733e038ab77b60e3f8a0ad88ea2e87c676e9bc1c2a93161dd669`
- 云端安装：passed
- 云端安装版 smoke-test：passed
- 云端卸载：passed
- 云端安全扫描：passed

失败原因：

```text
GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"
```

这是 electron-builder 在 CI 中检测到 GitHub 环境后尝试隐式 publish 导致的失败。3A 本来就禁止发布，所以已将 `dist:win` 改为 `electron-builder --win nsis --publish never`。

## Run 29935231224 最终结果

- Run ID：`29935231224`
- URL：https://github.com/qingyueshen5-gif/AI-Workbench/actions/runs/29935231224
- Job conclusion：success
- artifact 下载：成功
- artifact 内 `preflight-summary.json`：passed
- 云端 build：passed
- 云端 NSIS 静默安装：passed
- 云端安装路径：`C:\Users\runneradmin\AppData\Local\Programs\AIWorkbench`
- 云端安装版 `--smoke-test`：passed，退出码 0
- 云端卸载：passed，退出码 0
- 云端密钥和开发机路径扫描：passed
- 候选安装包：`release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`
- 大小：111522780 bytes
- SHA256：`ca833403906e8ba82c267813ced701b39a83f9d7a7d9f3e9e857a011b6b9ab47`

云端 artifact 证明：

- `artifactExists: true`
- `unpackedExists: true`
- `install.status: passed`
- `firstRun.exitCode: 0`
- `uninstall.status: passed`
- 五条硬验收均为 true

## 下一步

R1.3 已完成。下一步可进入 `③A-R2 shared key 生产注入修复/验证`，但必须由产品负责人明确批准后才能开始。

当前仍不进入 3B，不创建 Release/tag。
