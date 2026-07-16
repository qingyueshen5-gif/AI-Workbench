# AI Workbench 项目基准文档 (CONTEXT.md)

> **使用方法**：以后每次和任何AI(GPT / Codex / Claude)开始新对话，第一句话固定说：
> "先读这份CONTEXT.md，这是项目的最新基准，不要重新讨论，直接按此执行。" 然后粘贴本文件全文或GitHub链接。
> 如果基准有变化，只改这一份文件，不要口头重新解释。
> 新电脑迁移或重装环境时，先看仓库根目录的 `SETUP.md`。

---

## 一、项目一句话定位

用户负责目标和决策，AI工作台负责过程。用户说"我要完成什么"，工作台自动完成任务拆解、模型选择、工具调用、自动执行、结果验证、历史记录，用户最后确认即可。

## 二、五条不变原则

1. **解决问题**，不是聊天、不是炫技术、不是模型PK
2. **简单**：打开就是聊天、任务、进度、结束，不要复杂页面
3. **干净**：一个项目一个上下文，GitHub是唯一事实来源
4. **透明**：AI做了什么、用了哪个模型、花了多少钱，全部可见
5. **每天都有交付**：不追求一个月一个大版本，每天推进一点

## 三、产品北极星

让用户越来越少"操作和记忆负担"，而不是让用户学习越来越多AI工具。每加一个功能都问：它让用户少做了一步，还是多做了一步？多做了一步，哪怕技术再酷，也不做。

## 四、当前版本状态：v0.2.0（聊天为中心）

**重要：这是 Phase 3 的第一步。用户实测 v0.1.1 后确认，多页面表单增加了操作负担，所以本版本把入口收缩为聊天，任务和偏好主要由AI从聊天内容里自动提炼。**

已完成功能（今日验证通过）：
- 主界面是连续聊天流，不再要求用户切换首页/聊天/任务状态/历史记录四个独立页面
- 用户发送聊天后调用 DeepSeek，自动提炼今日目标、任务和偏好
- AI判断不确定的提炼结果会提示用户确认，不静默乱建任务
- 右侧栏保留任务列表、任务详情、历史和错误搜索，作为查看和手动修正入口
- 任务状态、负责人、备注可修改
- 刷新网页后数据仍在（本地持久化生效）
- 任务设为"失败"但不填写原因时不能保存（强制留痕机制）
- 填写失败原因后可以保存
- 历史页面能搜索到失败原因（错误记忆库雏形）
- 右侧栏能显示和搜索系统级错误日志

## 五、Roadmap（六阶段，不要跳步）

```
Phase 1 环境与基础设施              已完成
Phase 2 功能显性化与结构验证         已完成
Phase 3 功能筛选与收缩              进行中（当前）
Phase 4 极简用户界面                未开始
Phase 5 真实自动执行与模型调度        未开始（含：用户行为习惯学习、偏好记忆、错误闭环自动化）
Phase 6 连续使用、商业化与扩展        未开始
```

## 六、团队分工（固定，不要重新讨论）

| 角色 | 负责什么 |
|---|---|
| 用户（决策者） | 拍板、提供权限、最终验收，不可替代 |
| GPT | 产品方向、路线规划、任务拆分（战略级问题才找） |
| Codex | 唯一的代码执行者，只从书面任务卡拿指令，不听口头描述 |
| Claude | 把口头想法整理成结构化任务卡、代码调试、Review、日常执行协调 |
| Hermes / 小龙虾 | 浏览器/重复流程的执行工具，未来由工作台调度，不由用户直接操作 |

## 环境层已知问题（地基，不是工作台本身）

工作台（应用层）能不能稳定运行，前提是电脑本身的开发环境（Git、Node、网络、登录凭证）先稳定。这两者要分开看：

- **工作台出问题** → 改代码、改功能，是Codex的活
- **环境出问题**（比如登录掉了、路径不对、权限报错）→ 这是地基层的问题，不是"工作台又出bug了"，不要混为一谈

**已发生过的环境问题记录（同一个坑不要踩第二次）：**

| 问题 | 原因 | 解决方式 |
|---|---|---|
| git push报"dubious ownership" | 外接硬盘的文件系统不记录归属权 | `git config --global --add safe.directory F:/AI-Workbench` |
| git push报"SEC_E_NO_CREDENTIALS" | 本机Git登录凭证失效/未设置 | 在系统自带终端（不是Codex沙盒）执行 `gh auth login --web --git-protocol https`，走一次浏览器授权 |
| Codex沙盒内push超时/授权卡住 | Codex运行环境是隔离沙盒，浏览器跳转登录在里面容易失败 | 换到电脑自带终端（PowerShell/CMD）执行登录和push，不要在Codex对话框里硬跑这一步 |
| Codex窗口意外关闭/断连后不知道怎么重开 | 正常操作，不是故障 | 打开文件资源管理器进入 `F:\AI-Workbench`，在地址栏输入 `cmd` 或右键"在终端中打开"，在弹出的终端里输入 `codex` 回车，会自动加载到项目目录，之前的进度不会丢（都存在GitHub和本地文件里） |
| Codex任务量太大导致502/连接中断 | 一次性要求做的事情太多，处理超时 | 把任务拆小，分批发送，不要一次性发多步骤的大任务卡 |
| Hermes安装过程中出现多个重复WSL发行版 | 反复导入/尝试环境时留下了 `Ubuntu-24.04`、`HermesUbuntu`、`HermesAgentUbuntu`、`Ubuntu` 等重复发行版 | 2026-07-16 已用 `wsl --unregister` 清理重复发行版，只保留 `HermesUserUbuntu`（另保留 Docker 自带的 `docker-desktop`）；`.wsl\HermesUbuntu` 注销后残留空目录也已删除 |
| Hermes主程序和WSL运行环境不在同一个位置 | Hermes主体安装在 Windows/Anaconda 的 Python 环境，命令为 `D:\Anaconda\Scripts\hermes.exe`；`HermesUserUbuntu` 发行版内默认进入 `root`，PATH 里没有 `hermes` 命令 | `hermes doctor` 里出现大量 `D:\Anaconda\Lib\site-packages\...` 是因为 Windows 侧 Hermes 正在用 Anaconda Python 运行，不是 WSL 路径串了；以后验证 Hermes 主程序用 Windows 侧 `hermes --version` / `hermes doctor`，验证浏览器运行环境用 `wsl -d HermesUserUbuntu -- ...` |
| Hermes v0.17.0 安装后健康检查仍有未完成配置 | 2026-07-16 `hermes doctor` 显示 Python 3.13.5、SSL、核心 Python 包、git、rg、docker、Node.js、agent-browser、Playwright Chromium、内置 memory 和多数工具可用；但 `.env` 缺失、config 版本 `v0 -> v30` 待迁移、Anthropic API key 无效、OpenRouter 未配置、xAI HTTP 400、Skills Hub 未初始化、缺少 `GITHUB_TOKEN`、部分扩展工具因 token/系统依赖不可用 | doctor 最后明确列出 3 个待处理项：运行 `hermes setup` 创建 `.env`，运行 `hermes doctor --fix` 或 `hermes setup` 迁移 config，再配置缺失 API keys；这些属于 Hermes 后续配置问题，不是安装主体失败 |
| Hermes doctor 输出大量 Python traceback | Hermes 日志系统要写 `C:\Users\胖胖虎\AppData\Local\hermes\logs\.__agent.lock`，鉴权检查也要访问 `auth.lock`，当前权限被拒绝，所以每次插件注册/工具检查写日志时都重复打印 `PermissionError: [Errno 13] Permission denied` | 这类 traceback 影响日志和部分 auth 状态检查，但 doctor 仍继续完成并给出总结。处理方式：关闭可能占用 Hermes 的进程后删除或修复 `logs\.__agent.lock` / `auth.lock` 权限；必要时用当前 Windows 用户重新运行 `hermes setup` 或 `hermes doctor --fix`，不要用管理员/普通用户混跑同一份 Hermes 配置目录 |
| WSL内Chromium启动时出现DBus/localhost乱码警告 | Headless Chromium 在 WSL/root 环境里没有系统 DBus，WSL 启动时也会输出 localhost/NAT 相关乱码警告 | 2026-07-16 已用 `/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --dump-dom about:blank` 实测，返回 `<html><head></head><body></body></html>` 且退出码为 0，说明浏览器能跑；这些警告暂不阻塞 |

以后任务卡都要求：Codex完成代码改动后，自己尝试commit+push；如果push因环境问题失败，直接对照上表处理，不需要每次重新排查一遍。

## 七、已知技术限制（不要重复踩坑）

- **本地服务(127.0.0.1)任何AI都无法远程访问**，只能截图/录屏分享，不能发链接
- **API与网页版是两套独立系统**，网页版不能被程序自动调用，工作台要实现"自动调用AI"必须开通API
- **API支付卡在国内/港澳银行卡的风控问题**，众安虚拟卡等已知会被拒，此问题暂缓，不影响v0.1.0推进
- **GPT/Codex/Claude之间没有共享聊天室**，跨AI协作的唯一方式是这份CONTEXT.md，不是把它们连进同一对话

## 八、验收规则（永久）

AI不负责宣布成功，AI负责提供证据（改了哪些文件、运行结果、验证方式）。用户负责最终验收。

## 九、版本号规则

```
v0.1.0 功能显性版
v0.1.x 修Bug
v0.x.0 增加/调整一批功能
v1.0.0 第一个真正可交付版本
```

## 对话管理原则（怎么跟AI打交道）

- 不要依赖任何AI"记住"整段对话历史，包括Claude的记忆功能——它只能记住零散要点，不保证完整还原细节，这是所有大模型的共同限制
- 一个对话框只聊一个话题，话题切换就开新对话，避免单个对话被拉得太长、内容混杂
- 每次开新对话，先甩CONTEXT.md（当前状态）或VISION.md（构想部分）给AI，不要口头重新讲一遍
- 任何决策、结论、进度变化，当场就写回这两份文件，不要等对话结束才补记，很容易漏
