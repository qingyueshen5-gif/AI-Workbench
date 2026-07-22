# AI Workbench 任务执行与验收协议

## 1. 角色分工

产品负责人：

- 只负责产品方向；
- 优先级拍板；
- 是否进入下一阶段；
- 最终验收判断；
- 不负责具体技术选择和日常命令判断。

GPT / 任务规划助手：

- 读取仓库理解当前进度；
- 判断下一步任务是否符合当前主线；
- 把任务整理成一整块可直接复制给 Codex 的完整指令；
- 检查 Codex 返回结果；
- 不发散新功能；
- 不抢跑后续路线；
- 技术细节按仓库事实做保守选择。

Codex / 执行助手：

- 读取仓库文件建立上下文；
- 实际修改代码、文档、打包和验证；
- 把产物写回 `F:\AI-Workbench`；
- 生成真实验收证据；
- 更新交接文档；
- commit + push；
- 真实汇报，不伪造绿灯；
- 每阶段结束后停止，不自动进入下一阶段。

## 2. 唯一事实来源

唯一事实来源：

- 本地仓库 `F:\AI-Workbench`
- GitHub `origin/main`

禁止：

- 依赖聊天记忆判断任务已经完成；
- 根据用户口头提到的文件名假设文件存在；
- 根据计划文件推断代码已经实现；
- 根据 mock 结果推断生产已经可用；
- 根据本地成功推断 GitHub Actions 已成功。

每轮开始必须真实确认：

- 当前分支；
- `git status`；
- 本地 HEAD；
- `origin/main` HEAD；
- 工作区修改；
- 必读文件是否存在；
- 文件是否被 Git 跟踪；
- 上次 push 是否已经到达 GitHub。

## 3. 单一主线原则

每次只推进一个主线任务。

支持该主线所必需的文档更新、验收脚本、安全扫描、构建配置和交接留痕，可以在同一任务内完成。

不得趁机加入新功能、后续路线、无关重构、UI 美化或未经排期的技术实验。

下一阶段必须由产品负责人明确批准后才能开始。

## 4. 所有大任务必须分段执行

标准阶段固定为：

- 阶段0：仓库状态审计
- 阶段1：现有链路和真实能力检查
- 阶段2：制定最小修改方案
- 阶段3：实施最小修改
- 阶段4：构建或运行目标产物
- 阶段5：本地预验收和安全扫描
- 阶段6：外部环境验证
- 阶段7：生成 verification 证据
- 阶段8：更新任务、版本和交接文档
- 阶段9：git diff 检查、commit、push
- 阶段10：确认工作区干净、HEAD 与 origin/main 一致
- 阶段11：汇报并停止

不得一口气盲跑到结束。

每个阶段必须记录状态、做了什么、使用的命令、退出码、产物路径、失败原因、是否允许进入下一阶段。

阶段状态只允许使用：

- `passed`：真实执行并通过；
- `failed`：真实执行但未通过；
- `blocked`：缺少必要外部条件，当前无法继续；
- `partial`：仅完成部分内容；
- `pending`：等待外部结果；
- `not_run`：尚未执行；
- `skipped`：有明确理由跳过。

禁止用 `planned`、`expected`、`should work` 等推测代替真实结果。

## 5. 技术决策与授权

普通技术选择由 Codex 按以下优先级直接处理：

1. 当前仓库事实；
2. 已有架构；
3. 产品三条铁律；
4. 最小修改；
5. 最低风险；
6. 可验证和可回滚。

不得为了普通技术细节反复让产品负责人选择。

只有以下情况才要求产品负责人介入：

- 支付；
- API Key 或账号凭证；
- 删除不可恢复的数据；
- 覆盖重要成果；
- 发布到外部；
- 正式 Release；
- 正式 tag；
- 系统要求的管理员权限；
- 其他高风险或不可逆操作。

系统弹出网络、安装 exe、卸载或 `git push` 授权时：

- 说明将执行的具体命令；
- 说明实际风险；
- 给出推荐；
- 获得授权后继续。

## 6. 外部验证不能提前判绿

GitHub Actions：

- 本轮可以创建、修改并提交 workflow；
- 如果 push 后没有取得真实 Actions 运行结果，状态必须写 `pending` 或 `not_run`，不得写 `passed`；
- 只有拿到真实 run ID、结论和日志后，才能写 `passed` 或 `failed`。

任何云端、第三方平台、下载链接、Release、远程服务同理。

“代码已经写好”不能证明“外部流程已经成功”。

## 7. mock 与生产验证必须分开

mock、临时环境变量和本地替代服务只用于证明：

- 代码路径可以运行；
- 接口结构正确；
- 失败处理有效；
- 验收脚本本身可用。

mock 不能证明：

- 生产共享 Key 已真实注入；
- 陌生机器可以访问正式共享服务；
- 正式上游额度和权限可用；
- 正式 Release 已可下载。

验收报告必须明确区分：

- `mechanism_test`：机制测试；
- `production_test`：生产验证。

如果 `shared_managed` 的生产注入方式尚未实现，状态写 `failed` 或 `blocked`，写清阻塞点，不得把 mock 结果写成生产可用。

## 8. 安装和卸载验证

Windows NSIS 安装包优先使用真实静默参数验证。

安装优先尝试：

```text
/S
```

卸载优先尝试卸载程序支持的静默参数。

必须记录实际命令、退出码、安装目录、快捷方式、启动结果、卸载结果、卸载后残留。

如果静默安装或卸载不可用，可使用 GUI 手动验证；报告中必须写明是 GUI 验证，保存截图或其他真实证据，不得伪装成自动验收。

没有实际完成卸载，`uninstall` 不得写 `passed`。

## 9. 失败任务也必须形成完整留痕

如果任何核心项失败：

- 不得伪造绿色；
- 不得进入下一阶段；
- 仍需在安全可行的情况下生成候选产物、写 `summary.json`、写 `report.md`、保存真实日志、更新任务文档、commit + push。

summary 状态写 `failed`、`blocked`、`partial` 或 `pending`。

失败本身也是有效验收结果。

## 10. 文件放置规则

长期产品定义：

- `PRODUCT.md`
- `VISION.md`
- `PRINCIPLES.md`

执行规范：

- `EXECUTION_PROTOCOL.md`

当前任务和交接：

- `CURRENT_TASK.md`
- `TASKLOG.md`
- `NEXT_STEP.md`
- `DECISIONS.md`
- `CURRENT_PROGRESS_AUDIT.md`
- `AI-Workbench-Handoff.md`

上线最小集：

- `LAUNCH.md`

版本记录：

- `CHANGELOG.md`
- `versions/current.json`
- `versions/lock.json`
- `versions/releases/*.json`

任务记录：

- `tasks/YYYY-MM-DD-任务名.md`

方案与调研：

- `research/xxx-plan.md`
- `research/xxx-analysis.md`
- `research/xxx-report.md`

验收证据：

- `verification/<任务名>/summary.json`
- `verification/<任务名>/report.md`
- `verification/<任务名>/*.log`
- `verification/<任务名>/*.png`

安装包候选版：

- `release-v版本号-installer/`

候选 exe 不提交 Git。正式安装包通过 GitHub Release 发布。

本地数据、缓存和密钥不得提交：

- `.env`
- `data/`
- `logs/`
- `evidence/`
- `node_modules/`
- `.npm-cache/`
- `.electron-cache/`
- `.tmp-*`
- 用户运行目录
- 安装包 exe
- 本地凭证

## 11. 每个任务的固定结构

以后每份 Codex 指令都必须包含：

1. 当前事实；
2. 本轮唯一目标；
3. 明确禁止事项；
4. 开始前仓库审计；
5. 要读取和检查的文件；
6. 最小实施方案；
7. 分段执行顺序；
8. 要修改的代码和文档；
9. 要生成的验收产物；
10. 要运行的验证命令；
11. 状态判定标准；
12. 交接文档更新；
13. commit + push；
14. Git 同步检查；
15. 固定最终汇报格式；
16. 完成后停止。

## 12. 完成状态判定

一个任务只有同时满足以下条件，才能标记完成：

1. 代码或文档真实写入 `F:\AI-Workbench`；
2. 必须的产物真实存在；
3. 验收使用真实命令、文件、退出码和扫描结果；
4. `summary.json` 明确记录 `passed`；
5. `TASKLOG.md` 已更新；
6. `CHANGELOG.md` 已更新；
7. `CURRENT_TASK.md` 已更新；
8. 需要的交接文件已更新；
9. `git diff` 已检查；
10. commit 已生成；
11. push 成功；
12. 工作区干净；
13. 本地 HEAD 与 `origin/main` 一致；
14. 外部任务有真实外部结果。

任一条件未满足，只能标记 `partial`、`failed`、`blocked`、`pending` 或 `not_run`。

## 13. 最终汇报固定格式

每次最终汇报必须包含：

1. 本轮任务状态；
2. 各执行阶段状态；
3. 做了什么；
4. 产物路径；
5. 真实验收结果；
6. 外部验证状态；
7. 失败项和已知问题；
8. 修改文件；
9. commit ID；
10. push 是否成功；
11. 当前工作区是否干净；
12. 本地 HEAD 是否等于 `origin/main`；
13. 是否具备进入下一阶段的条件；
14. 下一步建议；
15. 明确声明没有自动继续下一阶段。
