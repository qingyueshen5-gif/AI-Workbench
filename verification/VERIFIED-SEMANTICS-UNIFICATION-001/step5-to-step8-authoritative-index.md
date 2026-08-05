# Step5至Step8机器权威索引

生成基线：`e0001f15dc6a390d33270e4e638d072b1c9fa22b`；生成时权威远端：`e0001f15dc6a390d33270e4e638d072b1c9fa22b`。

## 机器判定

| 功能项 | 判定 | 有效Checkpoint | Commit |
|---|---|---|---|
| STEP5-A · 服务端可信事实保留 | `PRESENT_AND_VERIFIED` | `LEGACY-RUN-API-STEP5-SERVER-FACT-PRESERVATION-001` | `58df1f714fcc13311b6c7b98145e239d61449fba` |
| STEP5-B · UI可写DTO与精确路径匹配 | `PRESENT_AND_VERIFIED` | `LEGACY-RUN-API-STEP5-UI-WRITABLE-DTO-001` | `2bc72b9044dde9787cd8c75b5bbb80a14271da4c` |
| STEP5-C · Context信任边界 | `PRESENT_AND_VERIFIED` | `LEGACY-RUN-API-STEP5-CONTEXT-TRUST-BOUNDARY-002` | `0618b838c0b85fe62339b5270ecf74255810b21c` |
| STEP5-D · UI执行状态与可信验收状态分离 | `PRESENT_AND_VERIFIED` | `LEGACY-RUN-API-STEP5-UI-STATUS-SEPARATION-001` | `8e111bb4531fe0fdd7ae219963c02e1deb88ca06` |
| STEP5-E · Gateway / Delivery传播边界 | `ACTUALLY_MISSING` | `NONE` | `NONE` |
| STEP6 · 旧测试迁移与历史断言存档 | `ACTUALLY_MISSING` | `NONE` | `NONE` |
| STEP7 · Mandatory Gates强制接线、完整运行与防伪 | `ACTUALLY_MISSING` | `NONE` | `NONE` |

## 决定性结果

- Step5-C旧版保持`INVALIDATED_BY_NEW_RISK`，由002版明确取代。
- Step5-E专用传播脚本、审计、矩阵、报告和正式Checkpoint均不存在。
- Step6三个旧测试中仍存在`verified:true`提交或`verified===true`旧契约断言，且历史断言存档与完备性专项不存在。
- Step7当前Mandatory Gates未接入十二项专项或三个旧测试，专用接线、防伪与正式收口证据不存在。

完整Checkpoint逐项盘点、Patch SHA和脚本语法结果见JSON。

## 状态约束

第四类风险保持OPEN；原三项HIGH保持OPEN；未开始Step8；未部署。
