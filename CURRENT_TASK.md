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

### 当前任务
- [ ] 连续使用 v0.2.0，观察聊天提炼是否比表单更省操作
- [ ] 判断右侧任务/历史栏是否还需要继续收缩
- [ ] 记录 AI 误判样例，决定后续确认机制怎么改

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

### 验证结果
- [x] `npm.cmd install --cache .npm-cache`
- [x] `npm.cmd run build`
- [x] `node --check server.mjs`
- [x] API 校验：无失败原因的失败任务返回 400
- [x] 新增 `npm run verify`，自动校验 JSON 持久化和失败原因必填规则
- [x] `npm.cmd run dev` 可启动 API 与 Vite，本地访问地址为 `http://127.0.0.1:5173`
- [x] `npm run verify` 覆盖无 API Key 时的系统错误日志写入
- [x] DeepSeek API 真实调用已接入聊天自动提炼

### 下一步
1. 用户连续使用 v0.2.0，重点观察聊天提炼是否真正减少操作。
2. 收集 AI 误判和不确定提示样例，决定下一轮收缩或确认方式。
3. 不要跳到自动执行、多 Agent 调度或电脑操作；这些属于 Phase 5。

## 任务记录规则

- 每完成一个功能，在 tasks/ 下记一条
- 文件名格式：`YYYY-MM-DD-功能名.md`
- 内容：做了什么 + 为什么这样做 + 下次改进方向
