# Clean Machine Readiness Report

## 外部环境假设与兜底状态

- Node 运行时：开发态依赖当前 Node；安装版由 Electron 自带运行时拉起内部服务。缺失或脚本不存在时，主窗口加载中文降级页，不白屏。
- 共享 key 入口：18800 服务端支持共享托管 key 兜底；用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`。前端和员工配置只使用本机占位 token，不暴露真实 key。
- 端口：18800 是模型代理，8787 是工作台核心服务，5173 是开发预览端口。端口被占用或不可达时统一显示中文未就绪状态，不向用户展示堆栈。
- 路径：运行数据使用 `AI_WORKBENCH_RUNTIME_DIR` / `%APPDATA%\ai-workbench` / 用户主目录兜底，自动创建 config、data、logs、evidence 目录；仓库不依赖开发机用户名绝对路径。
- 员工二进制：Hermes、OpenClaw 在干净机器上可能不存在；系统按“员工未就绪”降级，主程序和核心对话入口仍打开。
- 网络：模型上游、127.0.0.1 服务或外网不可达时归一成中文网络/服务不可用说明，并保留本地界面。

## 人工验收边界

真机试装由产品负责人在另一台干净 Windows 上执行；本脚本只覆盖 a-e 自动验收。
