import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskInterpreter } from '../agents/task-interpreter.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { ContractSessionStore, ContractToolExecutor, ContractModelRouter, ContractTaskInterpreter } from './runtime-dependency-contract-fixtures.mjs';
import { CapabilityRegistry } from '../capabilities/capability-registry.mjs';
import { CapabilityScheduler } from '../capabilities/capability-scheduler.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-task-lifecycle-'));
const taskRoot = join(root, 'tasks');
const file = join(root, 'NEXT_STEP.md');
await fs.writeFile(file, '<!-- AIW_NEXT_STEP_START -->\nTASK-LIFECYCLE-001 matrix goal\n<!-- AIW_NEXT_STEP_END -->\n', 'utf8');

const chat = (goal = 'answer user') => ({ taskType: 'chat', goal, actions: ['answer'], targets: [], context: {}, constraints: [], riskLevel: 'low', requiredCapabilities: [], successCriteria: ['non-empty answer'], requiresConfirmation: false, confidence: 0.99 });
const clarification = () => ({ taskType: 'clarification', goal: 'clarify target', actions: [], targets: [], context: { missingFields: ['target'], questions: ['Which target should I use?'] }, constraints: [], riskLevel: 'low', requiredCapabilities: [], successCriteria: ['user supplies target'], requiresConfirmation: false, confidence: 0.4 });
const fileRead = () => ({ taskType: 'file_operation', goal: 'read file', actions: ['read'], targets: [{ type: 'file', path: file }], context: { absolutePath: file }, constraints: ['read only'], riskLevel: 'low', requiredCapabilities: ['file.read'], successCriteria: ['file read evidence'], requiresConfirmation: false, confidence: 0.99 });
const confirmation = () => ({ taskType: 'commerce', goal: 'place order', actions: ['pay'], targets: [{ type: 'order' }], context: {}, constraints: [], riskLevel: 'high', requiredCapabilities: ['commerce.payment'], successCriteria: ['confirmation first'], requiresConfirmation: true, confidence: 0.95 });
const unavailable = () => ({ taskType: 'media_creation', goal: 'create video', actions: ['create'], targets: [{ type: 'video' }], context: {}, constraints: [], riskLevel: 'low', requiredCapabilities: ['media.video.create'], successCriteria: ['video exists'], requiresConfirmation: false, confidence: 0.95 });
const code = () => ({ taskType: 'code_task', goal: 'modify code', actions: ['modify', 'test'], targets: [{ type: 'project', path: root }], context: { scope: 'controlled_test' }, constraints: [], riskLevel: 'medium', requiredCapabilities: ['code.read', 'code.modify', 'code.execute'], successCriteria: ['tests pass'], requiresConfirmation: false, confidence: 0.96 });
const processStop = () => ({ taskType: 'computer_operation', goal: 'stop controlled process', actions: ['stop'], targets: [{ type: 'process', pid: 12345, name: 'controlled' }], context: { scope: 'controlled_test' }, constraints: ['exact pid only'], riskLevel: 'medium', requiredCapabilities: ['process.list', 'process.stop'], successCriteria: ['pid absent'], requiresConfirmation: false, confidence: 0.98 });

function makeModels(extra = {}) {
  return new ContractModelRouter({
    understand: extra.understand || (async () => ({ text: JSON.stringify(chat()) })),
    express: extra.express || (async () => ({ text: 'final answer' })),
    execute: extra.execute || (async () => ({ text: 'code execution evidence', sessionId: 'codex-session' })),
    healthCheck: async () => ({ ok: true, deepseek: { ok: true }, codex: { ok: true, authClass: 'chatgpt_subscription' } })
  });
}

function makeTools() {
  return new ContractToolExecutor(async (_id, call) => {
    const content = await fs.readFile(call.path, 'utf8');
    return { ok: true, results: [{ type: 'read_file', path: call.path, content, size: Buffer.byteLength(content), sha256: 'sha', currentSha256: 'sha', verified: true }] };
  });
}

function makeRuntime({ tasks = new TaskStore({ root: taskRoot }), sessions = new ContractSessionStore(), interpretation = chat(), models = makeModels(), statePaths = {}, processProvider = null } = {}) {
  const registry = new CapabilityRegistry();
  const providers = processProvider ? { 'local-process-provider': processProvider } : undefined;
  return { runtime: new AgentRuntime({ root, allowedRoots: [root], tasks, sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => interpretation), capabilityRegistry: registry, scheduler: new CapabilityScheduler({ registry }), providers, statePaths }), tasks, sessions, models };
}

const cases = [];
const record = (name, details = {}) => cases.push({ name, ...details });

{
  const store = new TaskStore({ root: join(root, 'one-to-one') });
  await store.create({ taskId: 't1', messageId: 'm1', originalMessageId: 'm1', conversationId: 'c' });
  await assert.rejects(() => store.create({ taskId: 't2', messageId: 'm2', originalMessageId: 'm1', conversationId: 'c' }), /already belongs/);
  record('one-task-per-original-message');
}

{
  const { runtime, tasks, sessions, models } = makeRuntime({ interpretation: chat('dup') });
  const job = { taskId: 'dup-task', messageId: 'dup-task', originalMessageId: 'dup-task', conversationId: 'dup', chatId: 'dup', text: 'hello' };
  const first = await runtime.handle(job);
  const second = await runtime.handle(job);
  assert.equal(first.text, second.text);
  assert.equal(second.replayed, true);
  assert.equal((await sessions.history('dup')).filter((item) => item.role === 'assistant').length, 1);
  assert.equal(models.calls.express, 1);
  assert.equal((await tasks.load('dup-task')).currentState, 'completed');
  record('exactly-once-final-result');
}

{
  const { runtime } = makeRuntime({ interpretation: fileRead() });
  const result = await runtime.handle({ messageId: 'read', originalMessageId: 'read', conversationId: 'read-c', chatId: 'read-c', text: `读取 ${file}，不要修改文件` });
  assert.equal(result.provider, 'local-read');
  assert.equal(result.metrics.readFileCalls, 1);
  record('direct-read-terminal-binding');
}

{
  const gateway = join(root, 'gateway-health.json');
  const worker = join(root, 'worker-state.json');
  await fs.writeFile(gateway, JSON.stringify({ pid: 1, gitCommit: 'g', connectionState: 'healthy' }));
  await fs.writeFile(worker, JSON.stringify({ pid: 2, gitCommit: 'r', status: 'online' }));
  const { runtime } = makeRuntime({ interpretation: { ...chat('status'), taskType: 'system_diagnosis', requiredCapabilities: ['runtime.status'], actions: ['status'], targets: [], context: {}, successCriteria: ['live status'] }, statePaths: { gateway, runtime: worker } });
  const result = await runtime.handle({ messageId: 'status', originalMessageId: 'status', conversationId: 'status-c', chatId: 'status-c', text: '当前Gateway、Runtime和任务状态是什么' });
  assert.equal(result.provider, 'local-status');
  assert.match(result.text, /Gateway PID 1/);
  record('status-query-uses-health-plus-task-store');
}

{
  const tasks = new TaskStore({ root: join(root, 'progress') });
  await tasks.create({ taskId: 'active', messageId: 'active', conversationId: 'pc' });
  await tasks.transitionTask('active', 'accepted', 'interpreting', 'test', 'test', {});
  const { runtime } = makeRuntime({ tasks, interpretation: chat() });
  const result = await runtime.handle({ messageId: 'progress', originalMessageId: 'progress', conversationId: 'pc', chatId: 'pc', text: '进度怎么样了' });
  assert.equal(result.controlKind, 'progress');
  assert.match(result.text, /interpreting/);
  record('progress-control');
}

{
  const tasks = new TaskStore({ root: join(root, 'cancel') });
  await tasks.create({ taskId: 'active', messageId: 'active', conversationId: 'cc' });
  const { runtime } = makeRuntime({ tasks, interpretation: chat() });
  const result = await runtime.handle({ messageId: 'cancel', originalMessageId: 'cancel', conversationId: 'cc', chatId: 'cc', text: '取消当前任务' });
  assert.equal(result.controlKind, 'cancel');
  assert.equal((await tasks.load('active')).currentState, 'cancelled');
  record('cancel-control-transition');
}

{
  const tasks = new TaskStore({ root: join(root, 'pause') });
  await tasks.create({ taskId: 'active', messageId: 'active', conversationId: 'pause-c' });
  const { runtime } = makeRuntime({ tasks, interpretation: chat() });
  const paused = await runtime.handle({ messageId: 'pause', originalMessageId: 'pause', conversationId: 'pause-c', chatId: 'pause-c', text: '暂停当前任务' });
  assert.equal(paused.controlKind, 'pause');
  assert.equal((await tasks.load('active')).currentState, 'paused');
  record('pause-control-transition');
}

{
  const tasks = new TaskStore({ root: join(root, 'continue') });
  await tasks.create({ taskId: 'active', messageId: 'active', conversationId: 'continue-c' });
  await tasks.patch('active', { waitingFor: { resumeState: 'interpreting' } });
  await tasks.transitionTask('active', 'accepted', 'paused', 'test_pause', 'test', {});
  const { runtime } = makeRuntime({ tasks, interpretation: chat() });
  const continued = await runtime.handle({ messageId: 'continue', originalMessageId: 'continue', conversationId: 'continue-c', chatId: 'continue-c', text: '继续当前任务' });
  assert.equal(continued.controlKind, 'continue');
  assert.equal((await tasks.load('active')).currentState, 'interpreting');
  record('continue-control-transition');
}

{
  const { runtime, tasks } = makeRuntime({ interpretation: clarification() });
  const result = await runtime.handle({ messageId: 'clarify', originalMessageId: 'clarify', conversationId: 'clarify-c', chatId: 'clarify-c', text: '处理一下' });
  assert.equal(result.schedulerStatus, 'needs_clarification');
  assert.deepEqual((await tasks.load('clarify')).waitingFor.missingFields, ['target']);
  record('clarification-requires-context-evidence');
}

{
  let calls = 0;
  const models = makeModels({ understand: async () => ({ text: ++calls === 1 ? '{bad' : JSON.stringify(chat('corrected')) }) });
  const interpreter = new TaskInterpreter({ model: models });
  const tasks = new TaskStore({ root: join(root, 'correction-success') });
  const runtime = new AgentRuntime({ root, allowedRoots: [root], tasks, sessions: new ContractSessionStore(), models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: interpreter });
  const result = await runtime.handle({ messageId: 'corrected', originalMessageId: 'corrected', conversationId: 'corr-c', chatId: 'corr-c', text: 'hello' });
  assert.equal(result.provider, 'deepseek');
  assert.equal(calls, 2);
  record('invalid-interpreter-one-correction-success');
}

{
  const models = makeModels({ understand: async () => ({ text: '{bad' }) });
  const interpreter = new TaskInterpreter({ model: models });
  const tasks = new TaskStore({ root: join(root, 'correction-fail') });
  const runtime = new AgentRuntime({ root, allowedRoots: [root], tasks, sessions: new ContractSessionStore(), models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: interpreter });
  await assert.rejects(() => runtime.handle({ messageId: 'bad', originalMessageId: 'bad', conversationId: 'bad-c', chatId: 'bad-c', text: 'hello' }), /Task Interpreter/);
  assert.equal((await tasks.load('bad')).currentState, 'failed');
  record('invalid-interpreter-fails-not-clarification');
}

{
  const { runtime } = makeRuntime({ interpretation: confirmation() });
  const result = await runtime.handle({ messageId: 'confirm', originalMessageId: 'confirm', conversationId: 'confirm-c', chatId: 'confirm-c', text: 'pay' });
  assert.equal(result.schedulerStatus, 'needs_confirmation');
  record('confirmation-transition');
}

{
  const { runtime, tasks } = makeRuntime({ interpretation: unavailable() });
  const result = await runtime.handle({ messageId: 'unavailable', originalMessageId: 'unavailable', conversationId: 'unavailable-c', chatId: 'unavailable-c', text: 'video' });
  assert.equal(result.schedulerStatus, 'capability_unavailable');
  assert.equal((await tasks.load('unavailable')).currentState, 'capability_unavailable');
  record('capability-unavailable-terminal');
}

{
  const { runtime } = makeRuntime({ interpretation: code() });
  const result = await runtime.handle({ messageId: 'code', originalMessageId: 'code', conversationId: 'code-c', chatId: 'code-c', text: '修改代码并运行测试' });
  assert.equal(result.toolUsed, 'codex');
  assert.equal(result.metrics.codexCalls, 1);
  record('code-execution-terminal');
}

{
  const processProvider = { async list() { return [{ pid: 12345, name: 'controlled' }]; }, async stop() { return { ok: true, target: { pid: 12345, name: 'controlled' }, verification: { pidAbsent: true }, remaining: false }; } };
  const { runtime } = makeRuntime({ interpretation: processStop(), processProvider });
  const result = await runtime.handle({ messageId: 'process', originalMessageId: 'process', conversationId: 'process-c', chatId: 'process-c', text: '停止受控进程' });
  assert.equal(result.toolUsed, 'process.stop');
  assert.equal(result.metrics.processStopCalls, 1);
  record('process-provider-terminal');
}

{
  const sessions = new ContractSessionStore();
  const models = makeModels();
  const sharedTaskRoot = join(root, 'restart-recovery');
  const first = new AgentRuntime({ root, allowedRoots: [root], tasks: new TaskStore({ root: sharedTaskRoot }), sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => chat('restart')) });
  const job = { messageId: 'restart', originalMessageId: 'restart', conversationId: 'restart-c', chatId: 'restart-c', text: 'hello' };
  await first.handle(job);
  const second = new AgentRuntime({ root, allowedRoots: [root], tasks: new TaskStore({ root: sharedTaskRoot }), sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => chat('restart')) });
  const replay = await second.handle(job);
  assert.equal(replay.replayed, true);
  assert.equal((await sessions.history('restart-c')).filter((item) => item.role === 'assistant').length, 1);
  record('restart-recovery-replays-terminal-result');
}

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, matrix: 'TASK-LIFECYCLE-001', cases }, null, 2));
