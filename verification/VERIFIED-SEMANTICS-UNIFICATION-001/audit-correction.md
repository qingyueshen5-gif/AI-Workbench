# 原verified审计更正核实

```text
correctionStatus=CORRECTED_BY_FOURTH_RISK_LATE_AUDIT
originalConclusion.fourthRiskFound=false
correctedConclusion.fourthRiskFound=true
riskName=LEGACY_WORKBENCH_RUN_VERIFIED_TRUST_BOUNDARY_BYPASS
riskClassification=HIGH_INDEPENDENT_FOURTH_RISK
```

原错误结论保留在`producer-inventory.json`，没有删除或覆盖。本文件和`audit-correction.json`追加更正。

- 发现时间：2026-08-04T18:34:19+08:00
- 更正落盘时间：2026-08-04T19:10:23+08:00
- 迟到原因：此前并行发出的批准基线只读审计在前六步Checkpoint完成后才返回。
- 批准基线：`7249188bb2fedb84d74fa6f4f7fa3f7e645b2add`

六处基线证据：

1. `server.mjs:206`：`normalizeRuns()`及`PUT /api/data`整库回灌；
2. `server.mjs:366`：`buildTaskContextPackage()`；
3. `server.mjs:1358`：旧Workbench工具执行；
4. `server.mjs:1863`：`/api/hermes/invoke`；
5. `server.mjs:2047`：`POST /api/runs`；
6. `server.mjs:2116`：孤立Run验证端点。

完整传播链：外部写入口→JSON持久化→Agent上下文→UI整库回写→旧测试依赖→孤立Run验证；Gateway/Delivery边界和历史存量裸`verified`另列为必须核验边界。

本风险独立于前三项风险：前三项是内部路径误用`verified`，本项允许外部调用者提交、回灌、持久化或影响服务端专有可信验收状态。

来源WIP证据：

- Checkpoint：`VERIFIED-SEMANTICS-UNIFICATION-FOURTH-RISK-WIP-001`
- Commit：`80b538b36ed1ec282477e2e8d2276cceb14c4d68`
- Patch SHA-256：`a1f25a5567f3303c3e27c943be5b533b9eb69cfb3a81f8de69a27826709972df`

`CURRENT_STATUS.md`已存在完整风险块，包含`status=OPEN`、`severity=HIGH`、`deploymentImpact=BLOCKED`、follow-up工作包、六处位置和完整传播面。本次核实没有重复写入该风险块。
