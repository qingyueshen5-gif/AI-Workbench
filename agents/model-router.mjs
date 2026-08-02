import { DeepSeekProvider } from './adapters/deepseek-provider.mjs';
import { CodexProvider } from './adapters/codex-provider.mjs';

export class ModelRouter {
  constructor(options = {}) {
    this.deepseek = options.deepseek || new DeepSeekProvider(options.deepseekOptions);
    this.codex = options.codex || new CodexProvider(options.codexOptions);
    this.activeExecutions=new Map();
  }
  async healthCheck() {
    const [deepseek, codex] = await Promise.all([this.deepseek.healthCheck(), this.codex.healthCheck()]);
    return { ok: deepseek.ok && codex.ok, deepseek, codex };
  }
  async understand(request) { return this.deepseek.generate({ ...request, employee: 'workbench-feishu-understanding' }); }
  async express(request) { return this.deepseek.generate({ ...request, employee: 'workbench-feishu-expression' }); }
  async execute(request) { const controller=new AbortController();this.activeExecutions.set(request.conversationId,controller);try{return await this.codex.generate({...request,signal:controller.signal});}finally{this.activeExecutions.delete(request.conversationId);} }
  cancel(conversationId) { const controller=this.activeExecutions.get(conversationId);if(!controller)return false;controller.abort();return true; }
}
