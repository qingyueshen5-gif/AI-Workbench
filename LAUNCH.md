---
# LAUNCH.md — 上线最小集

目标:尽快上线拿第一批真实用户反馈,不追求完美。功能做深不等于离上线更近;这份文件只管"让一个陌生人能装上、用起来、不崩"。
目标用户:普通人(只要结果)+ 专业人(只要省时间)。

## 已定决策
- 模型 key:共享 key 方案。在本机网关(18800)后垫一个共享 key,用户开箱即用,不需要自己申请或粘贴 key。保住极致零门槛护城河,前期少量用户成本可忽略。

## 上线最小集状态
1. [x] [硬骨头] 陌生机器不崩:干净 Windows 上能装、能开、核心对话能用,缺东西给人话不白屏。
2. [x] [硬骨头] 共享 key 落地:通过 Cloudflare Managed Proxy 开箱即用,不暴露 key、不要用户配置。
3. [x] [硬骨头] 能下载能安装:已通过 GitHub Release 提供公开下载链接。
4. [ ] 打开后知道能干嘛:首屏放 3–5 条能点即跑的示例指令。
5. [x] 办不成时是人话不是崩:readiness 和生产错误降级已具备中文说明；后续继续补真实使用中的失败自愈。
6. [ ] 反馈出口 + 一句安全告知:一个能听反馈的渠道;一句"数据存本地、它会帮你操作电脑"的告知加基本兜底。

## 可以以后慢慢加(别卡上线)
手机端、自动情报流水线、模型分层省钱、多平台通道、自动更新、本地推理/自托管、技能生态、品控体系、安装引导美化、官网。

## 上线判断
最小集 = 上面 6 条。前三条硬骨头已完成；首屏示例、反馈入口和安全告知仍未完成。当前唯一下一步仍是产品资产备份与电脑清理审计，不自动进入后续开发。

## 当前发布状态

- 2026-07-23：硬骨头3A-R1.3 已通过。Windows 安装包候选版 `AI-Workbench-Setup-v0.4.6-x64.exe` 已在 GitHub Actions Run `29935231224` 通过 build/install/smoke/uninstall/扫描预验收。
- 通过证据：`verification/install-release/preflight-summary.json`、`verification/install-release/repair1-3-summary.json`、`verification/install-release/actions-29935231224.md`。
- 本机 v0.4.6 安装版已恢复并保留，记录见 `tasks/2026-07-22-恢复本机安装版.md`。
- 3A-R2.1 生产 Managed Proxy 已通过，证据见 `verification/managed-proxy-production/summary.json`。
- ③A 总验收已通过，证据见 `verification/3a-final/summary.json`；候选包真实安装、生产对话、中文降级、安全扫描、卸载和恢复安装版均 passed。
- ③B GitHub Release 已通过，证据见 `verification/3b-release/summary.json`。
- Release 页面：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6`。
- 唯一安装包下载链接：`https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe`。
- 安装包大小：`111524004` bytes；SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 硬骨头3“能下载能安装”已完成；上线三大硬骨头整体完成。
- 产品方向和文档防漂移机制已完成；下一任务是电脑环境治理：产品资产备份、单点故障核查和清理候选盘点。完成后再准备首屏示例、反馈入口、安全告知和 3-5 名真实用户测试。
---
