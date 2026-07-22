# 2026-07-22 共享 key 落地

## 做了什么

- `model-proxy.mjs` 增加共享托管 key 兜底：用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`。
- `/health` 只返回 `credentialSource` 来源类型，不返回 key 内容。
- 新增 `npm.cmd run verify:shared-key`，用本地 mock 上游验证无用户 key 时仍能经 18800 完成模型调用，并确认 health、日志、进程输出不泄露 key。

## 为什么这样做

共享 key 必须收敛在 18800 服务端边界内。前端、Hermes、OpenClaw 和员工配置继续使用 `aiw.*.local` 占位 token，避免真实 key 出现在用户界面、员工配置、验收日志或仓库文件中。

## 下次改进方向

- 在打安装包和 GitHub Release 流程里明确共享 key 的注入方式。
- 发布前用安装版重启验证 `/health` 显示 `shared_managed`，并确认聊天入口无需用户配置即可返回模型回复。
