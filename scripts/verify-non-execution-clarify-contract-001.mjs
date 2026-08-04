import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { NonExecutionMessageStore } from '../channels/non-execution-message-store.mjs';
import { ContractSessionStore } from './runtime-dependency-contract-fixtures.mjs';
import { InterpreterAdapter } from '../agents/interpreter-adapter.mjs';
import { extractGroundTruth } from '../agents/original-ground-truth-extractor.mjs';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-clarify-contract-'));
const scenarios = [
  {
    id: 'missing-file-path',
    text: '帮我看下那个文件',
    expectedMissing: 'path',
    expectedText: /文件路径|完整路径/
  },
  {
    id: 'compound-file-and-runtime',
    text: '读一下文件，然后检查 Runtime',
    expectedMissing: 'selectedIntent',
    expectedText: /多个任务|先执行哪一个/
  },
  {
    id: 'compound-explicit-path-and-runtime',
    text: '读取 E:\\AI-Workbench\\NEXT_STEP.md，然后看看 Runtime 正不正常',
    expectedMissing: 'selectedIntent',
    expectedText: /多个任务|先执行哪一个/
  },
  {
    id: 'compound-unrecognized-front-fragment',
    text: '浏览一下那个资料，接着检查 Runtime 状态',
    expectedMissing: 'selectedIntent',
    expectedText: /可能包含多个任务|没有完整识别另一部分/
  },
  {
    id: 'compound-explicit-sequence',
    text: '先看看这个文件，之后再检查Runtime',
    expectedMissing: 'selectedIntent',
    expectedText: /多个任务|先执行哪一个/
  },
  {
    id: 'missing-explicit-target',
    text: '打开并读取文件',
    expectedMissing: 'path',
    expectedText: /文件路径|完整路径/
  }
];

const rows = [];
const adapter = new InterpreterAdapter();
const directAdapterChecks = [
  { id: 'single-runtime', text: '检查一下Runtime状态', decision: 'execute', capability: 'runtime.status' },
  { id: 'single-file', text: '读一下 E:\\AI-Workbench\\NEXT_STEP.md', decision: 'execute', capability: 'file.read' },
  { id: 'single-repeat-runtime', text: '再检查一下Runtime状态', decision: 'execute', capability: 'runtime.status' },
  { id: 'greeting', text: '你好', decision: 'respond', capability: null },
  { id: 'negative-display-runtime', text: '展示Runtime状态', decision: 'execute', capability: 'runtime.status', notFileRead: true },
  { id: 'negative-output-tests', text: '输出测试结果', decision: 'respond', capability: null, notFileRead: true },
  { id: 'negative-open-settings', text: '打开设置', decision: 'respond', capability: null, notFileRead: true },
  { id: 'negative-look-system', text: '看看系统是否正常', decision: 'execute', capability: 'runtime.status', notFileRead: true },
  { id: 'runtime-finished-word', text: 'Runtime完了', decision: 'respond', capability: null },
  { id: 'system-finished-word', text: '系统是不是完了', decision: 'respond', capability: null }
];
const directResults = directAdapterChecks.map((check) => {
  const result = adapter.adapt({ originalText: check.text, groundTruth: extractGroundTruth(check.text) });
  assert.equal(result.decision, check.decision, check.id);
  assert.deepEqual(result.taskDraft?.requiredCapabilities?.[0] || null, check.capability, check.id);
  if (check.notFileRead) assert.notEqual(result.taskDraft?.requiredCapabilities?.[0], 'file.read', check.id);
  return { id: check.id, input: check.text, decision: result.decision, capability: result.taskDraft?.requiredCapabilities?.[0] || null };
});
try {
  for (const scenario of scenarios) {
    const sessions = new ContractSessionStore();
    const counters = { taskLoads: 0, taskCreates: 0, scheduler: 0, provider: 0, model: 0, renderer: 0, persistedResults: 0 };
    const store = new NonExecutionMessageStore({ root: join(root, scenario.id), claimTtlMs: 1000, waitMs: 200, pollMs: 2 });
    const runtime = new AgentRuntime({
      sessions,
      tasks: {
        async load() { counters.taskLoads++; return null; },
        async create() { counters.taskCreates++; throw new Error('clarify must not create Task'); }
      },
      nonExecutionMessages: store,
      activeController: { async handle() { return { intercepted: false, classification: { kind: 'new_task' } }; } },
      scheduler: { plan() { counters.scheduler++; throw new Error('clarify must not enter Scheduler'); } },
      providers: new Proxy({}, { get() { counters.provider++; throw new Error('clarify must not access Provider'); } }),
      models: {
        async understand() { counters.model++; throw new Error('clarify must not call model'); },
        async express() { counters.model++; throw new Error('clarify must not call model'); },
        async execute() { counters.model++; throw new Error('clarify must not call model'); }
      },
      nonExecutionRenderer(adapterResult, options) {
        counters.renderer++;
        return {
          version: 'non-execution-result-v1',
          text: adapterResult.response.text,
          provider: 'deterministic-response-renderer',
          providerSessionId: '',
          toolUsed: '',
          verified: true,
          classification: {
            kind: 'non_execution',
            decision: adapterResult.decision,
            originalMessageId: options.originalMessageId,
            missingFields: adapterResult.missingFields,
            questions: adapterResult.questions,
            recognizedIntents: adapterResult.recognizedIntents,
            executionStarted: false
          },
          metrics: { taskCreates: 0, runCreates: 0, schedulerCalls: 0, providerCalls: 0, modelCalls: 0 }
        };
      },
      afterNonExecutionResultPersisted: async () => { counters.persistedResults++; }
    });
    const job = {
      channel: 'feishu',
      openId: 'isolated-user',
      messageId: scenario.id,
      originalMessageId: scenario.id,
      conversationId: `conversation-${scenario.id}`,
      text: scenario.text
    };
    const first = await runtime.handle(job);
    const second = await runtime.handle(job);
    const history = await sessions.history(job.conversationId);
    const assistantMessages = history.filter((item) => item.role === 'assistant');
    const userMessages = history.filter((item) => item.role === 'user');
    assert.equal(first.adapterResult.decision, 'clarify');
    assert.equal(first.classification.decision, 'clarify');
    assert.ok(first.classification.missingFields.length > 0);
    assert.ok(first.classification.questions.length > 0);
    assert.ok(first.classification.missingFields.includes(scenario.expectedMissing));
    assert.match(first.text, scenario.expectedText);
    assert.equal(first.adapterResult.taskDraft, null);
    assert.equal(first.taskId, undefined);
    assert.equal(first.executionStarted, false);
    assert.equal(first.messageReplayed, false);
    assert.equal(first.taskReplayed, false);
    assert.equal(second.messageReplayed, true);
    assert.equal(second.taskReplayed, false);
    assert.equal(second.executionStarted, false);
    assert.equal(first.deliveryKey, second.deliveryKey);
    assert.equal(counters.taskCreates, 0);
    assert.equal(counters.scheduler, 0);
    assert.equal(counters.provider, 0);
    assert.equal(counters.model, 0);
    assert.equal(counters.renderer, 1);
    assert.equal(counters.persistedResults, 1);
    assert.equal(userMessages.length, 1);
    assert.equal(assistantMessages.length, 1);
    assert.equal(new Set([first.deliveryKey, second.deliveryKey]).size, 1);
    assert.equal(first.metrics.taskCreates, 0);
    assert.equal(first.metrics.runCreates, 0);
    assert.equal(first.metrics.schedulerCalls, 0);
    assert.equal(first.metrics.providerCalls, 0);
    assert.equal(first.metrics.modelCalls, 0);
    rows.push({
      id: scenario.id,
      input: scenario.text,
      decision: first.classification.decision,
      missingFields: first.classification.missingFields,
      questions: first.classification.questions,
      firstMessageReplayed: first.messageReplayed,
      secondMessageReplayed: second.messageReplayed,
      taskReplayed: second.taskReplayed,
      taskCreates: counters.taskCreates,
      runs: first.metrics.runCreates,
      schedulerCalls: counters.scheduler,
      providerCalls: counters.provider,
      modelCalls: counters.model,
      assistantAppends: assistantMessages.length,
      uniqueDeliveryKeys: 1,
      successfulFinals: 0
    });
  }
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  module: 'NON-EXECUTION-CLARIFY-CONTRACT-001',
  rows,
  directResults,
  hardContract: {
    decision: 'clarify',
    tasks: 0,
    runs: 0,
    scheduler: 0,
    providers: 0,
    models: 0,
    duplicateAssistantAppends: 0,
    externalDeliveriesAtMost: 1,
    taskReplayed: false
  }
}, null, 2));
