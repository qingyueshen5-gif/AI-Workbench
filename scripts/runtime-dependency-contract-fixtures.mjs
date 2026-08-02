import assert from 'node:assert/strict';

export class ContractSessionStore {
  constructor(initial = {}) { this.states = new Map(Object.entries(initial)); }
  async load(conversationId, userId = '') { if (!this.states.has(conversationId)) this.states.set(conversationId, { schemaVersion: '1.0', conversationId, userId, originalMessages: [] }); return this.states.get(conversationId); }
  async save(state) { assert.ok(state?.conversationId); this.states.set(state.conversationId, state); return state; }
  async appendMessage(state, message) { state.originalMessages = [...(state.originalMessages || []), message]; return this.save(state); }
  async history(conversationId, limit = 20) { return (await this.load(conversationId)).originalMessages.slice(-limit); }
}
export class ContractActiveTaskStore {
  constructor(task = null) { this.task = task; }
  async load() { return this.task; }
  async save(task) { assert.ok(task?.conversationId); this.task = { ...task, updatedAt: Date.now() }; return this.task; }
  async create(job) { return this.save({ activeTaskId: job.activeTaskId || job.messageId, conversationId: job.conversationId || job.chatId, originalMessageId: job.originalMessageId || job.messageId, originalUserGoal: job.text, effectiveUserGoal: job.text, stage: 'accepted', currentStep: '任务已接收', completedSteps: [], currentActor: 'AI Workbench', startedAt: Date.now(), lastProgressAt: Date.now(), toolResults: [], paused: false, waitingUser: false, estimatedRemainingRange: '', latestFailureReason: '', supplementalInstructions: [], cancelled: false }); }
  async update(conversationId, patch) { if (!this.task) return null; return this.save({ ...this.task, ...patch, conversationId, lastProgressAt: patch.lastProgressAt || Date.now() }); }
  async addCompletedStep(conversationId, step) { if (!this.task) return null; return this.save({ ...this.task, conversationId, completedSteps: [...new Set([...(this.task.completedSteps || []), step])] }); }
  async addToolResult(conversationId, result) { if (!this.task) return null; return this.save({ ...this.task, conversationId, toolResults: [...(this.task.toolResults || []), result].slice(-10) }); }
  async active() { return this.task && !['completed', 'failed'].includes(this.task.stage) && !this.task.cancelled ? this.task : null; }
  async list() { return this.task ? [this.task] : []; }
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
export class ContractVerifier { verifyModelResult(result) { assert.equal(typeof result?.text, 'string'); if (!result.text.trim()) throw new Error('empty model result'); return { ok: true, text: result.text.trim() }; } verifyToolResult(call, verification) { assert.ok(call?.type); assert.equal(verification?.ok, true); return { ok: true, verification }; } }
export class ContractProgressWriter { constructor() { this.events = []; } async write(event) { for (const key of ['eventId','jobId','originalMessageId','conversationId','stage','message','createdAt']) assert.ok(event[key]); this.events.push(event); return true; } }
export class ContractTaskInterpreter { constructor(handler) { this.handler = handler; this.calls = []; } async interpret(input) { this.calls.push(input); return this.handler(input); } }

export async function verifyAgentRuntimeDependencyContracts(deps, fixture) {
  const required = { sessions: ['load','save','appendMessage','history'], activeTasks: ['load','save','create','update','addCompletedStep','addToolResult','active','list'], tools: ['execute'], models: ['healthCheck','understand','express','execute'], verifier: ['verifyModelResult','verifyToolResult'], progressWriter: ['write'] };
  for (const [name, methods] of Object.entries(required)) for (const method of methods) assert.equal(typeof deps[name]?.[method], 'function', `${name}.${method} missing`);
  const state = await deps.sessions.load('contract', 'user'); assert.ok(Array.isArray(state.originalMessages)); state.conversationId ||= 'contract'; assert.equal((await deps.sessions.save(state)).conversationId, 'contract'); await deps.sessions.appendMessage(state, { role: 'user', text: 'x' }); assert.ok(Array.isArray(await deps.sessions.history('contract')));
  const task = await deps.activeTasks.create({ messageId: 'contract-job', conversationId: 'contract', text: 'x' }); assert.ok(task.activeTaskId); assert.ok(await deps.activeTasks.load('contract')); assert.ok(await deps.activeTasks.update('contract', { stage: 'planning' })); await deps.activeTasks.addCompletedStep('contract', 'step'); await deps.activeTasks.addToolResult('contract', { summary: 'result' }); assert.ok(await deps.activeTasks.active('contract')); assert.ok(Array.isArray(await deps.activeTasks.list()));
  const verification = await deps.tools.execute('contract-job', { type: 'read_file', path: fixture.path }); assert.equal(verification.ok, true); assert.ok(verification.results[0].sha256); assert.equal(typeof verification.results[0].content, 'string');
  assert.equal((await deps.models.healthCheck()).ok, true); assert.equal(typeof (await deps.models.understand({})).text, 'string'); assert.equal(typeof (await deps.models.express({})).text, 'string'); assert.equal(typeof (await deps.models.execute({})).text, 'string'); assert.ok(deps.verifier.verifyModelResult({ text: 'ok' }).ok); assert.ok(deps.verifier.verifyToolResult({ type: 'read_file' }, verification).ok);
  assert.equal(await deps.progressWriter.write({ eventId:'e',jobId:'j',originalMessageId:'m',conversationId:'c',stage:'executing',message:'处理中',createdAt:Date.now() }), true);
  return { ok: true, required };
}
