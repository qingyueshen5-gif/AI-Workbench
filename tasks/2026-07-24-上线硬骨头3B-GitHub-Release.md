# 上线硬骨头3B-GitHub-Release

## 做了什么

- 基于 ③A 验收提交 `dbe48d6f29a4fbea02370fe699ed4e7ff837f38b` 创建 annotated tag `v0.4.6` 并推送到 origin。
- 创建 GitHub prerelease：`AI Workbench v0.4.6 Alpha`。
- 上传 ③A 验收通过的安装包和 SHA256 校验文件。
- 从公开 Release 下载链接重新下载安装包和 `.sha256` 文件，完成大小和 SHA256 回测。

## 为什么这样做

③A 已证明候选安装包能安装、启动、通过 Managed Proxy 完成生产模型调用、中文降级、安全扫描和卸载。③B 的目标不是改功能，而是把准确的验收包变成公开 Alpha 下载入口，并证明公开下载资产与 ③A 候选包完全一致。

## 验收结果

- 状态：passed。
- Release URL：https://github.com/qingyueshen5-gif/AI-Workbench/releases/tag/v0.4.6
- 安装包 URL：https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe
- SHA256 文件 URL：https://github.com/qingyueshen5-gif/AI-Workbench/releases/download/v0.4.6/AI-Workbench-Setup-v0.4.6-x64.exe.sha256
- 安装包大小：111524004 bytes。
- 安装包 SHA256：`b8de2e3f90c0063b8b3003c09de0b0886cc1861f4e8091df5f09994bdf6573f9`。
- 下载回测：passed。

## 下次改进

- 下一任务进入产品方向收口与首批用户准备。
- 不在本任务中继续修改功能代码、UI、模型分层、手机端或多 Agent 调度。
