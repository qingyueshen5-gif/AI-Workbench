# AI Workbench 上线硬骨头3：安装包与发布方案

日期：2026-07-22

## 目标

让陌生 Windows 用户最终只拿到一个下载链接，下载 `AI-Workbench-Setup-v0.4.6-x64.exe` 后可以安装、打开、使用；缺依赖或服务异常时看到中文人话，不白屏、不暴露内部错误栈。

## 分段

### 3A：安装包候选版与发布前预验收

当前阶段。只生成候选安装包并完成本地/自动化预验收。

3A 不做：

- GitHub Release 正式发布；
- 正式 tag；
- 官网；
- 模型分层；
- 手机端；
- 自动情报流水线；
- 新配置页面；
- UI 新功能；
- `verification/model-router/summary.json`。

3A 产物：

- `release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`
- `verification/install-release/preflight-summary.json`
- `verification/install-release/preflight-report.md`
- 必要日志：`verification/install-release/*.log`

候选 exe 不提交 Git。

### 3B：GitHub Release 正式发布

只有 3A 通过且产品负责人批准后才能开始。

3B 目标：

- 创建正式 tag；
- 创建 GitHub Release；
- 上传安装包；
- 验证下载链接；
- 将 LAUNCH 硬骨头3标记为完成。

## 四条现实约束

1. GitHub Actions workflow 本轮可以创建并提交。没有真实 Actions 运行结果时，Actions 状态写 `pending` 或 `not_run`，不得写 `passed`。
2. `shared_managed` mock 只能证明机制。真实生产注入未实现时必须写 `failed` 或 `blocked`，不得用 mock 结果冒充生产可用。
3. 安装和卸载优先使用 NSIS 静默参数。静默不可用可使用 GUI，但必须写清实际验证方式；没实际卸载不能写 `passed`。
4. 即使核心项失败，仍生成候选安装包、`preflight-summary.json`、`preflight-report.md`、交接文档并 commit + push；总状态如实写 `failed`、`blocked` 或 `partial`，不进入 3B。

## 安全边界

安装包、解包目录和提交内容不得包含：

- `.env`
- 真实 API Key
- 本地用户数据
- `.git`
- 开发日志
- 历史安装包
- `C:\Users\胖胖虎`
- `F:\AI-Workbench`
- 开发机专属绝对路径

扫描关键词：

- `sk-`
- `DEEPSEEK_API_KEY=`
- `SERPER_API_KEY=`
- `AIW_SHARED_DEEPSEEK_API_KEY=`
- `MODEL_PROXY_SHARED_API_KEY=`
- `C:\Users\胖胖虎`
- `F:\AI-Workbench`

不得在报告中输出完整密钥。

## 验收标准

核心五项：

- a. 无硬编码开发机路径；
- b. 首次运行自动创建 config/data/logs/evidence；
- c. 依赖缺失时不崩、不白屏、给中文人话；
- d. 端口冲突有兜底；
- e. 就绪报告完整，有真实命令、退出码或文件证据。

补充项：

- 安装成功；
- 安装后应用能打开；
- 卸载成功；
- SHA256 生成；
- 安装包无真实 Key；
- 用户全程不需要配置 Key。

## 当前状态

3A 进行中。3A 结果以 `verification/install-release/preflight-summary.json` 为准。
