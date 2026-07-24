# 电脑环境治理第一批安全清理报告

生成时间：2026-07-24

状态：`partial`

## 边界

本轮从中断点续接，不从头重跑整轮。执行范围仅限已批准的第一批安全清理：旧 `.tmp-*`、`.verify-*`、`.strict-*` 运行目录，`.electron-cache`，`.npm-cache*`，用户 npm 缓存，Windows 临时文件的人工确认，以及 `release-v0.4.0` 到 `release-v0.4.4*` 本地旧构建输出。

未执行：卸载软件、结束进程、修改 ACL、取得所有权、强制解除占用、迁移仓库、清理浏览器账号/缓存、清理 `managed-proxy`、清理 `node_modules`、清理 `release-v0.4.6-installer`、清理 verification 正式证据。

## 空间结果

| 阶段 | C 盘可用 | F 盘可用 |
| --- | ---: | ---: |
| 第一批清理前 | 31.86 GB | 1607.56 GB |
| 本次续接开始 | 31.60 GB | 1610.62 GB |
| 本次续接后 | 31.60 GB | 1610.62 GB |

第一批累计释放空间：约 3.06 GB。

本次续接新增释放空间：约 0 GB。

复核 `F:\AI-Workbench` 当前真实目录大小：约 13.57 GB。此前 255.4 GB 是整个 F 盘已用空间，不是仓库本身大小。

## 已成功清理

- `.electron-cache`
- `.tmp-3b-release-download-24928`
- `.strict-acceptance-runtime`
- 多个 0MB 级 `.tmp-*` 临时运行目录

## 部分清理

- `release-v0.4.0` 到 `release-v0.4.4*`：第一轮已删除部分大文件，F 盘释放约 3.06 GB；但多数目录仍存在，剩余多为 `win-unpacked/resources/app.asar.unpacked` 或资源目录，普通删除返回 `Access denied`。
- `.tmp-3a-actions-30001627121`：从约 106.8 MB 降到约 0.5 MB，目录仍存在。
- `.npm-cache-r21c`：从约 134.7 MB 降到约 106.4 MB，目录仍存在。

## 跳过与失败

跳过：

- `.strict-chrome-profile*`：属于浏览器 profile，且文件名命中 cookie/token 类内容。本轮禁止触碰浏览器账号和缓存。
- `verification/pc-environment-governance/restore-check`：这是上轮备份恢复校验留下的权限异常目录，本轮不修改 verification 正式证据或父目录权限。
- Windows 临时文件：本轮不使用强制脚本大范围删除，改为产品负责人手动打开 Windows 设置确认。

失败或延后：

- 用户 npm 缓存：`npm cache verify` 和 `npm cache clean --force` 均因 `EPERM` 失败，缓存大小仍约 3427.3 MB。
- 多个 `.verify-*`、`.tmp-managed-proxy-*`、`.tmp-installed-managed-proxy-*` 和旧 release 目录：普通删除一次后返回 `Access denied` 或 `directory is not empty`。

处理原则：未修改 ACL，未取得所有权，未强杀进程，未继续强制删除。

## 工具链复核

- AI Workbench：`npm run verify` passed。
- Git：`git version 2.54.0.windows.1` 可运行。
- Node：`v24.18.0` 可运行。
- npm：`11.16.0` 可运行，但用户 npm cache 操作受 EPERM 影响。
- Codex：`codex-cli 0.144.4` 可通过 `codex.cmd` 运行。
- Wrangler：`4.113.0` 可运行；仍提示 Wrangler 日志目录 `EPERM`，并检测到代理环境变量。

## 外部备份

外部备份仍存在：

`D:\AI-Workbench-Backups\2026-07-24-pc-environment-governance\ai-workbench-head-7200f78.zip`

SHA256：

`37157BD16891AA2527F88CC6A1ACFEF0ABA235AE14ED389C76D8A5208D50D291`

## Git 状态

续接前 Git 无 tracked diff，`HEAD` 与 `origin/main` 同步。报告生成前 `git diff --stat` 为空。

Git status 仍会打印权限警告，来源是已经存在的权限异常目录；本轮不通过修改父目录权限或隐藏目录来消除警告。

## 下一步

下一任务：

“重启后处理第一批遗留空目录，并由产品负责人决定Windows临时文件及第二批软件清理。”

完成本轮后停止，不自动执行第二批清理、不卸载软件、不调整自启项。
