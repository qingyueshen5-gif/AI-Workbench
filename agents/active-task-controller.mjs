import { ActiveTaskStore, activeTaskSummary } from '../channels/active-task-store.mjs';

const progressPatterns = [/还需要多久/, /到哪一步/, /为什么.*慢/, /完成了吗/, /在干什么/, /进度/, /怎么样了/];
const pausePatterns = [/^暂停[吧。！!]?$/, /^先暂停/, /^停一下/];
const stopPatterns = [/^停止[吧。！!]?$/, /^取消[吧。！!]?$/, /^别做了/, /^终止/];
const continuePatterns = [/^继续[吧。！!]?$/, /继续刚才/, /恢复任务/];
const correctionPatterns = [/不是这个/, /^改成/, /^只.+不要/, /不要修改/, /补充/, /纠正/, /换成/];

export function classifyActiveTaskMessage(text, hasActiveTask) {
  if (!hasActiveTask) return { kind: 'new_task' };
  const value = String(text || '').trim();
  if (progressPatterns.some((pattern) => pattern.test(value))) return { kind: 'progress' };
  if (pausePatterns.some((pattern) => pattern.test(value))) return { kind: 'pause' };
  if (stopPatterns.some((pattern) => pattern.test(value))) return { kind: 'cancel' };
  if (continuePatterns.some((pattern) => pattern.test(value))) return { kind: 'continue' };
  if (correctionPatterns.some((pattern) => pattern.test(value))) return { kind: 'correction' };
  return { kind: 'new_task' };
}

function progressText(task) {
  if (task.stage === 'paused') return `当前任务已暂停。已完成：${(task.completedSteps || []).join('；') || '暂无'}。发送“继续”可恢复同一个任务。`;
  if (task.stage === 'waiting_user') return `当前任务正在等待你的补充。当前步骤：${task.currentStep || '等待确认'}。`;
  const completed = (task.completedSteps || []).join('；');
  const remaining = task.estimatedRemainingRange || '完成后会直接回复你。';
  return `当前正在${task.currentStep || '处理任务'}${completed ? `，已完成：${completed}` : ''}。${remaining}`;
}

export class ActiveTaskController {
  constructor(options = {}) { this.store = options.store || new ActiveTaskStore(options.storeOptions); }
  async inspect(job) {
    const conversationId = job.conversationId || job.chatId;
    const active = await this.store.active(conversationId);
    const classification = classifyActiveTaskMessage(job.text, Boolean(active));
    return { conversationId, active, classification };
  }
  async handle(job) {
    const { conversationId, active, classification } = await this.inspect(job);
    if (!active || classification.kind === 'new_task') return { intercepted: false, active };
    if (classification.kind === 'progress') return { intercepted: true, kind: 'progress', text: progressText(active), activeTaskId: active.activeTaskId };
    if (classification.kind === 'pause') {
      const next = await this.store.update(conversationId, { stage: 'paused', paused: true, currentStep: active.currentStep || '任务已暂停', currentActor: 'AI Workbench', estimatedRemainingRange: '等待你发送“继续”。' });
      return { intercepted: true, kind: 'pause', text: `已暂停当前任务，不会再发起新的执行步骤。发送“继续”可恢复同一个任务。`, activeTaskId: next.activeTaskId };
    }
    if (classification.kind === 'continue') {
      const next = await this.store.update(conversationId, { stage: 'accepted', paused: false, waitingUser: false, currentStep: '正在根据已有进度继续任务', currentActor: 'AI Workbench', estimatedRemainingRange: '将从已保存的任务状态继续，完成后直接回复你。' });
      return { intercepted: true, kind: 'continue', text: '已恢复刚才的任务，将沿用同一个任务和已有进度继续处理。', activeTaskId: next.activeTaskId, resume: true };
    }
    if (classification.kind === 'cancel') {
      const next = await this.store.update(conversationId, { stage: 'failed', paused: false, cancelled: true, currentStep: '任务已取消', currentActor: 'AI Workbench', latestFailureReason: '用户取消', estimatedRemainingRange: '任务不会继续执行。' });
      return { intercepted: true, kind: 'cancel', text: '已取消当前任务，不会继续执行后续步骤。', activeTaskId: next.activeTaskId, cancel: true };
    }
    if (classification.kind === 'correction') {
      const supplementalInstructions = [...(active.supplementalInstructions || []), job.text].slice(-20);
      const next = await this.store.update(conversationId, { supplementalInstructions, effectiveUserGoal: `${active.originalUserGoal}\n补充要求：${supplementalInstructions.join('；')}`, paused: false, waitingUser: false, currentStep: '正在应用你的补充要求', currentActor: 'AI Workbench', estimatedRemainingRange: '将按最新限制继续原任务，完成后直接回复你。' });
      return { intercepted: true, kind: 'correction', text: '已把这条补充要求并入原任务，不会创建新任务；后续结果将按最新要求处理。', activeTaskId: next.activeTaskId, correction: job.text };
    }
    return { intercepted: false, active };
  }
  async context(conversationId) { return activeTaskSummary(await this.store.load(conversationId)); }
}
