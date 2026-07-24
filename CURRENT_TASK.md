# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-24
> 当前任务文件只描述正在执行或最近完成的任务，不定义后续路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

本轮唯一任务：电脑环境治理第一批安全清理收尾。

边界：

- 只处理已批准的旧临时目录、旧 release 构建目录、npm 缓存官方清理命令和清理报告留痕。
- 不卸载软件、不结束进程、不修改 ACL、不取得所有权、不迁移仓库。
- 不清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。

## 最近完成

- ③A 总验收：passed。证据见 `verification/3a-final/summary.json`。
- ③B GitHub Release：passed。AI Workbench v0.4.6 Alpha 已公开发布为 public prerelease，证据见 `verification/3b-release/summary.json`。
- 产品方向收口：completed。全球产品、一个输入框、质量基线托底、人机共同打磨、借用生态但掌握控制层、跨平台执行边界和阶段路线已整合进现有文档。
- 文档基准纠偏与防漂移机制：completed。已纠正当前状态漂移，建立 Handoff 自动生成和文档一致性校验，故障注入已证明可检出版本漂移。
- 电脑环境治理审计：completed。证据见 `verification/pc-environment-governance/summary.json`。
- 电脑环境治理第一批安全清理：partial。累计释放 F 盘约 3.06 GB；npm 缓存、Windows 临时文件和权限异常遗留目录仍需后续处理。证据见 `verification/pc-cleanup-batch1/summary.json`。

## 当前事实

- 当前版本：`package.json` version `0.4.6`，对外为 `v0.4.6 Alpha`。
- Release 页面：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6`。
- 安装包直接下载：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe`。
- 安装包大小：`111524004` bytes。
- SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 当前架构：`Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> Cloudflare Managed Proxy -> DeepSeek 官方 API`。
- 真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包和用户电脑。

## 上线硬骨头

- [x] 硬骨头1：陌生机器不崩。证据见 `verification/clean-machine/summary.json`。
- [x] 硬骨头2：共享 key 落地。证据见 `verification/shared-key/summary.json` 和 `verification/managed-proxy-production/summary.json`。
- [x] 硬骨头3：能下载能安装。③A 总验收和 ③B GitHub Alpha Release 均已通过，公开下载回测通过。证据见 `verification/3b-release/summary.json`。

## 未完成边界

以下能力仍未实施，不得写成当前已完成：

- 第一批遗留空目录重启后复核。
- Windows 临时文件人工确认。
- 自启项调整和闲置软件卸载决策。
- 首屏示例指令、反馈入口、安全和隐私告知。
- 3-5 名真实用户测试。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为准：重启后处理第一批遗留空目录，并由产品负责人决定Windows临时文件及第二批软件清理。

完成本轮第一批安全清理收尾后必须停止，等待产品负责人批准，不自动进入第二批清理。
