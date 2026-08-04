# 复合意图旁路精确文案断言存档

```text
status=SUPERSEDED_BY_BEHAVIORAL_ASSERTION
source=scripts/verify-interpreter-adapter-bypass-001.mjs
originalLine=41 at baseline 7a3ae26e5aa8badc37d792506d5d84ce2b2f753c
```

## 原断言原文

```js
await verify(
  '读一下 E:\\AI-Workbench\\NEXT_STEP.md，然后看看 Runtime 正不正常',
  'clarify',
  {textIncludes:/两个任务/}
);
```

辅助函数中的原执行方式：

```js
if(extra.textIncludes)assert.match(result.text,extra.textIncludes);
```

## 原测试目的

确认复合文件读取与Runtime状态请求不会执行任一任务，而是返回`clarify`，并向用户说明需要在多个任务之间作出选择。

## 为什么精确措辞断言不稳定

`/两个任务/`绑定的是某一版表达层文案，而不是安全行为。现行批准文案使用“多个任务”，并新增“尚未启动任何操作”和“可拆成两条消息”等安全通知；产品行为更完整，但旧正则仍会失败。

表达层可以在不改变协议和安全边界的前提下调整，因此测试不能依赖：

```text
两个任务
多个任务
我识别到
请指定先执行哪一个
```

## 新行为断言如何保留安全语义

新测试直接验证：

- `decision=clarify`；
- Task、Run、Scheduler、Provider、Model均为0；
- `missingFields`包含`selectedIntent`；
- `questions`非空；
- `recognizedIntents`完整等于`['读取文件','检查Runtime状态']`；
- 用户通知包含“一次只执行一个任务”的语义；
- 用户通知包含“尚未启动任何操作”的语义；
- 用户通知要求选择优先任务或拆分消息；
- `executionStarted=false`；
- `messageReplayed=false`且`taskReplayed=false`；
- 首次仅追加一条assistant消息；
- 不产生成功业务Task Final。

未修改Adapter决策逻辑、用户文案、执行路径、taskType、Capability或Allowlist。
