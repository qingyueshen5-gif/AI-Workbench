import assert from 'node:assert/strict';

const terminalStates = new Set(['completed', 'capability_unavailable', 'failed', 'cancelled']);

export class ContractSessionStore {
  constructor(initial = {}) { this.states = new Map(Object.entries(initial)); }
  async load(conversationId, userId = '') { if (!this.states.has(conversationId)) this.states.set(conversationId, { schemaVersion: '1.0', conversationId, userId, originalMessages: [] }); return this.states.get(conversationId); }
  async save(state) { assert.ok(state?.conversationId); this.states.set(state.conversationId, state); return state; }
  async appendMessage(state, message) { state.originalMessages = [...(state.originalMessages || []), message]; return this.save(state); }
  async history(conversationId, limit = 20) { return (await this.load(conversationId)).originalMessages.slice(-limit); }
}

export class ContractTaskStore {
  constructor(task = null) {
    this.tasks = new Map();
    if (task) throw new Error('ContractTaskStore fixtures must create and transition tasks through public APIs');
  }

  normalize(task) {
    const taskId = task.taskId || task.messageId || 'task';
    const currentState = task.currentState || 'accepted';
    return {
      taskId,
      originalMessageId: task.originalMessageId || task.messageId || taskId,
      conversationId: task.conversationId || task.chatId || 'conversation',
      parentTaskId: task.parentTaskId || '',
      interpretation: task.interpretation || null,
      schedulerAssignment: task.schedulerAssignment || null,
      providerExecution: task.providerExecution || null,
      verification: task.verification || null,
      finalResult: task.finalResult || null,
      failure: task.failure || null,
      currentState,
      stateReason: task.stateReason || 'contract_fixture',
      waitingFor: task.waitingFor || null,
      cancelledByUser: task.cancelledByUser || task.cancelled || false,
      evidence: task.evidence || [],
      createdAt: task.createdAt || Date.now(),
      updatedAt: task.updatedAt || Date.now(),
      terminalAt: task.terminalAt || null,
      stateHistory: task.stateHistory || [{ from: null, to: currentState, reason: 'contract_fixture', actor: 'test', evidence: {}, timestamp: Date.now() }],
      ...task
    };
  }

  async load(taskId) { return this.tasks.get(taskId) || null; }
  async save(task) { const next = this.normalize(task); this.tasks.set(next.taskId, { ...next, updatedAt: Date.now() }); return this.tasks.get(next.taskId); }
  async create(job) { const taskId = job.taskId || job.messageId; const existing = await this.load(taskId); if (existing) return existing; return this.save({ taskId, originalMessageId: job.originalMessageId || job.messageId, conversationId: job.conversationId || job.chatId, currentState: 'accepted', stateReason: 'message_accepted' }); }
  async patch(taskId, patch) { const task = await this.load(taskId); assert.ok(task, `task missing: ${taskId}`); return this.save({ ...task, ...patch, taskId, originalMessageId: task.originalMessageId }); }
  async transitionTask(taskId, from, to, reason, actor, evidence) {
    const task = await this.load(taskId);
    assert.ok(task, `task missing: ${taskId}`);
    assert.equal(task.currentState, from);
    assert.ok(reason);
    assert.ok(actor);
    assert.notEqual(evidence, undefined);
    return this.save({ ...task, currentState: to, stateReason: reason, terminalAt: terminalStates.has(to) ? Date.now() : null, stateHistory: [...(task.stateHistory || []), { from, to, reason, actor, evidence, timestamp: Date.now() }] });
  }
  async list() { return [...this.tasks.values()]; }
  async listConversation(conversationId) { return (await this.list()).filter((task) => task.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt); }
  async latestNonTerminal(conversationId) { return (await this.listConversation(conversationId)).filter((task) => !terminalStates.has(task.currentState)).at(-1) || null; }
}



export class ContractToolExecutor {
  constructor(handler) { this.handler = handler; this.calls = []; }
  async execute(messageId, call) { assert.equal(typeof messageId, 'string'); assert.ok(call?.type); this.calls.push({ messageId, call }); const result = await this.handler(messageId, call); assert.equal(result?.ok, true); assert.ok(Array.isArray(result.results)); for (const item of result.results) { assert.ok(item.path); if (call.type === 'read_file') { assert.equal(typeof item.content, 'string'); assert.equal(typeof item.size, 'number'); assert.ok(item.sha256); assert.ok(item.currentSha256); } } return result; }
}

export class ContractModelRouter {
  constructor(handlers = {}) { this.handlers = handlers; this.calls = { understand: 0, express: 0, execute: 0 }; }
  async healthCheck() { return this.handlers.healthCheck ? this.handlers.healthCheck() : { ok: true, deepseek: { ok: true }, codex: { ok: true } }; }
  async understand(request) { this.calls.understand++; const result = await this.handlers.understand(request); assert.equal(typeof result?.text, 'string'); return result; }
  async express(request) { this.calls.express++; const result = await this.handlers.express(request); assert.equal(typeof result?.text, 'string'); return result; }
  async execute(request) { this.calls.execute++; const result = await this.handlers.execute(request); assert.equal(typeof result?.text, 'string'); return result; }
}

export class ContractVerifier {
  verifyModelResult(result) { assert.equal(typeof result?.text, 'string'); if (!result.text.trim()) throw new Error('empty model result'); return { ok: true, text: result.text.trim() }; }
  verifyToolResult(call, verification) { assert.ok(call?.type); assert.equal(verification?.ok, true); return { ok: true, verification }; }
}

export class ContractProgressWriter {
  constructor() { this.events = []; }
  async write(event) { for (const key of ['eventId','jobId','originalMessageId','conversationId','stage','message','createdAt']) assert.ok(event[key]); this.events.push(event); return true; }
}

export class ContractTaskInterpreter {
  constructor(handler) { this.handler = handler; this.calls = []; }
  async interpret(input) { this.calls.push(input); return this.handler(input); }
}

export async function verifyAgentRuntimeDependencyContracts(deps, fixture) {
  const required = { sessions: ['load','save','appendMessage','history'], tasks: ['load','save','create','patch','transitionTask','latestNonTerminal','list'], tools: ['execute'], models: ['healthCheck','understand','express','execute'], verifier: ['verifyModelResult','verifyToolResult'], progressWriter: ['write'] };
  for (const [name, methods] of Object.entries(required)) for (const method of methods) assert.equal(typeof deps[name]?.[method], 'function', `${name}.${method} missing`);
  const state = await deps.sessions.load('contract', 'user'); assert.ok(Array.isArray(state.originalMessages)); state.conversationId ||= 'contract'; assert.equal((await deps.sessions.save(state)).conversationId, 'contract'); await deps.sessions.appendMessage(state, { role: 'user', text: 'x' }); assert.ok(Array.isArray(await deps.sessions.history('contract')));
  let task = await deps.tasks.create({ messageId: 'contract-job', conversationId: 'contract', text: 'x' }); assert.ok(task.taskId); assert.ok(await deps.tasks.load('contract-job')); task = await deps.tasks.transitionTask(task.taskId, 'accepted', 'interpreting', 'test', 'test', {}); assert.equal(task.currentState, 'interpreting'); assert.ok(await deps.tasks.patch(task.taskId, { interpretation: { ok: true } })); assert.ok(await deps.tasks.latestNonTerminal('contract')); assert.ok(Array.isArray(await deps.tasks.list()));
  const verification = await deps.tools.execute('contract-job', { type: 'read_file', path: fixture.path }); assert.equal(verification.ok, true); assert.ok(verification.results[0].sha256); assert.equal(typeof verification.results[0].content, 'string');
  assert.equal((await deps.models.healthCheck()).ok, true); assert.equal(typeof (await deps.models.understand({})).text, 'string'); assert.equal(typeof (await deps.models.express({})).text, 'string'); assert.equal(typeof (await deps.models.execute({})).text, 'string'); assert.ok(deps.verifier.verifyModelResult({ text: 'ok' }).ok); assert.ok(deps.verifier.verifyToolResult({ type: 'read_file' }, verification).ok);
  assert.equal(await deps.progressWriter.write({ eventId: 'e', jobId: 'j', originalMessageId: 'm', conversationId: 'c', stage: 'executing', message: 'processing', createdAt: Date.now() }), true);
  return { ok: true, required };
}
