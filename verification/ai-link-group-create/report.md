# AW-AILINK-GROUP-CREATE-001｜首批开发协作群创建与结构核验

## 结论

```text
group_created_structure_verified
```

唯一目标工作流`workflow-3da933e691b5`已创建一个飞书群，工作流为`ready/done`。没有重新创建或重新绑定员工，没有重新生成方案，没有创建第三个工作流或第二个同名目标群，没有发送测试消息，没有进入正式开发。

## 建群前只读核验

建群前状态：

```text
status=ready_to_create_group
stage=bindings
group=null
lastError=null
workflowCount=2
workflowSha256=4daede4d22e2d540b75b13c0aad1f243ead6997a4f6738f4bb2687db51b1c936
飞书绑定=5/5
```

五个worker ID与员工准备阶段一致，五个飞书绑定身份互不重复。内部角色和飞书显示名称全部符合产品负责人最终映射，没有错人或遗漏。

## 正式名称映射

群内搜索、原生@和日常协作必须使用“飞书显示名称”，A、E、G只作为内部工作包/角色代号。

| 工作流角色 | AI Link内部员工名称 | worker ID | 飞书显示名称 | 群内职责 |
| --- | --- | --- | --- | --- |
| 协调监工 | 协调角色 | `worker-1g20` | **协调** | 日常任务入口 |
| A架构开发 | A架构开发 | `worker-3bp0` | **架构开发** | A工作包开发 |
| E隐私开发 | E隐私开发 | `worker-5fr0` | **隐私开发** | E工作包开发 |
| G测试验收 | 测试验收角色 | `worker-1u80` | **测试验收** | G工作包、独立测试和验收 |
| 总集成 | 总集成 | `worker-2tj0` | **总集成** | 唯一最终汇总和集成角色 |

## 群创建结果

```text
群名称=AI Workbench v0.4.7首批开发协作群
群非敏感标识后缀=b102dc
status=ready
stage=done
lastError=null
workflowSha256=c955702d6dd2a91485067c7bb18ddb44a1f2c5791e3ac1cbbc8daef2c7cb40ca
```

群主为AI Link中已经确认的当前飞书账号，即产品负责人/人工审批人。没有在文档中记录完整账号Open ID或chat ID。

当前共存在两个不同用途的工作流群：本轮唯一目标群和此前的“AI Workbench 只读协作交付验证”群。名称及工作流ID不同，不属于重复群。

## 群专属Skill结构核验

AI Link编译并安装唯一群专属Skill：

```text
skillId=workflow-3da933e691b5
version=1.0.0
contentHash=7f5f7324aca4a612337fde2fcbdb732f4cb1737aa88727d4f199039b69a0b9d6
requiresMention=true
trigger.type=manual
entryRoleIds=[coordination-supervisor]
```

5名员工的registry均指向同一个群非敏感标识后缀、同一skillId、版本和contentHash，状态均为enabled。五份编译后的`workflow.json`哈希完全一致：

```text
0139475a93ce74522510d8b1e9afee81e0d230b442c8845b262278221f1f5c85
```

这证明：

- 默认必须使用飞书原生@指定员工才触发；
- “协调”对应日常入口`coordination-supervisor`；
- “总集成”对应唯一`chief-integrator`角色；
- 五名员工加载的是同一个群专属Skill版本和成员映射。

## 消息与费用边界

本轮没有人工或Agent发送测试消息。AI Link在正式建群流程中按产品既有流程自动发送了一条预设欢迎消息，工作流记录`welcomeSent=true`；该消息是建群产品副作用，不是测试消息，也没有通过员工触发模型。

18765只增加只读diagnostics调用，没有`/v1/chat/completions`。UI前后均显示：

```text
余额=¥73.84
今日用量=¥81.16
```

未观察到费用变化。

## 异常

没有发现：

- worker ID变化；
- 绑定状态消失；
- 重复绑定、错人或遗漏；
- 重新扫码、重新绑定或重新创建员工；
- 重复目标群或部分创建；
- 付费模型调用；
- 账号、Secret、代理、网络或系统设置修改；
- 正式开发启动。

`18766 /health`继续保留历史`lastError=fetch failed`，但服务状态为`ok`；本轮未修改或自动修复该历史环境项。
