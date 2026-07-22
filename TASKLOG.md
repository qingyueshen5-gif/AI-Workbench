# TASKLOG.md - 任务总账本

> 仓库文件是唯一事实来源。每个任务下达、完成、验收和交接都必须写回本仓库，不能只留在对话里。

最新更新：2026-07-22

## 当前一句话状态

AI Workbench 已完成统一模型入口、上线硬骨头1“陌生机器不崩”和上线硬骨头2“共享 key 落地”；下一步是上线硬骨头3“能下载能安装”，也就是打安装包并挂 GitHub Release 下载链接。

## 已完成任务

| 任务 | 状态 | 做了什么 | 验收产物 |
| --- | --- | --- | --- |
| 统一模型入口 | 已完成 | Workbench、Hermes、OpenClaw 三个员工的模型调用统一收敛到本机 `18800` 代理；`model-proxy.mjs` 已扩展为 provider registry。 | `verification/unified-model-proxy/summary.json` |
| 硬骨头1：陌生机器不崩 | 已完成 | 启动路径改为缺依赖降级；首次运行自动创建 config/data/logs/evidence；18800/Hermes/OpenClaw/端口异常统一返回中文未就绪状态。 | `verification/clean-machine/summary.json`、`verification/clean-machine/readiness-report.md` |
| 硬骨头2：共享 key 落地 | 已完成 | 18800 网关支持共享托管 key 兜底；用户本机 key 优先；前端、Hermes、OpenClaw 和员工配置只使用本机占位 token。 | `verification/shared-key/summary.json` |
| 任务账本与进度口径校准 | 已完成 | 新增本文件作为总账本；明确当前缺失文件、真实进度和下一步；避免跨 AI 协作时混淆“统一模型入口”和“模型分层”。 | `TASKLOG.md` |

## 当前未完成任务

| 任务 | 当前状态 | 下一步 |
| --- | --- | --- |
| 硬骨头3：能下载能安装 | 未完成 | 打 Windows 安装包，挂 GitHub Release，只给用户一个下载链接。 |
| 打开后知道能干嘛 | 未完成 | 首屏放 3-5 条能点即跑的示例指令。 |
| 办不成时是人话不是崩 | 部分完成 | 已有 readiness 降级说明；后续继续补失败自愈、重试和人话解释。 |
| 反馈出口 + 一句安全告知 | 未完成 | 增加反馈渠道和基础安全告知。 |
| 模型分层调用 | 未开始/暂缓 | 等上线最小集前三条稳定后再做；不要抢跑。 |
| 手机端 | 未开始 | 等桌面上线闭环后再排期。 |
| 自动情报流水线 | 未开始/P3 | 后续再做，不阻塞上线。 |

## 缺失文件说明

| 缺失文件 | 是否需要现在补 | 原因 |
| --- | --- | --- |
| `verification/model-router/summary.json` | 不补 | 这个文件名对应“模型分层/模型路由”验收产物，但模型分层任务尚未正式执行。当前已有的是 `verification/unified-model-proxy/summary.json`，它只代表“统一模型入口”验收，不能冒充模型分层验收。 |
| `research/market-intelligence.md` | 暂不补 | 该文件对应后续市场/情报材料，当前仓库不存在；情报流水线是 P3，不阻塞上线硬骨头3。 |

## 留痕规则

- 每次下达或完成任务，都必须更新 `TASKLOG.md`、`CHANGELOG.md`、`CURRENT_TASK.md`。
- 涉及方案或调研时，必须写入 `research/` 下对应 `.md`。
- 涉及验收时，必须把摘要写入 `verification/<task-name>/summary.json`；有人工可读报告时写入同目录 `.md`。
- 完成后必须 `commit + push`，让本地 F 盘和 GitHub 同步。
- 不允许为了“补齐文件”伪造未执行任务的验收产物。
