# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-16

## 当前阶段：Phase 3 功能筛选与收缩正在进行

### 今天完成
- [x] 创建 GitHub 仓库 AI-Workbench
- [x] 建立四个基础文档（README / PRODUCT / PRINCIPLES / CURRENT_TASK）
- [x] Codex CLI 恢复正常工作
- [x] 按 `Codex任务卡_MVP工作台.md` 完成最小闭环：发指令 → 系统留痕 → 展示进度
- [x] 新增 React + Tailwind 本地网页
- [x] 新增 Node 本地 API，数据写入 `data/workbench.json`
- [x] 完成四个页面：首页、聊天页、任务状态页、历史记录页
- [x] 实现失败任务必须填写失败原因的强制规则
- [x] 新增 `CONTEXT.md` 作为项目最新基准文件
- [x] 新增 `VISION.md` 作为长期构想备忘录
- [x] 新增 `CHANGELOG.md` 记录 v0.1.0
- [x] 修复 Windows 下 `npm run dev` 一键启动问题
- [x] 新增自动验证脚本 `npm run verify`
- [x] v0.1.1 扩充显示面板：模型连接状态、用户偏好、存储状态、系统错误日志
- [x] 新增 DeepSeek API 连接测试入口
- [x] 打 `v0.1.1-stable` 备份标签并推送，作为大改前稳定回退点
- [x] v0.2.0 收缩为聊天中心界面，取消四个独立 tab
- [x] 新增 DeepSeek 聊天自动提炼：从自然语言识别今日目标、任务和偏好
- [x] 修复对话持久化：支持连续对话、标题推导和会话恢复
- [x] 上线通用搜索能力：DeepSeek 可通过工具调用执行实时联网搜索
- [x] 修复失败任务留痕体验：标记失败时自动生成失败原因，用户可再编辑
- [x] 优化任务列表视觉区分：任务卡片显示负责人、日期和短 ID
- [x] 完成 Hermes v0.17.0 安装收尾：清理重复 WSL 发行版，验证 Playwright Chromium 可运行，读取并归档 doctor 结果

### 当前任务
- [ ] 明天运行 `hermes setup`，完成 Hermes `.env` 和 config 迁移
- [ ] 修复 Hermes `auth.lock` / `logs\.__agent.lock` 权限问题
- [ ] 补齐 Hermes 所需 API keys：Anthropic、OpenRouter、xAI、GITHUB_TOKEN 等按实际需要配置
- [ ] 处理视觉细节 5 项，继续压缩不必要的界面负担
- [ ] 评估本地工作台开机自启方案
- [ ] 评估部署方案，明确本地版、内网版或云端版的边界

### 本次改动文件
- `CONTEXT.md`：项目基准文档，供后续 GPT / Codex / Claude 新对话同步上下文
- `VISION.md`：构想备忘录，存放暂不进入执行排期的长期想法
- `CHANGELOG.md`：版本变更记录，记录 v0.1.0 功能、已知问题和下一步方向
- `package.json` / `package-lock.json`：项目脚本与依赖
- `index.html` / `vite.config.js` / `tailwind.config.js` / `postcss.config.js`：前端工程配置
- `server.mjs`：本地 JSON 存储 API
- `scripts/dev.mjs`：同时启动 API 与 Vite 开发服务器，兼容 Windows
- `scripts/verify.mjs`：自动验证本地持久化、失败原因必填规则、存储状态和无 API Key 错误日志
- `src/main.jsx` / `src/styles.css`：聊天中心工作台页面与样式
- `.gitignore`：忽略依赖、构建产物、本地缓存、运行数据和本地日志
- `hermes-doctor-2026-07-16.txt`：Hermes doctor 健康检查原始输出，用于后续排查配置问题

### 验证结果
- [x] `npm.cmd install --cache .npm-cache`
- [x] `npm.cmd run build`
- [x] `node --check server.mjs`
- [x] API 校验：无失败原因的失败任务返回 400
- [x] 新增 `npm run verify`，自动校验 JSON 持久化和失败原因必填规则
- [x] `npm.cmd run dev` 可启动 API 与 Vite，本地访问地址为 `http://127.0.0.1:5173`
- [x] `npm run verify` 覆盖无 API Key 时的系统错误日志写入
- [x] DeepSeek API 真实调用已接入聊天自动提炼
- [x] Hermes doctor 输出已读取：主体安装可用，剩余为 `.env`、config、API key 和 lock 权限配置问题
- [x] `.wsl-cache/` 和 `.wsl/` 已加入 `.gitignore`，避免 Ubuntu 安装包和 WSL 运行目录进入项目文件监控/版本库

### 下一步
1. 运行 `hermes setup` / `hermes doctor --fix`，完成 Hermes 配置迁移和 `.env` 创建。
2. 修复 Hermes lock 文件权限，并补齐必要 API keys。
3. 完成视觉细节 5 项、开机自启和部署方案评估。
4. 不要跳到自动执行、多 Agent 调度或电脑操作；这些属于 Phase 5。

## 任务记录规则

- 每完成一个功能，在 tasks/ 下记一条
- 文件名格式：`YYYY-MM-DD-功能名.md`
- 内容：做了什么 + 为什么这样做 + 下次改进方向
