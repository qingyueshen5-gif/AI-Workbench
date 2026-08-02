import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { fixtureInterpreter, taskInterpretations } from './task-interpreter-contract-fixtures.mjs';
import { trustedAuthorizations } from './authorization-context-fixtures.mjs';

class Sessions {
  constructor() { this.states = new Map(); }
  async load(conversationId) { if (!this.states.has(conversationId)) this.states.set(conversationId, { conversationId, originalMessages: [] }); return this.states.get(conversationId); }
  async save(state) { this.states.set(state.conversationId, state); return state; }
  async appendMessage(state, message) { state.originalMessages.push(message); return this.save(state); }
}

const tmp = await fs.mkdtemp(join(os.tmpdir(), 'aiw-runtime-'));
const file = join(tmp, 'NEXT_STEP.md');
await fs.writeFile(file, '<!-- AIW_NEXT_STEP_START -->\nContinue task TEST-1, finish A, then run E.\n<!-- AIW_NEXT_STEP_END -->\n');
const before = await fs.stat(file);

const calls = { read: 0, codex: 0, understand: 0, express: 0 };
const tools = { execute: async (_id, call) => { assert.equal(call.type, 'read_file'); calls.read++; const content = await fs.readFile(call.path, 'utf8'); return { ok: true, results: [{ path: call.path, content, size: Buffer.byteLength(content), sha256: 'hash', currentSha256: 'hash' }] }; } };
const models = {
  understand: async () => { calls.understand++; return { text: JSON.stringify(taskInterpretations.chat('ordinary answer')) }; },
  express: async ({ messages }) => { calls.express++; return { text: String(messages?.[1]?.content || '').includes('Follow-up') ? 'Continue task TEST-1.' : 'final answer' }; },
  execute: async () => { calls.codex++; await new Promise((resolve) => setTimeout(resolve, 35)); return { text: 'code task completed', sessionId: 's' }; }
};
const sessions = new Sessions();
const progress = [];
const interpret = (text) => text.includes('NEXT_STEP.md')
  ? taskInterpretations.fileRead(file)
  : text.includes('状态')
    ? taskInterpretations.runtimeStatus()
    : text.includes('修改代码')
      ? taskInterpretations.code()
      : taskInterpretations.chat();
const make = () => new AgentRuntime({
  root: tmp,
  allowedRoots: [tmp],
  tasks: new TaskStore({ root: join(tmp, `tasks-${Math.random()}`) }),
  sessions,
  models,
  tools,
  verifier: { verifyModelResult: (result) => ({ text: result.text }), verifyCodeResult: () => ({ ok: true }) },
  taskInterpreter: fixtureInterpreter('runtime-business', ({ text }) => interpret(text)),
  onProgress: async (event) => progress.push(event),
  progressOptions: { firstDelayMs: 10, minIntervalMs: 20 }
});

const runtime = make();
let start = Date.now();
const read = await runtime.handle({ messageId: 'read1', originalMessageId: 'read1', conversationId: 'c', chatId: 'c', text: `读取 ${file}，告诉我当前最重要的目标。不要修改文件。` });
const readMs = Date.now() - start;
assert.equal(read.classification.kind, 'new_task');
assert.equal(read.classification.action, 'read');
assert.equal(read.classification.target, file);
assert.equal(read.metrics.readFileCalls, 1);
assert.equal(read.metrics.codexCalls, 0);
assert.equal(calls.read, 1);
assert.equal(calls.codex, 0);
assert.ok(read.evidence.sha256);
const after = await fs.stat(file);
assert.equal(after.mtimeMs, before.mtimeMs);
assert.equal(after.size, before.size);
assert.ok(readMs < 10000);

const f1 = await runtime.handle({ messageId: 'f1', originalMessageId: 'f1', conversationId: 'c', chatId: 'c', text: '这个目标具体是什么意思？' });
const f2 = await runtime.handle({ messageId: 'f2', originalMessageId: 'f2', conversationId: 'c', chatId: 'c', text: '那么下一步是什么？' });
assert.equal(f1.metrics.readFileCalls + f2.metrics.readFileCalls, 0);
assert.equal(f1.metrics.codexCalls + f2.metrics.codexCalls, 0);
assert.equal(calls.read, 1);
assert.equal(calls.codex, 0);

const chatTimes = [];
for (const [i, text] of ['你好', '你能做什么', '谢谢', '请一句话介绍自己', '今天聊点什么'].entries()) {
  start = Date.now();
  const result = await runtime.handle({ messageId: `chat${i}`, originalMessageId: `chat${i}`, conversationId: 'chat', chatId: 'chat', text });
  chatTimes.push(Date.now() - start);
  assert.equal(result.metrics.codexCalls, 0);
  assert.equal(result.metrics.readFileCalls, 0);
}
assert.ok(Math.max(...chatTimes) < 5000);

const stateRoot = await fs.mkdtemp(join(os.tmpdir(), 'aiw-state-'));
const gateway = join(stateRoot, 'gateway.json');
const worker = join(stateRoot, 'worker.json');
await fs.writeFile(gateway, JSON.stringify({ pid: 1, gitCommit: 'g', connectionState: 'healthy' }));
await fs.writeFile(worker, JSON.stringify({ pid: 2, gitCommit: 'r', status: 'online' }));
const grounded = new AgentRuntime({
  root: tmp,
  allowedRoots: [tmp],
  tasks: new TaskStore({ root: join(tmp, 'status-tasks') }),
  sessions: new Sessions(),
  models,
  tools,
  verifier: { verifyModelResult: (result) => ({ text: result.text }) },
  taskInterpreter: fixtureInterpreter('runtime-status', taskInterpretations.runtimeStatus()),
  statePaths: { gateway, runtime: worker }
});
const status = await grounded.handle({ messageId: 'status', conversationId: 's', chatId: 's', text: '当前Gateway、Runtime和任务状态是什么' });
assert.equal(status.provider, 'local-status');
assert.match(status.text, /Gateway PID 1/);
assert.equal(status.metrics.codexCalls, 0);

const complex = await make().handle({ messageId: 'complex', originalMessageId: 'complex', conversationId: 'x', chatId: 'x', openId: 'test-user', text: '修改代码并运行测试', authorizationContexts: trustedAuthorizations({ taskId: 'complex', userId: 'test-user', capabilityIds: ['code.modify','code.execute'] }) });
assert.equal(complex.metrics.codexCalls, 1);
await new Promise((resolve) => setTimeout(resolve, 15));
assert.ok(progress.some((event) => event.jobId === 'complex'));

await fs.rm(tmp, { recursive: true, force: true });
await fs.rm(stateRoot, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, executor: 'local read_file', readFileCalls: calls.read, codexCallsForRead: 0, simpleReadMs: readMs, chatTimesMs: chatTimes, progressGenerated: progress.length > 0, statusGrounded: true }, null, 2));
