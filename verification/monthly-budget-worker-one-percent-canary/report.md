# 第 3B-2b2c 段 1% 生产灰度报告

## 结论

- 执行状态：`one_percent_canary_observation_limited_by_low_traffic`
- 新 active deployment：`55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`
- 旧稳定 version：`16333442-925a-4b11-a3d1-d6249d2492ba`，99% 正常生产流量
- 新预算 version：`483e4fae-3af8-40fa-ab83-4551f08b519e`，1% 正常生产流量
- 主动观察 20 分钟和指标缓冲 5 分钟已完成。
- 生产 `/health` 11 次检查均 HTTP 200；生产 `/v1/models` 11 次检查均 HTTP 200。
- version override 指向新预算 version 的无付费 GET 检查通过。
- 未主动发起真实模型调用，未使用真实安装 Token，未注册 installation。
- Secrets 未修改，D1 schema 未修改，Managed Proxy 功能代码未修改。
- 预算表灰度前后仍为 0 行、0 预留。
- 未触发回滚。

## 可信度限制

本轮没有确认到自然生产流量落到新预算 version。Wrangler tail 已建立，但 4.113.0 拒绝 `--sampling-rate 1`，实际使用 `0.999`；tail 在观察窗口内未向捕获文件输出 JSON 事件。因此不能写成“已通过真实用户流量验证”，只能写成 1% deployment 正确、健康检查正常、version override 正常、未观察到错误事件。

## 开始前状态

- 仓库：clean，HEAD=origin/main=`06933e9958621e7a5a1c05a390a4f168290daa33`
- `06933e9` 是当前 HEAD 的祖先。
- `06933e9..HEAD -- managed-proxy` 无差异。
- `git fetch origin --prune` 因 `SEC_E_NO_CREDENTIALS` 失败；未修改凭据。
- active deployment：`063b83c3-974f-43fb-84f2-9da0d574f745`
- 旧稳定 version：100%
- 新预算 version：0%
- 两张预算表：0 行、0 预留

## 灰度执行

dry-run 确认只包含两个 version：

- 旧稳定 version：99%
- 新预算 version：1%

随后执行 `wrangler versions deploy`，没有使用普通 `wrangler deploy`，没有上传新 version，没有修改 Secrets、D1 schema、routes、domains 或 triggers。

## 观察结果

快照点：T+0、T+2、T+5、T+10、T+15、T+20、T+25-final。

所有快照均显示：

- active deployment：`55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`
- 旧稳定 version：99%
- 新预算 version：1%
- `/health`：HTTP 200
- `/v1/models`：HTTP 200
- 预算表：0 行、0 预留
- candidate error tail：无事件

## 回滚判断

未触发回滚条件：

- 流量比例始终为 99% / 1%
- 没有第三个 version 承载流量
- 健康检查无失败
- 未观察到新 version runtime error
- Secrets 名称集合未变
- D1 schema 未变
- 预算表可查询且结构正常

回滚命令已核对，旧稳定 version 仍可作为回滚目标。

## 边界

新预算 Worker 当前仅承载 1% 正常生产流量。生产钱包刹车尚未全量，不得写成全面上线或完整真实模型预算链路验证通过。
