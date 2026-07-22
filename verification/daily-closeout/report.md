# 今日收尾与产品距离核验

日期：2026-07-23

## 结论

今日收尾：passed。

今天解决了三个现实问题：

- 产品负责人本机 `AI Workbench v0.4.6` 安装版已恢复并保留。
- 最近几轮任务状态已按仓库和验收产物重新核实。
- 当前产品距离最终形态的差距已收敛为两个核心阻塞：`shared_managed` 生产注入和 GitHub Release 唯一下载链接。

一句话：今天让“候选安装包能跑、产品负责人电脑能用、仓库口径能接手”这三件事落地了；产品更接近最终形态，但还不能对外发布。

## 本机安装版恢复

- 安装包：`F:\AI-Workbench\release-v0.4.6-installer\AI-Workbench-Setup-v0.4.6-x64.exe`
- SHA256：`ca833403906e8ba82c267813ced701b39a83f9d7a7d9f3e9e857a011b6b9ab47`
- 安装目录：`%LOCALAPPDATA%\Programs\AIWorkbench`
- `AI Workbench.exe`：存在
- 版本：`0.4.6.0`
- 桌面快捷方式：存在，最终指向当前安装目录
- 开始菜单快捷方式：存在，最终指向当前安装目录
- 启动验证：安装版 `--smoke-test` 退出码 0，正常窗口标题 `AI Workbench v0.4.6`
- 用户数据：`%APPDATA%\ai-workbench` 存在，未删除
- 本轮卸载：未执行

本机现象：直接 `/S` 在当前已有安装状态下超时；显式 `/S /D=%LOCALAPPDATA%\Programs\AIWorkbench` 可保留安装。该现象不改变 Run `29935231224` 的云端通过结论。

## 最近任务真实状态

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 统一模型入口 | passed | `verification/unified-model-proxy/summary.json`，`ok=true` |
| 陌生机器不崩 | passed | `verification/clean-machine/summary.json`，a-e 均 `ok=true` |
| 共享 Key 机制 | partial | `verification/shared-key/summary.json` 机制测试 `ok=true`；生产注入仍 blocked |
| Windows 安装包本地安装/启动/卸载 | passed | `verification/install-release/repair1-2-summary.json`、`verification/install-release/preflight-summary.json` |
| GitHub Actions Run `29935231224` | passed | `verification/install-release/actions-29935231224.md`、GitHub conclusion `success` |
| 密钥和开发机路径扫描 | passed | `verification/install-release/preflight-summary.json`：安装包/解包扫描无阻塞命中 |
| 本机安装版恢复 | passed | `tasks/2026-07-22-恢复本机安装版.md` 和本轮复核 |

必须保持的真实口径：

- `shared_managed` 机制测试已通过，但生产注入仍 blocked。
- 硬骨头3尚未全部完成。
- GitHub Release 和唯一下载链接尚未完成。
- `verification/model-router/summary.json` 不存在，也不得为尚未执行的模型分层任务创建假文件。

## 产品距离核验

| 维度 | 当前状态 | 真实证据 | 剩余差距 |
| --- | --- | --- | --- |
| 零门槛 | partial | 安装包和云端 preflight 证明不需要 Node/npm/Python；本机安装版已恢复 | 生产 shared key 还没真正注入，正式下载入口还没有 |
| 真能办事 | partial | 动作验收、统一模型入口和安装版 smoke-test 已有证据 | 更广泛的真实电脑任务稳定性还需后续继续验收 |
| 死守简单 | passed | 3A/R1.3/本机恢复没有增加配置页或 UI 功能 | 示例指令、反馈出口、安全告知还要在不复杂化 UI 的前提下补 |
| 安装交付 | partial | 候选安装包可构建、安装、启动、卸载，Actions passed | 还没有正式 Release/tag/唯一下载链接 |
| 去第三方依赖 | partial | 三员工模型调用已收敛到 18800；共享 key 机制测试通过 | `shared_managed` 生产凭证注入仍 blocked |
| 上线能力 | blocked | `LAUNCH.md` 仍要求前 3 条硬骨头完全闭环 | 3B 未发布，下载链接不存在；生产 shared key 未验收 |

明确结论：今天解决了本机安装版恢复、云端安装包预验收判绿、跨 AI 交接口径校准这三个现实问题；产品向最终形态前进在“普通安装、无开发环境、启动不白屏、缺依赖中文降级”这些可验证链路上；仍被 `shared_managed` 生产注入和 GitHub Release 唯一下载链接两个问题卡住。

## 下一步

下一次唯一主线：`③A-R2：shared_managed 真实生产注入修复/验证`。

R2 通过后，再做 ③A 总验收；③A 总验收通过并经产品负责人批准后，才进入 ③B 正式 GitHub Release。

今天不再继续执行。
