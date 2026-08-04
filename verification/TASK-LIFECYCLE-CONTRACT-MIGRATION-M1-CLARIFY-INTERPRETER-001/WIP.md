# M1 CQ-001 首失败记录

```text
task=TASK-LIFECYCLE-CONTRACT-MIGRATION-M1-CLARIFY-INTERPRETER-001
stage=CQ-001
status=WIP_NOT_GATED
classification=PRODUCT_OR_SECURITY_FAILURE
```

## 已完成但尚未通过的成果

- 新建`verify-non-execution-clarify-contract-001.mjs`；
- 存档CQ-001历史断言；
- 补全多轮澄清技术债登记；
- 未修改任何生产代码；
- 未进入CQ-002、CQ-003或M2—M4。

## 首失败

命令：

```text
node --check scripts/verify-non-execution-clarify-contract-001.mjs
node scripts/verify-non-execution-clarify-contract-001.mjs
```

语法检查通过，专项执行退出`1`。

失败场景：

```text
输入=读一下文件，然后检查 Runtime
期望decision=clarify
实际decision=execute
实际taskDraft.requiredCapabilities=[runtime.status]
```

Fail-closed Fixture在Runtime尝试创建Task时抛出：

```text
clarify must not create Task
```

## 精确原因

`InterpreterAdapter`当前file-read意图正则包含：

```text
读取
打开并读取
只读
查看
看一下
看下
看看
read
open
```

但不识别输入中的：

```text
读一下文件
```

因此：

```text
hasRead=false
hasRuntime=true
compound=false
→ runtime.status execute
→ 创建业务Task
```

这违反本轮已批准的CQ-001复合意图契约：复合文件读取与Runtime状态请求必须`clarify`且Task=0。

## 处置

按照任务硬停止规则，`PRODUCT_OR_SECURITY_FAILURE`发生后：

- 未修改生产Adapter；
- 未降低或改写专项断言；
- 未开始CQ-002；
- 未开始CQ-003；
- 未开始M2、M3、M4；
- 当前成果以WIP Checkpoint保存。
