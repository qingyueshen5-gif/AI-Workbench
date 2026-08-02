# Deployment Checklist — stable-single-agent-v1

任何部署必须严格按以下顺序完成；任一FAIL立即停止。

## 0. Freeze Preconditions

- [ ] 目标提交、分支、标签和工作区状态已记录。
- [ ] 变更范围不含未批准Capability、Provider、模型、UI或Agent能力。
- [ ] Capability Inventory与Registry一致。
- [ ] 回滚提交和固定Gateway连续性方案已确认。

## 1. Code Review Gate

- [ ] 无Critical/High代码缺陷。
- [ ] 无旧Decision协议、TODO/FIXME、未解释Dead Code。
- [ ] Registry、Provider Map和Runtime消费一致。
- [ ] diff仅包含批准范围。
- **当前状态：FAIL**（见`CODE_GOVERNANCE_REPORT_V1.md`）。

## 2. Security Gate

- [ ] 无Critical/High安全风险。
- [ ] Prompt Injection、路径、权限、Shell、Process和Provider边界通过。
- [ ] 不读取、不记录、不提交凭据值。
- [ ] 高风险操作必须确认，低置信度必须澄清。
- **当前状态：FAIL**（存在Critical/High，见`SECURITY_REPORT_V1.md`）。

## 3. Architecture Gate

- [ ] 仅存在Interpreter→Scheduler→Registry→Provider→Verifier→Result链。
- [ ] Gateway/IPC保持纯传输与持久化。
- [ ] Runtime不以关键词/旧classification绕过Scheduler。
- [ ] 所有已执行Capability来自Registry Assignment。
- [ ] Provider不生成最终成功结论，Verifier不可绕过。
- **当前状态：FAIL**（见`ARCHITECTURE_V1.md`冻结偏差）。

## 4. QA Gate

- [ ] 契约、单元、集成、真实Runtime、Gateway、Progress、幂等全通过。
- [ ] 安全回归通过。
- [ ] 受控进程测试不影响用户程序。
- [ ] 生产Fallback与不可用行为陈述真实。
- [ ] 第一失败点为零。
- **当前状态：FAIL（部署级）**（见`QA_REPORT_V1.md`）。

## 5. Deployment Gate

- [ ] Product Agent已明确批准目标提交。
- [ ] 前四个Gate均有独立PASS证据。
- [ ] 部署前健康检查通过。
- [ ] 仅切换Runtime，固定Gateway不重启、不替换。
- [ ] 失败自动回退已验证稳定Runtime。
- [ ] 部署后验证PID/path/commit、exactly-once、Gateway连续性和队列清空。

**规则：任何未勾选项都禁止上线。当前不具备正式部署条件。**
