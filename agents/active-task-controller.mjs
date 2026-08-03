import { TaskStore, TERMINAL_TASK_STATES } from '../channels/task-store.mjs';

const progressPatterns = [/还需要多久/, /到哪一步/, /完成了吗/, /在干什么/, /进度/, /怎么样了/, /\bprogress\b/i, /\bstatus\b/i];
const pausePatterns = [/^暂停(?:当前|刚才|上面)?(?:的)?.*任务?[吧。！!]?$/, /^先暂停/];
const stopPatterns = [/^(?:停止|取消)(?:当前|刚才|上面)?(?:的)?.*任务?[吧。！!]?$/, /^别做了/, /^终止/];
const continuePatterns = [/^继续(?:刚才|当前|上面)?(?:的)?.*任务?[吧。！!]?$/, /恢复(?:刚才|当前|上面)?(?:的)?.*任务/];
const activeReferencePatterns = [/刚才(?:那个|的)?.*任务/, /当前任务/, /上面(?:那个|的)?.*(?:要求|任务)/, /原任务/, /之前(?:那个|的)?.*任务/];
const correctionVerbPatterns = [/不是这个/, /改成/, /调整为/, /换成/, /补充(?:要求)?/, /纠正/];

function classify(text, hasTarget) {
  const value = String(text || '').trim();
  const base = { action: '', target: '', constraints: [] };
  if (!hasTarget) return { ...base, kind: 'new_task', relationToActiveTask: 'new_task', reason: 'no_target_task' };
  if (progressPatterns.some((item) => item.test(value))) return { ...base, kind: 'progress', relationToActiveTask: 'progress', reason: 'explicit_progress_reference' };
  if (pausePatterns.some((item) => item.test(value))) return { ...base, kind: 'pause', relationToActiveTask: 'pause', reason: 'explicit_task_control' };
  if (stopPatterns.some((item) => item.test(value))) return { ...base, kind: 'cancel', relationToActiveTask: 'cancel', reason: 'explicit_task_control' };
  if (continuePatterns.some((item) => item.test(value))) return { ...base, kind: 'continue', relationToActiveTask: 'continue', reason: 'explicit_task_control' };
  if (activeReferencePatterns.some((item) => item.test(value)) && correctionVerbPatterns.some((item) => item.test(value))) return { ...base, kind: 'correction', relationToActiveTask: 'correction', reason: 'explicit_task_reference' };
  return { ...base, kind: 'new_task', relationToActiveTask: 'new_task', reason: 'independent_message' };
}

export function classifyActiveTaskMessage(text, hasActiveTask) {
  return classify(text, hasActiveTask);
}

export function analyzeActiveTaskMessage(text, hasActiveTask) {
  return classify(text, hasActiveTask);
}

export function taskStatusText(task) {
  if (!task) return 'No current task is available.';
  const waiting = task.waitingFor ? ` Waiting for: ${JSON.stringify(task.waitingFor)}.` : '';
  return `Task ${task.taskId} state: ${task.currentState}. Reason: ${task.stateReason || 'unknown'}.${waiting}`;
}

export class ActiveTaskController {
  constructor(options = {}) {
    this.store = options.store || new TaskStore(options.storeOptions);
  }

  async inspect(job) {
    const conversationId = job.conversationId || job.chatId;
    const active = job.parentTaskId ? await this.store.load(job.parentTaskId) : await this.store.latestNonTerminal(conversationId);
    return { conversationId, active, classification: classify(job.text, Boolean(active)) };
  }

  async handle(job) {
    const { active, classification } = await this.inspect(job);
    if (!active || classification.kind === 'new_task') return { intercepted: false, active, classification };

    if (classification.kind === 'progress') {
      return { intercepted: true, kind: 'progress', text: taskStatusText(active), activeTaskId: active.taskId, targetTaskId: active.taskId, classification };
    }

    if (classification.kind === 'cancel') {
      if (!TERMINAL_TASK_STATES.has(active.currentState)) {
        await this.store.cancelTaskWithRun(active.taskId, { reason: 'user_cancelled', actor: 'user', evidence: { controlMessageId: job.originalMessageId || job.messageId } });
      }
      return { intercepted: true, kind: 'cancel', text: 'Task cancelled.', activeTaskId: active.taskId, targetTaskId: active.taskId, classification };
    }

    if (classification.kind === 'pause') {
      if (!TERMINAL_TASK_STATES.has(active.currentState) && active.currentState !== 'paused') {
        const patched = await this.store.patch(active.taskId, { waitingFor: { resumeState: active.currentState, control: 'paused_by_user' } });
        await this.store.transitionTask(patched.taskId, patched.currentState, 'paused', 'user_paused', 'user', { controlMessageId: job.originalMessageId || job.messageId });
      }
      return { intercepted: true, kind: 'pause', text: 'Task paused.', activeTaskId: active.taskId, targetTaskId: active.taskId, classification };
    }

    if (classification.kind === 'continue' && active.currentState === 'paused') {
      const resumeState = active.waitingFor?.resumeState || 'ready';
      const patched = await this.store.patch(active.taskId, { waitingFor: null });
      await this.store.transitionTask(patched.taskId, patched.currentState, resumeState, 'user_continued', 'user', { controlMessageId: job.originalMessageId || job.messageId });
      return { intercepted: true, kind: 'continue', text: taskStatusText(await this.store.load(active.taskId)), activeTaskId: active.taskId, targetTaskId: active.taskId, classification };
    }

    if (classification.kind === 'continue' || classification.kind === 'correction') return { intercepted: false, active, classification, targetTaskId: active.taskId };
    return { intercepted: false, active, classification };
  }

  async context(taskId) {
    return taskStatusText(await this.store.load(taskId));
  }
}
