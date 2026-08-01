import { DeepSeekProvider } from './adapters/deepseek-provider.mjs';
import { CodexProvider } from './adapters/codex-provider.mjs';

export class ModelRouter {
  constructor(options = {}) {
    this.deepseek = options.deepseek || new DeepSeekProvider(options.deepseekOptions);
    this.codex = options.codex || new CodexProvider(options.codexOptions);
  }
  async healthCheck() {
    const [deepseek, codex] = await Promise.all([this.deepseek.healthCheck(), this.codex.healthCheck()]);
    return { ok: deepseek.ok && codex.ok, deepseek, codex };
  }
  async understand(request) { return this.deepseek.generate({ ...request, employee: 'workbench-feishu-understanding' }); }
  async express(request) { return this.deepseek.generate({ ...request, employee: 'workbench-feishu-expression' }); }
  async execute(request) { return this.codex.generate(request); }
}
