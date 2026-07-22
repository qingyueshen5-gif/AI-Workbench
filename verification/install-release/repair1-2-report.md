# 上线硬骨头3A-R1.2：NSIS 安装器修复

生成时间：2026-07-22

## 状态

- 本地 R1.2 状态：passed
- 是否进入 3B：否，等待 GitHub Actions 真实结果和产品负责人验收
- shared_managed 生产验证：blocked，本轮未处理

## 根因

NSIS 默认 per-user 安装目录在当前中文用户名环境下没有稳定落盘；安装器只留下 `%LOCALAPPDATA%\ai-workbench-updater\installer.exe`。显式 `/D=C:\Users\Public\AIW-R1-2-Test\AI Workbench` 可落盘，说明安装包 payload 有效，问题在默认安装目录/安装执行链。

## 修复

- 新增 `build/installer.nsh`，将默认安装目录固定为 `%LOCALAPPDATA%\Programs\AIWorkbench`。
- 新增 `scripts/verify-nsis-install.mjs`，用 Node + PowerShell 执行真实安装、安装版 smoke-test 和卸载。
- 更新 `scripts/verify-install-release.mjs`，主 preflight 使用新的 NSIS helper。
- 更新 GitHub Actions，失败时也 `always()` 上传 installer 和 verification 证据。

## 验收结果

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| win-unpacked 可运行 | passed | R1.2 win-unpacked smoke 退出码 0 |
| NSIS 默认 `/S` 真实落盘 | passed | `%LOCALAPPDATA%\Programs\AIWorkbench` |
| exe 存在 | passed | `AI Workbench.exe` |
| 卸载器存在 | passed | `Uninstall AI Workbench.exe` |
| 卸载注册表项存在 | passed | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\bb4acaa9-99d0-5390-9d1a-038d599d7094` |
| 快捷方式指向本次安装目录 | passed | 桌面和开始菜单快捷方式均指向 `%LOCALAPPDATA%\Programs\AIWorkbench\AI Workbench.exe` |
| 安装版 smoke-test | passed | exit 0 |
| 真实卸载 | passed | exit 0 |
| `0x80000003` | passed | 未复现，smoke-test exit 0 |
| 密钥/开发机路径扫描 | passed | installer/package hits 0 |

## 五条硬验收

- a 无硬编码路径：passed
- b 首次运行自建：passed
- c 依赖缺失不崩：passed
- d 端口冲突兜底：passed
- e 就绪报告完整：passed

## Actions

- 状态：failed
- Run ID：29919498085
- URL：https://github.com/qingyueshen5-gif/AI-Workbench/actions/runs/29919498085
- 失败步骤：Build installer candidate
- 说明：preflight 未执行；当前 `gh` token 无法读取日志（HTTP 403）或下载 artifact（HTTP 401）。已补 workflow 诊断，下一次 run 会上传 `actions-build.log`。

## 证据文件

- `verification/install-release/repair1-2-summary.json`
- `verification/install-release/repair1-2-install.log`
- `verification/install-release/repair1-2-smoke.log`
- `verification/install-release/repair1-2-uninstall.log`
- `verification/install-release/repair1-2-registry.log`
- `verification/install-release/preflight-summary.json`
- `verification/install-release/preflight-report.md`
