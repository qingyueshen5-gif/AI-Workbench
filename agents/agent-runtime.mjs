import fs from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { ModelRouter } from './model-router.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { ActiveTaskController } from './active-task-controller.mjs';
import { ActiveTaskStore, activeTaskSummary } from '../channels/active-task-store.mjs';
import { runtimeRoot } from '../runtime-paths.mjs';

function historyPrompt(history) { return history.slice(-20).map((item) => `${item.role === 'assistant' ? '助手' : item.role === 'tool' ? '执行结果' : '用户'}：${item.text}`).join('\n'); }
function parseDecision(text) {
  const value = JSON.parse(String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (typeof value.requiresExecution !== 'boolean') throw new Error('DeepSeek decision missing requiresExecution');
  return { requiresExecution: value.requiresExecution, task: String(value.task || '').trim(), answer: String(value.answer || '').trim() };
}
const readOnlyConstraint = /不要修改|只读|仅查看|不要写入|不要删除/;
const singleFileExt = /\.(?:md|txt|json|ya?ml|toml|csv|log|pdf|docx|xlsx)$/i;
const followupPattern = /^(?:这个|该|上述|刚才|文件中|文件里|为什么|再|那么|其中|下一步|还有|具体|它)/;
const statusPattern = /(?:当前|现在|实际).*(?:Runtime|Gateway|任务|状态)|(?:Runtime|Gateway|任务).*(?:状态|版本|进度|提交|PID)/i;
const complexPattern = /(?:编写|修改|修复|调试|构建|测试|运行|执行.*命令|终端|部署|跨文件|多个文件|多步|电脑操作|代码)/i;
function extractImportantGoal(content) {
  const marked = content.match(/<!--\s*AIW_NEXT_STEP_START\s*-->([\s\S]*?)<!--\s*AIW_NEXT_STEP_END\s*-->/i)?.[1]?.trim();
  if (marked) return marked;
  const section = content.match(/(?:当前最重要的目标|当前唯一下一步)[：:\s]*([\s\S]{1,1200}?)(?=\n#{1,3}\s|$)/)?.[1]?.trim();
  return section || content.trim().slice(0, 1200);
}
function progressMessage(stage) {
  return ({ understanding: '正在理解任务并确认目标。', planning: '已理解任务，正在整理执行步骤。', executing: '正在执行任务，完成后会核对结果。', verifying: '执行已完成，正在核对结果。', finalizing: '结果已确认，正在整理最终回复。' })[stage] || '任务正在处理中。';
}
export class RuntimeProgressController {
  constructor(job, emit, options = {}) { this.job = job; this.emit = emit || (async () => {}); this.now = options.now || (() => Date.now()); this.firstDelayMs = Number(options.firstDelayMs ?? 8000); this.minIntervalMs = Number(options.minIntervalMs ?? 20000); this.startedAt = this.now(); this.stage = 'understanding'; this.lastSentAt = 0; this.lastSentStage = ''; this.closed = false; this.timer = setTimeout(() => this.tryEmit(true).catch(() => {}), this.firstDelayMs); }
  async setStage(stage) { this.stage = stage; if (this.lastSentAt && stage !== this.lastSentStage && this.now() - this.lastSentAt >= this.minIntervalMs) await this.tryEmit(false); }
  async tryEmit(first) { if (this.closed || (!first && this.stage === this.lastSentStage)) return false; const createdAt = this.now(); if (first && createdAt - this.startedAt < this.firstDelayMs) return false; await this.emit({ eventId: `${this.job.messageId}-${this.stage}-${createdAt}`, jobId: this.job.messageId, originalMessageId: this.job.originalMessageId || this.job.messageId, conversationId: this.job.conversationId || this.job.chatId, stage: this.stage, message: progressMessage(this.stage), createdAt }); this.lastSentAt = createdAt; this.lastSentStage = this.stage; return true; }
  close() { this.closed = true; clearTimeout(this.timer); }
}

export class AgentRuntime {
  constructor(options = {}) {
    this.sessions = options.sessions || new SessionStore(options.sessionOptions);
    this.activeTasks = options.activeTasks || new ActiveTaskStore(options.activeTaskOptions);
    this.activeController = options.activeController || new ActiveTaskController({ store: this.activeTasks, staleAcceptedMs: options.staleAcceptedMs, now: options.now });
    this.models = options.models || new ModelRouter(options.modelOptions);
    this.tools = options.tools || new ToolExecutor({ root: options.root || process.cwd(), allowedRoots: options.allowedRoots || [process.cwd()] });
    this.verifier = options.verifier || new ResultVerifier();
    this.onStage = options.onStage || (async () => {});
    this.onProgress = options.onProgress || (async () => {});
    this.progressOptions = options.progressOptions || {};
    this.statePaths = options.statePaths || { gateway: resolve(runtimeRoot, 'feishu-workbench-bridge', 'gateway-health.json'), runtime: resolve(runtimeRoot, 'feishu-workbench-bridge', 'ipc', 'worker-state.json'), task: resolve(runtimeRoot, 'feishu-workbench-bridge', 'status.json') };
  }
  async stage(job, progress, stage) { await this.onStage(job, stage); await progress.setStage(stage); }
  async groundedStatus(text) {
    const read = async (path) => { try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return null; } };
    const [gateway, runtime, task] = await Promise.all([read(this.statePaths.gateway), read(this.statePaths.runtime), read(this.statePaths.task)]);
    const parts = [];
    if (/Gateway/i.test(text)) parts.push(gateway ? `Gateway PID ${gateway.pid}，提交 ${gateway.gitCommit || '未记录'}，连接状态 ${gateway.connectionState || '未知'}。` : '没有可用的Gateway状态证据。');
    if (/Runtime/i.test(text)) parts.push(runtime ? `Runtime PID ${runtime.pid}，提交 ${runtime.gitCommit || '未记录'}，状态 ${runtime.status || '未知'}。` : '没有可用的Runtime状态证据。');
    if (/任务|进度/.test(text)) parts.push(task ? `当前任务阶段：${task.currentStage || '未知'}；最近任务：${task.latestMessageId || task.latestSuccessfulTask || '未记录'}。` : '没有可用的任务状态证据。');
    return parts.join('\n') || '没有足够的实时状态证据。';
  }
  async handle(job) {
    const conversationId = job.conversationId || job.chatId;
    const progress = new RuntimeProgressController(job, this.onProgress, this.progressOptions);
    try {
      const control = await this.activeController.handle(job);
      if (control.intercepted) return { text: control.text, provider: 'ai-workbench', providerSessionId: '', toolUsed: '', verified: true, controlKind: control.kind, activeTaskId: control.activeTaskId, classification: control.classification, metrics: { readFileCalls: 0, codexCalls: 0 } };
      const classification = control.classification;
      const state = await this.sessions.load(conversationId, job.openId);
      let activeTask = await this.activeTasks.load(conversationId);
      if (!activeTask || ['completed', 'failed'].includes(activeTask.stage) || activeTask.originalMessageId !== (job.originalMessageId || job.messageId)) activeTask = await this.activeTasks.create(job);
      await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId });
      await this.activeTasks.update(conversationId, { stage: 'understanding', currentStep: '理解任务并整理上下文', currentActor: 'AI Workbench', paused: false, waitingUser: false });
      await this.stage(job, progress, 'understanding');

      if (statusPattern.test(job.text)) {
        await this.stage(job, progress, 'verifying'); const text = await this.groundedStatus(job.text); await this.stage(job, progress, 'finalizing');
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'local-status' });
        await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', estimatedRemainingRange: '已完成。' });
        return { text, provider: 'local-status', providerSessionId: '', toolUsed: 'status_grounding', verified: true, classification, activeTaskId: job.messageId, metrics: { readFileCalls: 0, codexCalls: 0 } };
      }

      const directRead = classification.action === 'read' && isAbsolute(classification.target || '') && singleFileExt.test(classification.target) && (readOnlyConstraint.test(job.text) || !complexPattern.test(job.text));
      if (directRead) {
        await this.stage(job, progress, 'planning'); await this.stage(job, progress, 'executing');
        const before = await fs.stat(classification.target); const verification = await this.tools.execute(job.messageId, { type: 'read_file', path: classification.target }); const after = await fs.stat(classification.target);
        const item = verification.results?.[0]; if (!item?.content) throw new Error('本轮文件读取没有返回内容');
        if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || item.sha256 !== item.currentSha256) throw new Error('只读任务检测到文件发生变化');
        const evidence = { path: item.path, mtimeMs: after.mtimeMs, size: after.size, sha256: item.sha256, content: item.content, readAt: Date.now(), sourceMessageId: job.messageId };
        state.lastFileEvidence = evidence; await this.sessions.save(state); await this.activeTasks.addToolResult(conversationId, { at: evidence.readAt, source: 'read_file', summary: JSON.stringify({ path: evidence.path, mtimeMs: evidence.mtimeMs, size: evidence.size, sha256: evidence.sha256 }) });
        await this.stage(job, progress, 'verifying'); const goal = extractImportantGoal(item.content); await this.stage(job, progress, 'finalizing');
        const text = `根据本轮对 \`${evidence.path}\` 的实际读取，当前最重要的目标是：${goal}\n\n读取证据：文件大小 ${evidence.size} 字节，SHA-256 \`${evidence.sha256}\`；文件未被修改。`;
        await this.sessions.appendMessage(state, { role: 'tool', text: goal, messageId: job.messageId, provider: 'read_file', evidence: { ...evidence, content: undefined } }); await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'local-read' });
        await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', estimatedRemainingRange: '已完成。' });
        return { text, provider: 'local-read', providerSessionId: '', toolUsed: 'read_file', verified: true, classification, activeTaskId: job.messageId, evidence: { ...evidence, content: undefined }, metrics: { readFileCalls: 1, codexCalls: 0 } };
      }

      if (state.lastFileEvidence && followupPattern.test(String(job.text || '').trim())) {
        await this.stage(job, progress, 'planning'); await this.stage(job, progress, 'finalizing');
        const finalModel = await this.models.express({ messages: [{ role: 'system', content: '只根据给定的本轮文件读取证据回答连续追问，不得声称重新读取文件。' }, { role: 'user', content: `追问：${job.text}\n文件路径：${state.lastFileEvidence.path}\n本轮读取内容：${state.lastFileEvidence.content}` }] });
        const text = this.verifier.verifyModelResult(finalModel).text; await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek' });
        await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', estimatedRemainingRange: '已完成。' });
        return { text, provider: 'deepseek', providerSessionId: '', toolUsed: '', verified: true, classification, activeTaskId: job.messageId, metrics: { readFileCalls: 0, codexCalls: 0, reusedFileEvidence: true } };
      }

      await this.stage(job, progress, 'planning');
      if (complexPattern.test(job.text)) {
        await this.stage(job, progress, 'executing'); const execution = await this.models.execute({ conversationId, prompt: job.text, workspace: resolve(process.cwd()), writable: true });
        await this.sessions.appendMessage(state, { role: 'tool', text: execution.text, messageId: job.messageId, provider: 'codex', providerSessionId: execution.sessionId }); await this.stage(job, progress, 'verifying'); await this.stage(job, progress, 'finalizing');
        const finalModel = await this.models.express({ messages: [{ role: 'system', content: '将已验证执行结果整理为自然中文最终回复。' }, { role: 'user', content: `原问题：${job.text}\n执行结果：${execution.text}` }] }); const text = this.verifier.verifyModelResult(finalModel).text;
        await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek' }); await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', estimatedRemainingRange: '已完成。' });
        return { text, provider: 'deepseek', providerSessionId: execution.sessionId, toolUsed: 'codex', verified: true, classification, activeTaskId: job.messageId, metrics: { readFileCalls: 0, codexCalls: 1 } };
      }

      const understanding = await this.models.understand({ messages: [{ role: 'system', content: '你是AI Workbench普通聊天模块。直接自然回答，不调用工具。只输出JSON：{"requiresExecution":false,"task":"","answer":"回答"}。' }, { role: 'user', content: `${historyPrompt(state.originalMessages || [])}\n用户：${job.text}` }], responseFormat: { type: 'json_object' } });
      const decision = parseDecision(understanding.text); await this.stage(job, progress, 'finalizing'); const text = decision.answer || this.verifier.verifyModelResult(await this.models.express({ prompt: job.text })).text;
      await this.sessions.appendMessage(state, { role: 'assistant', text, messageId: job.messageId, provider: 'deepseek' }); await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', estimatedRemainingRange: '已完成。' });
      return { text, provider: 'deepseek', providerSessionId: '', toolUsed: '', verified: true, classification, activeTaskId: job.messageId, metrics: { readFileCalls: 0, codexCalls: 0 } };
    } catch (error) {
      await this.activeTasks.update(conversationId, { stage: 'failed', currentStep: '任务失败', latestFailureReason: error.message || String(error), estimatedRemainingRange: '任务已停止。' }).catch(() => {}); throw error;
    } finally { progress.close(); }
  }
}
