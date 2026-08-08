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
import { trustedAuthorizations } from './authorization-context-fixtures.mjs';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-task-lifecycle-'));
const taskRoot = join(root, 'tasks');
const file = join(root, 'NEXT_STEP.md');
await fs.writeFile(file, '<!-- AIW_NEXT_STEP_START -->\nTASK-LIFECYCLE-001 matrix goal\n<!-- AIW_NEXT_STEP_END -->\n', 'utf8');

const chat = (goal = 'answer user') => ({ taskType: 'chat', goal, actions: ['answer'], targets: [], context: {}, constraints: [], riskLevel: 'low', requiredCapabilities: ['conversation'], successCriteria: ['non-empty answer'], requiresConfirmation: false, confidence: 0.99 });
const clarification = () => ({ taskType: 'clarification', goal: 'clarify target', actions: [], targets: [], context: { missingFields: ['target'], questions: ['Which target should I use?'] }, constraints: [], riskLevel: 'low', requiredCapabilities: [], successCriteria: ['user supplies target'], requiresConfirmation: false, confidence: 0.4 });
const fileRead = () => ({ taskType: 'file_operation', goal: 'read file', actions: ['read'], targets: [{ type: 'file', path: file }], context: { absolutePath: file }, constraints: ['read only'], riskLevel: 'low', requiredCapabilities: ['file.read'], successCriteria: ['file read evidence'], requiresConfirmation: false, confidence: 0.99 });
const confirmation = () => ({ taskType: 'commerce', goal: 'place order', actions: ['pay'], targets: [{ type: 'order' }], context: {}, constraints: [], riskLevel: 'high', requiredCapabilities: ['commerce.payment'], successCriteria: ['confirmation first'], requiresConfirmation: true, confidence: 0.95 });
const unavailable = () => ({ taskType: 'media_creation', goal: 'create video', actions: ['create'], targets: [{ type: 'video' }], context: {}, constraints: [], riskLevel: 'low', requiredCapabilities: ['media.video.create'], successCriteria: ['video exists'], requiresConfirmation: false, confidence: 0.95 });
const code = () => ({ taskType: 'code_task', goal: 'modify code', actions: ['modify', 'test'], targets: [{ type: 'project', path: root }], context: {}, constraints: [], riskLevel: 'medium', requiredCapabilities: ['code.read', 'code.modify', 'code.execute'], successCriteria: ['tests pass'], requiresConfirmation: false, confidence: 0.96 });
const processStop = () => ({ taskType: 'computer_operation', goal: 'stop controlled process', actions: ['stop'], targets: [{ type: 'process', pid: 12345, name: 'controlled' }], context: {}, constraints: ['exact pid only'], riskLevel: 'medium', requiredCapabilities: ['process.list', 'process.stop'], successCriteria: ['pid absent'], requiresConfirmation: false, confidence: 0.98 });
let runtimeFixtureId = 0;

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
  return { runtime: new AgentRuntime({ root, allowedRoots: [root], tasks, sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => interpretation), capabilityRegistry: registry, scheduler: new CapabilityScheduler({ registry }), providers, statePaths, nonExecutionMessageOptions: { root: join(root, 'non-execution', String(++runtimeFixtureId)) } }), tasks, sessions, models };
}

const cases = [];
const record = (name, details = {}) => cases.push({ name, ...details });

{
  const tasks = new TaskStore({ root: join(root, 'pure-greeting') });
  const models = makeModels();
  const runtime = new AgentRuntime({ root, allowedRoots: [root], tasks, sessions: new ContractSessionStore(), models, tools: makeTools(), verifier: new ResultVerifier(), nonExecutionMessageOptions: { root: join(root, 'pure-greeting-non-execution') } });
  const result = await runtime.handle({ messageId: 'pure-greeting', originalMessageId: 'pure-greeting', conversationId: 'pure-greeting-c', chatId: 'pure-greeting-c', text: '你好' });
  assert.equal(result.classification.decision, 'respond');
  assert.equal(result.executionStarted, false);
  assert.equal(await tasks.load('pure-greeting'), null);
  assert.equal(models.calls.express, 0);
  record('pure-greeting-non-execution', { taskCreates: 0, runCreates: 0, providerCalls: 0 });
}

{
  const tasks = new TaskStore({ root: join(root, 'conversation-business') });
  const models = makeModels({ express: async () => ({ text: 'E2E-A-OK' }) });
  const { runtime } = makeRuntime({ tasks, models, interpretation: chat('reply with requested format') });
  const result = await runtime.handle({ messageId: 'conversation-business', originalMessageId: 'conversation-business', conversationId: 'conversation-business-c', chatId: 'conversation-business-c', leaseOwner: 'conversation-worker', text: '请只回复：E2E-A-OK' });
  const task = await tasks.load('conversation-business');
  const run = task.runs[0];
  assert.equal(task.adapterResult.decision, 'execute');
  assert.equal(task.interpretation.taskType, 'chat');
  assert.deepEqual(task.interpretation.requiredCapabilities, ['conversation']);
  assert.equal(task.currentState, 'completed');
  assert.deepEqual(task.stateHistory.map((item) => item.to), ['accepted','interpreting','scheduling','ready','executing','verifying','completed']);
  assert.equal(task.runs.length, 1);
  assert.equal(run.providerId, 'deepseek');
  assert.equal(models.calls.express, 1);
  assert.equal(run.verification.taskId, task.taskId);
  assert.equal(run.verification.runId, run.runId);
  assert.equal(task.finalResult.taskId, task.taskId);
  assert.equal(task.finalResult.runId, run.runId);
  assert.equal(result.taskId, task.taskId);
  assert.equal(result.runId, run.runId);
  assert.equal(task.activeRunId, null);
  record('conversation-business-execution', { taskCreated: true, lifecycle: task.stateHistory.map((item) => item.to), runs: task.runs.length, runProviderId: run.providerId, expressCalls: models.calls.express, verificationBound: run.verification.runId === run.runId, finalTaskBound: task.finalResult.taskId === task.taskId, finalRunBound: task.finalResult.runId === run.runId });
}

{
  const store = new TaskStore({ root: join(root, 'one-to-one') });
  await store.create({ taskId: 't1', messageId: 'm1', originalMessageId: 'm1', conversationId: 'c' });
  await assert.rejects(() => store.create({ taskId: 't2', messageId: 'm2', originalMessageId: 'm1', conversationId: 'c' }), /already belongs/);
  record('one-task-per-original-message');
}

{
  const gateway = join(root, 'replay-gateway-health.json');
  const worker = join(root, 'replay-worker-state.json');
  await fs.writeFile(gateway, JSON.stringify({ pid: 11, gitCommit: 'g', connectionState: 'healthy' }));
  await fs.writeFile(worker, JSON.stringify({ pid: 12, gitCommit: 'r', status: 'online' }));
  const runtimeStatus = { ...chat('dup'), taskType: 'system_diagnosis', requiredCapabilities: ['runtime.status'], actions: ['status'], targets: [], context: {}, successCriteria: ['live status'] };
  const { runtime, tasks, sessions, models } = makeRuntime({ interpretation: runtimeStatus, statePaths: { gateway, runtime: worker } });
  const job = { taskId: 'dup-task', messageId: 'dup-task', originalMessageId: 'dup-task', conversationId: 'dup', chatId: 'dup', text: '当前Gateway、Runtime和任务状态是什么' };
  const before=await tasks.list();
  const first = await runtime.handle(job);
  const afterFirst=await tasks.list();const firstTask=await tasks.load('dup-task');const firstRuns=firstTask.runs.length;const firstHistory=firstTask.stateHistory.length;
  const second = await runtime.handle(job);
  const afterSecond=await tasks.list();const secondTask=await tasks.load('dup-task');
  assert.equal(first.text, second.text);
  assert.equal(second.replayed, true);
  assert.equal((await sessions.history('dup')).filter((item) => item.role === 'assistant').length, 1);
  assert.equal(afterFirst.length-before.length,1);
  assert.equal(afterSecond.length-afterFirst.length,0);
  assert.equal(firstRuns,1);
  assert.equal(secondTask.runs.length,firstRuns);
  assert.equal(secondTask.stateHistory.length,firstHistory);
  assert.equal(secondTask.activeRunId,null);
  assert.equal(firstTask.currentState, 'completed');
  assert.equal(firstTask.finalResult.text,second.text);
  assert.equal(models.calls.express, 0);
  record('exactly-once-final-result');
}

{
  const { runtime } = makeRuntime({ interpretation: fileRead() });
  const result = await runtime.handle({ messageId: 'read', originalMessageId: 'read', conversationId: 'read-c', chatId: 'read-c', text: `只读查看 ${file}` });
  assert.equal(result.provider, 'local-tool-executor');
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
  assert.equal(result.provider, 'local-runtime-state');
  assert.match(result.text, /Runtime PID 2/);
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
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'clarify', originalMessageId: 'clarify', conversationId: 'clarify-c', chatId: 'clarify-c', text: '读取文件' });
  const after = await tasks.list();
  assert.equal(result.requiresUserInput, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.classification.decision, 'clarify');
  assert.ok(result.classification.missingFields.includes('path'));
  assert.ok(result.classification.questions.some((question) => typeof question === 'string' && question.length > 0));
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('clarify'), null);
  record('clarification-requires-context-evidence');
}

{
  let calls = 0;
  const models = makeModels({ understand: async () => ({ text: ++calls === 1 ? '{bad' : JSON.stringify(chat('corrected')) }) });
  const interpreter = new TaskInterpreter({ model: models });
  const tasks = new TaskStore({ root: join(root, 'correction-success') });
  const runtime = new AgentRuntime({ root, allowedRoots: [root], tasks, sessions: new ContractSessionStore(), models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: interpreter });
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'corrected', originalMessageId: 'corrected', conversationId: 'corr-c', chatId: 'corr-c', text: 'hello' });
  const after = await tasks.list();
  assert.equal(result.provider, 'deterministic-response-renderer');
  assert.equal(result.classification.decision, 'respond');
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.modelCalls, 0);
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(calls, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('corrected'), null);
  record('invalid-interpreter-one-correction-success');
}

{
  let calls = 0;
  const models = makeModels({ understand: async () => { calls += 1; return { text: '{bad' }; } });
  const interpreter = new TaskInterpreter({ model: models });
  const tasks = new TaskStore({ root: join(root, 'correction-fail') });
  const runtime = new AgentRuntime({ root, allowedRoots: [root], tasks, sessions: new ContractSessionStore(), models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: interpreter });
  const result = await runtime.handle({ messageId: 'bad', originalMessageId: 'bad', conversationId: 'bad-c', chatId: 'bad-c', text: 'hello' });
  assert.equal(result.provider, 'deterministic-response-renderer');
  assert.equal(result.classification.decision, 'respond');
  assert.equal(result.requiresUserInput, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.modelCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(calls, 0);
  assert.equal(await tasks.load('bad'), null);
  record('invalid-interpreter-fails-not-clarification');
}

{
  const { runtime, tasks } = makeRuntime({ interpretation: confirmation() });
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'confirm', originalMessageId: 'confirm', conversationId: 'confirm-c', chatId: 'confirm-c', text: '付款' });
  const after = await tasks.list();
  assert.equal(result.classification.decision, 'unsupported');
  assert.equal(result.capabilityAvailable, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('confirm'), null);
  record('confirmation-transition');
}

{
  const { runtime, tasks } = makeRuntime({ interpretation: unavailable() });
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'unavailable', originalMessageId: 'unavailable', conversationId: 'unavailable-c', chatId: 'unavailable-c', text: '生成视频' });
  const after = await tasks.list();
  assert.equal(result.classification.decision, 'unsupported');
  assert.equal(result.capabilityAvailable, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('unavailable'), null);
  record('capability-unavailable-terminal');
}

{
  const { runtime, tasks } = makeRuntime({ interpretation: code() });
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'code', originalMessageId: 'code', conversationId: 'code-c', chatId: 'code-c', openId: 'test-user', text: '修改代码并运行测试', authorizationContexts: trustedAuthorizations({ taskId: 'code', userId: 'test-user', capabilityIds: ['code.modify','code.execute'] }) });
  const after = await tasks.list();
  assert.equal(result.classification.decision, 'unsupported');
  assert.equal(result.capabilityAvailable, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.codexCalls, 0);
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('code'), null);
  record('code-execution-terminal');
}

{
  let providerCalls = 0;
  const processProvider = { async list() { providerCalls += 1; return [{ pid: 12345, name: 'controlled' }]; }, async stop() { providerCalls += 1; return { ok: true, target: { pid: 12345, name: 'controlled' }, verification: { pidAbsent: true }, remaining: false }; } };
  const { runtime, tasks } = makeRuntime({ interpretation: processStop(), processProvider });
  const before = await tasks.list();
  const result = await runtime.handle({ messageId: 'process', originalMessageId: 'process', conversationId: 'process-c', chatId: 'process-c', openId: 'test-user', text: '停止受控进程', authorizationContexts: trustedAuthorizations({ taskId: 'process', userId: 'test-user', capabilityIds: ['process.stop'] }) });
  const after = await tasks.list();
  assert.equal(result.classification.decision, 'unsupported');
  assert.equal(result.capabilityAvailable, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.metrics.providerCalls, 0);
  assert.equal(result.metrics.schedulerCalls, 0);
  assert.equal(result.metrics.taskCreates, 0);
  assert.equal(providerCalls, 0);
  assert.equal(after.length, before.length);
  assert.equal(await tasks.load('process'), null);
  record('process-provider-terminal');
}

{
  const sessions = new ContractSessionStore();
  const models = makeModels();
  const sharedTaskRoot = join(root, 'restart-recovery');
  const firstTasks = new TaskStore({ root: sharedTaskRoot });
  const first = new AgentRuntime({ root, allowedRoots: [root], tasks: firstTasks, sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => chat('restart')), nonExecutionMessageOptions: { root: join(root, 'restart-non-execution') } });
  const job = { messageId: 'restart', originalMessageId: 'restart', conversationId: 'restart-c', chatId: 'restart-c', text: 'hello' };
  const firstResult = await first.handle(job);
  assert.equal(firstResult.messageReplayed, false);
  assert.equal(firstResult.taskReplayed, false);
  assert.equal(firstResult.classification.decision, 'respond');
  assert.equal(await firstTasks.load('restart'), null);
  const secondTasks = new TaskStore({ root: sharedTaskRoot });
  const second = new AgentRuntime({ root, allowedRoots: [root], tasks: secondTasks, sessions, models, tools: makeTools(), verifier: new ResultVerifier(), taskInterpreter: new ContractTaskInterpreter(async () => chat('restart')), nonExecutionMessageOptions: { root: join(root, 'restart-non-execution') } });
  const replay = await second.handle(job);
  assert.equal(replay.messageReplayed, true);
  assert.equal(replay.taskReplayed, false);
  assert.equal(replay.executionStarted, false);
  assert.equal(replay.classification.decision, 'respond');
  assert.equal(replay.metrics.taskCreates, 0);
  assert.equal(await secondTasks.load('restart'), null);
  assert.equal((await sessions.history('restart-c')).filter((item) => item.role === 'assistant').length, 1);
  record('restart-recovery-replays-terminal-result');
}

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, matrix: 'TASK-LIFECYCLE-001', cases }, null, 2));
