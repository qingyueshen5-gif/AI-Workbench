# 3A-R2.1 Managed Proxy 生产部署验收报告

- 总状态：passed
- Worker URL：`https://ai-workbench-managed-proxy.qingyueshen5.workers.dev`
- D1：`aiw-managed-proxy` / `202583b9-817f-4115-9ab1-41e136133de8`
- Secrets：`DEEPSEEK_API_KEY`、`TOKEN_SIGNING_SECRET`、`INSTALLATION_HASH_SALT` 已配置在 Cloudflare；Secret 值未写入仓库、本机配置、日志或命令行。
- 安装包：重新构建 `release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe`，未创建 Release/tag。

## 真实生产结果

- Worker `/health`：passed，`enabled=true`
- D1 schema：passed，`installations`、`daily_usage`、`revoked_tokens` 可读写
- 生产 DeepSeek 调用：passed，返回 `生产共享模型调用成功`
- 本机 18800 无本机 Key：passed，`credentialSource=managed_remote`
- 安装版零配置对话：passed，安装目录内打包版 `model-proxy.mjs` 通过生产 Worker 返回 `生产共享模型调用成功`

## 失败场景

- token 刷新：passed
- 吊销 token：passed，返回 401 / `revoked_token`
- 单实例限流：passed，返回 429 / `install_daily_limit`
- 单 IP 限流：passed，返回 429 / `ip_daily_limit`
- 全局限流：passed，返回 429 / `global_daily_limit`
- 预算限额：passed，返回 429 / `global_token_limit`
- 紧急关闭：passed，临时部署 `MANAGED_PROXY_ENABLED=false` 后返回 503 / `managed_proxy_disabled`，随后已恢复 `MANAGED_PROXY_ENABLED=true`
- 中文降级：passed，认证、限流、预算、紧急关闭均返回中文说明

## 安全扫描

- Git / 源码 / Worker / 验证日志：passed
- 候选安装包目录和安装目录：passed，扫描 167 个文件，无 DeepSeek `sk-` key 或 JWT-like 长 token
- 进程参数：passed，扫描 395 个进程，无 Secret 或长期 token 形态

## 证据

- `verification/managed-proxy-production/summary.json`
- `verification/managed-proxy-production/production-test.log`
- `verification/managed-proxy-production/failure-cases.log`
- `verification/managed-proxy-production/security-scan.log`
- `verification/managed-proxy-production/security-scan-installation.log`
- `verification/managed-proxy-production/process-args-scan.log`
- `verification/managed-proxy-production/installed-production.log`

结论：R2.1 生产 Managed Proxy、D1、Secrets、真实 DeepSeek 上游、安装版零配置、刷新/吊销/限流/预算/紧急关闭/中文降级和安全扫描均已真实通过。此结论不等于 3A 总验收或 3B Release 已完成。
