# AI Workbench 电脑环境治理审计报告

生成时间：2026-07-24

## 范围与边界

本轮只执行产品资产备份、备份可恢复性验证、账号单点故障核查、磁盘/进程/缓存/安装包/自启项/闲置软件盘点和清理候选清单输出。

未执行：删除文件、卸载软件、结束进程、迁移活跃仓库、修改产品功能代码、修改 Release、修改 Cloudflare 配置、修改模型配置或用户数据。

## 基线

- 分支：`main`
- HEAD：`7200f78fb344ced4f2a30302670d8e9a88cc5ca0`
- `HEAD == origin/main`：是
- 开始执行前工作区：clean
- 本轮产生的仓库内正式审计文件：本目录下 `summary.json` 和 `report.md`

## 产品资产备份

备份方式：使用 `git archive HEAD` 备份当前提交的 239 个 Git 跟踪文件。

外部备份位置：

`D:\AI-Workbench-Backups\2026-07-24-pc-environment-governance\ai-workbench-head-7200f78.zip`

SHA256：

`37157BD16891AA2527F88CC6A1ACFEF0ABA235AE14ED389C76D8A5208D50D291`

仓库内临时 zip 已在确认外部副本可读取且哈希一致后删除，不提交到 Git。

注意：该备份是非 F 盘副本，但仍在同一台电脑上。它能防止误删工作区文件，但不能替代离机备份或云端灾难恢复备份。

## 可恢复性验证

已将备份 zip 解压到临时目录并抽样比对 Git blob 哈希。抽样文件：

- `package.json`
- `TASKLOG.md`
- `PRODUCT.md`
- `server.mjs`
- `model-proxy.mjs`
- `scripts/verify-docs-consistency.mjs`

结论：抽样文件与当前 HEAD 的 Git blob 哈希一致，备份可读取、可解压、可恢复。

临时目录清理说明：`verification/pc-environment-governance/restore-check` 是本轮刚生成的解压验证副本。删除时 Windows 和 WSL 均对剩余空目录骨架返回 Access denied / directory not empty；当前剩余项为空目录，不被 Git 跟踪。未发现 `.env`，未发现常见 Secret/Token/Password/API_KEY/Cookie/Private Key 关键词命中文件。

## 账号与工具单点故障核查

GitHub CLI：

- 当前已登录账号：`qingyueshen5-gif`
- Git 操作协议：HTTPS
- 已观察到权限范围：`gist`、`read:org`、`repo`、`workflow`
- 未展示、未索要 Token、Cookie、密码或恢复码

Cloudflare Wrangler：

- 仓库本地 Wrangler 可用：`managed-proxy/node_modules/.bin/wrangler.cmd`
- Wrangler 版本：`4.113.0`
- 当前可读取登录状态
- 凭据路径存在：`C:\Users\胖胖虎\AppData\Roaming\xdg.config\.wrangler\config\default.toml`
- 未展示、未索要 Token、Cookie、密码、Secret 或恢复码

风险：

- Wrangler 能读取登录状态，但写日志到 Wrangler 日志目录时出现 `EPERM`，说明工具日志目录权限存在异常。
- Wrangler 检测到代理环境变量，未来部署或远程请求可能受代理影响。
- GitHub 和 Cloudflare 的 2FA、恢复邮箱、恢复码、紧急访问人只能由产品负责人在浏览器中确认。

产品负责人唯一需要执行的账号动作：

打开 GitHub 和 Cloudflare 的安全设置页面，确认 2FA、恢复邮箱、恢复码和紧急访问方案有效。不要向任何工具或对话提供密码、Token、Cookie、Secret 或恢复码。

## 磁盘盘点

| 盘符 | 总量 | 剩余 | 风险 |
| --- | ---: | ---: | --- |
| C: | 198.8 GB | 31.7 GB | 中，系统盘剩余空间偏低 |
| D: | 120.0 GB | 17.7 GB | 中，备份盘剩余空间偏低 |
| F: | 1863.0 GB | 1607.5 GB | 低 |

## 进程盘点

观察到的高内存进程包括：

- `chrome`
- `node`
- `MsMpEng`
- `explorer`
- `codex`
- `Weixin`
- `QyClient`
- `msedge`

未结束任何进程。进程项只能作为后续人工判断是否需要优化自启或常驻服务的参考。

## 缓存与目录候选

较大的候选项：

| 路径 | 大小 | 类型 |
| --- | ---: | --- |
| `release-v0.4.4-installer-final16` | 560.3 MB | 旧 release 构建输出 |
| `release-v0.4.4-installer-final15` | 557.5 MB | 旧 release 构建输出 |
| `release-v0.4.4-installer-final14` | 557.4 MB | 旧 release 构建输出 |
| `node_modules` | 503.7 MB | 依赖目录 |
| `release-v0.4.6-installer` | 372.4 MB | 当前版本构建输出 |
| `.npm-cache` | 259.4 MB | npm 缓存 |
| `managed-proxy` | 165.7 MB | 活跃子项目，不能整体删除 |
| `.electron-cache` | 137.6 MB | Electron 缓存 |

用户目录缓存：

- `C:\Users\胖胖虎\AppData\Local\Temp`：约 1551.4 MB
- `C:\Users\胖胖虎\AppData\Local\npm-cache`：约 3427.3 MB

## 安装包盘点

当前 v0.4.6 安装包存在多份副本：

- `release-v0.4.6-installer\AI-Workbench-Setup-v0.4.6-x64.exe`
- `.tmp-3b-release-download-24928\AI-Workbench-Setup-v0.4.6-x64.exe`
- `.tmp-3a-actions-30001627121\...\AI-Workbench-Setup-v0.4.6-x64.exe`

这些只能列为候选，不得在未批准前删除。公开 GitHub Release 和外部备份可读后，可考虑只保留必要副本。

## 自启项盘点

Startup 文件夹观察到：

- `AI Workbench Dev Server.lnk`
- `OpenClaw Gateway.cmd`
- `人人视频.lnk`
- `发送至 OneNote.lnk`

注册表 Run 观察到：

- `SecurityHealth`
- `RtkAudUService`

自启清理需要产品负责人逐条批准，尤其是 AI Workbench Dev Server 和 OpenClaw Gateway，不能自动禁用。

## 闲置软件候选

仅作为候选，不执行卸载：

- 重复 Python 版本：Python 3.13.9 与 Python 3.14.0 组件同时存在。
- 重复 QGIS 版本：QGIS 3.40.11 与 3.40.13 同时存在。
- 媒体/娱乐类应用：爱奇艺、哔哩哔哩、芒果TV、人人视频。
- 远程控制或常驻工具：ToDesk。
- 厂商应用商店/管理器：联想应用商店、腾讯应用宝等。

## 清理候选清单

以下项目只进入候选，等待产品负责人逐条批准：

1. 旧 `release-v0.4.0` 到 `release-v0.4.4` 构建输出目录。
2. 旧 `.tmp-*` 验证 runtime 目录。
3. 旧 `.verify-*`、`.strict-*` runtime/profile 目录。
4. 本地 npm/electron 缓存。
5. 重复的 v0.4.6 安装包下载副本。
6. Startup 文件夹中的 AI Workbench Dev Server、OpenClaw Gateway、媒体应用和 OneNote 自启项。
7. 重复 Python/QGIS 版本及可能闲置软件。

## 当前停止点

审计已完成。下一步不得自动清理。需要产品负责人先完成账号恢复设置人工确认，并逐条批准清理候选。
