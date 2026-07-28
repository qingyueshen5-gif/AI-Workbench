# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
等待产品负责人验收 AW-AILINK-ROUTE-AND-REVIEW-001；验收通过后进入人工确认现有版本3方案的审批门，不重新生成。
<!-- AIW_NEXT_STEP_END -->

## 当前状态

- `AW-AILINK-READINESS-001`已由产品负责人验收通过。
- `AW-AILINK-ROUTE-AND-REVIEW-001`已完成只读核验。
- AI Link自有LLM上游直连和经7890均可达；当前代码没有要求该域名经过7890。
- 路由最终分类为`functional_but_unmanaged_route`：功能可用，但缺少明确分流策略、监控、超时重试和fallback治理。
- `AW-AILINK-GROUP-001`版本3方案审查结果为`review_passed_with_nonblocking_notes`。
- 五个角色齐全，单一总集成、产品负责人审批门、原生@响应和权限边界合格。
- 当前仍只有2个工作流；目标工作流仍为`review_ready/review`、草稿3，无pending或lastError。
- 明确结论：`new_generation_not_required`。

## 当前唯一下一步

等待产品负责人验收 AW-AILINK-ROUTE-AND-REVIEW-001；验收通过后进入人工确认现有版本3方案的审批门，不重新生成。

下一阶段若获批准，只允许在AI Link中人工确认现有版本3方案，并在动作前再次核对工作流ID、草稿版本、角色分配和“确认不等于开工”边界；不得自动准备员工、绑定飞书、创建群或启动正式开发。

当前不得执行：

- 点击“让AI生成方案”或“让创建工程师调整”；
- 生成版本4或第三个同目标工作流；
- 未经新批准确认方案；
- 创建员工、绑定飞书或创建群；
- 修改AI Link、代理、网络、注册表或系统设置；
- 启动v0.4.7 A/E/G或其他正式开发；
- 部署、付费、密钥或生产操作。
