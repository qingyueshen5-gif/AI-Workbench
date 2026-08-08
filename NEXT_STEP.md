# NEXT_STEP.md — 当前唯一下一步

<!-- AIW_NEXT_STEP_START -->
ZERO_TO_ONE_ONBOARDING_AND_CHANNEL_PAIRING_DISCOVERY_AND_CONTRACT_AWAIT_APPROVAL
<!-- AIW_NEXT_STEP_END -->

## 当前产品阶段

```text
completedProductPhase=FIRST_PRODUCT_CORE_MILESTONE
nextProductPhase=ZERO_TO_ONE_ONBOARDING_AND_CHANNEL_PAIRING
```

## 下一任务性质

等待产品负责人批准一个独立的Discovery / Contract工作包，用于只读审查：

1. 现有Installer、Bootstrap与first-run入口；
2. User / Workspace / Device identity现状；
3. ChannelAdapter契约与现有Feishu实现；
4. 新飞书账号Pairing所需正式接口和授权能力；
5. Provider first-run setup；
6. Clean-room First-user Acceptance边界；
7. 一次性、短期有效且不包含永久Secret/API Key/Token的Pairing安全契约。

二维码只属于目标UX，不是已完成事实，也不在本轮预设具体实现。

## 完成标准

下一轮Discovery / Contract必须形成：

- 当前代码与产品能力事实盘点；
- 明确的Identity与Channel Binding数据契约；
- Feishu官方能力与现有实现差距；
- 威胁模型、权限、Secret与失效策略；
- Installer / Bootstrap / Provider setup依赖图；
- Clean-room测试环境计划；
- 原子施工包、门禁与首失败停止条件。

## 明确禁止

在产品负责人批准Discovery / Contract之前，不得：

- 实施Pairing或二维码；
- 修改Installer或Bootstrap；
- 创建新Feishu账号绑定；
- 破坏Golden Reference Environment；
- 执行Human Acceptance；
- 实施Billing、Multi-task或Multi-agent；
- Rebind当前live Runtime；
- 自动进入任何功能开发。
