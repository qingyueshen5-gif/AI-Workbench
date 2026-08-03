# INTERPRETER-ADAPTER-PHASE-B5-RECOVERY-AND-CLOSEOUT-001 · 安全阻断

## 结论

```text
failureClassification=PRODUCT_OR_SECURITY_FAILURE
gateStatus=BLOCKED
finalAcceptance=false
deployment=NOT_DEPLOYED
productionSmokeStarted=false
```

B5候选的隔离Fixture曾通过，但只读独立审查和Mandatory Gate证明当前候选不能进入最终收口。

## 正式门禁阻断

`node scripts/verify-mandatory-gates-001.mjs`退出1；首个失败为`Task Lifecycle`：终态Task重放缺少`replayed=true`。该失败尚未被同门禁PASS取代。

## 新增安全审查阻断

1. `runtime.status`默认状态Provider在状态源不可读时仍可生成`ok:true`、固定fallback文本及人工时间戳；当前Verifier仅验证非空文本和`readAt`，不能证明真实状态源读取成功。
2. `executeCapabilityPlan()`丢弃`ResultVerifier.verifyCapabilityResult()`返回值；Grounded分支随后手工写入`verified:true`和`finalEvidence.verified=true`，持久化的Run verification不是Verifier的结构化输出。
3. 新`file.read` Provider使用裸`fs.readFile/fs.stat`，没有复用ToolExecutor的`allowedRoots`/realpath containment边界，形成权限边界弱化和重复读取架构。
4. `handle()`仍保留旧`statusPattern`和`directRead`执行捷径；若Adapter或classification漂移，可绕过新Grounded Run/verification/finalizeRun链。旧status分支还会追加assistant消息后继续向后执行。
5. Grounded分支允许多个assignment共用一个记录为首Provider的Run；当前Adapter虽会澄清复合意图，但Runtime自身未fail-closed。
6. `executeWithRun()`为了兼容正式RUN-FENCING恢复为Provider调用时Run处于`starting`；独立审查指出这与期望的真实执行状态语义存在设计张力。不得在未统一RUN-FENCING契约前自行改变。

## 已验证但不构成最终接受

- B5隔离Fixture：`runtime.status`、`file.read`、非执行旁路均PASS。
- D0-1B：20/20，`falseAuthorizationGrants=0`。
- RUN-FENCING首次FAIL后，相同正式门禁重跑15/15 PASS。
- D0-1A PASS。
- Critical/High PASS，critical=0、high=0。

上述PASS不能覆盖Mandatory Task Lifecycle失败，也不能覆盖本报告中的Grounded evidence、Verifier provenance和file.read路径权限缺口。

## 后续允许动作

必须由产品负责人另行批准安全修复范围，至少涵盖：

- 结构化且fail-closed的runtime.status真实证据；
- 将Verifier真实输出绑定到Run verification与Final evidence；
- file.read复用既有受限读取边界；
- 移除/禁用旧status/directRead捷径；
- 单Grounded capability/assignment fail-closed；
- 修复Task Lifecycle终态重放并重跑完整Mandatory Gates。

在此之前禁止最终标签、部署或Production Path Smoke。
