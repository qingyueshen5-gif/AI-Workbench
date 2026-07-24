# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-24
> 当前任务文件只描述正在执行或最近完成的任务，不定义后续路线；当前唯一下一步以 `NEXT_STEP.md` 为准。

## 当前主线

本轮唯一任务：阶段性总审核（砍薄版）。

边界：

- 只审核备份是否真的可恢复、Git 当前内容和完整本地可达历史是否泄漏凭据、文档是否存在假完成。
- 已有有效 verification 证据且已经判绿的模块不重复跑完整验收，只核对证据是否存在、是否对应声明。
- 不修改功能代码、Managed Proxy、Cloudflare、模型配置、Release、安装包或用户数据。
- 不轮换、吊销或修改任何密钥；发现泄密只记录脱敏事实并等待产品负责人批准处置。
- 审核完成后停止，等待产品负责人验收，不自动进入生存体检、成本熔断、模型分层、v0.4.7 或其他任务。

## 最近完成

- ③A 总验收：passed。证据见 `verification/3a-final/summary.json`。
- ③B GitHub Release：passed。AI Workbench v0.4.6 Alpha 已公开发布为 public prerelease，证据见 `verification/3b-release/summary.json`。
- 产品方向收口：completed。全球产品、一个输入框、质量基线托底、人机共同打磨、借用生态但掌握控制层、跨平台执行边界和阶段路线已整合进现有文档。
- 文档基准纠偏与防漂移机制：completed。已纠正当前状态漂移，建立 Handoff 自动生成和文档一致性校验，故障注入已证明可检出版本漂移。
- 电脑环境治理审计：completed。证据见 `verification/pc-environment-governance/summary.json`。
- 电脑环境治理第一批安全清理：partial。累计释放 F 盘约 3.06 GB；重启后指定遗留目录已处理，用户 npm 缓存仍因 `EPERM` 未清理，Windows 临时文件仍需产品负责人手动确认。证据见 `verification/pc-cleanup-batch1/summary.json`。
- 阶段性总审核（砍薄版）：passed。备份隔离恢复、Git 凭据扫描和文档假完成核对均已执行；未发现确认的 Git 凭据泄漏或 confirmed fake completion，非关键过期表述已修正。证据见 `verification/thin-stage-audit/summary.json`。

## 当前事实

- 当前版本：`package.json` version `0.4.6`，对外为 `v0.4.6 Alpha`。
- Release 页面：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6`。
- 安装包直接下载：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe`。
- 安装包大小：`111524004` bytes。
- SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 当前架构：`Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider`。
- DeepSeek 是当前唯一已接入的生产实现，属于可替换实现细节，不是产品定位。真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包和用户电脑。

## 上线硬骨头

- [x] 硬骨头1：陌生机器不崩。证据见 `verification/clean-machine/summary.json`。
- [x] 硬骨头2：共享 key 落地。证据见 `verification/shared-key/summary.json` 和 `verification/managed-proxy-production/summary.json`。
- [x] 硬骨头3：能下载能安装。③A 总验收和 ③B GitHub Alpha Release 均已通过，公开下载回测通过。证据见 `verification/3b-release/summary.json`。

## 未完成边界

以下能力仍未实施，不得写成当前已完成：

- Windows 临时文件人工确认。
- 自启项调整和闲置软件卸载决策。
- 生存体检、平台月度总上限和自动熔断。
- 首屏示例指令、反馈入口、安全和隐私告知。
- 3-5 名真实用户测试。
- 长期记忆、任务历史和状态卡、质量检查层、自动任务拆解和分配。
- 模型分层、完整多 Agent 调度、手机端、情报流水线、跨网站复杂执行、国际化和区域合规。

## 当前唯一下一步

当前唯一下一步以 `NEXT_STEP.md` 为准：等待产品负责人验收阶段性总审核（砍薄版）。未经产品负责人批准，不得进入生存体检或其他任务。

完成本轮审核后必须停止，等待产品负责人验收，不自动进入生存体检、第二批清理或其他任务。
