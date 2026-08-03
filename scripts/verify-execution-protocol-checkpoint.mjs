import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const protocol = await readFile('EXECUTION_PROTOCOL.md', 'utf8');
const required = [
  '测试 `PASS` 与 Git 保存是两个独立状态',
  '每个节点通过即提交，不得等待整个工作包结束',
  '未提交的 `PASS` 成果存在时禁止 reset/clean',
  '“工作区干净”不是允许清理的唯一依据',
  '测试基础设施失败或无关回归失败不得删除已通过的生产实现',
  '绕过保护器属于 `Deployment BLOCKED`',
  '禁止直接执行 `git reset --hard`、`git clean -fd` 或任何 `resetHard` 等价路径', // CHECKPOINT_PROTECTION_FIXTURE
  '`scripts/git-guard.mjs` 是唯一 guarded reset/clean 入口',
  '机器可读 `PASS` manifest',
  '仓库外 `git format-patch`',
  'SHA-256',
  '`saved: true`',
  'scope allowlist',
  '专项测试失败时必须保留实现，不得 reset/clean'
];
for (const text of required) assert.ok(protocol.includes(text), `EXECUTION_PROTOCOL missing hard rule: ${text}`);
console.log(JSON.stringify({ ok: true, module: 'CHECKPOINT-PROTECTION-001', protocolRules: required.length }));
