import { resolve } from 'node:path';
import { ModelRouter } from './model-router.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { ActiveTaskStore, activeTaskSummary } from '../channels/active-task-store.mjs';

function historyPrompt(history) {
  return history.slice(-20).map((item) => `${item.role === 'assistant' ? '助手' : item.role === 'tool' ? '执行结果' : '用户'}：${item.text}`).join('\n');
}
function parseDecision(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned);
  if (typeof value.requiresExecution !== 'boolean') throw new Error('DeepSeek decision missing requiresExecution');
  return {
    requiresExecution: value.requiresExecution,
    task: String(value.task || '').trim(),
    answer: String(value.answer || '').trim()
  };
}

export class AgentRuntime {
  constructor(options = {}) {
    this.sessions = options.sessions || new SessionStore(options.sessionOptions);
    this.activeTasks = options.activeTasks || new ActiveTaskStore(options.activeTaskOptions);
    this.models = options.models || new ModelRouter(options.modelOptions);
    this.tools = options.tools || new ToolExecutor({ root: options.root || process.cwd(), allowedRoots: options.allowedRoots || [process.cwd()] });
    this.verifier = options.verifier || new ResultVerifier();
    this.onStage = options.onStage || (async () => {});
  }
  async handle(job) {
    const conversationId = job.conversationId || job.chatId;
    const state = await this.sessions.load(conversationId, job.openId);
    let activeTask = await this.activeTasks.load(conversationId);
    if (!activeTask || ['completed', 'failed'].includes(activeTask.stage) || activeTask.originalMessageId !== (job.originalMessageId || job.messageId)) activeTask = await this.activeTasks.create(job);
    const supplemental = (activeTask.supplementalInstructions || []).join('；');
    const effectiveGoal = supplemental ? `${activeTask.originalUserGoal}\n补充要求：${supplemental}` : (activeTask.effectiveUserGoal || job.text);
    await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId });
    await this.activeTasks.update(conversationId, { stage: 'understanding', currentStep: '理解任务并整理上下文', currentActor: 'DeepSeek', paused: false, waitingUser: false, estimatedRemainingRange: '当前正在执行第1步，完成后会继续规划。' });
    await this.onStage(job, 'understanding');
    const understanding = await this.models.understand({
      messages: [
        { role: 'system', content: '你是AI Workbench语言理解模块。判断用户消息是否需要操作电脑、代码、文件或终端。普通聊天必须requiresExecution=false。只输出JSON：{"requiresExecution":boolean,"task":"给Codex的明确任务；不执行则为空","answer":"普通聊天可直接回答；执行任务则为空"}。' },
        { role: 'user', content: `${historyPrompt(state.originalMessages || [])}\n\n当前active_task：\n${activeTaskSummary(await this.activeTasks.load(conversationId))}\n\n用户本轮有效目标：${effectiveGoal}` }
      ],
      responseFormat: { type: 'json_object' }
    });
    const decision = parseDecision(understanding.text);
    await this.activeTasks.addCompletedStep(conversationId, '已理解任务并整理上下文');
    await this.activeTasks.update(conversationId, { stage: 'planning', currentStep: decision.requiresExecution ? '整理电脑执行步骤' : '准备直接回答', currentActor: 'DeepSeek', estimatedRemainingRange: decision.requiresExecution ? '当前正在执行第2步，后续还需执行和验证。' : '正在整理最终回复。' });
    await this.onStage(job, 'planning');
    let execution = null;
    if (decision.requiresExecution) {
      if (!decision.task) throw new Error('DeepSeek did not provide an execution task');
      await this.activeTasks.addCompletedStep(conversationId, '已制定执行计划');
      await this.activeTasks.update(conversationId, { stage: 'executing', currentStep: '按任务要求执行电脑、文件或终端操作', currentActor: 'Codex', estimatedRemainingRange: '当前正在执行电脑步骤，完成后还需验证和整理结果。' });
      await this.onStage(job, 'executing');
      execution = await this.models.execute({
        conversationId,
        prompt: [
          '你是AI Workbench的电脑执行模块。只执行下面明确任务；可操作代码、文件或终端。返回实际结果和验证证据，不负责面向用户润色。',
          decision.task
        ].join('\n\n'),
        workspace: resolve(process.cwd()),
        writable: true
      });
      await this.sessions.appendMessage(state, { role: 'tool', text: execution.text, messageId: job.messageId, provider: 'codex', providerSessionId: execution.sessionId });
      await this.activeTasks.addCompletedStep(conversationId, '电脑执行已完成');
      await this.activeTasks.addToolResult(conversationId, { at: Date.now(), source: 'codex', summary: execution.text.slice(0, 1000) });
    }
    await this.activeTasks.update(conversationId, { stage: 'verifying', currentStep: execution ? '核对电脑执行结果' : '核对回答是否符合用户目标', currentActor: 'AI Workbench', estimatedRemainingRange: '执行已结束，正在验证并整理最终回复。' });
    await this.onStage(job, 'verifying');
    await this.activeTasks.addCompletedStep(conversationId, '执行结果已进入验证');
    await this.activeTasks.update(conversationId, { stage: 'finalizing', currentStep: '整理最终中文回复', currentActor: 'DeepSeek', estimatedRemainingRange: '结果已经确认，正在整理最终回复。' });
    await this.onStage(job, 'finalizing');
    const latestTask = await this.activeTasks.load(conversationId);
    const finalModel = await this.models.express({
      messages: [
        { role: 'system', content: '你是AI Workbench最终结果表达模块。结合原问题与已验证执行结果，用自然中文给出最终回复。不要展示内部模型、进程、协议或日志。若没有执行结果，直接自然回答。' },
        { role: 'user', content: `原问题与最新补充：${latestTask?.effectiveUserGoal || effectiveGoal}\n\n有界对话历史：\n${historyPrompt(state.originalMessages || [])}\n\n已完成步骤：${(latestTask?.completedSteps || []).join('；') || '暂无'}\n\n当前步骤：${latestTask?.currentStep || '整理结果'}\n\n已有工具结果：${(latestTask?.toolResults || []).map((item) => item.summary || '').join('；') || '无'}\n\nDeepSeek初步回答：${decision.answer || '无'}\n\nCodex执行结果：${execution?.text || '未调用Codex'}` }
      ]
    });
    const final = this.verifier.verifyModelResult(finalModel).text;
    await this.sessions.appendMessage(state, { role: 'assistant', text: final, messageId: job.messageId, provider: 'deepseek' });
    await this.activeTasks.addCompletedStep(conversationId, '最终回复已整理');
    await this.activeTasks.update(conversationId, { stage: 'completed', currentStep: '任务已完成', currentActor: 'AI Workbench', paused: false, waitingUser: false, estimatedRemainingRange: '已完成。', latestFailureReason: '' });
    return { text: final, provider: 'deepseek', languageModel: 'deepseek-chat', codexUsed: Boolean(execution), providerSessionId: execution?.sessionId || '', toolUsed: execution ? 'codex' : '', verified: true };
  }
}
