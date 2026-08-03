import fs from 'node:fs/promises';
import { resolve } from 'node:path';
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
import { LocalGroundedProvider } from '../execution/local-grounded-provider.mjs';
import { extractGroundTruth } from './original-ground-truth-extractor.mjs';
import { InterpreterAdapter } from './interpreter-adapter.mjs';
import { toNonExecutionRuntimeResult } from './interpreter-adapter-contract.mjs';
import { NonExecutionMessageStore, nonExecutionIdentity } from '../channels/non-execution-message-store.mjs';

function historyPrompt(history) {
  return history.slice(-20).map((item) => `${item.role === 'assistant' ? 'assistant' : item.role === 'tool' ? 'tool' : 'user'}: ${item.text}`).join('\n');
}

const readOnlyConstraint = /不要修改|只读|仅查看|不要写入|不要删除|read-?only/i;
const absolutePathPattern = /[A-Za-z]:[\\/][^\s，。；,;'"`]+|\/[^\s，。；,;'"`]+/;

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
    this.interpreterAdapter = options.interpreterAdapter || new InterpreterAdapter();
    this.groundTruthExtractor = options.groundTruthExtractor || extractGroundTruth;
    this.nonExecutionMessages = options.nonExecutionMessages || new NonExecutionMessageStore(options.nonExecutionMessageOptions);
    this.deliveryKeyFor = options.deliveryKeyFor || ((identity) => `result:${identity.channel}:${identity.stableMessageId}`);
    this.scheduler = options.scheduler || new CapabilityScheduler({ registry: this.capabilityRegistry });
    this.statePaths = options.statePaths || {
      gateway: resolve(runtimeRoot, 'feishu-workbench-bridge', 'gateway-health.json'),
      runtime: resolve(runtimeRoot, 'feishu-workbench-bridge', 'ipc', 'worker-state.json')
    };
    const groundedProvider = options.groundedProvider || new LocalGroundedProvider({ readState: options.readRuntimeState || ((context) => this.groundedStatus(context?.text || 'Runtime status', context?.taskId, context?.conversationId)), toolExecutor:this.tools });
    this.providers = new Map(Object.entries(options.providers || { 'local-process-provider': options.processProvider || new LocalProcessProvider(), 'local-runtime-state': groundedProvider, 'local-tool-executor': groundedProvider }));
  }

  async transition(task, to, reason, actor, evidence, progress) {
    const next = await this.tasks.transitionTask(task.taskId, task.currentState, to, reason, actor, evidence);
    await this.onStage({ messageId: next.originalMessageId, taskId: next.taskId, conversationId: next.conversationId }, next.currentState);
    await progress?.onTransition(next);
    return next;
  }

  async executeWithRun(task,{leaseOwner,providerId},providerStart){
    const activated=await this.tasks.startRun(task.taskId,{expectedTaskRevision:task.taskRevision,leaseOwner,providerId});
    const identity={taskId:activated.taskId,runId:activated.activeRunId,taskRevision:activated.taskRevision};
    await this.tasks.transitionRun(activated.taskId,{...identity,from:'created',to:'starting'});
    try {
      const result=await providerStart(identity);
      await this.tasks.transitionRun(activated.taskId,{...identity,from:'starting',to:'running',evidence:{providerId}});
      return {identity,result};
    } catch (error) {
      await this.tasks.failRunVerification(activated.taskId,identity,{passed:false,verifierId:'ResultVerifier',verificationMethod:'capability-result-verification',evidenceReferences:[],failureReason:error.message||String(error),verifiedAt:Date.now()});
      throw error;
    }
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

  async executeCapabilityPlan(plan, interpretation, runIdentity = null) {
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
          } else if (assignment.capabilityId === 'runtime.status') {
            completed = { providerId: providerSpec.providerId, result: await provider.status({ text: interpretation.goal, taskId: runIdentity?.taskId, conversationId: interpretation.context?.conversationId, ...runIdentity }) };
          } else if (assignment.capabilityId === 'file.read') {
            const target = interpretation.targets.find((item) => item.path) || {};
            completed = { providerId: providerSpec.providerId, result: await provider.read({ path: target.path, ...runIdentity }) };
          } else throw new Error(`Runtime capability not connected: ${assignment.capabilityId}`);
          const rawVerification = this.verifier.verifyCapabilityResult(assignment.capabilityId, completed.result);
          const passed = rawVerification?.passed === false ? false : rawVerification?.ok === true;
          const verification = { ...rawVerification, verifierId: rawVerification?.verifierId || this.verifier.constructor?.name || 'ResultVerifier', verificationMethod: rawVerification?.verificationMethod || providerSpec.verificationMethod || 'capability-result-verification', evidenceReferences: rawVerification?.evidenceReferences || completed.result?.evidence?.evidenceReferences || (completed.result?.evidence?.path ? [completed.result.evidence.path] : []), passed, failureReason: passed ? null : (rawVerification?.failureReason || 'Verifier rejected capability result'), verifiedAt: rawVerification?.verifiedAt || Date.now() };
          if (!verification.passed) throw Object.assign(new Error(verification.failureReason), { verification });
          completed = { ...completed, verification };
          break;
        } catch (error) {
          lastError = error;
          completed = null;
        }
      }
      if (!completed) throw lastError || new Error(`Capability failed: ${assignment.capabilityId}`);
      results.push({ capabilityId: assignment.capabilityId, ...completed, ...(runIdentity || {}) });
    }
    return results;
  }

  assertProviderAuthorized(assignment) {
    if (assignment.authorization?.required && assignment.authorization?.valid !== true) throw new Error(`Provider execution authorization missing: ${assignment.capabilityId}`);
  }

  async groundedStatus(text, taskId, conversationId) {
    const read = async (path) => {
      const readAt=Date.now();
      try { return {ok:true,value:JSON.parse(await fs.readFile(path, 'utf8')),readAt}; } catch (error) { return {ok:false,value:null,readAt,errorCode:error?.code||'READ_FAILED'}; }
    };
    const [gateway, runtime] = await Promise.all([read(this.statePaths.gateway), read(this.statePaths.runtime)]);
    const task = taskId ? await this.tasks.load(taskId) : await this.tasks.latestNonTerminal(conversationId);
    const parts = [];
    const evidenceSources=[];
    if (/Gateway/i.test(text)&&gateway.ok){parts.push(`Gateway PID ${gateway.value.pid}, commit ${gateway.value.gitCommit || 'unknown'}, connection ${gateway.value.connectionState || gateway.value.status || 'unknown'}.`);evidenceSources.push({sourceId:'gateway-health',sourceType:'file',path:this.statePaths.gateway,read:true,readAt:gateway.readAt});}
    if (/Runtime/i.test(text)&&runtime.ok){parts.push(`Runtime PID ${runtime.value.pid}, commit ${runtime.value.gitCommit || 'unknown'}, status ${runtime.value.status || 'unknown'}.`);evidenceSources.push({sourceId:'runtime-worker-state',sourceType:'file',path:this.statePaths.runtime,read:true,readAt:runtime.readAt});}
    if (/任务|进度|task/i.test(text)) parts.push(task ? `Task ${task.taskId} state: ${task.currentState}. Reason: ${task.stateReason || 'unknown'}.` : 'No active task state evidence is available.');
    if(task&&/任务|进度|task/i.test(text))evidenceSources.push({sourceId:`task:${task.taskId}`,sourceType:'task-store',read:true,readAt:Date.now()});
    return {ok:parts.length>0&&evidenceSources.length>0,text:parts.join('\n'),evidenceSources,failures:[gateway.ok?null:{sourceId:'gateway-health',sourceType:'file',failure:gateway.errorCode},runtime.ok?null:{sourceId:'runtime-worker-state',sourceType:'file',failure:runtime.errorCode}].filter(Boolean)};
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
      const groundTruth = this.groundTruthExtractor(String(job.text || ''));
      const adapterResult = this.interpreterAdapter.adapt({ originalText: String(job.text || ''), groundTruth, semanticCandidate: job.semanticCandidate || null });
      if (adapterResult.decision !== 'execute') {
        const identity=nonExecutionIdentity(job);const claimed=await this.nonExecutionMessages.claim(identity,adapterResult.decision,{ownerId:job.nonExecutionOwnerId});
        const replay=(completed)=>({...completed.result,messageReplayed:true,taskReplayed:false,executionStarted:false,deliveryKey:completed.deliveryKey,adapterResult});
        if(!claimed.acquired){
          if(claimed.status==='COMPLETED')return replay(claimed.result);
          if(claimed.status==='FAILED')return {decision:adapterResult.decision,messageReplayed:true,taskReplayed:false,executionStarted:false,failed:true,failureReason:claimed.failure.failureReason,adapterResult};
          const settled=await this.nonExecutionMessages.waitForResult(identity.key);
          if(settled.status==='COMPLETED')return replay(settled.result);
          return {decision:adapterResult.decision,messageReplayed:true,taskReplayed:false,executionStarted:false,inProgress:settled.status==='CLAIMED',failed:settled.status==='FAILED',failureReason:settled.failure?.failureReason||'',adapterResult};
        }
        try{
          const state = await this.sessions.load(conversationId, job.openId);
          const result = toNonExecutionRuntimeResult(adapterResult, { originalMessageId: identity.stableMessageId });
          const deliveryKey=this.deliveryKeyFor(identity,adapterResult.decision);
          const completed=await this.nonExecutionMessages.complete(identity,claimed.claim.ownerId,result,{deliveryKey});
          await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId,originalMessageId:identity.stableMessageId });
          await this.sessions.appendMessage(state, { role: 'assistant', text: result.text, messageId: job.messageId,originalMessageId:identity.stableMessageId, provider: result.provider,deliveryKey });
          return { ...result,messageReplayed:false,taskReplayed:false,executionStarted:false,deliveryKey,adapterResult };
        }catch(error){await this.nonExecutionMessages.fail(identity,claimed.claim.ownerId,error);throw error;}
      }

      const state = await this.sessions.load(conversationId, job.openId);
      task = existing || await this.tasks.create({ ...job, taskId });
      await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId, taskId });
      task = await this.transition(task, 'interpreting', 'interpreter_started', 'agent-runtime', { messageId: job.messageId }, progress);

      const interpretation = adapterResult.taskDraft;
      task = await this.tasks.patch(task.taskId, { interpretation, groundTruth, adapterResult });

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

      const groundedCapabilities = interpretation.requiredCapabilities.filter((item) => item === 'runtime.status' || item === 'file.read');
      const groundedAssignments = capabilityPlan.assignments.filter((item) => item.capabilityId === 'runtime.status' || item.capabilityId === 'file.read');
      if (groundedCapabilities.length && groundedAssignments.length === 0) throw new Error('Grounded capability assignment missing');
      if (groundedAssignments.length > 1) {
        const text = '我识别到多个可执行任务：检查Runtime状态、读取文件。当前版本一次只执行一个任务，因此没有启动任何操作。请告诉我先执行哪一个。';
        const rejection = { code: 'MULTIPLE_GROUNDED_ASSIGNMENTS', assignmentCount: groundedAssignments.length, capabilities: groundedAssignments.map((item) => item.capabilityId), providerStarts: 0, effectiveExecutionRunStarted: 0 };
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'capability-scheduler', taskId });
        task = await this.tasks.patch(task.taskId, { failure: rejection, protocolRejection: rejection });
        await this.transition(task, 'failed', 'multiple_grounded_assignments_rejected', 'agent-runtime', rejection, progress);
        return { messageId: job.messageId, text, provider: 'capability-scheduler', providerSessionId: '', toolUsed: '', verified: false, interpretation, schedulerStatus: 'protocol_rejected', classification, activeTaskId: task.taskId, taskId: task.taskId, rejection, metrics: { readFileCalls: 0, codexCalls: 0, providerStarts: 0, effectiveExecutionRunStarted: 0 } };
      }
      if (groundedCapabilities.length) {
        const assignments = groundedAssignments;
        if (assignments.length !== groundedCapabilities.length) throw new Error('Grounded capability assignment mismatch');
        for (const assignment of assignments) this.assertProviderAuthorized(assignment);
        task = await this.transition(task, 'executing', 'grounded_capability_execution_started', 'agent-runtime', { capabilities: groundedCapabilities }, progress);
        const started = await this.executeWithRun(task, { leaseOwner: String(job.leaseOwner || job.workerId || 'agent-runtime'), providerId: assignments[0]?.primaryProvider?.providerId || 'grounded-provider' }, (identity) => this.executeCapabilityPlan({ ...capabilityPlan, assignments }, interpretation, identity));
        const results = started.result;
        task = await this.tasks.patch(task.taskId, { providerExecution: { provider: assignments[0]?.primaryProvider?.providerId || 'grounded-provider', results } });
        task = await this.transition(task, 'verifying', 'grounded_capability_verifying', 'agent-runtime', { capabilities: groundedCapabilities, runId: started.identity.runId }, progress);
        const verificationResults = results.map((item) => item.verification);
        const verificationRecord = {
          verifierId: this.verifier.constructor?.name || 'ResultVerifier',
          verificationMethod: verificationResults.map((item) => item.verificationMethod).join(','),
          evidenceReferences: verificationResults.flatMap((item) => item.evidenceReferences || []),
          passed: verificationResults.length === results.length && verificationResults.every((item) => item.passed === true),
          failureReason: verificationResults.find((item) => item.passed !== true)?.failureReason || null,
          verifiedAt: Math.max(...verificationResults.map((item) => Number(item.verifiedAt) || 0)),
          results: verificationResults,
          ...started.identity
        };
        await this.tasks.bindRunVerification(task.taskId, started.identity, verificationRecord);
        const status = results.find((item) => item.capabilityId === 'runtime.status');
        const read = results.find((item) => item.capabilityId === 'file.read');
        const text = status ? status.result.text : `Read \`${read.result.evidence.path}\`. Evidence: size ${read.result.evidence.size} bytes, SHA-256 \`${read.result.evidence.sha256}\`; file was not modified.`;
        const toolUsed = status ? 'runtime.status' : 'file.read';
        const provider = status?.providerId || read?.providerId || 'grounded-provider';
        const finalResult = { messageId: job.messageId, text, provider, providerSessionId: '', toolUsed, verified: verificationRecord.passed, verification: verificationRecord, interpretation, schedulerStatus: capabilityPlan.status, capabilityResults: results, classification, runId: started.identity.runId, taskRevision: started.identity.taskRevision, metrics: { readFileCalls: read ? 1 : 0, codexCalls: 0 } };
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider, taskId });
        const completed = await this.tasks.finalizeRun(task.taskId, started.identity, { finalResult, finalEvidence: { ...verificationRecord, provider, toolUsed } });
        return { ...finalResult, activeTaskId: completed.taskId, taskId: completed.taskId };
      }

      const processCapabilities = interpretation.requiredCapabilities.filter((item) => item === 'process.list' || item === 'process.stop');
      if (processCapabilities.length) {
        for (const assignment of capabilityPlan.assignments.filter((item) => processCapabilities.includes(item.capabilityId))) this.assertProviderAuthorized(assignment);
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

      const codeTask = interpretation.taskType === 'code_task' && interpretation.requiredCapabilities.some((item) => item.startsWith('code.'));
      if (codeTask) {
        const codeCapabilities = interpretation.requiredCapabilities.filter((item) => item.startsWith('code.'));
        const writable = codeCapabilities.includes('code.modify');
        const workspaceTarget = interpretation.targets.find((item) => item?.type === 'project' || item?.type === 'workspace');
        const workspace = resolve(workspaceTarget?.path || process.cwd());
        const executionPrompt = JSON.stringify({ goal: interpretation.goal, actions: interpretation.actions, targets: interpretation.targets, constraints: interpretation.constraints, successCriteria: interpretation.successCriteria, userMessage: job.text });
        for (const assignment of capabilityPlan.assignments.filter((item) => codeCapabilities.includes(item.capabilityId))) this.assertProviderAuthorized(assignment);
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
