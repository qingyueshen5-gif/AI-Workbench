# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收 AW-ENV-BASELINE-001；不得自动进入任何修复、付费生成、员工或工作群创建。
<!-- AIW_NEXT_STEP_END -->

## 当前状态

- `AW-ENV-BASELINE-001` 已完成30分钟只读稳定性观察和八层状态矩阵。
- AI Link后台和本地端口在窗口内稳定；桌面UI与Session仍未验证，历史状态仍为`temporarily_recovered`。
- 网络为`route_dependent`，代理为`application_proxy_mismatch`，国外Provider仅`partially_reachable`。
- 当前付费生成安全门为`blocked`；本轮没有付费调用、员工、工作流、飞书群、产品代码或运行配置变更。

## 当前唯一下一步

等待产品负责人验收 AW-ENV-BASELINE-001；不得自动进入任何修复、付费生成、员工或工作群创建。

基线完成后按以下顺序等待逐项批准：

1. P0 任务和账号安全；
2. P1 基础环境稳定；
3. P2 OpenAI/Anthropic 官方 API 支付路径；
4. P3 一次受控工作流生成、5个新员工、飞书绑定、建群和只读冒烟；
5. P4 正式开发审批。

当前不得执行：

- 点击“让 AI 生成方案”或其他付费调用；
- 创建工作流、员工或飞书群；
- 修改 AI Link、代理、网络、注册表或系统设置；
- 开通 API、绑卡、充值或购买手机号；
- 修改账号恢复方式；
- 启动 v0.4.7 A/E/G 或其他正式开发。
