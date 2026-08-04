# VERIFIED-SEMANTICS-UNIFICATION-001 · 第四类风险迟到审计

## 结论

```text
classification=PRODUCT_OR_SECURITY_FAILURE
fourthRiskFound=true
risk=LEGACY_WORKBENCH_RUN_VERIFIED_TRUST_BOUNDARY_BYPASS
status=HARD_STOP
finalAcceptance=false
deployment=NOT_DEPLOYED
```

在前六步完成后，先前并行发出的批准基线只读审计返回。该审计基于批准基线：

```text
7249188bb2fedb84d74fa6f4f7fa3f7e645b2add
```

审计确认存在不同于三项已知风险的第四类独立信任边界风险：旧 Workbench `server.mjs` Run API/JSON数据面允许调用者直接写入或回灌`verified=true`，或仅凭孤立Run证据将`verification.ok`投影为`verified=true`，但没有绑定权威Task、Run identity、task revision、真实Verifier PASS及成功Final。

## 批准基线证据

批准基线`server.mjs`存在以下生产位置：

| 基线行 | 路径 | 问题 |
|---:|---|---|
| 206 | `normalizeRuns()` / `PUT /api/data` | `verified: Boolean(run.verified)`，允许整份客户端数据回灌可信值 |
| 366 | `buildTaskContextPackage()` | 把未可信绑定的`run.verified`送入后续Agent上下文 |
| 1358 | 旧Workbench工具执行路径 | 仅凭`verification.ok`写入`verified` |
| 1863 | `/api/hermes/invoke`旧执行路径 | 仅凭`verification.ok`写入`verified` |
| 2047 | `POST /api/runs` | `verified: Boolean(payload.verified)`，直接信任调用者 |
| 2116 | `POST /api/runs/:id/verify` | 孤立Run验证后直接写`verified: verification.ok` |

相关消费者和测试包括：

- `server.mjs`的`buildTaskContextPackage()`把Run的`verified`写入`recentRuns`；
- `src/main.jsx`通过`PUT /api/data`回写整份数据；
- `scripts/verify-memories.mjs`主动向`POST /api/runs`提交`verified:true`；
- `scripts/verify-verification-layer.mjs`只验证孤立Run evidence，不验证权威revision、Current Run、Task terminal success或Final identity；
- `scripts/verify-tasks-runs.mjs`只检查字段存在，未证明不可伪造性。

## 为什么属于第四类

该风险不是：

1. `AgentRuntime`非终态控制、clarify、confirmation或capability_unavailable结果；
2. `AgentRuntime` process.stop、code execution或conversation旧执行返回；
3. Interpreter Adapter非执行renderer。

它是并行存在的旧Workbench Run API、JSON持久化及上下文传播信任边界，具备独立的：

```text
外部写入口
→ 持久化
→ Agent上下文消费者
→ UI数据回写
→ 旧测试契约
```

因此不得仅归入原三项风险而继续宣称`fourthRiskFound=false`。

## 当前候选状态

前六步迁移过程中，部分上述生产位置已经被加法字段迁移或fail-closed为`verified=false`。但是：

1. 第一步审计成果错误记录了`fourthRiskFound=false`；
2. 原审计把该独立信任边界归入“已知风险扩展位置”，分类不准确；
3. 尚未建立针对客户端注入、`PUT /api/data`回灌、孤立Run verification及UI回写的正式专项契约；
4. 尚未证明Gateway/Delivery/Workbench API全链只传播统一可信派生结果；
5. 因此不能执行第七步把三项风险全部标记RESOLVED，也不能执行最终影响面回归并宣称工作包完成。

## 停止决定

依据原指令：发现第四类风险时必须保存成果、Checkpoint、Patch、Push并硬停止。

本轮从此处停止：

```text
第七步文档更新=NOT_STARTED
第八步完整影响面回归=NOT_STARTED
VERIFIED-SEMANTICS-UNIFICATION-001=BLOCKED_BY_FOURTH_RISK_PRODUCT_DECISION
finalAcceptance=false
deployment=NOT_DEPLOYED
```

不得自动：

- 修改前六步历史Checkpoint；
- 把三项HIGH风险标记为全部RESOLVED；
- 更新NEXT_STEP为M1脚本迁出；
- 开始M1/M2/M3/M4；
- 启动Production Path Smoke；
- 创建候选标签；
- 部署。

## 需要产品负责人裁定

建议正式登记：

```text
HIGH · LEGACY_WORKBENCH_RUN_VERIFIED_TRUST_BOUNDARY_BYPASS
```

建议精确定义：

> 旧Workbench Run API、整库JSON回灌或孤立Run验证路径，允许未经权威Task/Run/revision/真实Verifier PASS/成功Final完整绑定的值进入或传播业务`verified`。

需要裁定：

1. 是否接受该名称和独立风险分类；
2. 是否批准新增原子整改工作包，覆盖`POST /api/runs`、`PUT /api/data`、`/api/runs/:id/verify`、Agent上下文和对应测试；
3. 客户端提交`verified`应被拒绝还是无条件忽略并由服务器重新派生；
4. UI的“已完成”展示是否必须与可信`verified`明确区分；
5. 该专项是否必须接入Mandatory Gates后才能恢复本工作包第七、八步。
