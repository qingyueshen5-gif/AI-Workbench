import { resolve } from 'node:path';
import { ModelRouter } from './model-router.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { SessionStore } from '../channels/session-store.mjs';

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
    this.models = options.models || new ModelRouter(options.modelOptions);
    this.tools = options.tools || new ToolExecutor({ root: options.root || process.cwd(), allowedRoots: options.allowedRoots || [process.cwd()] });
    this.verifier = options.verifier || new ResultVerifier();
    this.onStage = options.onStage || (async () => {});
  }
  async handle(job) {
    const conversationId = job.conversationId || job.chatId;
    const state = await this.sessions.load(conversationId, job.openId);
    await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId });
    await this.onStage(job, 'understanding');
    const understanding = await this.models.understand({
      messages: [
        { role: 'system', content: '你是AI Workbench语言理解模块。判断用户消息是否需要操作电脑、代码、文件或终端。普通聊天必须requiresExecution=false。只输出JSON：{"requiresExecution":boolean,"task":"给Codex的明确任务；不执行则为空","answer":"普通聊天可直接回答；执行任务则为空"}。' },
        { role: 'user', content: `${historyPrompt(state.originalMessages || [])}\n\n用户本轮消息：${job.text}` }
      ],
      responseFormat: { type: 'json_object' }
    });
    const decision = parseDecision(understanding.text);
    let execution = null;
    if (decision.requiresExecution) {
      if (!decision.task) throw new Error('DeepSeek did not provide an execution task');
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
    }
    await this.onStage(job, 'verifying');
    const finalModel = await this.models.express({
      messages: [
        { role: 'system', content: '你是AI Workbench最终结果表达模块。结合原问题与已验证执行结果，用自然中文给出最终回复。不要展示内部模型、进程、协议或日志。若没有执行结果，直接自然回答。' },
        { role: 'user', content: `原问题：${job.text}\n\nDeepSeek初步回答：${decision.answer || '无'}\n\nCodex执行结果：${execution?.text || '未调用Codex'}` }
      ]
    });
    const final = this.verifier.verifyModelResult(finalModel).text;
    await this.sessions.appendMessage(state, { role: 'assistant', text: final, messageId: job.messageId, provider: 'deepseek' });
    return { text: final, provider: 'deepseek', languageModel: 'deepseek-chat', codexUsed: Boolean(execution), providerSessionId: execution?.sessionId || '', toolUsed: execution ? 'codex' : '', verified: true };
  }
}
