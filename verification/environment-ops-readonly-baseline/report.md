# AW-ENV-BASELINE-001｜Environment Ops 只读运行环境基线

- 任务：`AW-ENV-BASELINE-001`
- 观察开始：2026-07-28 20:45:19 +08:00
- 稳定性观察：2026-07-28 20:53:08 至 21:23:25 +08:00（30分17秒，7个样本，约每5分钟一次）
- 报告完成：2026-07-28 21:23 +08:00 后
- 范围：只读采集与纯文档更新
- 总体结论：当前桌面、本地服务、代理监听、飞书客户端和所测链路在30分钟窗口内保持可用，但网络明显依赖路由/代理，AI Link UI与Session未能通过只读桌面树完整验证，故不得写成永久修复或根因已确认。

## 1. 电脑与操作系统基线

| 项目 | 结果 |
| --- | --- |
| Windows | Windows 11 家庭中文版，10.0.26200，build 26200，64-bit |
| 登录会话 | Console，interactive=true |
| CPU | Intel Core i7-1165G7，8逻辑处理器 |
| 内存 | 16,705,122,304 bytes；采样时可用 4,576,518,144 bytes |
| 磁盘 | C: 34,783,879,168 bytes free；D: 18,411,638,784；F: 1,704,436,432,896 |
| 启动时间 | 2026-07-27 21:24:45 +08:00 |
| 采样时运行时间 | 84,188秒（约23小时23分） |
| 活跃适配器 | WLAN / Intel Wi-Fi 6 AX201 160MHz，780 Mbps |
| Wi-Fi状态 | connected，5 GHz，信号93%；SSID与硬件身份不写入报告 |
| 默认网关 | 192.168.1.1 |
| DNS | 路由器IPv6地址，以及 8.8.8.8、1.1.1.1 |
| 时区 | China Standard Time / UTC+08:00 |
| 时间同步 | W32Time Running；最近成功同步 2026-07-28 14:07:16，源 time.windows.com |

结论：L1没有发现资源耗尽或时间服务停止证据；D盘余量相对较低但不构成本轮即时故障证据。

## 2. AI Link 进程、端口与本地健康

- 安装版本：AI Link 0.2.12。
- 可执行路径：用户本地 Programs 下的 `ai-link-desktop/AI Link.exe`（报告不记录用户名）。
- 进程族：4个同路径 Electron 进程；父主进程 PID 33972，3个子进程 PID 29376、24180、29048。
- 4个进程启动时间集中在 2026-07-28 19:24:57–19:24:58 +08:00；这是一个Electron进程族，不是已证明的两个独立主实例。
- 主进程父进程为 Windows shell；子进程父进程均为主进程。
- 18765：127.0.0.1监听，归属主进程；`/health` HTTP 200，`status=ok`、`provider=gateway`。
- 18766：0.0.0.0监听，归属主进程；`/health` HTTP 200，`status=ok`、`running=true`、`lastError=null`。
- 当前工作流目录数/`workflow.json`数：2/2；本轮未创建工作流。
- 30分钟内PID、启动时间和端口拥有者未变化，没有自动重启或新增主实例证据。
- 用户数据目录存在，`secure-session.json`存在且内容为加密封装；未读取或输出认证正文。
- 没有发现独立AI Link文本日志目录。对用户数据目录的只读关键词扫描只在历史Codex配置备份中命中“proxy”等配置词，未发现可归因于当前窗口的 `fetch failed`、`ECONNRESET`、`socket hang up`、WebSocket断线、DNS或TLS故障日志。

## 3. UI 与 Session

- Windows进程API持续显示一个标题为“AI Link”的主窗口，进程 `Responding=true`。
- 由于该Electron窗口未稳定暴露给只读UI Automation窗口枚举，无法在不激活、不点击的边界内完成页面内容和“可交互”验证。
- `secure-session.json`存在且为加密内容，只能证明持久Session封装存在，不能证明当前认证一定有效。
- 因此：UI=`unverified`；登录Session=`unverified`。不得根据本地health或文件存在推断登录有效。

## 4. 代理基线

| 项目 | 结果 |
| --- | --- |
| 127.0.0.1:7890 | 持续监听，归属 `binglingCore` |
| WinINET系统代理 | enabled，`127.0.0.1:7890` |
| 本地地址排除 | 包含 localhost、`.local`、127.*、10.*、172.16–31.*、192.168.* |
| 环境变量 | `http_proxy`、`https_proxy`存在并指向本地7890；`ALL_PROXY`、`NO_PROXY`未设置 |
| WinHTTP | Direct access，无代理 |
| AI Link启动参数 | 未发现 `--proxy-server`、`--proxy-bypass-list`、`--proxy-pac-url` |
| Electron主进程Node代理 | 是否继承环境变量或配置dispatcher仍为 `unverified` |
| 出口地区 | 只读公开查询返回 United Kingdom / GB；未保存完整IP |
| 代理模式 | GUI未能通过只读窗口树识别，`unknown` |
| 观察期变化 | 7890 PID与监听保持不变，没有观察到重启或切换证据 |

结论：代理在监听且系统/进程环境存在代理入口，但AI Link主进程Node fetch是否实际使用代理仍未验证。WinINET、WinHTTP、环境变量三套口径不一致。

## 5. 网络分层非付费探测

所有探测均为公开GET/连接测试，不使用API Key，不调用付费模型。

| 目标 | DNS | 直连TCP/TLS | 直连HTTP | 经7890 HTTP | 判定 |
| --- | --- | --- | --- | --- | --- |
| 127.0.0.1:18765/health | 成功 | TCP成功 | 200，TTFB约2ms | 200 | 本地回环可达 |
| 127.0.0.1:18766/health | 成功 | TCP成功 | 200，TTFB约2ms | 200 | 本地回环可达 |
| 默认网关192.168.1.1:80 | 不适用 | TCP成功约2ms | 未做管理页请求 | 未做 | 网关可达 |
| 百度HTTPS | 成功 | TCP/TLS成功 | 200，TTFB约123ms | 200，约111ms | 国内链路可达 |
| 飞书公开站点 | 成功 | TCP/TLS成功 | 200，TTFB约226ms | 200，约382ms | 飞书公开HTTPS可达 |
| Google generate_204 | 成功 | 直连TCP超时 | 超时，HTTP 000 | 204，约1.15s | 依赖代理 |
| OpenAI `/v1/models` | 成功 | 直连TCP超时 | 超时，HTTP 000 | 401，约1.27s | 经代理到达服务端；认证未验证 |
| Anthropic `/v1/models` | 成功 | TCP/TLS成功 | 403，约1.10s | 401，约1.26s | 直连与代理均到达服务端；认证未验证 |
| AI Link Web域名 | 成功 | TCP/TLS成功 | 404，约151ms | 404，约122ms | 服务端可达，根路径不存在不等于失败 |
| AI Link LLM域名 | 成功 | TCP/TLS成功 | 200，约147ms | 200，约372ms | 直连与代理均可达 |

注意：401/403/404证明DNS、TCP、TLS与HTTP链路到达服务端，不证明认证、业务接口或付费生成可用。OpenAI直连和Google直连超时，而代理路径成功，构成明确的route dependence证据。

## 6. 飞书连接

- 飞书主窗口存在、进程响应正常；观察期间有10个同一客户端进程，属于多进程桌面应用形态。
- 观察的7个样本中，飞书Established TCP连接数为4、4、6、4、6、6、5，始终大于0。
- 当前连接既存在远端443，也存在到本地7890的连接，说明至少部分飞书流量可能经过代理；不能仅凭端口判断具体长连接类型。
- 飞书窗口在观察结束时出现新消息提示，说明客户端当时仍在接收数据；本轮没有发送消息。
- 未取得可安全归因的“最近断线/最近重连”时间。历史网络诊断日志在2026-07-27 20:13记录过 `ERR_PROXY_CONNECTION_FAILED`，但该日志不是本轮观察期事件。
- 本轮30分钟未观察到飞书进程消失或所有Established TCP归零；没有自然网络/代理切换。

判定：当前连接活跃，但长连接协议、精确在线状态、最近断线和重连时间仍为 `unverified`。

## 7. 30分钟稳定性时间线

| 时间 (+08:00) | AI Link进程/PID | 18765/18766 | health | AI窗口 | 7890 | 飞书TCP | 网络 | 异常 |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 20:53:08 | 4，固定PID组 | 同一主PID | 200/200 | Responding | 同一代理PID | 4 | WLAN | 无 |
| 20:58:13 | 不变 | 不变 | 200/200 | Responding | 不变 | 4 | WLAN | 无 |
| 21:03:16 | 不变 | 不变 | 200/200 | Responding | 不变 | 6 | WLAN | 无 |
| 21:08:18 | 不变 | 不变 | 200/200 | Responding | 不变 | 4 | WLAN | 无 |
| 21:13:20 | 不变 | 不变 | 200/200 | Responding | 不变 | 6 | WLAN | 无 |
| 21:18:23 | 不变 | 不变 | 200/200 | Responding | 不变 | 6 | WLAN | 无 |
| 21:23:25 | 不变 | 不变 | 200/200 | Responding | 不变 | 5 | WLAN | 无 |

观察期未发现：AI Link重启、额外主实例、端口换主、health失败、7890重启、飞书TCP全断、自然网络切换。由于没有可靠AI Link运行日志和UI内容快照，`fetch failed`、Session失效、WebSocket断线、是否需要人工刷新只能标为 `not_observed_but_partially_unverifiable`。

## 8. 八层状态矩阵

| 层 | 状态 | 依据 |
| --- | --- | --- |
| L1 电脑与操作系统 | `healthy` | 资源、适配器、网关、时区、时间服务可用；观察期无OS级异常 |
| L2 本地进程和端口 | `healthy` | 一个主进程族，PID和端口30分钟稳定；历史重复实例风险仍保留在问题总表 |
| L3 网络 | `route_dependent` | 国内与AI Link直连可达；Google/OpenAI直连超时、代理可达 |
| L4 代理 | `application_proxy_mismatch` | 7890监听；WinINET/环境变量有代理，WinHTTP直连，AI Link Node显式代理未验证 |
| L5 AI Link后台 | `healthy` | 18765/18766持续200且端口归属稳定 |
| L6 AI Link桌面端和Session | `unknown` | 窗口Responding但页面内容与Session无法只读完整验证 |
| L7 飞书连接 | `healthy` | 客户端响应、持续存在Established TCP且观察期未归零；精确长连接状态仍未验证 |
| L8 国外Provider可达性 | `partially_reachable` | OpenAI仅代理可达401；Anthropic直连/代理均到服务端；认证与计费未测试 |

## 9. 已确认事实

1. AI Link版本为0.2.12，当前只有一个主进程族，4个Electron进程并不等于4个独立实例。
2. 18765和18766均归属AI Link主进程并持续健康。
3. 7890由本地代理核心持续监听；系统WinINET代理启用。
4. 本地/私网地址已在WinINET排除列表中，但环境变量没有`NO_PROXY`。
5. WinHTTP为直连；AI Link无显式代理启动参数。
6. OpenAI和Google的直连路径在本次探测中超时，代理路径到达服务端。
7. Anthropic、AI Link域名、国内HTTPS和飞书公开HTTPS在本次探测中到达服务端。
8. 30分钟内没有AI Link重启、端口换主、7890重启或飞书TCP全断。
9. 当前工作流数量为2，本轮没有创建工作流、员工或群。
10. 本轮没有API Key请求、付费生成、环境配置修改、产品代码修改或部署。

## 10. 仍未确认的假设

- AI Link主进程Node fetch是否实际继承`http_proxy`/`https_proxy`，以及是否使用Undici dispatcher。
- 代理软件当前模式、节点及规则细节；仅确认出口地区为英国。
- AI Link UI页面内容、可交互性和登录Session有效性。
- 飞书AI Link绑定的精确在线状态、WebSocket类型、最近断线和重连时间。
- 2026-07-27故障的最终责任点，以及热点改善是否仅由网络入口变化导致。
- 日志缺失是产品未持久化、目录未找到，还是日志只在内存/控制台。
- 当前认证、Billing和付费模型生成是否可用；本轮没有也不得验证。

## 11. 热点线索判定

判定：`correlated_but_unconfirmed`。

原因：历史上切换热点后表现改善是真实相关性，但本轮未获批准切换网络做对照；当前Wi-Fi窗口内稳定，不能据此确认根因。未来对照测试必须保持同一电脑、同一代理节点、同一AI Link版本、同一时间窗口，仅改变网络入口，并分别比较DNS、延迟、丢包、TLS和断线率。

## 12. 当前是否可安全执行一次付费生成

结论：**否 / blocked**。

虽然后台和所测链路在30分钟内稳定，但以下Preflight关键项未闭环：AI Link UI与Session未验证；Electron/Node实际代理路径未验证；幂等提交和重复费用保护尚未验收；飞书精确连接状态未验证。因此不得用“当前可达”代替付费任务安全门。

## 13. 后续独立修复任务草案

| Task ID | 问题与证据 | 风险 | 阻塞工作群 | 优先级 | 修复范围 | 验收标准 | 需审批 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AW-ENV-FIX-PROXY-001 | Node/Electron代理路径不明确；OpenAI/Google直连超时而代理可达 | 生成失败、误重试 | 是 | P0 | Electron main/Undici显式代理、错误cause | 直连/代理矩阵通过，记录实际路由，本地地址直连 | 是 |
| AW-ENV-FIX-ROUTING-001 | WinINET有排除，但环境变量无NO_PROXY；国内外路径差异明显 | 国内服务受国外代理拖累 | 是 | P0 | NO_PROXY、本地/国内/国外分流 | 本地、飞书、国内、国外故障互不传染 | 是 |
| AW-ENV-FIX-IDEMPOTENCY-001 | 付费生成缺少已验收幂等与费用对账 | 重复费用、部分成功 | 是 | P0 | request ID、幂等键、账单/落盘对账 | 双击、超时、断线只产生一个付费请求 | 是 |
| AW-ENV-FIX-CHECKPOINT-001 | 网络抖动下草稿、检查点和续跑未验收 | 草稿丢失、重复生成 | 是 | P0 | 草稿持久化、事务检查点、续跑 | 崩溃/断网注入后可从明确检查点恢复 | 是 |
| AW-ENV-FIX-PREFLIGHT-001 | 当前检查依赖人工且部分状态不可观测 | 误放行付费任务 | 是 | P0 | Environment Ops自动只读Preflight | 12项逐层结果、失败fail-closed、无付费副作用 | 是 |
| AW-ENV-FIX-SINGLETON-001 | 历史发生重复主实例；本轮只证明当前稳定 | 端口争用、空壳 | 是 | P1 | 单实例锁、端口/更新竞争保护 | 启退/网络切换20轮仅一个主实例 | 是 |
| AW-ENV-FIX-READINESS-001 | 后台健康但UI/Session不可统一验证 | 假健康、用户误判 | 是 | P1 | UI/backend/Session/channel readiness状态机 | 任一层异常可解释且health不掩盖UI/Session失败 | 是 |
| AW-ENV-FIX-FEISHU-001 | 飞书有活跃连接但协议和重连状态不可观测 | 静默断线 | 是 | P1 | 心跳、重连、状态解释、时间线 | 断网/代理故障后自动重连且状态时间可查 | 是 |
| AW-ENV-FIX-LOGGING-001 | 未发现可归因AI Link持久运行日志 | 根因无法复盘 | 是 | P1 | 脱敏结构化main/renderer/network/channel日志 | fetch/timeout/DNS/TLS/proxy/WS保留阶段和request ID | 是 |
| AW-ENV-TEST-ROUTE-001 | 热点改善仅相关未确认 | 根因误判 | 是 | P1 | Wi-Fi/热点受控对照 | 变量受控，各30分钟，输出DNS/延迟/丢包/TLS/断线率 | 是 |
| AW-ACCOUNT-RECOVERY-001 | 海外账号恢复依赖仍未审计 | 账号丢失 | 否 | P1 | 恢复方式、备份因子、责任归属 | 无单手机号单点，恢复演练留证据 | 是 |
| AW-ACCOUNT-PHONE-001 | 海外手机号长期控制方案未定 | 恢复或验证失效 | 否 | P2 | 合规长期号码方案调研 | 所有权、续费、地区、恢复和退出条件明确 | 是 |
| AW-PAYMENT-BASELINE-001 | OpenAI/Anthropic官方API Billing未验证 | 付款失败或超支 | 否 | P2 | 官方账户、地区、支付、预算基线 | 独立Billing、预算、Key隔离和小额验证方案获批 | 是 |

工作群创建阻塞任务：前十项中除账号/支付三项外，尤其 `PROXY-001`、`ROUTING-001`、`IDEMPOTENCY-001`、`CHECKPOINT-001`、`PREFLIGHT-001`、`SINGLETON-001`、`READINESS-001`、`FEISHU-001`、`LOGGING-001`、`ROUTE-001` 均应在受控生成和工作群创建前完成或由产品负责人明确接受剩余风险。

## 14. Git基线

- 开始分支：main。
- 开始HEAD与origin/main：`2292dc7638aa1baf4596b716d80cc2aca86eea04`。
- 该提交包含并等于上一阶段验收提交。
- 开始前已有未跟踪目录：`verification/windows-environment-recovery-20260727/`；本轮不修改、不删除、不纳入提交。
- 诊断期间没有产品代码或运行配置diff；后续仅提交本报告、summary和权威文档更新。
