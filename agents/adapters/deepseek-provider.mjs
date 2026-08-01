const baseUrl = String(process.env.MODEL_PROXY_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');

async function request(url, options = {}, timeoutMs = 60000) {
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
    this.model = options.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }
  async healthCheck() {
    try {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not configured');
      const probe = await this.generate({ messages: [{ role: 'user', content: '只回复OK' }] });
      return { ok: Boolean(probe.text), provider: 'deepseek', model: this.model, transport: 'official_deepseek_api' };
    } catch (error) {
      return { ok: false, provider: 'deepseek', model: this.model, transport: 'official_deepseek_api', error: error.message };
    }
  }
  async generate({ messages, prompt, responseFormat }) {
    const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');
    const body = { model: this.model, messages: messages || [{ role: 'user', content: String(prompt || '') }], stream: false };
    if (responseFormat) body.response_format = responseFormat;
    const startedAt = Date.now();
    const payload = await request(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('DeepSeek returned no answer');
    return { provider: 'deepseek', text, model: this.model, durationMs: Date.now() - startedAt };
  }
}
