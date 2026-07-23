# ③A 总验收报告

- 总状态：passed
- 候选包：AI-Workbench-Setup-v0.4.6-x64.exe
- 大小：111524004
- SHA256：b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9
- Actions Run：30001627121
- Worker URL：https://ai-workbench-managed-proxy.qingyueshen5.workers.dev

## 检查项
- passed: install - {"exitCode":0,"installedExeExists":true,"uninstallerExists":true,"desktopShortcut":{"path":"C:\\\\Users\\\\胖胖虎\\\\Desktop\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"},"startShortcut":{"path":"C:\\\\Users\\\\胖胖虎\\\\AppData\\\\Roaming\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"}}
- passed: shortcuts - {"desktop":{"path":"C:\\\\Users\\\\胖胖虎\\\\Desktop\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"},"start":{"path":"C:\\\\Users\\\\胖胖虎\\\\AppData\\\\Roaming\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"}}
- passed: startup_api - http_status=200
- passed: credential_source - managed_remote
- passed: no_local_keys - DEEPSEEK_API_KEY/AIW_SHARED_DEEPSEEK_API_KEY/MODEL_PROXY_SHARED_API_KEY cleared in verifier environment
- passed: dependency_chinese_degrade - readiness=ready, simulated=degraded
- passed: production_dialogue - http_status=200, reply=③A总验收通过
- passed: hermes_openclaw_loopback_only - adapters configure MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1 and local placeholder tokens; see agents/adapters/hermes.mjs and agents/adapters/openclaw.mjs
- passed: security_scan - source=0, installer=0, installDir_actionable=0, installDir_third_party_runtime=3, runtime=0, processArgs=passed
- passed: uninstall - {"attempted":true,"exitCode":0,"installDirExists":false,"installedExeExists":false,"desktopShortcutExists":false,"startShortcutExists":false}
- passed: restore_daily_install - {"exitCode":0,"installedExeExists":true,"uninstallerExists":true,"desktopShortcut":{"path":"C:\\\\Users\\\\胖胖虎\\\\Desktop\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"},"startShortcut":{"path":"C:\\\\Users\\\\胖胖虎\\\\AppData\\\\Roaming\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\AI Workbench.lnk","target":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench\\AI Workbench.exe","workingDirectory":"C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AIWorkbench"}}

## 结论

③A 总验收本机安装、启动、生产对话、中文降级、安全扫描、卸载和恢复安装版均已通过。
