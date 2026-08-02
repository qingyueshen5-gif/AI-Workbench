# Version Freeze — stable-single-agent-v1

## Freeze declaration

AI Workbench的v1目标架构、Task Interpreter Schema、Capability Inventory、治理角色和部署门禁在本目录文档中冻结，冻结名为`stable-single-agent-v1`。

## Freeze scope

- 冻结架构边界，不新增模型、Provider、Capability、UI或Runtime Agent能力。
- 冻结统一Task Schema和旧Decision协议禁令。
- 冻结部署顺序：Code Review → Security → Architecture → QA → Deployment。
- 冻结固定Gateway纯传输、Runtime可切换和失败回退原则。

## Release status

- **Architecture specification：FROZEN**
- **Capability inventory：FROZEN AS-IS**
- **Production release：BLOCKED**
- **正式版本标签：未创建**

原因：`CODE_GOVERNANCE_REPORT_V1.md`、`SECURITY_REPORT_V1.md`和`ARCHITECTURE_V1.md`仍列有High级部署阻断项。冻结文档不是部署批准，也不把部分接入能力描述为完整闭环。

## Unfreeze policy

只有重大架构缺陷、Critical/High安全修复或产品负责人批准的下一版本范围，才允许修改冻结边界。任何解冻必须有ADR、独立审查和完整回归证据。
