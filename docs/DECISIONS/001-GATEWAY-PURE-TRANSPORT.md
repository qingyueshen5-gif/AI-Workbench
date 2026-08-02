# ADR 001 — Gateway Pure Transport

- **状态：** Accepted / Frozen in stable-single-agent-v1

## 为什么这样设计

Gateway只处理连接、幂等、IPC入队、进度和Result投递。

## 解决了什么问题

消除Gateway缓存业务语义导致Runtime升级不生效和跨层调用。

## 权衡

业务判断集中到Runtime，代价是Gateway必须依赖稳定IPC契约。

## 后续是否允许修改

除重大架构缺陷外禁止修改；任何变更需Architecture Gate。
