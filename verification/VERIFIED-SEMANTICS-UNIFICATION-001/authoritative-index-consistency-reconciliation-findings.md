# 权威索引一致化机器裁决

基线：`c6abaa8d94f7e645a6e53bbc61f83565e610649b`。本报告只做治理复核，未补做功能。

| 功能项 | 最终机器判定 | 决定性依据 |
|---|---|---|
| STEP5-E | `ACTUALLY_MISSING` | 全目录、Git和Checkpoint搜索未找到完整传播专项、证据和有效Checkpoint。 |
| STEP6 | `ACTUALLY_MISSING` | `verify-memories`仍以旧合法样本提交`verified:true`并期待201；`verify-verification-layer`仍期待孤立校验写成true；第三个测试仅查字段存在；存档和完备性专项缺失。 |
| STEP7 | `ACTUALLY_MISSING` | 十二项有效Mandatory为`0/12`；三个旧测试均`NOT_MANDATORY`；防伪、完整全绿和正式Checkpoint证据缺失。 |

## Step6计数

- verifiedTrueOccurrences=2
- verifiedTrueAttackFixtureCount=0
- verifiedTrueLegacyContractCount=2
- CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN occurrences=0
- businessVerifiedFalse occurrences=0
- runEvidenceValidated occurrences=0

## Step7计数

- targetCount=12
- directMandatoryCount=0
- transitiveMandatoryCount=0
- effectiveMandatoryCount=0
- missingMandatoryCount=12
- optionalCount=0
- antiFraudEvidencePresent=false
- fullGatesEvidencePresent=false

完整逐文件行号、执行图及证据字段见JSON。
