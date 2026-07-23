# 环境搭建说明书（新电脑迁移用）

> 本文件基于 2026-07-15 在当前电脑 `F:\AI-Workbench` 的真实检查结果整理。新电脑迁移时优先照这里执行；背景坑位见 `CONTEXT.md` 的“环境层已知问题”。

## 当前电脑检查结果

| 检查项 | 命令 | 实际结果 |
|---|---|---|
| Node.js | `node -v` | `v24.18.0` |
| npm | `npm -v` | PowerShell 拦截 `npm.ps1`，报 running scripts is disabled |
| npm | `npm.cmd -v` | `11.16.0` |
| Git | `git --version` | `git version 2.54.0.windows.1` |
| GitHub CLI | `gh --version` | `gh version 2.96.0 (2026-07-02)` |
| Git 凭证助手 | `git config --global --get credential.helper` | `manager` |
| Git 安全目录 | `git config --global --get-all safe.directory` | `F:/AI-Workbench` |
| GitHub CLI 登录状态 | `gh auth status` | 当前 token 显示 invalid，新电脑必须重新登录 |
| Codex CLI 入口 | `codex --version` | PowerShell 拦截 `codex.ps1`，报 running scripts is disabled |
| Codex CLI 入口 | `codex.cmd --version` | `codex-cli 0.144.4` |
| Codex CLI 包名 | 本地全局包 `package.json` | `@openai/codex`，版本 `0.144.4` |
| Codex 登录方式 | `%USERPROFILE%\.codex\auth.json` | `OPENAI_API_KEY` 为 `PROXY_MANAGED`，由 Codex/ChatGPT 登录环境托管，不在项目内保存密钥 |

## 前置软件安装（按顺序）

1. 安装 Node.js（版本要求：当前检查到 `v24.18.0`，建议安装同级或更新 LTS/Current 版本），下载地址：https://nodejs.org/
2. 安装 Git（当前检查到 `git version 2.54.0.windows.1`），下载地址：https://git-scm.com/downloads
3. 安装 GitHub CLI (gh)（当前检查到 `gh version 2.96.0`），下载地址：https://cli.github.com/
4. 安装 Codex CLI：

```bash
npm i -g @openai/codex
```

如果 Windows PowerShell 报 `running scripts is disabled`，优先在 CMD 里执行 `codex`，或在 PowerShell 里调用 `codex.cmd`。

## Git 配置（新电脑必须执行）

下面几条是今天踩坑之后才明确需要配置的地基项，原因见 `CONTEXT.md` 的“环境层已知问题”。

```bash
git config --global user.name "<USER>"
git config --global user.email "qingyueshen5@gmail.com"
git config --global credential.helper manager
git config --global --add safe.directory F:/AI-Workbench
```

说明：
- `credential.helper manager`：让 Git 使用 Windows Git Credential Manager 保存 GitHub 登录凭证，避免 push 时反复丢凭证。
- `safe.directory F:/AI-Workbench`：外接盘或特殊文件系统可能触发 `dubious ownership`，需要把项目目录加入 Git 安全目录。
- 如果新电脑项目路径不同，把 `F:/AI-Workbench` 改成实际路径，例如 `D:/AI-Workbench`。

## GitHub 登录授权

在系统自带终端执行：

```bash
gh auth login --web --git-protocol https
```

说明：这一步必须在系统自带终端做，不能在 Codex 内部做。Codex 运行环境是隔离沙盒，浏览器跳转登录和凭证写入容易失败；原因见 `CONTEXT.md` 的“环境层已知问题”。

当前电脑检查到 `gh auth status` 显示 GitHub CLI token invalid，所以新电脑迁移时不要假设 gh 已经登录，必须重新跑上面的授权命令。

## 项目克隆与安装

```bash
git clone https://github.com/qingyueshen5-gif/AI-Workbench.git
cd AI-Workbench
npm install
```

如果 PowerShell 拦截 `npm.ps1`，改用：

```bash
npm.cmd install
```

## 环境变量配置

安装版默认由本机 18800 模型代理连接 AI Workbench 自控 Cloudflare Managed Proxy，用户不需要配置模型 key。开发态如需使用自己的 DeepSeek 账户，可以在项目根目录新建 `.env` 文件，填入：

```bash
DEEPSEEK_API_KEY=（可选；使用自己的 DeepSeek 账户时填写）
SERPER_API_KEY=（可选；需要通用网络搜索能力时填写，去 serper.dev 获取）
```

注意：`.env` 只能留在本机，不能提交到 GitHub。

说明：
- `DEEPSEEK_API_KEY`：开发者本机模型 key，优先级高于远程 Managed Proxy；普通用户不需要填写。
- `MANAGED_PROXY_URL` / `AIW_MANAGED_PROXY_URL`：可覆盖默认生产 Worker URL。生产默认 URL 是公开配置，不是 Secret。
- `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`：仅允许开发/机制测试使用；安装版生产路径禁止依赖本机 shared key。
- `SERPER_API_KEY`：用于 `web_search` 通用联网搜索工具。没有这个 key 时，模型仍可聊天和提炼，但不能执行实时搜索、新闻、当前价格等查询。

## 安装包候选版状态

2026-07-24 重新生成了 v0.4.6 Windows 安装包候选版：

```text
release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe
```

该候选版仅用于 3A 预验收，尚未发布到 GitHub Release。当前 3A-R1.3 和 3A-R2.1 均已通过，3A 总验收和 3B Release 尚未完成。R2.1 生产 Managed Proxy 证据见：

```text
verification/managed-proxy-production/summary.json
verification/managed-proxy-production/report.md
```

不要把该候选包发给真实用户。只有 3A 总验收通过、产品负责人批准进入 3B、GitHub Release 下载链接验证完成后，才能对外分发。

## 启动项目

```bash
npm run dev
```

如果 PowerShell 拦截 `npm.ps1`，改用：

```bash
npm.cmd run dev
```

打开：

```text
http://127.0.0.1:5173
```

## 开机自启动（当前电脑已配置）

当前电脑已配置为 Windows 登录后自动启动本地服务，用户开机后直接打开浏览器书签即可访问：

```text
http://127.0.0.1:5173
```

实现方式：
- 项目内脚本：`scripts/start-workbench-dev.ps1`
- 后台服务脚本：`scripts/dev-background.mjs`
- 用户启动项快捷方式：`%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\AI Workbench Dev Server.lnk`
- 启动逻辑：脚本先检查 `5173` 端口是否已经在运行；如果没有，就隐藏启动 `scripts/dev-background.mjs`，由它拉起 API 和 Vite
- 运行日志：`.workbench-startup.log` 和 `.workbench-startup.err.log`（已加入 `.gitignore`，不提交）

关闭自启动：
1. 打开文件资源管理器地址栏，输入：

```text
shell:startup
```

2. 删除 `AI Workbench Dev Server.lnk`

临时停止正在运行的本地服务：在任务管理器里结束对应的 `node.exe` 进程，或重启电脑后先删除上面的启动项。

## 验证是否搭建成功

```bash
npm run build
npm run verify
```

如果 PowerShell 拦截 `npm.ps1`，改用：

```bash
npm.cmd run build
npm.cmd run verify
```
