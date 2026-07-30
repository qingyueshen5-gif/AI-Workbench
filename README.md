# AI Workbench

AI Workbench 是面向普通人和专业用户的 Windows 桌面 AI 工作台，也是模型与 Agent 无关的调度、监管和交付框架。

用户只需通过一个输入框表达目标。工作台负责读取上下文、拆解任务、选择模型和工具、安排执行、检查结果、处理失败、控制成本，并留下可复核证据。

当前公开版本为 **v0.4.6 Alpha**：

- Release：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
- 安装包：https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe
- 状态：公开 prerelease / Alpha

> DeepSeek 是当前唯一接入生产链路的模型 provider，但只是可替换实现，不是产品定位。AI Workbench 的核心是调度、权限、安全、成本、记忆、验证与交付。

## 产品解决什么问题

- 普通用户不需要学习模型、API Key、Agent、代理和环境配置；
- 专业用户减少重复解释、手工协调和反复核对；
- 用户状态差时系统托底，状态正常时提质，能力强时进一步放大判断力和执行力；
- 长期让不同国家和地区的用户通过同一个简单入口调用合适的模型、Agent 和成熟工具。

## 当前真实状态

### 已完成

- Windows 安装、启动、桌面快捷方式和卸载验收；
- v0.4.6 Alpha 公开 GitHub Release 和安装包下载回测；
- 无需用户填写模型 API Key 的生产模型调用；
- AI Workbench Managed Proxy、Cloudflare Worker、D1、Secrets 和生产链路；
- 限流、令牌刷新/吊销、紧急关闭和安全扫描；
- 平台模型调用 **40 USD 月度硬上限**与 fail-closed 钱包刹车；
- DeepSeek V4 Flash 非思考兼容生产路由；
- 本地 Codex 任务网关 v0.1、Windows 启动修复、mock 验收和真实只读 smoke；
- 新电脑迁移、环境恢复和 G1 迁移门验收；
- AI Link 五名正式数字员工身份、人物画像、职责和权限边界复核；
- 新协作群结构验收、工作流绑定及五名员工真实触发验收。

### 尚未完成

- v0.4.7 功能开发；
- 首屏示例、反馈入口、安全与隐私告知；
- 产品埋点、错误日志和桌面端预算到顶提示验收；
- 首批陌生真人试用；
- 长期记忆、任务状态卡和质量检查层；
- 完整模型分层、多模型和多 Agent 调度；
- 手机端、Web 端、国际化与区域合规适配。

## 当前唯一下一步

等待产品负责人审核并明确批准 **v0.4.7 第一批工作包**的正式开工范围：

- A：公共底层、统一输入和模型抽象；
- E：反馈、埋点、错误日志和隐私；
- G：测试验收和质量证据。

批准前不启动 v0.4.7 功能开发，不创建正式开发 worktree，不部署生产，不扩大范围。

## 当前架构

```text
用户输入
  -> AI Workbench 桌面端 / 本地服务
  -> 任务、上下文、权限、成本与证据控制层
  -> 127.0.0.1:18800 provider-aware model proxy
  -> AI Workbench Managed Proxy
  -> 当前生产 provider
```

Hermes、OpenClaw、Codex、数字员工和通讯入口都是可接入的执行者或入口，不是产品核心身份。产品核心不得绑定某个模型、Agent 或聊天平台。

## 安全和成本边界

- 真实生产模型 Key 只保存在受控服务端 Secret 中；
- 不进入安装包、前端、用户电脑、员工配置、日志或公开仓库；
- 模型调用在 provider 前执行月度平台总账硬刹车；
- 缺少价格、预算账本不可用或明细写入失败时 fail closed；
- 外部操作遵守用户授权、平台规则和最小权限；
- 不以绕过验证码、权限、反自动化或安全限制为目标；
- 关键结果必须有状态、证据、失败原因和恢复路径。

## 安装公开版本

从 Release 页面下载 `AI-Workbench-Setup-v0.4.6-x64.exe`。安装后可通过桌面或开始菜单中的 **AI Workbench** 启动，公开安装包无需用户填写模型 API Key。

## 本地开发

要求：Windows 11、Node.js、npm 和 Git。

```bash
npm install --cache .npm-cache
npm run dev
```

本地服务：

- Vite 前端：`http://127.0.0.1:5173`
- 本地 API：`http://127.0.0.1:8787`
- 本机模型代理：`http://127.0.0.1:18800`

开发环境如需独立 provider Key，可在 `.env` 中配置；`.env` 已被 Git 忽略。不得把真实 Key 提交到仓库。

## 验证命令

```bash
npm run build
npm run verify
npm run verify:docs-consistency
```

按任务还可以运行 `verify:task-gateway`、`verify:feishu-channel`、`verify:model-proxy`、`verify:acceptance` 等验证。具体任务是否通过，应查看对应 `verification/<task>/summary.json`、报告、命令日志和 Git diff，不能只根据单个脚本退出码宣布产品阶段通过。

## 权威文档

- `AI-Workbench-Handoff.md`：新对话交接快照；
- `NEXT_STEP.md`：当前唯一下一步；
- `CURRENT_PROGRESS_AUDIT.md`：能力与任务状态；
- `PRODUCT.md`：产品定义、用户与产品地图；
- `VISION.md`：长期愿景；
- `PRINCIPLES.md`：设计与执行原则；
- `CONTEXT.md`：完整项目基准；
- `EXECUTION_PROTOCOL.md`：执行、验收和交接协议；
- `SETUP.md`：新电脑和重装环境说明；
- `ENVIRONMENT_OPS_ISSUES.md`：运行环境与故障资产。

## 项目原则摘要

- 为真实用户和真实问题而做；
- 前台保持一个输入框，后台承担复杂性；
- 本地优先、隐私优先、权限最小化；
- 能借用成熟生态就不重复造轮子；
- 执行可以快，但结果不能免检；
- 不把“给出建议”当作“真实完成”；
- 同一时间只推进一条需要产品负责人持续拍板的产品实施主线。
