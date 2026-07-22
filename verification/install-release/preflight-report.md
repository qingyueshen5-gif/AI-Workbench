# Windows 安装包候选版发布前预验收

生成时间：2026-07-22T08:42:00.356Z

## 总状态

- 状态：failed
- 版本：0.4.6
- 安装包：release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe
- 大小：111661558
- SHA256：90b9a6c30e015fe8a283eae0ae31909c330511f372660596f4905b52b735adf7

## 五条硬验收

| 标准 | 状态 |
| --- | --- |
| a. 无硬编码开发机路径 | passed |
| b. 首次运行自建目录 | passed |
| c. 依赖缺失不崩并给中文说明 | passed |
| d. 端口冲突有兜底 | passed |
| e. 就绪报告完整 | passed |

## 安装与卸载

- 安装：failed，NSIS silent installer exited 0 but did not create the expected per-user Programs installation or uninstaller. Existing shortcuts still point to an old desktop install path, so 3A cannot be considered installable for strangers.
- 卸载：failed，Uninstall was not attempted because expected uninstaller was not created.

## shared_managed

- 机制测试：mock_upstream
- 生产验证：blocked
- 说明：3A has no production shared key injection evidence; mock only verifies mechanism.

## 安全扫描

- 运行时源码命中：2
- 解包目录命中：0
- 安装包命中：0

## 已知问题

- shared_managed production injection is not verified in 3A; mechanism test used mock upstream only.
- NSIS silent install did not create the expected per-user installed exe/uninstaller.
- Uninstall verification did not pass.
- Packaged Electron smoke test did not complete successfully.

## 命令证据

- `C:\Program Files\nodejs\node.exe F:\AI-Workbench\model-proxy.mjs` -> exit 0
- `git ls-files` -> exit 0
