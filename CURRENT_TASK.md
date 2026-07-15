# CURRENT_TASK.md — 当前任务

> 最新更新：2026-07-15

## 当前阶段：Phase 2 功能显性化与结构验证收尾

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
- [x] 修复 Windows 下 `npm run dev` 一键启动问题
- [x] 新增自动验证脚本 `npm run verify`

### 本次改动文件
- `CONTEXT.md`：项目基准文档，供后续 GPT / Codex / Claude 新对话同步上下文
- `package.json` / `package-lock.json`：项目脚本与依赖
- `index.html` / `vite.config.js` / `tailwind.config.js` / `postcss.config.js`：前端工程配置
- `server.mjs`：本地 JSON 存储 API
- `scripts/dev.mjs`：同时启动 API 与 Vite 开发服务器，兼容 Windows
- `scripts/verify.mjs`：自动验证本地持久化与失败原因必填规则
- `src/main.jsx` / `src/styles.css`：MVP 工作台页面与样式
- `.gitignore`：忽略依赖、构建产物、本地缓存、运行数据和本地日志

### 验证结果
- [x] `npm.cmd install --cache .npm-cache`
- [x] `npm.cmd run build`
- [x] `node --check server.mjs`
- [x] API 校验：无失败原因的失败任务返回 400
- [x] 新增 `npm run verify`，自动校验 JSON 持久化和失败原因必填规则
- [x] `npm.cmd run dev` 可启动 API 与 Vite，本地访问地址为 `http://127.0.0.1:5173`

### 下一步
1. 用户最终验收 Phase 2：连续使用 3-7 天，每天记录目标、任务和失败原因。
2. 根据真实使用反馈进入 Phase 3：功能筛选与收缩，决定哪些入口保留、合并或隐藏。
3. 不要跳到自动执行、多 Agent 调度或 API 调用；这些属于 Phase 5。

## 任务记录规则

- 每完成一个功能，在 tasks/ 下记一条
- 文件名格式：`YYYY-MM-DD-功能名.md`
- 内容：做了什么 + 为什么这样做 + 下次改进方向
