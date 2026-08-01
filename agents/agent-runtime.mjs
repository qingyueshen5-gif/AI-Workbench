import { resolve } from 'node:path';
import { ModelRouter } from './model-router.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { SessionStore } from '../channels/session-store.mjs';

function extractPath(text) {
  const match = String(text || '').match(/[A-Za-z]:\\[^\r\n"'<>|?*]+?\.(?:md|txt|json|csv|yaml|yml)/i);
  return match ? match[0] : '';
}
function toolIntent(text) {
  const value = String(text || '');
  const path = extractPath(value);
  if (path && /(?:读取|查看|打开|总结|概括|分析)/.test(value)) return { type: 'read_file', path };
  if (path && /(?:修改|写入|改成|替换)/.test(value)) {
    const content = value.match(/(?:内容(?:为|改为)|写入)[：:]?\s*([\s\S]+)$/)?.[1]?.trim();
    if (content) return { type: 'write_file', path, content };
  }
  return null;
}
function historyPrompt(history) {
  return history.slice(-20).map((item) => `${item.role === 'assistant' ? '助手' : item.role === 'tool' ? '工具' : '用户'}：${item.text}`).join('\n');
}

export class AgentRuntime {
  constructor(options = {}) {
    this.sessions = options.sessions || new SessionStore(options.sessionOptions);
    this.models = options.models || new ModelRouter(options.modelOptions);
    this.tools = options.tools || new ToolExecutor({ root: options.root || process.cwd(), allowedRoots: options.allowedRoots || [process.cwd()] });
    this.verifier = options.verifier || new ResultVerifier();
  }
  async handle(job) {
    const conversationId = job.conversationId || job.chatId;
    const state = await this.sessions.load(conversationId, job.openId);
    await this.sessions.appendMessage(state, { role: 'user', text: job.text, messageId: job.messageId });
    const call = toolIntent(job.text);
    let toolEvidence = null;
    if (call) {
      const verification = await this.tools.execute(job.messageId, call);
      toolEvidence = this.verifier.verifyToolResult(call, verification).verification;
      await this.sessions.appendMessage(state, { role: 'tool', text: JSON.stringify({ call, verification: toolEvidence }), messageId: job.messageId });
    }
    const prompt = [
      '你是 AI Workbench 的单一助手。只输出自然中文，不展示内部日志、进程、会话ID、工具协议或技术栈。',
      '结合持续对话上下文回答。若提供了已验证工具结果，必须据此回答，不得声称再次执行工具。',
      historyPrompt(state.originalMessages || []),
      toolEvidence ? `本轮已验证工具结果：${JSON.stringify(toolEvidence)}` : '',
      `用户本轮消息：${job.text}`
    ].filter(Boolean).join('\n\n');
    const result = await this.models.generate({ conversationId, prompt, workspace: resolve(process.cwd()), writable: false });
    const final = this.verifier.verifyModelResult(result).text;
    await this.sessions.appendMessage(state, { role: 'assistant', text: final, messageId: job.messageId, provider: 'codex', providerSessionId: result.sessionId });
    return { text: final, provider: 'codex', providerSessionId: result.sessionId, toolUsed: call?.type || '', verified: true };
  }
}
