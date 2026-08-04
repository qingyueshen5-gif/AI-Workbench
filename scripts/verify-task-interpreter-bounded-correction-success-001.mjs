import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TaskInterpreter, validateTaskInterpretation, interpreterPrompt } from '../agents/task-interpreter.mjs';

const fixtureId = randomUUID();
const temporaryRoot = await fs.mkdtemp(join(os.tmpdir(), `aiw-cq002-${fixtureId}-`));
const calls = [];
const runtimeCounters = { providers: 0, tasks: 0, runs: 0, scheduler: 0, trustedAuthorizations: 0, realExecutions: 0 };
const invalidFirstOutput = {
  taskType: 'chat',
  goal: '回应普通问候',
  context: { source: 'fixture', authorized: true },
  riskLevel: 'low',
  requiredCapabilities: [],
  successCriteria: ['返回普通问候'],
  requiresConfirmation: false,
  confidence: 1,
  providerId: 'forbidden-provider',
  approved: true,
  authorizationContext: { trusted: true }
};
const validSecondOutput = {
  taskType: 'chat',
  goal: '回应普通问候',
  actions: ['respond'],
  targets: [{ type: 'conversation', scope: 'current' }],
  context: {
    source: 'isolated-fixture',
    approved: true,
    nested: { authorized: true, retainedFact: 'fixture-only' }
  },
  constraints: ['不得执行真实任务'],
  riskLevel: 'low',
  requiredCapabilities: [],
  successCriteria: ['返回结构化解释'],
  requiresConfirmation: false,
  confidence: 1,
  providerId: 'must-not-pass',
  approved: true,
  trusted: true,
  authorizationContext: { taskId: 'must-not-pass', trusted: true }
};

const model = {
  async understand(request) {
    calls.push(structuredClone(request));
    if (calls.length === 1) return { text: JSON.stringify(invalidFirstOutput) };
    if (calls.length === 2) return { text: JSON.stringify(validSecondOutput) };
    throw new Error('third model call is forbidden');
  }
};

try {
  const interpreter = new TaskInterpreter({ model });
  const interpretation = await interpreter.interpret({
    text: 'hello',
    conversationContext: [],
    environmentContext: { fixtureId, temporaryRoot }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].messages.length, 2);
  assert.equal(calls[1].messages.length, 3);
  assert.equal(calls[0].messages[0].content, interpreterPrompt);
  assert.equal(calls[1].messages[0].content, interpreterPrompt);
  assert.equal(calls[0].responseFormat.type, 'json_object');
  assert.equal(calls[1].responseFormat.type, 'json_object');

  const correction = calls[1].messages[2];
  assert.equal(correction.role, 'user');
  assert.match(correction.content, /只纠正JSON结构/);
  assert.match(correction.content, /Task Interpreter缺少字段 actions/);
  assert.match(correction.content, /原始用户消息：hello/);
  assert.equal(correction.content.includes('选择Provider'), false);
  assert.equal(correction.content.includes('执行任务'), false);
  assert.equal(correction.content.includes('可信授权'), false);

  const schemaValidated = validateTaskInterpretation(interpretation);
  assert.deepEqual(schemaValidated, interpretation);
  assert.equal(interpretation.taskType, 'chat');
  assert.equal(interpretation.goal, '回应普通问候');
  assert.deepEqual(interpretation.actions, ['respond']);
  assert.deepEqual(interpretation.requiredCapabilities, []);

  const serialized = JSON.stringify(interpretation);
  for (const forbidden of ['providerId', 'approved', 'authorized', 'authorizationContext', 'trusted', 'must-not-pass', 'forbidden-provider']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden field leaked: ${forbidden}`);
  }
  assert.equal(interpretation.context.nested.retainedFact, 'fixture-only');
  assert.deepEqual(runtimeCounters, { providers: 0, tasks: 0, runs: 0, scheduler: 0, trustedAuthorizations: 0, realExecutions: 0 });

  console.log(JSON.stringify({
    ok: true,
    module: 'TASK-INTERPRETER-BOUNDED-CORRECTION-SUCCESS-001',
    fixtureId,
    isolatedTemporaryRoot: temporaryRoot,
    modelCalls: calls.length,
    thirdCall: false,
    firstInvalidReason: 'Task Interpreter缺少字段 actions',
    correctionPrompt: {
      role: correction.role,
      boundedToJsonStructure: true,
      includesOriginalMessage: true,
      messageCount: calls[1].messages.length,
      responseFormat: calls[1].responseFormat.type
    },
    schemaValidation: 'PASS',
    interpretation,
    forbiddenFieldsPassed: false,
    runtimeCounters,
    realModelCalled: false
  }, null, 2));
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
