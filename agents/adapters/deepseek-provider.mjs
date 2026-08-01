const proxyBaseUrl = String(process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1').replace(/\/+$/, '');
const healthUrl = proxyBaseUrl.replace(/\/v1$/, '/health');

async function request(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `DeepSeek HTTP ${response.status}`);
    return payload;
  } finally { clearTimeout(timer); }
}

export class DeepSeekProvider {
  constructor(options = {}) {
    this.model = options.model || 'deepseek-chat';
  }
  async healthCheck() {
    try {
      const health = await request(healthUrl, {}, 10000);
      if (!(health?.ok === true && health?.defaultProvider === 'deepseek')) throw new Error('DeepSeek health endpoint is not ready');
      const probe = await this.generate({ messages: [{ role: 'user', content: '只回复OK' }], employee: 'workbench-feishu-health' });
      return { ok: Boolean(probe.text), provider: 'deepseek', model: this.model, transport: 'ai_workbench_model_proxy' };
    } catch (error) {
      return { ok: false, provider: 'deepseek', model: this.model, error: error.message };
    }
  }
  async generate({ messages, prompt, responseFormat, employee = 'workbench-feishu' }) {
    const body = { model: this.model, messages: messages || [{ role: 'user', content: String(prompt || '') }], stream: false };
    if (responseFormat) body.response_format = responseFormat;
    const startedAt = Date.now();
    const payload = await request(`${proxyBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer aiw.workbench.local', 'x-aiw-employee': employee },
      body: JSON.stringify(body)
    }, 60000);
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('DeepSeek returned no answer');
    return { provider: 'deepseek', text, model: this.model, durationMs: Date.now() - startedAt };
  }
}
