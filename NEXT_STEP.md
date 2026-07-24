# NEXT_STEP.md

<!-- AIW_NEXT_STEP_START -->
重启后处理第一批遗留空目录，并由产品负责人决定Windows临时文件及第二批软件清理。
<!-- AIW_NEXT_STEP_END -->

## 当前状态

- AI Workbench v0.4.6 Alpha 已公开发布。
- 产品方向收口已 passed。
- 文档基准纠偏与防漂移机制已 passed。
- 电脑环境治理审计已完成。
- 第一批安全清理已部分完成，累计释放 F 盘约 3.06 GB。
- 当前唯一下一步调整为重启后处理第一批遗留空目录，并由产品负责人决定 Windows 临时文件及第二批软件清理。

## 为什么先处理遗留项

- 第一批清理中部分旧 runtime 和旧 release 目录被 Windows/exFAT 权限异常阻断。
- 用户 npm 缓存和 Wrangler 日志目录也出现 `EPERM`。
- 需要先重启，让占用和异常目录状态释放，再决定是否继续精确删除或进入第二批软件/自启清理。

## 下一轮允许范围

只允许：

- 重启后复核第一批遗留空目录；
- 精确删除产品负责人批准的遗留临时目录；
- 由产品负责人手动确认 Windows 临时文件；
- 由产品负责人逐条决定是否调整自启项或卸载闲置软件；
- 继续记录证据和风险。

禁止：

- 删除文件；
- 卸载软件；
- 迁移活跃仓库；
- 批量结束进程；
- 修改功能代码、Release、Cloudflare、模型配置或用户数据；
- 自动进入首屏示例、反馈入口、安全告知、真实用户测试、模型分层、手机端、完整多 Agent 调度或生态扩张；
- 清理浏览器账号/缓存、GitHub/Cloudflare/Windows 凭据、`managed-proxy`、`node_modules`、`release-v0.4.6-installer` 或 verification 正式证据。
