# AW-AILINK-ROUTE-AND-REVIEW-001｜AI Link上游路由定性报告

- 核验时间：2026-07-28 22:31–22:35 +08:00
- AI Link版本：0.2.12
- 核验性质：安装包、运行配置和非付费网络路径只读审计
- 新模型生成：未执行
- 最终分类：`functional_but_unmanaged_route`

## 1. 完整请求链

当前workflow creator链路为：

1. AI Link renderer调用`workflow:generate`；
2. Electron IPC进入主进程；
3. `workflow-orchestrator.js`调用`defaultGenerateBlueprint`；
4. 请求发送到`127.0.0.1:18765/v1/chat/completions`，并携带`x-aiw-employee: workflow-creator`；
5. 18765主进程代理从运行Session取得`llmBaseUrl`和虚拟Key；
6. 18765使用Node全局`fetch`向AI Link LLM上游发送HTTPS POST；
7. 当前diagnostics显示上游基础地址为`https://ai-link-llm.lhmxrzs.cn`。

18766是AI Workers员工本机代理，不是workflow creator当前调用入口。

## 2. 安装包和配置证据

### 上游用途和来源

- `runtimeSession.apiBaseUrl`默认指向AI Link业务API域名。
- `runtimeSession.llmBaseUrl`默认指向AI Link LLM域名。
- 登录结果中的`user.litellm.baseUrl`可以覆盖并写入Session；当前diagnostics仍显示AI Link LLM域名。
- 这表明该域名是AI Link控制的模型网关入口，不是客户端直接访问OpenAI、Google或单一Provider的地址。
- 生产环境配置明确使用AI Link业务域名；测试环境只为业务API提供单独地址。

### 代理和分流实现

未发现以下实现：

- `Electron session.setProxy`；
- Chromium `--proxy-server`或`--proxy-bypass-list`命令行参数；
- Node `ProxyAgent`、`EnvHttpProxyAgent`或`setGlobalDispatcher`；
- 逐请求`dispatcher`；
- AI Link LLM域名白名单、显式DIRECT规则或fallback到7890；
- WinINET或WinHTTP API调用；
- 根据OpenAI、Google和AI Link域名进行应用内分流的代码。

代码包含HTTP/HTTPS/ALL_PROXY和NO_PROXY环境变量的清理/传递字段，但没有为当前Node fetch建立明确代理适配。因此不能从代码证明“AI Link自有上游直连、OpenAI等经7890”是产品内设计分流。

### 超时、重试和fallback

- workflow creator到18765的fetch未见显式超时、重试或退避。
- 18765到上游的fetch未见显式超时、重试、备用地址或代理fallback。
- diagnostics有进程内请求统计，但不是持久化路由审计或长期监控。

## 3. 网络属性

只记录必要结果，不在报告中保存完整公网地址清单。

- AI Link业务域名和LLM域名当前解析到同一服务地址。
- 外部只读地理查询将当前服务地址识别为韩国首尔、腾讯相关网络；该第三方定位仅作网络属性线索，不是服务设计权威声明。
- 直连TCP 443成功。
- 直连TLS成功，TLS 1.3。
- 证书为`lhmxrzs.cn`通配证书，SAN覆盖AI Link LLM子域名，验证结果正常。
- 直连公开根路径返回HTTP 200。
- 经`127.0.0.1:7890`访问相同根路径也返回HTTP 200。
- 两条路径的服务端标识和内容类型一致，没有观察到证书、SNI或HTTP状态差异。
- curl强制直连样本约155ms；经7890样本约135ms。单样本不能代表长期质量。
- Python直连样本明显更慢，但仍成功；说明路径性能可能随客户端实现和网络条件变化。
- 没有证据表明该域名必须经过国外代理才能使用。

## 4. 路由定性

最终分类：`functional_but_unmanaged_route`

理由：

1. 该域名明确是AI Link登录Session下发/默认配置的自有LLM网关，当前直连和7890路径均可用；
2. 当前主进程使用普通Node fetch，没有显式要求经过7890；因此“不连接7890”本身不是故障；
3. 但安装包中没有明确DIRECT策略、域名分流表、路由监控、超时/重试或失败时代理fallback；
4. 没有权威产品文档或代码注释明确声明此域名必须直连；
5. 也没有产品内证据证明OpenAI/Google由AI Link客户端经7890，而AI Link自有上游直连。

因此当前路径可工作，但属于缺少明确治理和可观测性的直连，而不是已经得到充分证明的`expected_direct_route`或`expected_split_route`。

## 5. 是否预期经过7890

结论：**当前代码没有要求AI Link LLM上游经过7890；也没有证据证明7890是该上游的必经路径。**

7890仍可能被系统、环境或其他应用用于OpenAI、Google等受限目标，但AI Link v0.2.12没有实现可审计的应用级分流契约。

## 6. 原网络与手机热点差异

理论上可能有差异，影响因素包括：

- DNS解析和缓存；
- 运营商、路由器与国际出口路径；
- TCP/TLS时延和丢包；
- 本地代理节点和分流规则；
- Node fetch连接复用和超时表现。

本轮没有切换网络，不把理论差异写成已确认根因。热点改善仍为`correlated_but_unconfirmed`。

## 7. 尚未确认

- AI Link官方是否有未打包进客户端的路由设计文档；
- 服务端是否按地区或账号动态下发其他`llmBaseUrl`；
- 失败时是否存在服务端侧路由或Provider fallback；
- 原Wi-Fi和手机热点在同一时段的真实对照；
- 长时间直连可用率、延迟、丢包和连接重置率；
- 历史`fetch failed`的唯一责任点。

## 8. 结论影响

- 不应再以“AI Link主进程未连接7890”为由阻塞现有版本3方案审查或要求重新生成。
- `PROXY-001`从“单次生成硬阻塞”调整为长期路由治理和可观测性任务。
- 当前不执行生成；已有版本3方案应独立按内容审查。
