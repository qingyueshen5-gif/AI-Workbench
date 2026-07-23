# 3A-R2.1 Managed Proxy 验收报告

- 总状态：passed
- Worker URL：https://ai-workbench-managed-proxy.qingyueshen5.workers.dev
- 机制测试：passed
- 生产验证：passed
- D1：aiw-managed-proxy / 202583b9-817f-4115-9ab1-41e136133de8
- Secrets：DEEPSEEK_API_KEY、TOKEN_SIGNING_SECRET、INSTALLATION_HASH_SALT 已配置在 Cloudflare；未写入仓库。

## 检查项
- passed: mechanism_18800_reports_managed_remote - managed_remote
- passed: mechanism_local_proxy_forwards_to_managed_proxy - http_status=200
- passed: mechanism_token_forwarding - register=1, chat=1
- passed: mechanism_token_not_plaintext_in_runtime_config - managed config exists
- passed: mechanism_logs_do_not_leak_tokens - stdout/stderr scanned
- passed: production_health - http_status=200, enabled=true
- passed: production_model_allowlist - models=deepseek-chat
- passed: production_install_register - http_status=200
- passed: production_token_refresh - http_status=200
- passed: production_deepseek_upstream_call - http_status=200, reply=生产共享模型调用成功
- passed: production_18800_credential_source - managed_remote
- passed: production_18800_real_chat_without_local_keys - http_status=200, reply=生产共享模型调用成功
- passed: production_18800_refreshes_expiring_token - http_status=200, before=2026-07-24T10:53:24.000Z, after=2026-07-24T10:53:27.000Z
- passed: failure_bad_token_chinese_message - http_status=401, message=共享模型服务认证失败，请稍后重试。
- passed: failure_model_allowlist_rejects_unknown_model - http_status=400, code=model_not_allowed
- passed: failure_revoked_token_rejected - http_status=401, code=revoked_token
- passed: failure_install_daily_limit_chinese_message - http_status=429, code=install_daily_limit
- passed: failure_ip_daily_limit_chinese_message - http_status=429, code=ip_daily_limit
- passed: failure_global_daily_limit_chinese_message - http_status=429, code=global_daily_limit
- passed: failure_budget_token_limit_chinese_message - http_status=429, code=global_token_limit
- passed: security_scan_no_secret_values - no secret-like values found

## 结论

R2.1 生产 Managed Proxy、D1、Secrets、无本机 Key 真实 DeepSeek 调用、刷新/吊销/限流/预算/中文降级和安全扫描均已通过。