export interface Env {
  DB: D1Database;
  DEEPSEEK_API_KEY: string;
  TOKEN_SIGNING_SECRET: string;
  INSTALLATION_HASH_SALT: string;
  MANAGED_PROXY_ENABLED?: string;
  ALLOWED_MODELS?: string;
  DAILY_GLOBAL_LIMIT?: string;
  DAILY_INSTALL_LIMIT?: string;
  DAILY_IP_LIMIT?: string;
  DAILY_TOKEN_LIMIT?: string;
  MAX_REQUEST_BYTES?: string;
  MAX_INPUT_CHARS?: string;
  MAX_OUTPUT_TOKENS?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  DEEPSEEK_BASE_URL?: string;
}

type Json = Record<string, unknown>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function json(payload: Json, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {})
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function configNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function allowedModels(env: Env) {
  return String(env.ALLOWED_MODELS || 'deepseek-chat')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signToken(env: Env, payload: Json) {
  const header = base64url(textEncoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(textEncoder.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const signature = base64url(await hmac(env.TOKEN_SIGNING_SECRET, data));
  return `${data}.${signature}`;
}

async function verifyToken(env: Env, token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad_token');
  const data = `${parts[0]}.${parts[1]}`;
  const expected = base64url(await hmac(env.TOKEN_SIGNING_SECRET, data));
  if (expected !== parts[2]) throw new Error('bad_signature');
  const payload = JSON.parse(textDecoder.decode(fromBase64url(parts[1]))) as Json;
  if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('expired_token');
  return payload;
}

async function installationHash(env: Env, installationId: string) {
  return sha256Hex(`${env.INSTALLATION_HASH_SALT}:${installationId}`);
}

async function ipHash(env: Env, request: Request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return sha256Hex(`${env.INSTALLATION_HASH_SALT}:ip:${ip}`);
}

function tokenUsageFromPayload(payload: any) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const inputChars = messages.map((message: any) => String(message?.content || '')).join('\n').length;
  return {
    inputChars,
    inputTokens: Math.ceil(inputChars / 4),
    outputTokens: 0
  };
}

async function enforceUsage(env: Env, installHash: string, ip: string) {
  const date = today();
  const installLimit = configNumber(env.DAILY_INSTALL_LIMIT, 40);
  const ipLimit = configNumber(env.DAILY_IP_LIMIT, 80);
  const globalLimit = configNumber(env.DAILY_GLOBAL_LIMIT, 200);
  const tokenLimit = configNumber(env.DAILY_TOKEN_LIMIT, 200000);

  const installRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(request_count), 0) AS n FROM daily_usage WHERE usage_date = ? AND installation_hash = ?'
  ).bind(date, installHash).first<{ n: number }>();
  if (Number(installRow?.n || 0) >= installLimit) {
    return json({ error: { message: '共享模型服务今天的本机额度已用完，请明天再试。', code: 'install_daily_limit' } }, { status: 429 });
  }

  const ipRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(request_count), 0) AS n FROM daily_usage WHERE usage_date = ? AND ip_hash = ?'
  ).bind(date, ip).first<{ n: number }>();
  if (Number(ipRow?.n || 0) >= ipLimit) {
    return json({ error: { message: '共享模型服务今天的网络额度已用完，请稍后再试。', code: 'ip_daily_limit' } }, { status: 429 });
  }

  const globalRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(request_count), 0) AS n FROM daily_usage WHERE usage_date = ?'
  ).bind(date).first<{ n: number }>();
  if (Number(globalRow?.n || 0) >= globalLimit) {
    return json({ error: { message: '共享模型服务今天的总额度已用完，请稍后再试。', code: 'global_daily_limit' } }, { status: 429 });
  }

  const tokenRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS n FROM daily_usage WHERE usage_date = ?'
  ).bind(date).first<{ n: number }>();
  if (Number(tokenRow?.n || 0) >= tokenLimit) {
    return json({ error: { message: '共享模型服务今天的预算已用完，请稍后再试。', code: 'global_token_limit' } }, { status: 429 });
  }

  return null;
}

async function recordUsage(env: Env, installHash: string, ip: string, inputTokens: number, outputTokens: number) {
  await env.DB.prepare(
    `INSERT INTO daily_usage (usage_date, installation_hash, ip_hash, request_count, input_tokens, output_tokens, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(usage_date, installation_hash, ip_hash)
     DO UPDATE SET request_count = request_count + 1,
       input_tokens = input_tokens + excluded.input_tokens,
       output_tokens = output_tokens + excluded.output_tokens,
       updated_at = excluded.updated_at`
  ).bind(today(), installHash, ip, inputTokens, outputTokens, nowIso()).run();
}

async function register(request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as Json;
  const installationId = String(body.installationId || '').trim();
  const version = String(body.version || 'unknown').slice(0, 32);
  if (!/^[a-zA-Z0-9._-]{16,128}$/.test(installationId)) {
    return json({ error: { message: '安装实例注册失败：安装标识无效。', code: 'bad_installation_id' } }, { status: 400 });
  }
  const installHash = await installationHash(env, installationId);
  const ip = await ipHash(env, request);
  const limited = await enforceUsage(env, installHash, ip);
  if (limited) return limited;
  const at = nowIso();
  await env.DB.prepare(
    `INSERT INTO installations (installation_hash, status, created_at, last_seen_at)
     VALUES (?, 'active', ?, ?)
     ON CONFLICT(installation_hash)
     DO UPDATE SET last_seen_at = excluded.last_seen_at`
  ).bind(installHash, at, at).run();
  await recordUsage(env, installHash, ip, 0, 0);
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const token = await signToken(env, { sub: installHash, version, exp, jti });
  return json({ token, expiresAt: new Date(exp * 1000).toISOString(), tokenType: 'Bearer' });
}

async function refresh(request: Request, env: Env) {
  const token = bearerToken(request);
  if (!token) return json({ error: { message: '安装令牌缺失，请重新注册。', code: 'missing_token' } }, { status: 401 });
  const payload = await verifyToken(env, token);
  const installHash = String(payload.sub || '');
  const status = await installationStatus(env, installHash);
  if (status !== 'active') {
    return json({ error: { message: '安装令牌已失效，请重新注册。', code: 'installation_revoked' } }, { status: 403 });
  }
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  return json({ token: await signToken(env, { sub: installHash, version: payload.version || 'unknown', exp, jti }), expiresAt: new Date(exp * 1000).toISOString(), tokenType: 'Bearer' });
}

function bearerToken(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function installationStatus(env: Env, installHash: string) {
  const row = await env.DB.prepare('SELECT status FROM installations WHERE installation_hash = ?').bind(installHash).first<{ status: string }>();
  return row?.status || 'missing';
}

async function authenticated(request: Request, env: Env) {
  const token = bearerToken(request);
  if (!token) throw new Error('missing_token');
  const payload = await verifyToken(env, token);
  const installHash = String(payload.sub || '');
  const jti = String(payload.jti || '');
  if (!installHash || !jti) throw new Error('bad_token');
  const revoked = await env.DB.prepare('SELECT jti FROM revoked_tokens WHERE jti = ?').bind(jti).first();
  if (revoked) throw new Error('revoked_token');
  const status = await installationStatus(env, installHash);
  if (status !== 'active') throw new Error('installation_revoked');
  return { installHash, jti };
}

async function chatCompletions(request: Request, env: Env) {
  if (String(env.MANAGED_PROXY_ENABLED || 'true').toLowerCase() === 'false') {
    return json({ error: { message: '共享模型服务已临时停用，请稍后再试。', code: 'managed_proxy_disabled' } }, { status: 503 });
  }
  const maxBytes = configNumber(env.MAX_REQUEST_BYTES, 65536);
  const raw = await request.text();
  if (new Blob([raw]).size > maxBytes) {
    return json({ error: { message: '请求内容太长，请缩短后再试。', code: 'request_too_large' } }, { status: 413 });
  }
  let auth;
  try {
    auth = await authenticated(request, env);
  } catch (error: any) {
    return json({ error: { message: '共享模型服务认证失败，请稍后重试。', code: error.message || 'auth_failed' } }, { status: 401 });
  }
  let payload: any;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return json({ error: { message: '请求 JSON 格式无效。', code: 'bad_json' } }, { status: 400 });
  }
  const allowed = allowedModels(env);
  if (!allowed.includes(String(payload.model || ''))) {
    return json({ error: { message: '该模型暂未开放共享调用。', code: 'model_not_allowed' } }, { status: 400 });
  }
  const usage = tokenUsageFromPayload(payload);
  if (usage.inputChars > configNumber(env.MAX_INPUT_CHARS, 30000)) {
    return json({ error: { message: '输入内容太长，请缩短后再试。', code: 'input_too_large' } }, { status: 413 });
  }
  payload.max_tokens = Math.min(Number(payload.max_tokens || configNumber(env.MAX_OUTPUT_TOKENS, 2048)), configNumber(env.MAX_OUTPUT_TOKENS, 2048));
  const ip = await ipHash(env, request);
  const limited = await enforceUsage(env, auth.installHash, ip);
  if (limited) return limited;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('upstream timeout'), configNumber(env.UPSTREAM_TIMEOUT_MS, 60000));
  try {
    const upstream = await fetch(`${String(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await upstream.text();
    let outputTokens = 0;
    try {
      outputTokens = Number(JSON.parse(text)?.usage?.completion_tokens || 0);
    } catch {}
    await recordUsage(env, auth.installHash, ip, usage.inputTokens, outputTokens);
    console.log(JSON.stringify({ at: nowIso(), installationHash: auth.installHash.slice(0, 16), ipHash: ip.slice(0, 16), statusCode: upstream.status, durationMs: 0, inputTokens: usage.inputTokens, outputTokens }));
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return json({ error: { message: '共享模型服务连接上游超时或失败，请稍后再试。', code: 'upstream_failed' } }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({
        ok: String(env.MANAGED_PROXY_ENABLED || 'true').toLowerCase() !== 'false',
        service: 'ai-workbench-managed-proxy',
        enabled: String(env.MANAGED_PROXY_ENABLED || 'true').toLowerCase() !== 'false',
        models: allowedModels(env)
      });
    }
    if (url.pathname === '/v1/models') {
      return json({ object: 'list', data: allowedModels(env).map((id) => ({ id, object: 'model', owned_by: 'deepseek' })) });
    }
    if (request.method === 'POST' && url.pathname === '/v1/install/register') return register(request, env);
    if (request.method === 'POST' && url.pathname === '/v1/install/refresh') return refresh(request, env);
    if (request.method === 'POST' && url.pathname === '/v1/chat/completions') return chatCompletions(request, env);
    return json({ error: { message: 'not found' } }, { status: 404 });
  }
};
