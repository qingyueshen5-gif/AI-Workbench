import { CodexProvider } from '../agents/adapters/codex-provider.mjs';

export class ModelRouter {
  constructor(options = {}) {
    this.providers = new Map([['codex', options.codex || new CodexProvider(options.codexOptions)]]);
    this.defaultProvider = 'codex';
  }
  async healthCheck() { return this.providers.get(this.defaultProvider).healthCheck(); }
  async generate(request) {
    const providerId = request.provider || this.defaultProvider;
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown model provider: ${providerId}`);
    return provider.generate(request);
  }
}
