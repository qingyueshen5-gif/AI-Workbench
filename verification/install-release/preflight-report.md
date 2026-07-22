# Windows 安装包候选版发布前预验收

生成时间：2026-07-22T12:10:31.684Z

## 总状态

- 状态：passed
- 版本：0.4.6
- 安装包：release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe
- 大小：111605899
- SHA256：857fd37521fa6cf8a01306d165e4cf3b5123013ca8392f1acf92807214976992

## 五条硬验收

| 标准 | 状态 |
| --- | --- |
| a. 无硬编码开发机路径 | passed |
| b. 首次运行自建目录 | passed |
| c. 依赖缺失不崩并给中文说明 | passed |
| d. 端口冲突有兜底 | passed |
| e. 就绪报告完整 | passed |

## 安装与卸载

- 安装：passed，
- 卸载：passed，

## shared_managed

- 机制测试：installed_smoke
- 生产验证：blocked
- 说明：3A-R1 does not implement production shared key injection; smoke validates installed app mechanics only.

## 安全扫描

- 运行时源码命中：6
- 解包目录命中：0
- 安装包命中：0

## 已知问题

- shared_managed production injection is not verified in 3A; mechanism test used mock upstream only.

## 命令证据

- `C:\Program Files\nodejs\node.exe F:\AI-Workbench\scripts\verify-nsis-install.mjs F:\AI-Workbench\release-v0.4.6-installer\AI-Workbench-Setup-v0.4.6-x64.exe F:\AI-Workbench\verification\install-release` -> exit 0
- `C:\Program Files\nodejs\node.exe F:\AI-Workbench\model-proxy.mjs` -> exit 0
- `git ls-files` -> exit 0
