# 当前真实进度清单

生成时间：2026-07-21

范围：只按当前仓库真实文件和已提交验收证据盘点；不按记忆猜测。

## 1. 根目录关键文件

| 文件 | 是否存在 | 大小 |
| --- | --- | ---: |
| `PRODUCT.md` | 存在 | 2399 bytes |
| `VISION.md` | 存在 | 7645 bytes |
| `CURRENT_TASK.md` | 存在 | 7898 bytes |
| `ARCHITECTURE.md` | 存在 | 13686 bytes |
| `CHANGELOG.md` | 存在 | 17978 bytes |

版本号：

- `package.json` 当前版本：`0.4.5`
- `CHANGELOG.md` 最新版本条目：`v0.4.5 - 全链版本管理落地`

## 2. `research/` 真实存在文件

| 文件 | 大小 | 对应任务 | 当前进度 |
| --- | ---: | --- | --- |
| `ai-link-analysis.md` | 19371 bytes | AI Link 本机实现调研，拆解 Electron、worker、模型/通道代理和可借鉴架构。 | 调研完成；作为微信/飞书通道和本地代理方案参考。 |
| `channel-connection-plan.md` | 16555 bytes | 多平台连接实施方案，覆盖微信、飞书、Telegram 的通道 adapter、扫码绑定和消息回传。 | 方案完成；尚未进入实现，下一阶段手机端/通道连接时使用。 |
| `hermes-one-ecosystem.md` | 4065 bytes | Hermes One 商业版产品形态对标，梳理员工、通道、技能、编排、记忆。 | 调研完成；结论是功能内置化，用户只见一个页面。 |
| `intel-pipeline-plan.md` | 23681 bytes | AI 行业情报采集流水线方案，覆盖 X、小红书、平台 AI、OpenClaw 浏览器辅助和合规边界。 | 方案完成；当前明确先不做，等 P0/P1 稳定后再推进。 |
| `openclaw-candidate-gateway-test.md` | 4903 bytes | OpenClaw candidate 配置 gateway 启动验证。 | 已完成；结论是 candidate 配置结构可用但不能解决 gateway 不监听，问题转向 runtime。 |
| `openclaw-config-diff.md` | 11594 bytes | OpenClaw 配置缩水对比诊断，对比当前配置和 last-known-good。 | 已完成；结论是 size drop 主要来自 JSON 序列化变紧，不是关键配置段丢失。 |
| `openclaw-health.md` | 8358 bytes | OpenClaw 安装、命令、gateway、配置和日志的只读健康体检。 | 已完成；早期结论是 gateway 不可达、status 不应作为唯一健康检查。 |
| `openclaw-runtime-gateway-diagnosis.md` | 5729 bytes | OpenClaw gateway runtime 深挖，直调 Node 入口并检查 lock/state/device/browser/channel 残留。 | 已完成；结论是清理残留后 gateway 可启动监听 `18789`，问题收敛为启动慢和常驻管理。 |
| `pc-health-report.md` | 6594 bytes | 电脑与冰灵代理体检，检查系统资源、磁盘、网络、工作台/Hermes/OpenClaw。 | 已完成；作为环境稳定性和代理问题记录。 |
| `self-hosting-plan.md` | 10203 bytes | 自主化与去第三方依赖方案，规划把模型和员工调用收敛到本机代理。 | 方案完成；其中 OpenClaw 收敛到 `18800` 已进入并完成一轮实现验收。 |
| `unified-model-proxy-plan.md` | 6286 bytes | 统一模型入口方案，把 Workbench、Hermes、OpenClaw 三员工模型调用统一经过 `18800`。 | 已补卡并完成；代码已实现、验收脚本已跑通、commit 已推送。 |
| `version-management-plan.md` | 8879 bytes | 全链版本管理方案，锁定工作台、员工、模型、运行配置和验收证据。 | 方案完成；`v0.4.5` 已落地版本矩阵和验证脚本。 |

## 3. 应该有但没有的文件

| 缺失文件 | 为什么应该有 | 当前处理 |
| --- | --- | --- |
| `research/market-intelligence.md` | 对话中提到它应记录“39 张小红书情报整理”，属于后续情报/市场材料。 | 当前仓库不存在；已明确 P3，不影响 P0/P1 和统一模型入口，不补内容、不猜。 |

说明：

- `research/unified-model-proxy-plan.md` 之前缺失，但已经在本次补卡中新建并提交。
- `research/hermes-one-ecosystem.md` 和 `research/channel-connection-plan.md` 当前都真实存在，不是缺失文件。

## 4. 当前真实进度

- 产品版本：`v0.4.5`
- 上一步做完了什么：OpenClaw gateway 掉线问题已定位并修复到可启动状态；清理 lock/tmp/browser/devices/cron 等 runtime 残留后，gateway 可监听 `127.0.0.1:18789`。
- 统一模型入口：已完成代码实现和验收。`model-proxy.mjs` 已扩展为 provider registry；DeepSeek、Hermes、OpenClaw 三员工都已通过 `18800` 调用模型，验收摘要在 `verification/unified-model-proxy/summary.json`。
- 现在卡在什么：当前仓库和执行器没有卡在“执行器故障”。执行器已经恢复，统一模型入口也已经 commit + push。仍需注意的是 OpenClaw CLI 在统一验收中会出现收尾超时 warning，但代理日志已证明模型入口经过 `18800`。
- `research/` 里真实存在文件：见第 2 节，共 12 个 `.md` 文件。
- `research/` 里应该有但缺的文件：`market-intelligence.md`，原因见第 3 节。

## 5. 下一步

1. 进入第 3 步：模型分层调用。
2. 在 `18800` provider registry 基础上设计模型用途分层：理解、编排、执行、摘要、去重、情报压缩分别走合适模型。
3. 保持当前产品原则：界面不变复杂，员工和模型差异都折叠在内部。
4. 情报流水线和多平台连接暂不抢跑，等 P0/P1 稳定后再推进。
