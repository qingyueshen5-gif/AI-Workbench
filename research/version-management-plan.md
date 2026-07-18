# 全链版本管理方案

日期：2026-07-18  
范围：方案设计，不改功能代码。

## 目标

工作台要做到“全链版本可锁、可查、可退”。一次稳定版本不只锁工作台代码，还要锁：

- 工作台自身版本：Git commit / tag / CHANGELOG。
- 员工版本：Hermes、OpenClaw 等本地安装工具的版本、安装来源、安装路径。
- 模型版本：DeepSeek 等 API 模型名、供应商、可用性、切换策略。
- 关键运行配置：模型代理地址、员工运行目录、环境变量摘要、验证脚本结果。

最终效果：如果 `v0.4.0` 是稳定版，就能明确知道它当时对应 `Hermes v0.17.0 + OpenClaw 某版本 + DeepSeek deepseek-chat`，并能在升级翻车时回到这套组合。

## 1. 员工版本管理

### 1.1 锁定当前版本

建议新增一份机器可读清单，例如 `versions/lock.json`：

```json
{
  "workbench": {
    "version": "v0.4.0",
    "commit": "ccd1f50"
  },
  "employees": {
    "hermes": {
      "version": "0.17.0",
      "manager": "pipx 或 pip",
      "installPath": "检测得到的本机路径",
      "command": "hermes --version",
      "lockedAt": "2026-07-18T00:00:00Z"
    },
    "openclaw": {
      "version": "实际检测版本",
      "manager": "npm",
      "installPath": "检测得到的本机路径",
      "command": "openclaw --version",
      "lockedAt": "2026-07-18T00:00:00Z"
    }
  }
}
```

锁定动作不靠人工手写，应由脚本采集：

- `hermes --version`
- `openclaw --version`
- `where hermes`
- `where openclaw`
- `npm list -g openclaw --depth=0` 或等价命令
- `pip show hermes` / `pipx list` / `uv tool list`，按实际安装方式探测

每次发布工作台 tag 前，必须生成并提交该 lock 文件。

### 1.2 回退到指定旧版本

不同安装来源使用不同机制：

- npm 全局工具：`npm install -g <package>@<version>`。
- pip 工具：`pip install <package>==<version>`。
- pipx 工具：`pipx install <package>==<version>`；已存在时先 `pipx uninstall` 再装指定版本。
- uv tool：`uv tool install <package>==<version>`。
- 手工二进制：保留旧二进制备份目录，例如 `runtime/tool-backups/hermes/0.17.0/`。

回退脚本应按 `versions/lock.json` 执行，而不是让用户记命令。建议提供：

- `npm run versions:snapshot`：采集当前员工/模型/工作台版本。
- `npm run versions:restore -- v0.4.0`：读取对应版本清单并回退员工。
- `npm run versions:doctor`：检查当前版本是否和锁文件一致。

### 1.3 升级前自动备份

升级任何员工前必须做三件事：

1. 采集当前版本和路径，写入 `versions/backups/YYYY-MM-DD-HH-mm-ss.json`。
2. 备份员工运行配置和关键数据：
   - Hermes：`.hermes-runtime/config.yaml`、`.hermes-runtime/.env`、memory、skills、sessions 摘要。
   - OpenClaw：本机 agent 配置、gateway/channel 配置、sessions 索引。
3. 跑升级前健康检查：
   - `hermes --version`
   - `hermes doctor` 或最小对话
   - `openclaw --version`
   - `openclaw status --json`

升级后必须跑同样检查，并把“升级前/升级后”的差异写入报告。失败时提示用户一键回退。

## 2. 模型版本管理

### 2.1 固定模型名

API 模型必须显式写模型名，不能用含糊别名：

- 推荐：`deepseek-chat`、`deepseek-reasoner` 这类官方稳定名称。
- 不推荐：`latest`、`default`、空模型名。

工作台应把每个模型调用记录到模型锁文件：

```json
{
  "models": {
    "deepseek": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "baseUrl": "https://api.deepseek.com/v1",
      "purpose": "default_chat_and_extraction",
      "lockedAt": "2026-07-18T00:00:00Z"
    }
  }
}
```

Hermes 和 OpenClaw 通过本地模型代理调用模型时，也要记录最终转发到哪个 provider/model，避免表面上是 Hermes，实际模型已被换掉。

### 2.2 官方换代检测

建议增加每日或启动时轻量检查：

- 调供应商模型列表接口，拿当前可用模型名。
- 对锁定模型做一次最小 ping。
- 对比上次清单：
  - 新模型出现：提示“有新模型可评估”，不自动切换。
  - 锁定模型仍可用：保持不变。
  - 锁定模型返回 deprecation/downline/404：进入下线处置流程。

提示策略：

- 默认保持旧模型，除非用户确认跟进。
- 新模型先进入“候选模型”，跑固定验收集：JSON 提炼、动作路由、工具调用、中文回复、长上下文。
- 候选模型通过后，才允许更新 lock 文件。

### 2.3 防止模型悄悄变化

供应商可能保持同一个模型名但内部换代。工作台无法完全阻止，但可以记录迹象：

- 每次调用记录响应 header 中的 request id / model 字段。
- 每日固定 prompt 回归测试，比较结构化输出稳定性。
- 如果同名模型行为明显变化，提示“模型行为疑似变化”，建议锁定验收结果并人工确认。

## 3. 工作台版本与员工/模型版本关联

工作台已有 Git tag 和 CHANGELOG，需要再补一层版本矩阵。

建议新增：

- `versions/releases/v0.4.0.json`
- `versions/current.json`

示例：

```json
{
  "release": "v0.4.0",
  "workbenchCommit": "ccd1f50",
  "createdAt": "2026-07-18T00:00:00Z",
  "employees": {
    "hermes": "0.17.0",
    "openclaw": "detected-version"
  },
  "models": {
    "deepseek": "deepseek-chat"
  },
  "verification": {
    "build": "passed",
    "actionRouting": "passed",
    "hermesInvoke": "passed",
    "openclawStatus": "passed_or_known_issue"
  },
  "notes": "v0.4.0 对应 Electron 打包、模型代理、数据迁移、watchdog、OpenClaw 接入。"
}
```

CHANGELOG 负责人类可读说明，`versions/*.json` 负责机器可执行回退。

发布流程建议：

1. 跑所有验收。
2. `versions:snapshot` 生成当前矩阵。
3. 提交矩阵和 CHANGELOG。
4. 打 Git tag。
5. 推送 tag。

回退流程建议：

1. `git checkout v0.4.0` 或回退到对应 commit。
2. `versions:restore -- v0.4.0` 回退员工版本。
3. 恢复员工配置备份。
4. 检查模型锁定模型仍可用。
5. 跑版本对应验收集。

## 4. 官方下线检测和处置

### 4.1 下线检测

触发条件：

- 模型列表接口不再返回锁定模型。
- 最小 ping 返回 404、410、model_not_found、deprecated、permission denied。
- 员工包管理器查不到指定版本。
- 安装源下载链接 404 或 hash 不匹配。
- 员工启动后版本号与锁文件不一致。

检测频率：

- 工作台启动时检查一次。
- 每日后台检查一次。
- 发布前强制检查一次。

### 4.2 处置策略

分级处理：

- 低风险：新版本出现，旧版仍可用。只提示，不自动切换。
- 中风险：旧版提示 deprecated，但仍能用。提示用户评估迁移，生成候选版本测试任务。
- 高风险：旧版不可用。进入降级/替代流程。

高风险流程：

1. 工作台明确告诉用户：哪个组件下线、影响哪些功能。
2. 自动查找可替代版本或模型。
3. 在隔离运行目录中试跑候选版本。
4. 跑固定验收集。
5. 通过后提示用户选择：
   - 临时切到候选版本。
   - 保持旧版但功能降级。
   - 等待用户手动配置。

原则：不静默升级，不伪装可用，不把官方下线误报成“网络失败”。

## 5. 工作量预估

### 最小可用版：1-2 天

交付：

- `versions/lock.json` 和 `versions/releases/*.json` 格式确定。
- 版本采集脚本：Hermes/OpenClaw/DeepSeek 当前模型。
- 发布前自动生成版本矩阵。
- CHANGELOG 中引用版本矩阵。

风险：只能记录和提示，自动回退能力有限。

### 实用版：3-5 天

交付：

- `versions:snapshot`
- `versions:doctor`
- `versions:restore`
- 员工升级前备份和升级后验收。
- 模型可用性检查和候选模型提示。

风险：不同安装方式复杂，需要覆盖 npm/pip/pipx/uv/手工安装。

### 完整版：1-2 周

交付：

- 员工版本一键升级/回退。
- 模型换代检测和回归验收集。
- 官方下线高风险处置流程。
- UI 中展示“当前工作台版本 + 员工版本 + 模型版本 + 是否偏离锁定版本”。
- 每个 Git tag 自动关联版本矩阵和验收结果。

风险：OpenClaw/Hermes 的实际安装源、配置目录和锁文件机制可能变化，需要按真实机器反复验证。

## 建议落地顺序

1. 先做只读版本采集和版本矩阵，不做自动升级。
2. 再做升级前备份和版本偏离提示。
3. 再做员工回退脚本。
4. 最后做模型下线检测和候选模型验收。

这样不会把版本管理一次性做成高风险自动化，也能尽快满足“可锁、可查、可退”的底线。
