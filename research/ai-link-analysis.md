# AI Link 本机实现调研报告

调研范围：只读检查本机 AI Link 安装目录、用户数据目录和 `C:\Users\胖胖虎\ai-workers\` 运行目录。未修改 AI Link 文件，也未修改 AI-Workbench 代码。

主要证据路径：

- 安装目录：`C:\Users\胖胖虎\AppData\Local\Programs\ai-link-desktop`
- Electron 用户数据：`C:\Users\胖胖虎\AppData\Roaming\ai-link-desktop`
- 员工运行目录：`C:\Users\胖胖虎\ai-workers\employees\worker-1d00`
- 关键包：`C:\Users\胖胖虎\AppData\Local\Programs\ai-link-desktop\resources\app.asar`
- 员工模板资产：`C:\Users\胖胖虎\AppData\Local\Programs\ai-link-desktop\resources\worker-assets`

## 1. 它用什么打包成桌面独立产品？

AI Link 是 Electron 桌面应用。证据很直接：

- 安装目录里有 `AI Link.exe`、`resources\app.asar`、`chrome_*.pak`、`icudtl.dat`、`ffmpeg.dll`、`libEGL.dll`、`libGLESv2.dll`、`LICENSE.electron.txt`、`LICENSES.chromium.html` 等典型 Electron/Chromium 运行文件。
- `app.asar` 内的 `package.json` 显示：
  - `name: ai-link-desktop`
  - `version: 0.2.10`
  - `main: electron/main.js`
  - 依赖只有 `qrcode`、`ws`，主逻辑集中在 Electron 主进程和前端静态资源里。
- 安装目录还有 `Uninstall AI Link.exe` 和 `resources\elevate.exe`，说明 Windows 侧使用安装器安装到用户级目录。

“双击就能用”的关键是：

1. Electron 把 Chromium、Node 主进程和前端 UI 一起随 `AI Link.exe` 分发。
2. 应用业务代码打进 `resources\app.asar`。
3. 大体积运行资产不全塞进 asar，而是放在 `resources\worker-assets`，包括员工模板、Hermes/Codex 相关脚本、微信/BOSS 等模板安装脚本和 vendored skills。
4. 安装位置是用户目录下的 `AppData\Local\Programs\ai-link-desktop`，不需要系统级安装权限即可双击运行。

对我们的可借鉴点：

AI-Workbench 如果要做“给普通用户双击即用”的版本，Electron 是最直接路线：把 React/Vite 前端和 Node API 收进一个桌面壳，运行数据放 `AppData\Roaming`，大资产放 `resources` 或首次启动下载。先做用户级安装，避免管理员权限和服务安装复杂度。

## 2. 它的安装目录/配置/数据是怎么组织的？

AI Link 把“程序文件”“Electron 用户态数据”“数字员工运行态”分开了。

### 程序安装目录

路径：`C:\Users\胖胖虎\AppData\Local\Programs\ai-link-desktop`

主要内容：

- `AI Link.exe`：主程序。
- `Uninstall AI Link.exe`：卸载器。
- `resources\app.asar`：Electron 应用代码。
- `resources\worker-assets`：员工模板、技能、安装脚本、绑定脚本。
- Electron/Chromium runtime 文件：`locales`、`*.pak`、`*.dll` 等。

这个目录偏“只读程序资产”，版本更新会替换这里的安装包内容。

### Electron 用户数据目录

路径：`C:\Users\胖胖虎\AppData\Roaming\ai-link-desktop`

观察到的内容：

- Chromium/Electron 缓存：`Cache`、`Code Cache`、`GPUCache`、`Local Storage`、`Network`、`Session Storage`。
- 应用偏好：`Preferences`、`preferences.json`、`secure-session.json`。
- Codex 相关缓存：`codex\model_catalog.json`、`codex-plugins\codex-plugins-windows-...`。
- 配置备份：`config-backups\codex.json`、`config-backups\codex\...`。
- 更新包缓存：`updates\0.2.10\AI-Link-Setup.exe`。

这个目录偏“当前用户应用状态”，符合 Electron 默认 `app.getPath('userData')` 的组织方式。

### 员工运行目录

路径：`C:\Users\胖胖虎\ai-workers\employees\worker-1d00`

典型结构：

- `config\config.yaml`：Hermes 员工配置，模型指向本机代理。
- `config\.env` 等价数据被绑定脚本维护；当前目录里还能看到微信账号、pairing、状态库等。
- `config\state.db`、`kanban.db`：状态和任务/看板数据库。
- `config\sessions`：会话记录。
- `config\skills`：员工私有技能。
- `config\memories`、`MEMORY.md`、`USER.md`、`SOUL.md`：员工记忆和人格。
- `config\logs`：`agent.log`、`gateway.log`、`watchdog.log`、`errors.log`。
- `workspace`：员工实际工作目录。
- `config\gateway.pid`、`gateway.lock`、`gateway_state.json`：Hermes gateway 运行状态。
- `config\channel_directory.json`：移动端/渠道目标目录，例如当前可见 `weixin` 私聊 target。

员工状态文件 `worker-state.json` 记录 `workerId`、`enabled`、迁移记录等；这让桌面端可以在启动后恢复员工，而不是只靠进程是否存在。

对我们的可借鉴点：

AI-Workbench 也应该分三层：安装程序、用户配置/缓存、项目或员工工作区。不要把运行数据和程序代码混在项目目录里。尤其是未来多员工场景，每个员工应有独立 `config`、`workspace`、`logs`、`state.db`，并用 `worker-state.json` 记录启停意图和迁移状态。

## 3. 它怎么解决模型 API 的网络/VPN问题？

这是 AI Link 设计里最值得学的部分。它没有让每个员工直接拿云端模型 API key，也没有让 Hermes 直接访问外部模型地址，而是做了“两层本机代理 + 外部网络守护”。

### 第一层：AI Link 桌面端内置本机模型代理

`app.asar` 里的 `electron/aiw-local-proxy.js` 定义了 AI Workers 本机代理：

- 默认端口：`18766`。
- 暴露接口：
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/responses`
- 代理只接受本机 loopback 或带 token 的请求。
- 请求转发到 `session.llmBaseUrl`，并注入真实 `session.llmKey`。
- 员工身份从 `Authorization: Bearer aiw.<employee_id>.<token>` 或 `x-aiw-employee` 推导，用于日志和用量归因。

登录后，`electron/main.js` 的 `initializeAiwLoggedInRuntime` 从登录结果里取：

- `result.user.litellm.baseUrl`
- `result.user.litellm.virtualKey`

然后调用 `aiwProxy.setSession({ llmBaseUrl, llmKey })`。也就是说，真实模型地址和真实 virtual key 只保存在桌面主进程 session 里；员工只知道本机 `http://127.0.0.1:18766/v1`。

### 第二层：通用 local proxy，兼容不同客户端协议

`electron/main.js` 里还有另一个本机代理端口：

- `LOCAL_PROXY_PORT = 18765`
- `LOCAL_PROXY_BASE_URL = http://127.0.0.1:18765`

它处理多个客户端形态：

- `/v1/responses`：给 Codex/Responses 协议用。
- `/v1/chat/completions`：给 Hermes/chat-completions 协议用。
- `/claude-desktop/v1/messages`：给 Claude Desktop 兼容入口用。
- `/v1/models` 和 `/claude-desktop/v1/models`：给客户端发现模型用。

它会根据目标客户端把模型 ID 映射到 AI Link 后端 LiteLLM 模型，并统一转发。Codex 和 Claude 的配置写入逻辑也围绕这个本机代理生成本地配置。

### 员工 Hermes 配置如何接入模型

员工 `config.yaml` 当前配置为：

```yaml
model:
  default: gpt-5.6-sol
  provider: custom
  base_url: http://127.0.0.1:18766/v1
  api_key: aiw.worker-1d00.<员工token>
  api_mode: codex_responses
  context_length: 400000
```

安装资产里的 `config.template.yaml` 注释写得更明确：员工通过“宿主机本机代理”打云端 LiteLLM，`api_key` 携带本机代理随机 token，代理校验后再注入真实 virtualKey。

### VPN/网络问题怎么处理

本机 watchdog 脚本 `config\watchdog\ai-link-watchdog.ps1` 把网络可用性拆成三个依赖：

1. 代理/VPN 端口：`127.0.0.1:7890`
2. AI Link 模型服务端口：`127.0.0.1:18766`
3. Hermes gateway 进程

脚本里写死了：

- `$BinglingExe = 'C:\Program Files\bingling\bingling.exe'`
- `$ProxyPort = 7890`
- `$ModelPort = 18766`

守护逻辑：

- `Ensure-Proxy`：如果 7890 不通，启动 `bingling.exe`，最多等 60 秒；恢复后写日志。
- `Ensure-AILink`：如果 AI Link 没运行就启动；如果 18766 不通，就杀掉并重启 AI Link，再等模型服务恢复。
- `Ensure-Gateway`：检测 Hermes gateway 数量，0 个则启动，多个则全部杀掉后重启；如果 gateway 日志里近期出现 `127.0.0.1:7890` 相关 `poll error`、`send failed`、`Connection error`，并且代理和模型服务已经恢复，就重启 gateway。

这个设计的重点不是“模型 API 自己重试”，而是把失败分层：

- VPN/系统代理坏了：拉起 bingling。
- 桌面模型代理坏了：重启 AI Link。
- gateway 被坏代理状态污染：重启 gateway。

`install-watchdog.ps1` 进一步把这个脚本注册成两个计划任务：

- `AI Link Connection Watchdog`：每 2 分钟运行一次。
- `AI Link Startup Recovery`：用户登录后延迟 20 秒运行。

对我们的可借鉴点：

AI-Workbench 不应让每个 agent 直接管理外部 API key 和代理。更稳的架构是：本机只暴露一个 loopback 模型代理，agent 全部打本机代理；真实 API key、模型路由、用量归因和网络重试集中在代理层。对 VPN 要做独立健康检查，不要只在模型调用失败后提示用户；可以明确检查代理端口、模型代理端口、agent 进程，并用计划任务/启动项做恢复。

## 4. 它怎么连接飞书/微信做手机端交互？

AI Link 的手机端交互不是把桌面 UI 投到手机，而是让 Hermes gateway 接入消息平台。飞书和微信都走“扫码/设备码绑定 -> 写员工凭证 -> 重启 gateway -> 平台消息进入员工”的模式。

### 前端绑定状态机

`app/workers-live.js` 的前端逻辑写了绑定状态机：

- `begin`：开始绑定，拿二维码或授权 URL。
- `poll`：轮询绑定状态。
- confirmed 后调用 `channel.restart(workerId)`，让 gateway 重新加载 `.env`/平台配置。

前端平台名是 `wechat/feishu`；后端 `aiw-worker-rpc.js` 里会把 `wechat` 转成 Hermes 平台名 `weixin`。

### 飞书绑定

脚本：`resources\worker-assets\scripts\feishu_bind.py`

工作方式：

1. `begin` 调用 Hermes/插件里的飞书 registration：
   - `_init_registration('feishu')`
   - `_begin_registration('feishu')`
2. 生成 `device_code`、`qr_url`、`interval`、`expire_in`。
3. 状态写入员工目录：
   - `HERMES_HOME\pairing\aiw_feishu_qr_state.json`
   - 可选生成 `aiw_feishu_qr.png`
4. `poll` 用 `device_code` 轮询。
5. confirmed 后拿到 `client_id`、`client_secret`、domain、open_id。
6. 写入员工 `.env`：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_DOMAIN`
   - `FEISHU_CONNECTION_MODE=websocket`
7. 脚本不向 stdout 打印 secret，只返回 `bot_name`、`home_channel` 等可公开信息。

`aiw-worker-rpc.js` 还有 `configureFeishuAcl`，通过 `.env` 写：

- `FEISHU_GROUP_POLICY`
- `FEISHU_REQUIRE_MENTION`

所以飞书可以进一步配置群聊策略，例如群是否开放、是否必须 @。

### 微信绑定

脚本：`resources\worker-assets\scripts\weixin_bind.py`

工作方式：

1. `begin` 调用 Hermes 微信平台接口：
   - `ILINK_BASE_URL`
   - `EP_GET_BOT_QR`
   - `bot_type=3`
2. 生成 iLink bot 二维码，状态写入：
   - `HERMES_HOME\pairing\aiw_weixin_qr_state.json`
   - `aiw_weixin_qr.png`
3. `poll` 调用 `EP_GET_QR_STATUS` 查询状态。
4. 状态有几类：
   - `wait`
   - `scaned_but_redirect`
   - `confirmed`
   - `expired`
5. 如果出现 `scaned_but_redirect`，脚本会保存新的 `redirect_host` 为 base_url，继续轮询。
6. confirmed 后拿：
   - `ilink_bot_id`
   - `bot_token`
   - `baseurl`
   - `ilink_user_id`
7. 保存到 Hermes 账号文件，并写员工 `.env`：
   - `WEIXIN_ACCOUNT_ID`
   - `WEIXIN_TOKEN`
   - `WEIXIN_BASE_URL`
   - `WEIXIN_DM_POLICY`
   - `WEIXIN_GROUP_POLICY`
   - 可选 `WEIXIN_HOME_CHANNEL`

当前本机 `worker-1d00` 证据：

- `config\weixin\accounts\...\*.json` 中有微信账号文件。
- `config\channel_directory.json` 中有 `platforms.weixin`，包含一个私聊 target。
- `config\gateway_state.json` 中 `platforms.weixin.state` 为 `connected`。

报告中不展开本机 token 值，但可以确认凭证是落在员工配置目录，并由 gateway 读取。

### Hermes gateway 如何承接微信

`electron/main.js` 的 `startHermesGateway` 会：

1. 读取已保存的微信账号。
2. 写 Hermes config。
3. 以 detached 子进程启动 `hermes gateway run`。
4. 给子进程注入环境变量：
   - `WEIXIN_ACCOUNT_ID`
   - `WEIXIN_TOKEN`
   - `WEIXIN_BASE_URL`
   - `WEIXIN_DM_POLICY=open`
   - `WEIXIN_GROUP_POLICY=disabled`
   - `WEIXIN_ALLOW_ALL_USERS=true`
   - `API_SERVER_ENABLED=true`
   - `API_SERVER_HOST=127.0.0.1`
   - `API_SERVER_PORT=8642`
   - `API_SERVER_MODEL_NAME=<当前模型>`

这说明 AI Link 把手机端消息交互统一收敛到 Hermes gateway：微信/飞书只是平台 adapter，真正执行仍是员工 Hermes。

对我们的可借鉴点：

AI-Workbench 如果要手机端交互，最稳路线不是先做移动 App，而是先做“消息平台 gateway”：网页端负责绑定和状态展示，后端保存平台凭证，agent gateway 负责收发消息。微信/飞书都要有明确状态机：开始绑定、轮询、过期、确认、重启生效、健康检查。凭证不要展示给前端，stdout 和日志也要脱敏。

## 5. 它的进程守护/自愈是怎么设计的？

AI Link 有两套恢复机制：桌面主进程内恢复和 Windows 计划任务 watchdog。

### 桌面主进程内恢复

`electron/main.js` 的 `initializeAiwLoggedInRuntime` 登录成功后会：

1. 设置模型代理 session。
2. 检查 Hermes runtime 状态。
3. 如果 runtime 可用，调用 `recoverAiwWorkersAfterBoot()`。

`recoverAiwWorkersAfterBoot` 会：

- 先 `ensureSharedComputerUse`。
- 再 `aiwRpc.recoverWorkersAfterBoot`。
- 发送 `worker:recovered` 事件给渲染进程。

`aiw-worker-rpc.js` 的 `recoverWorkersAfterBoot` 逻辑：

1. 列出 `ai-workers\employees` 下所有 worker。
2. 跑模型迁移，例如把默认模型迁移到 `gpt-5.6-sol`。
3. 读取每个 worker 的 `worker-state.json`，只恢复 `enabled=true` 的员工。
4. 检查 Hermes native runtime。
5. 对每个候选员工：
   - 如果已运行且无需重启，记为 running。
   - 如果模型迁移过或强制重启，先 stop，再 start。
   - 如果未运行，启动 native worker。
6. 返回 started/restarted/running/disabled/missing/failed 明细。

创建员工失败时也有清理：

- `createWorker` 先 scaffold、装 Git Bash、跑模板 setup、启动 gateway。
- 任一步失败会 `cleanupFailedWorker`：stop worker 并删除创建失败的 worker 目录。

### Windows 计划任务 watchdog

`config\watchdog\install-watchdog.ps1` 注册两个计划任务：

- `AI Link Connection Watchdog`：每 2 分钟检查一次。
- `AI Link Startup Recovery`：登录后 20 秒恢复。

`ai-link-watchdog.ps1` 自愈对象：

- `bingling.exe` 代理：检查 7890。
- `AI Link.exe`：检查进程和 18766 模型服务端口。
- Hermes gateway：检查 python gateway 进程数量、日志里的近期代理错误。

它还用 `watchdog.lock` 防止 watchdog 多实例并发执行。日志写入 `config\logs\watchdog.log`。实际日志里可以看到重复的“Detected 2 gateway processes; restarting to remove duplicates.”和“Starting Hermes gateway.”，说明它确实按“进程数量异常 -> 清理重复 -> 重启”的方式运行过。

对我们的可借鉴点：

AI-Workbench 需要把“恢复意图”和“当前进程状态”分开。建议引入 `enabled`/`desiredState` 文件，启动时按意图恢复；同时做一个轻量 watchdog，定期检查端口、进程、日志错误模式。不要只靠 Node 进程常驻；Windows 上用计划任务比手写后台循环更稳。

## 6. 它的版本更新是怎么做的？

AI Link 的自动更新不是用 `electron-updater`。`electron/auto-update.js` 文件开头注释明确写了：

- 不依赖 `electron-updater` 或第三方库。
- macOS 用 `tar.gz + detached bash` 替换 `.app`。
- Windows 走 NSIS 安装器路线：下载/校验 setup.exe 后启动安装器并退出当前进程。

### 更新发现

前端 `app/workers-live.js` 里写了：

- “复用 AI Link backend `/api/downloads/clients` manifest，下载源为国内 OSS”
- 调用 `window.aiw.downloads.clients()` 获取 manifest。
- 调用 `window.aiw.update.check(manifest)` 比较版本。
- 如果有更新，显示更新 banner。

主进程 `auto-update.js`：

- `APP_UPDATE_CLIENT = 'ai-link'`
- 根据平台选择 asset：
  - `windows-x64`
  - `windows-arm64`
  - `macos-x64`
  - `macos-arm64`
  - `macos-universal`
- 用 `compareVersions(asset.version, current)` 判断是否更新。

### 下载和校验

更新包下载到：

`C:\Users\胖胖虎\AppData\Roaming\ai-link-desktop\updates\<version>\`

当前本机可见：

- `updates\0.2.10\AI-Link-Setup.exe`
- `C:\Users\胖胖虎\AppData\Local\ai-link-desktop-updater\installer.exe`

下载流程：

1. `downloadUpdatePackage(asset)` 创建 `updates\<version>` 工作目录。
2. Windows fallback 文件名是 `AI-Link-Setup.exe`。
3. 调 `downloadUrlToFile` 下载。
4. 如果 manifest 提供 `sha256`，下载后计算 sha256，不匹配就删除工作目录并抛 `update_checksum_mismatch`。

### Windows 安装

`applyWindowsUpdate`：

1. 下载并校验包。
2. 要求包扩展名是 `.exe` 或 `.msi`。
3. 通过 `shell.openPath(packagePath)` 打开安装器。
4. 800ms 后 `app.quit()`。

也就是说 Windows 不做运行中替换 exe，而是交给安装器接管。结合安装目录中的 `Uninstall AI Link.exe` 和用户级安装路径，基本可以判断 Windows 包是 NSIS/Squirrel 类安装体验，其中源码注释明确提到 NSIS。

### macOS 安装

macOS 则是：

1. 下载 tar.gz。
2. 解压出 `AI Link.app`。
3. detached bash 等旧进程退出。
4. 旧 `.app` 改名为 `.ailink-bak`。
5. 移动新 `.app` 到原位置。
6. 校验 `Contents/MacOS/AI Link` 可执行。
7. 失败则回滚，成功后 relaunch。

对我们的可借鉴点：

AI-Workbench 做桌面版时，Windows 更新应优先走“下载完整安装器 -> 校验 sha256 -> 打开安装器 -> 退出当前进程”，不要尝试运行中替换 exe。manifest 放服务端，下载源用国内可达对象存储，客户端只做版本比较、下载、校验、安装触发。更新包缓存放 userData 的 `updates/<version>`，失败可重试、可定位。

## 总结

AI Link 的核心架构可以概括为：

1. Electron 桌面壳负责登录、配置、UI、更新、本机代理和进程管理。
2. 模型访问统一走本机 loopback 代理，真实云端 key 只在桌面主进程 session 中。
3. 数字员工是独立 Hermes worker，每个 worker 有自己的 config、workspace、skills、logs、state。
4. 飞书/微信只是 Hermes gateway 的 platform adapter，通过扫码/device-code 写入员工 `.env` 后重启生效。
5. 自愈同时发生在应用启动恢复和 Windows 计划任务 watchdog 两层。
6. 更新采用 manifest + 国内 OSS + sha256 + Windows 安装器/macOS 替换脚本。

对 AI-Workbench 的优先借鉴顺序：

1. 先做本机模型代理和密钥集中管理。
2. 再把运行数据从项目目录迁移到用户数据目录。
3. 然后做计划任务/启动恢复。
4. 最后再做微信/飞书 gateway 和桌面安装器更新。
