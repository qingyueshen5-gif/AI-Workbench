import { ActiveTaskStore, activeTaskSummary } from '../channels/active-task-store.mjs';

const DEFAULT_STALE_ACCEPTED_MS = Number(process.env.AIW_ACTIVE_TASK_STALE_ACCEPTED_MS || 5 * 60 * 1000);
const progressPatterns = [/还需要多久/, /到哪一步/, /为什么.*慢/, /完成了吗/, /在干什么/, /进度/, /怎么样了/];
const pausePatterns = [/^暂停(?:当前|刚才|上面)?(?:的)?任务[吧。！!]?$/, /^先暂停(?:当前|刚才|上面)?(?:的)?任务/, /^停一下(?:当前|刚才|上面)?(?:的)?任务/];
const stopPatterns = [/^(?:停止|取消)(?:当前|刚才|上面)?(?:的)?(?:.+)?任务[吧。！!]?$/, /^别做了/, /^终止(?:当前|刚才|上面)?(?:的)?任务/];
const continuePatterns = [/^继续(?:刚才|当前|上面)?(?:的)?任务[吧。！!]?$/, /恢复(?:刚才|当前|上面)?(?:的)?任务/];
const activeReferencePatterns = [/刚才(?:那个|的)?任务/, /当前任务/, /上面(?:那个|的)?(?:要求|任务)/, /原任务/, /之前(?:那个|的)?任务/, /把上面的/, /继续刚才/, /暂停当前/, /取消刚才/];
const correctionVerbPatterns = [/不是这个/, /改成/, /调整为/, /换成/, /补充(?:要求)?/, /纠正/];
const constraintPatterns = [/(?:不要|别)(?:修改|删除|部署|重启|写入|覆盖|移动|发送|执行)[^，。；;]*/g, /只读/g, /仅查看/g, /只告诉我[^，。；;]*/g];
const actionSpecs = [
  { action: 'read', patterns: [/读取/, /读一下/, /查看(?:文件|文档)?/, /打开/] },
  { action: 'delete', patterns: [/删除/, /清理/] },
  { action: 'check', patterns: [/检查/, /核对/, /确认/, /查看状态/] },
  { action: 'search', patterns: [/搜索/, /查找/, /检索/] },
  { action: 'deploy', patterns: [/部署/, /发布/] },
  { action: 'restart', patterns: [/重启/] }
];
const windowsPathPattern = /[A-Za-z]:\\[^\r\n，。；;：:]+/;
const namedTargetPattern = /(?:NEXT_STEP\.md|package\.json|[A-Za-z0-9_.-]+\.(?:md|json|txt|log|ya?ml|toml|csv|xlsx|docx|pdf))/i;
const genericTargets = [
  { pattern: /临时文件/, target: '临时文件' },
  { pattern: /项目文件/, target: '项目文件' },
  { pattern: /服务状态/, target: '服务状态' },
  { pattern: /日志/, target: '日志' },
  { pattern: /配置/, target: '配置' }
];

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function findAction(value) {
  for (const spec of actionSpecs) if (spec.patterns.some((pattern) => pattern.test(value))) return spec.action;
  return '';
}
function findTarget(value) {
  const path = value.match(windowsPathPattern)?.[0]?.trim();
  if (path) return path;
  const named = value.match(namedTargetPattern)?.[0]?.trim();
  if (named) return named;
  return genericTargets.find((item) => item.pattern.test(value))?.target || '';
}
function findExpectedResult(value, action, target) {
  const tell = value.match(/(?:告诉我|只告诉我|说明|返回|给出)([^。；;]+)/)?.[1]?.trim();
  if (tell) return tell;
  if (action === 'check' && target) return `${target}检查结果`;
  if (action === 'delete' && target) return `完成${target}删除`;
  if (action === 'search' && target) return `${target}搜索结果`;
  return '';
}
function findConstraints(value) {
  const constraints = [];
  for (const pattern of constraintPatterns) constraints.push(...[...value.matchAll(pattern)].map((match) => match[0].trim()));
  return unique(constraints);
}

export function analyzeActiveTaskMessage(text, hasActiveTask) {
  const value = String(text || '').trim();
  const action = findAction(value);
  const target = findTarget(value);
  const expectedResult = findExpectedResult(value, action, target);
  const constraints = findConstraints(value);
  const referencesActiveTask = activeReferencePatterns.some((pattern) => pattern.test(value));
  const explicitIndependentTask = Boolean(action && target);
  let relationToActiveTask = 'new_task';
  let kind = 'new_task';
  let reason = explicitIndependentTask ? 'explicit_action_and_target' : 'independent_message';

  if (hasActiveTask) {
    if (progressPatterns.some((pattern) => pattern.test(value)) && !explicitIndependentTask) {
      relationToActiveTask = 'progress'; kind = 'progress'; reason = 'active_task_progress_reference';
    } else if (pausePatterns.some((pattern) => pattern.test(value))) {
      relationToActiveTask = 'pause'; kind = 'pause'; reason = 'explicit_active_task_control';
    } else if (stopPatterns.some((pattern) => pattern.test(value))) {
      relationToActiveTask = 'cancel'; kind = 'cancel'; reason = 'explicit_active_task_control';
    } else if (continuePatterns.some((pattern) => pattern.test(value))) {
      relationToActiveTask = 'continue'; kind = 'continue'; reason = 'explicit_active_task_control';
    } else if (!explicitIndependentTask && referencesActiveTask && (correctionVerbPatterns.some((pattern) => pattern.test(value)) || constraints.length > 0)) {
      relationToActiveTask = 'correction'; kind = 'correction'; reason = 'explicit_reference_without_independent_task';
    } else if (!explicitIndependentTask && referencesActiveTask) {
      relationToActiveTask = 'needs_semantic_judgment'; kind = 'needs_semantic_judgment'; reason = 'ambiguous_active_task_reference';
    }
  }
  return { action, target, expectedResult, constraints, relationToActiveTask, kind, reason, referencesActiveTask, explicitIndependentTask };
}

export function classifyActiveTaskMessage(text, hasActiveTask) {
  return analyzeActiveTaskMessage(text, hasActiveTask);
}

function progressText(task) {
  if (task.stage === 'paused') return `当前任务已暂停。已完成：${(task.completedSteps || []).join('；') || '暂无'}。发送“继续”可恢复同一个任务。`;
  if (task.stage === 'waiting_user') return `当前任务正在等待你的补充。当前步骤：${task.currentStep || '等待确认'}。`;
  const completed = (task.completedSteps || []).join('；');
  const remaining = task.estimatedRemainingRange || '完成后会直接回复你。';
  return `当前正在${task.currentStep || '处理任务'}${completed ? `，已完成：${completed}` : ''}。${remaining}`;
}

export function isStaleAcceptedTask(task, now = Date.now(), staleAcceptedMs = DEFAULT_STALE_ACCEPTED_MS) {
  if (!task || task.stage !== 'accepted') return false;
  const lastActivity = Number(task.lastProgressAt || task.updatedAt || task.startedAt || 0);
  const hasExecutionEvidence = Boolean(task.jobClaimedAt || task.runtimePid || task.claimId || (task.toolResults || []).length || (task.completedSteps || []).length);
  return !hasExecutionEvidence && lastActivity > 0 && now - lastActivity > staleAcceptedMs;
}

export class ActiveTaskController {
  constructor(options = {}) {
    this.store = options.store || new ActiveTaskStore(options.storeOptions);
    this.staleAcceptedMs = Number(options.staleAcceptedMs || DEFAULT_STALE_ACCEPTED_MS);
    this.now = options.now || (() => Date.now());
  }
  async inspect(job) {
    const conversationId = job.conversationId || job.chatId;
    let active = await this.store.active(conversationId);
    if (isStaleAcceptedTask(active, this.now(), this.staleAcceptedMs)) active = null;
    const classification = classifyActiveTaskMessage(job.text, Boolean(active));
    return { conversationId, active, classification };
  }
  async handle(job) {
    const { conversationId, active, classification } = await this.inspect(job);
    if (!active || classification.kind === 'new_task' || classification.kind === 'needs_semantic_judgment') return { intercepted: false, active, classification };
    if (classification.kind === 'progress') return { intercepted: true, kind: 'progress', text: progressText(active), activeTaskId: active.activeTaskId, classification };
    if (classification.kind === 'pause') {
      const next = await this.store.update(conversationId, { stage: 'paused', paused: true, currentStep: active.currentStep || '任务已暂停', currentActor: 'AI Workbench', estimatedRemainingRange: '等待你发送“继续”。' });
      return { intercepted: true, kind: 'pause', text: '已暂停当前任务，不会再发起新的执行步骤。发送“继续”可恢复同一个任务。', activeTaskId: next.activeTaskId, classification };
    }
    if (classification.kind === 'continue') {
      const next = await this.store.update(conversationId, { stage: 'accepted', paused: false, waitingUser: false, currentStep: '正在根据已有进度继续任务', currentActor: 'AI Workbench', estimatedRemainingRange: '将从已保存的任务状态继续，完成后直接回复你。' });
      return { intercepted: true, kind: 'continue', text: '已恢复刚才的任务，将沿用同一个任务和已有进度继续处理。', activeTaskId: next.activeTaskId, resume: true, classification };
    }
    if (classification.kind === 'cancel') {
      const next = await this.store.update(conversationId, { stage: 'failed', paused: false, cancelled: true, currentStep: '任务已取消', currentActor: 'AI Workbench', latestFailureReason: '用户取消', estimatedRemainingRange: '任务不会继续执行。' });
      return { intercepted: true, kind: 'cancel', text: '已取消当前任务，不会继续执行后续步骤。', activeTaskId: next.activeTaskId, cancel: true, classification };
    }
    if (classification.kind === 'correction') {
      const supplementalInstructions = [...(active.supplementalInstructions || []), job.text].slice(-20);
      const next = await this.store.update(conversationId, { supplementalInstructions, effectiveUserGoal: `${active.originalUserGoal}\n补充要求：${supplementalInstructions.join('；')}`, paused: false, waitingUser: false, currentStep: '正在应用你的补充要求', currentActor: 'AI Workbench', estimatedRemainingRange: '将按最新限制继续原任务，完成后直接回复你。' });
      return { intercepted: true, kind: 'correction', text: '已把这条补充要求并入原任务，不会创建新任务；后续结果将按最新要求处理。', activeTaskId: next.activeTaskId, correction: job.text, classification };
    }
    return { intercepted: false, active, classification };
  }
  async context(conversationId) { return activeTaskSummary(await this.store.load(conversationId)); }
}
