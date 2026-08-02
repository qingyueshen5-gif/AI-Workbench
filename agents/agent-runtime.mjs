import fs from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { ModelRouter } from './model-router.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { ActiveTaskController } from './active-task-controller.mjs';
import { TaskStore, TERMINAL_TASK_STATES } from '../channels/task-store.mjs';
import { runtimeRoot } from '../runtime-paths.mjs';
import { TaskInterpreter } from './task-interpreter.mjs';
import { CapabilityRegistry } from '../capabilities/capability-registry.mjs';
import { CapabilityScheduler } from '../capabilities/capability-scheduler.mjs';
import { LocalProcessProvider } from '../execution/local-process-provider.mjs';

function historyPrompt(history) {
  return history.slice(-20).map((item) => `${item.role === 'assistant' ? 'assistant' : item.role === 'tool' ? 'tool' : 'user'}: ${item.text}`).join('\n');
}

const readOnlyConstraint = /不要修改|只读|仅查看|不要写入|不要删除|read-?only/i;
const singleFileExt = /\.(?:md|txt|json|ya?ml|toml|csv|log|pdf|docx|xlsx)$/i;
const followupPattern = /^(?:这个|该|上述|刚才|文件中|文件里|为什么|再|那么|其中|下一步|还有|具体|它)/;
const statusPattern = /(?:当前|现在|实际).*(?:Runtime|Gateway|任务|状态)|(?:Runtime|Gateway|任务).*(?:状态|版本|进度|提交|PID)|status/i;
const complexPattern = /(?:编写|修改|修复|调试|构建|测试|运行|执行.*命令|终端|部署|跨文件|多个文件|多步|电脑操作|代码)/i;
const absolutePathPattern = /[A-Za-z]:[\\/][^\s，。；,;'"`]+|\/[^\s，。；,;'"`]+/;

function extractImportantGoal(content) {
  const marked = content.match(/<!--\s*AIW_NEXT_STEP_START\s*-->([\s\S]*?)<!--\s*AIW_NEXT_STEP_END\s*-->/i)?.[1]?.trim();
  if (marked) return marked;
  const section = content.match(/(?:当前最重要的目标|当前唯一下一步)[：:\s]*([\s\S]{1,1200}?)(?=\n#{1,3}\s|$)/)?.[1]?.trim();
  return section || content.trim().slice(0, 1200);
}

function progressMessage(state) {
  return ({
    accepted: 'Task accepted.',
    interpreting: 'Understanding the task.',
    scheduling: 'Planning execution.',
    ready: 'Execution plan is ready.',
    executing: 'Executing the task.',
    verifying: 'Verifying the result.'
  })[state] || '';
}

function normalizeClassification(classification, text) {
  const next = { relationToActiveTask: classification?.kind || 'new_task', ...classification };
  const value = String(text || '');
  if (!next.action && /读取|打开|查看|read|open/i.test(value)) next.action = 'read';
  if (!next.target) next.target = value.match(absolutePathPattern)?.[0] || '';
  if (!Array.isArray(next.constraints)) {
    next.constraints = [];
    if (readOnlyConstraint.test(value)) next.constraints.push('read_only');
  }
  return next;
}

function clarificationText(interpretation) {
  const questions = interpretation.context?.questions || [];
  return `Need clarification: ${questions.join(' ') || interpretation.goal}`;
}

export class RuntimeProgressController {
  constructor(job, emit, options = {}) {
    this.job = job;
    this.emit = emit || (async () => {});
    this.now = options.now || (() => Date.now());
    this.firstDelayMs = Number(options.firstDelayMs ?? 8000);
    this.minIntervalMs = Number(options.minIntervalMs ?? 20000);
    this.startedAt = this.now();
    this.lastSentAt = 0;
    this.lastSentState = '';
    this.closed = false;
  }

  async onTransition(task) {
    const message = progressMessage(task.currentState);
    if (this.closed || !message || task.currentState === this.lastSentState) return false;
    const createdAt = this.now();
    if (!this.lastSentAt && createdAt - this.startedAt < this.firstDelayMs) return false;
    if (this.lastSentAt && createdAt - this.lastSentAt < this.minIntervalMs) return false;
    await this.emit({
      eventId: `${task.taskId}-${task.stateHistory.length}-${createdAt}`,
      taskId: task.taskId,
      jobId: task.taskId,
      originalMessageId: task.originalMessageId,
      conversationId: task.conversationId,
      stage: task.currentState,
      state: task.currentState,
      message,
      createdAt
    });
    this.lastSentAt = createdAt;
    this.lastSentState = task.currentState;
    return true;
  }

  close() {
    this.closed = true;
  }
}

export class AgentRuntime {
  constructor(options = {}) {
    this.sessions = options.sessions || new SessionStore(options.sessionOptions);
    this.tasks = options.tasks || (typeof options.activeTasks?.transitionTask === 'function' ? options.activeTasks : null) || new TaskStore(options.taskOptions);
    this.activeController = options.activeController || new ActiveTaskController({ store: this.tasks });
    this.models = options.models || new ModelRouter(options.modelOptions);
    this.tools = options.tools || new ToolExecutor({ root: options.root || process.cwd(), allowedRoots: options.allowedRoots || [process.cwd()] });
    this.verifier = options.verifier || new ResultVerifier();
    this.onStage = options.onStage || (async () => {});
    this.onProgress = options.onProgress || (async () => {});
    this.progressOptions = options.progressOptions || {};
    this.capabilityRegistry = options.capabilityRegistry || new CapabilityRegistry();
    this.taskInterpreter = options.taskInterpreter || new TaskInterpreter({ model: this.models });
    this.scheduler = options.scheduler || new CapabilityScheduler({ registry: this.capabilityRegistry });
    this.providers = new Map(Object.entries(options.providers || { 'local-process-provider': options.processProvider || new LocalProcessProvider() }));
    this.statePaths = options.statePaths || {
      gateway: resolve(runtimeRoot, 'feishu-workbench-bridge', 'gateway-health.json'),
      runtime: resolve(runtimeRoot, 'feishu-workbench-bridge', 'ipc', 'worker-state.json')
    };
  }

  async transition(task, to, reason, actor, evidence, progress) {
    const next = await this.tasks.transitionTask(task.taskId, task.currentState, to, reason, actor, evidence);
    await this.onStage({ messageId: next.originalMessageId, taskId: next.taskId, conversationId: next.conversationId }, next.currentState);
    await progress?.onTransition(next);
    return next;
  }

  async terminalResult(task) {
    return {
      ...(task.finalResult || {}),
      text: task.finalResult?.text || '',
      provider: task.finalResult?.provider || 'ai-workbench',
      providerSessionId: task.finalResult?.providerSessionId || '',
      toolUsed: task.finalResult?.toolUsed || '',
      verified: task.finalResult?.verified !== false,
      activeTaskId: task.taskId,
      taskId: task.taskId,
      terminalState: task.currentState,
      replayed: true,
      metrics: { readFileCalls: 0, codexCalls: 0, ...(task.finalResult?.metrics || {}) }
    };
  }

  async finalize(task, finalResult, progress) {
    const current = await this.tasks.load(task.taskId);
    if (!current) throw new Error(`Task not found: ${task.taskId}`);
    if (TERMINAL_TASK_STATES.has(current.currentState)) return this.terminalResult(current);
    const patched = await this.tasks.patch(task.taskId, { finalResult });
    const completed = await this.transition(patched, 'completed', 'final_result_bound', 'agent-runtime', {
      provider: finalResult.provider,
      toolUsed: finalResult.toolUsed || '',
      messageId: finalResult.messageId
    }, progress);
    return { ...finalResult, activeTaskId: completed.taskId, taskId: completed.taskId };
  }

  async failTask(task, error, progress) {
    if (!task || TERMINAL_TASK_STATES.has(task.currentState)) return;
    const latest = await this.tasks.load(task.taskId).catch(() => null);
    if (!latest || TERMINAL_TASK_STATES.has(latest.currentState)) return;
    await this.tasks.patch(latest.taskId, { failure: { message: error.message || String(error), name: error.name || 'Error' } }).catch(() => {});
    await this.transition(latest, 'failed', 'runtime_error', 'agent-runtime', { error: error.message || String(error), name: error.name || 'Error' }, progress).catch(() => {});
  }

  async executeCapabilityPlan(plan, interpretation) {
    const results = [];
    for (const assignment of plan.assignments) {
      let completed = null;
      let lastError = null;
      for (const providerSpec of [assignment.primaryProvider, ...assignment.fallbackProviders]) {
        const provider = this.providers.get(providerSpec.providerId);
        if (!provider) {
          lastError = new Error(`Provider not connected: ${providerSpec.providerId}`);
          continue;
        }
        try {
          if (assignment.capabilityId === 'process.list') completed = { providerId: providerSpec.providerId, result: { ok: true, processes: await provider.list() } };
          else if (assignment.capabilityId === 'process.stop') {
            const target = interpretation.targets.find((item) => item.type === 'process' || item.type === 'application_process') || {};
            completed = { providerId: providerSpec.providerId, result: await provider.stop({ pid: target.pid, exactName: target.exactName }) };
          } else throw new Error(`Runtime capability not connected: ${assignment.capabilityId}`);
          this.verifier.verifyCapabilityResult(assignment.capabilityId, completed.result);
          break;
        } catch (error) {
          lastError = error;
          completed = null;
        }
      }
      if (!completed) throw lastError || new Error(`Capability failed: ${assignment.capabilityId}`);
      results.push({ capabilityId: assignment.capabilityId, ...completed });
    }
    return results;
  }

  async groundedStatus(text, taskId, conversationId) {
    const read = async (path) => {
      try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return null; }
    };
    const [gateway, runtime] = await Promise.all([read(this.statePaths.gateway), read(this.statePaths.runtime)]);
    const task = taskId ? await this.tasks.load(taskId) : await this.tasks.latestNonTerminal(conversationId);
    const parts = [];
    if (/Gateway/i.test(text)) parts.push(gateway ? `Gateway PID ${gateway.pid}, commit ${gateway.gitCommit || 'unknown'}, connection ${gateway.connectionState || gateway.status || 'unknown'}.` : 'No Gateway health evidence is available.');
    if (/Runtime/i.test(text)) parts.push(runtime ? `Runtime PID ${runtime.pid}, commit ${runtime.gitCommit || 'unknown'}, status ${runtime.status || 'unknown'}.` : 'No Runtime health evidence is available.');
    if (/任务|进度|task/i.test(text)) parts.push(task ? `Task ${task.taskId} state: ${task.currentState}. Reason: ${task.stateReason || 'unknown'}.` : 'No active task state evidence is available.');
    return parts.join('\n') || 'No live status evidence is available.';
  }

  async handle(job) {
    const conversationId = job.conversationId || job.chatId;
    const taskId = job.taskId || job.messageId;
    const progress = new RuntimeProgressController({ ...job, taskId }, this.onProgress, this.progressOptions);
    let task = null;
    try {
      const existing = await this.tasks.load(taskId);
      if (existing && TERMINAL_TASK_STATES.has(existing.currentState)) return this.terminalResult(existing);

      const control = await this.activeController.handle({ ...job, taskId });
      if (control.intercepted) {
        if (control.kind === 'cancel' || control.kind === 'pause') this.models.cancel?.(conversationId);
        return {
          text: control.text,
          provider: 'ai-workbench',
          providerSessionId: '',
          toolUsed: '',
          verified: true,
          controlKind: control.kind,
          activeTaskId: control.activeTaskId,
          taskId: control.activeTaskId,
          classification: control.classification,
          metrics: { readFileCalls: 0, codexCalls: 0 }
        };
      }

      const classification = normalizeClassification(control.classification, job.text);
      const state = await this.sessions.load(conversationId, job.openId);
      task = existing || await this.tasks.create({ ...job, taskId });
      await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId, taskId });
      task = await this.transition(task, 'interpreting', 'interpreter_started', 'agent-runtime', { messageId: job.messageId }, progress);

      const interpretation = await this.taskInterpreter.interpret({
        text: job.text,
        conversationContext: (state.originalMessages || []).slice(-12),
        environmentContext: { platform: process.platform }
      });
      task = await this.tasks.patch(task.taskId, { interpretation });

      if (interpretation.taskType === 'clarification') {
        const text = clarificationText(interpretation);
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'task-interpreter', taskId });
        task = await this.tasks.patch(task.taskId, { waitingFor: { missingFields: interpretation.context.missingFields, questions: interpretation.context.questions, confidence: interpretation.confidence } });
        await this.transition(task, 'waiting_for_clarification', 'clarification_required', 'task-interpreter', {
          missingFields: interpretation.context.missingFields,
          questions: interpretation.context.questions,
          confidence: interpretation.confidence
        }, progress);
        return { text, provider: 'task-interpreter', toolUsed: '', verified: true, interpretation, schedulerStatus: 'needs_clarification', classification, activeTaskId: task.taskId, taskId: task.taskId, metrics: { readFileCalls: 0, codexCalls: 0 } };
      }

      task = await this.transition(task, 'scheduling', 'scheduler_started', 'agent-runtime', { requiredCapabilities: interpretation.requiredCapabilities }, progress);
      const capabilityPlan = this.scheduler.plan(interpretation, { taskId: task.taskId, userId: job.openId || job.userId || '', authorizationContexts: job.authorizationContexts || [] });
      task = await this.tasks.patch(task.taskId, { schedulerAssignment: capabilityPlan });

      if (capabilityPlan.status === 'needs_confirmation') {
        const text = `This task needs confirmation before execution: ${interpretation.goal}`;
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'capability-scheduler', taskId });
        task = await this.tasks.patch(task.taskId, { waitingFor: { confirmation: true, reason: 'capability_scheduler' } });
        await this.transition(task, 'waiting_for_confirmation', 'confirmation_required', 'capability-scheduler', { riskLevel: interpretation.riskLevel, requiredCapabilities: interpretation.requiredCapabilities }, progress);
        return { text, provider: 'capability-scheduler', toolUsed: '', verified: true, interpretation, schedulerStatus: capabilityPlan.status, classification, activeTaskId: task.taskId, taskId: task.taskId, metrics: { readFileCalls: 0, codexCalls: 0 } };
      }

      if (capabilityPlan.status === 'capability_unavailable') {
        const text = `Missing capabilities: ${capabilityPlan.missingCapabilities.join(', ')}. The task was not executed.`;
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'capability-scheduler', taskId });
        task = await this.tasks.patch(task.taskId, { finalResult: { messageId: job.messageId, text, provider: 'capability-scheduler', toolUsed: '', verified: true, metrics: { readFileCalls: 0, codexCalls: 0 } } });
        await this.transition(task, 'capability_unavailable', 'capability_unavailable', 'capability-scheduler', { missingCapabilities: capabilityPlan.missingCapabilities }, progress);
        return { text, provider: 'capability-scheduler', toolUsed: '', verified: true, interpretation, schedulerStatus: capabilityPlan.status, classification, activeTaskId: task.taskId, taskId: task.taskId, metrics: { readFileCalls: 0, codexCalls: 0 } };
      }

      task = await this.transition(task, 'ready', 'schedule_ready', 'capability-scheduler', { assignments: capabilityPlan.assignments.map((item) => item.capabilityId) }, progress);

      const processCapabilities = interpretation.requiredCapabilities.filter((item) => item === 'process.list' || item === 'process.stop');
      if (processCapabilities.length) {
        task = await this.transition(task, 'executing', 'process_capability_execution_started', 'agent-runtime', { capabilities: processCapabilities }, progress);
        const results = await this.executeCapabilityPlan({ ...capabilityPlan, assignments: capabilityPlan.assignments.filter((item) => processCapabilities.includes(item.capabilityId)) }, interpretation);
        task = await this.tasks.patch(task.taskId, { providerExecution: { provider: 'local-process-provider', results } });
        task = await this.transition(task, 'verifying', 'process_capability_verifying', 'agent-runtime', { resultCount: results.length }, progress);
        const stopped = results.find((item) => item.capabilityId === 'process.stop');
        if (!stopped) throw new Error('process.stop result missing');
        const text = `Completed: ${interpretation.goal}. Stopped PID ${stopped.result.target.pid} and verified it is absent.`;
        await this.sessions.appendMessage(state, { role: 'tool', text: JSON.stringify({ capability: 'process.stop', provider: stopped.providerId, pid: stopped.result.target.pid, verified: true }), messageId: job.messageId, provider: stopped.providerId, taskId });
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: stopped.providerId, taskId });
        return this.finalize(task, { messageId: job.messageId, text, provider: stopped.providerId, toolUsed: 'process.stop', verified: true, interpretation, schedulerStatus: capabilityPlan.status, capabilityResults: results, metrics: { readFileCalls: 0, codexCalls: 0, processStopCalls: 1 } }, progress);
      }

      if (statusPattern.test(job.text)) {
        task = await this.transition(task, 'verifying', 'status_grounding_started', 'agent-runtime', { statePaths: this.statePaths }, progress);
        const text = await this.groundedStatus(job.text, job.parentTaskId, conversationId);
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'local-status', taskId });
        return this.finalize(task, { messageId: job.messageId, text, provider: 'local-status', providerSessionId: '', toolUsed: 'status_grounding', verified: true, classification, metrics: { readFileCalls: 0, codexCalls: 0 } }, progress);
      }

      const directRead = classification.action === 'read' && isAbsolute(classification.target || '') && singleFileExt.test(classification.target) && (readOnlyConstraint.test(job.text) || !complexPattern.test(job.text));
      if (directRead) {
        task = await this.transition(task, 'executing', 'read_file_started', 'agent-runtime', { path: classification.target }, progress);
        const before = await fs.stat(classification.target);
        const verification = await this.tools.execute(job.messageId, { type: 'read_file', path: classification.target });
        const after = await fs.stat(classification.target);
        const item = verification.results?.[0];
        if (!item?.content) throw new Error('File read returned no content');
        if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || item.sha256 !== item.currentSha256) throw new Error('Read-only task detected file mutation');
        const evidence = { path: item.path, mtimeMs: after.mtimeMs, size: after.size, sha256: item.sha256, content: item.content, readAt: Date.now(), sourceMessageId: job.messageId };
        state.lastFileEvidence = evidence;
        await this.sessions.save(state);
        task = await this.tasks.patch(task.taskId, { providerExecution: { provider: 'read_file', evidence: { ...evidence, content: undefined } } });
        task = await this.transition(task, 'verifying', 'read_file_verified', 'agent-runtime', { path: evidence.path, sha256: evidence.sha256 }, progress);
        const goal = extractImportantGoal(item.content);
        const text = `Read \`${evidence.path}\`. Current most important goal: ${goal}\n\nEvidence: size ${evidence.size} bytes, SHA-256 \`${evidence.sha256}\`; file was not modified.`;
        await this.sessions.appendMessage(state, { role: 'tool', text: goal, messageId: job.messageId, provider: 'read_file', evidence: { ...evidence, content: undefined }, taskId });
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'local-read', taskId });
        return this.finalize(task, { messageId: job.messageId, text, provider: 'local-read', providerSessionId: '', toolUsed: 'read_file', verified: true, classification, evidence: { ...evidence, content: undefined }, metrics: { readFileCalls: 1, codexCalls: 0 } }, progress);
      }

      if (state.lastFileEvidence && followupPattern.test(String(job.text || '').trim())) {
        const finalModel = await this.models.express({ messages: [{ role: 'system', content: 'Answer only from the provided file-read evidence. Do not claim a new file read.' }, { role: 'user', content: `Follow-up: ${job.text}\nPath: ${state.lastFileEvidence.path}\nContent: ${state.lastFileEvidence.content}` }] });
        task = await this.transition(task, 'verifying', 'followup_answer_verified', 'agent-runtime', { reusedFileEvidence: true }, progress);
        const text = this.verifier.verifyModelResult(finalModel).text;
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek', taskId });
        return this.finalize(task, { messageId: job.messageId, text, provider: 'deepseek', providerSessionId: '', toolUsed: '', verified: true, classification, metrics: { readFileCalls: 0, codexCalls: 0, reusedFileEvidence: true } }, progress);
      }

      const codeTask = interpretation.taskType === 'code_task' && interpretation.requiredCapabilities.some((item) => item.startsWith('code.'));
      if (codeTask) {
        const codeCapabilities = interpretation.requiredCapabilities.filter((item) => item.startsWith('code.'));
        const writable = codeCapabilities.includes('code.modify');
        const workspaceTarget = interpretation.targets.find((item) => item?.type === 'project' || item?.type === 'workspace');
        const workspace = resolve(workspaceTarget?.path || process.cwd());
        const executionPrompt = JSON.stringify({ goal: interpretation.goal, actions: interpretation.actions, targets: interpretation.targets, constraints: interpretation.constraints, successCriteria: interpretation.successCriteria, userMessage: job.text });
        task = await this.transition(task, 'executing', 'code_execution_started', 'agent-runtime', { workspace, writable }, progress);
        const execution = await this.models.execute({ conversationId, prompt: executionPrompt, workspace, writable });
        await this.sessions.appendMessage(state, { role: 'tool', text: execution.text, messageId: job.messageId, provider: 'codex', providerSessionId: execution.sessionId, taskId });
        task = await this.tasks.patch(task.taskId, { providerExecution: { provider: 'codex', sessionId: execution.sessionId, text: execution.text } });
        task = await this.transition(task, 'verifying', 'code_execution_verifying', 'agent-runtime', { sessionId: execution.sessionId }, progress);
        this.verifier.verifyCodeResult?.({ capabilities: codeCapabilities, execution, workspace, writable, successCriteria: interpretation.successCriteria });
        const finalModel = await this.models.express({ messages: [{ role: 'system', content: 'Summarize the verified execution result as the final user reply.' }, { role: 'user', content: `Original request: ${job.text}\nExecution result: ${execution.text}` }] });
        const text = this.verifier.verifyModelResult(finalModel).text;
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek', taskId });
        return this.finalize(task, { messageId: job.messageId, text, provider: 'deepseek', providerSessionId: execution.sessionId, toolUsed: 'codex', verified: true, classification, metrics: { readFileCalls: 0, codexCalls: 1 } }, progress);
      }

      const conversationTask = interpretation.taskType === 'chat' || interpretation.requiredCapabilities.length === 0;
      if (!conversationTask) throw new Error(`Runtime capability not connected: ${interpretation.requiredCapabilities.join(', ')}`);
      task = await this.transition(task, 'verifying', 'conversation_answer_verifying', 'agent-runtime', { taskType: interpretation.taskType }, progress);
      const finalModel = await this.models.express({ messages: [{ role: 'system', content: 'Answer naturally from the structured task interpretation. Do not claim unexecuted tools or operations.' }, { role: 'user', content: JSON.stringify({ task: interpretation, userMessage: job.text, conversationContext: historyPrompt(state.originalMessages || []) }) }] });
      const text = this.verifier.verifyModelResult(finalModel).text;
      await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek', taskId });
      return this.finalize(task, { messageId: job.messageId, text, provider: 'deepseek', providerSessionId: '', toolUsed: '', verified: true, interpretation, schedulerStatus: capabilityPlan.status, classification, metrics: { readFileCalls: 0, codexCalls: 0 } }, progress);
    } catch (error) {
      await this.failTask(task, error, progress);
      throw error;
    } finally {
      progress.close();
    }
  }
}
