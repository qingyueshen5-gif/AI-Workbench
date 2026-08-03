# CURRENT_STATUS.md — 当前真实工程状态唯一权威

- **状态时间：2026-08-03**
- 本文件只记录已证明事实。
- 计划、愿景和目标不得写成已完成能力。
- 其他文件与本文件冲突时，以本文件为准。

## 一、当前结论

- 产品尚未达到可部署和真人稳定使用状态。
- 当前不能宣布P0清零。
- 当前不能进入正式发布。
- RUN-FENCING候选`c2ed8c13e42b5c006a6c30a943b08975cff6c3a5`已通过验收，但未部署。
- D0-1B原始事实提取器候选已完成完整回归；尚未接入生产Interpreter路径，尚未部署，Production Smoke未重新执行或通过，真人验收尚未通过。

## 二、版本与运行状态

- 生产known-good Runtime：`75ef8ca8838790fc32cb95ddeb9d56fcfd969a92`。
- 生产Runtime本轮未触碰。
- 最近失败候选基线：`6006013be5aaa809401198f91eec5aafbb29136b`。
- Checkpoint保护基线：`bc43431e954f708d74d82b49ce367a73e07d0174`。
- Critical/High IPC隔离修复：`e4af9f912f82bf25f31bb3ad7bcaa0645cec2265`。
- 保护标签：`candidate/checkpoint-protection-v1`。

## 三、最近关键事件

1. 候选版本部署后，真实飞书Production Smoke失败。
2. “你好”和Runtime状态请求均在Interpreter阶段失败。
3. 失败根因是实际模型输出不符合严格内部Schema。
4. 候选已回滚到known-good Runtime。
5. RUN-FENCING已重新实现、分阶段Checkpoint并通过15/15及完整回归。
6. D0-1A `runtime.status`与指定真实文件`file.read`已通过。
7. D0-1B已建立确定性原始事实提取器，模型调用和网络调用均为0。
8. 所有成果仍是候选状态，Production Smoke未重新执行或通过。

## 四、当前已完成

- v0.4.6历史发布。
- 钱包刹车和成本保护历史里程碑。
- Gateway/Runtime解耦基础。
- 既有Mandatory Gates。
- Critical/High IPC隔离修复。
- Checkpoint保护机制及远端存档。
- RUN-FENCING候选通过并保存，未部署。
- D0-1A候选验证通过。
- D0-1B候选专项通过，未接入Interpreter。

## 五、当前阻断

- Interpreter Adapter未完成。
- 安全闸门和抗变体矩阵未完成。
- Production Smoke未通过。
- 真人验收未通过。

## 六、当前技术主线

RUN-FENCING候选（已通过、未部署）
→ D0-1A（已通过）
→ D0-1B原始事实提取（候选完成）
→ 等待用户批准Interpreter Adapter
→ 安全闸门与抗变体
→ Production Smoke
→ 真人验收

当前唯一获准的下一任务和施工边界以`NEXT_STEP.md`为准；不得因为本节列出后续技术主线而提前施工。

## 七、环境兼容风险

- **HIGH · ENVIRONMENT_COMPATIBILITY_RISK（未修复）**：固定路径`D:\\Anaconda\\Scripts\\hermes.exe`必须在真人陌生Windows机器验收前处理。本轮不批量修改生产路径。
- 盘符清单中其余31项`PRODUCTION_PATH`登记为`PENDING_ENVIRONMENT_COMPATIBILITY_REVIEW`，需逐项确认配置化、自动发现或保留理由后再修改。

## 八、未裁定资产

`E:\AI-Workbench`主仓库仍存在原有modified和untracked资产。它们尚未全部确定来源和权威性，不得清除，也不得自动视为正式成果。本次施工只将其作为只读参考，并在仓库外保存资产清单。
