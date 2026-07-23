import { createServer } from 'node:http';
import { readFileSync, mkdirSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateLegacyRuntimeData, runtimeConfigDir, runtimeManagedProxyFile, runtimeModelProxyLogFile, runtimeRoot } from './runtime-paths.mjs';
import { explainPortStatus } from './readiness.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const envFile = join(root, '.env');
const runtimeEnvFile = join(runtimeRoot, '.env');
const logFile = runtimeModelProxyLogFile;
const port = Number(process.env.MODEL_PROXY_PORT || 18800);
const maxRetries = Number(process.env.MODEL_PROXY_MAX_RETRIES || 3);
const packagedMode = process.env.AIW_PACKAGED === '1';
const clientVersion = String(process.env.npm_package_version || '0.4.6');

migrateLegacyRuntimeData(root);

function loadLocalEnv() {
  if (process.env.MODEL_PROXY_DISABLE_LOCAL_ENV === '1') return;
  for (const file of [runtimeEnvFile, envFile]) {
    try {
      const raw = readFileSync(file, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) process.env[key] = value;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

loadLocalEnv();

const providers = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai-compatible',
    baseUrl: String(process.env.MODEL_PROXY_DEEPSEEK_BASE_URL || process.env.MODEL_PROXY_UPSTREAM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    sharedApiKeyEnv: 'AIW_SHARED_DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', ownedBy: 'deepseek', aliases: ['deepseek-v4-pro', 'deepseek-v4-flash'] },
      { id: 'deepseek-reasoner', ownedBy: 'deepseek', aliases: [] }
    ]
  }
};

const defaultProviderId = String(process.env.MODEL_PROXY_DEFAULT_PROVIDER || 'deepseek').trim() || 'deepseek';

function readManagedState() {
  try {
    if (!existsSync(runtimeManagedProxyFile)) return {};
    return JSON.parse(readFileSync(runtimeManagedProxyFile, 'utf8'));
  } catch {
    return {};
  }
}

function getManagedProxyUrl() {
  return String(process.env.MANAGED_PROXY_URL || process.env.AIW_MANAGED_PROXY_URL || readManagedState().managedProxyUrl || '').trim().replace(/\/+$/, '');
}

function providerApiKey(provider) {
  const localKey = String(process.env[provider.apiKeyEnv] || '').trim();
  if (localKey) return { value: localKey, source: 'local_env', configured: true };
  if (getManagedProxyUrl()) return { value: '', source: 'managed_remote', configured: true, managed: true };
  if (packagedMode) return { value: '', source: 'missing', configured: false };
  const sharedKey = String(process.env[provider.sharedApiKeyEnv] || process.env.MODEL_PROXY_SHARED_API_KEY || '').trim();
  if (sharedKey) return { value: sharedKey, source: 'shared_managed', configured: true };
  return { value: '', source: 'missing', configured: false };
}

function writeManagedState(state) {
  mkdirSync(runtimeConfigDir, { recursive: true });
  writeFileSync(runtimeManagedProxyFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function protectSecret(value) {
  if (process.platform !== 'win32') return { encoding: 'plain-dev-only', value };
  const script = '[Console]::InputEncoding=[Text.Encoding]::UTF8; $raw=[Console]::In.ReadToEnd(); ConvertTo-SecureString -String $raw -AsPlainText -Force | ConvertFrom-SecureString';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    input: value,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) throw new Error('安装令牌加密保存失败');
  return { encoding: 'windows-dpapi', value: String(result.stdout || '').trim() };
}

function unprotectSecret(record) {
  if (!record?.value) return '';
  if (record.encoding === 'plain-dev-only') return String(record.value || '');
  if (record.encoding !== 'windows-dpapi') return '';
  const script = '$encrypted=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $encrypted; $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    input: String(record.value || ''),
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function tokenExpiresSoon(expiresAt) {
  const time = Date.parse(String(expiresAt || ''));
  return !Number.isFinite(time) || time - Date.now() < 10 * 60 * 1000;
}

async function managedRequest(path, options = {}) {
  const managedProxyUrl = getManagedProxyUrl();
  const response = await fetch(`${managedProxyUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, text, payload };
}

async function ensureManagedToken() {
  const managedProxyUrl = getManagedProxyUrl();
  if (!managedProxyUrl) throw new Error('共享模型服务地址未配置');
  const state = readManagedState();
  const installationId = String(state.installationId || randomUUID());
  const currentToken = unprotectSecret(state.token);
  if (currentToken && !tokenExpiresSoon(state.expiresAt)) return { token: currentToken, installationId };
  if (currentToken) {
    const refreshed = await managedRequest('/v1/install/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentToken}` }
    });
    if (refreshed.response.ok && refreshed.payload?.token) {
      const next = {
        ...state,
        installationId,
        managedProxyUrl,
        token: protectSecret(String(refreshed.payload.token)),
        expiresAt: String(refreshed.payload.expiresAt || '')
      };
      writeManagedState(next);
      return { token: String(refreshed.payload.token), installationId };
    }
  }
  const registered = await managedRequest('/v1/install/register', {
    method: 'POST',
    body: JSON.stringify({ installationId, version: clientVersion })
  });
  if (!registered.response.ok || !registered.payload?.token) {
    const message = registered.payload?.error?.message || '共享模型服务注册失败';
    throw new Error(message);
  }
  writeManagedState({
    installationId,
    managedProxyUrl,
    token: protectSecret(String(registered.payload.token)),
    expiresAt: String(registered.payload.expiresAt || '')
  });
  return { token: String(registered.payload.token), installationId };
}

function resolveProvider(providerId = defaultProviderId) {
  return providers[providerId] || providers[defaultProviderId] || providers.deepseek;
}

function allModelEntries() {
  return Object.values(providers).flatMap((provider) => provider.models.map((model) => ({
    id: model.id,
    object: 'model',
    created: 0,
    owned_by: model.ownedBy || provider.id,
    provider: provider.id
  })));
}

function resolveModel(provider, modelId) {
  const requested = String(modelId || '').trim();
  const normalized = requested.includes('/') ? requested.split('/').pop() : requested;
  const found = provider.models.find((model) => model.id === normalized || model.aliases?.includes(normalized));
  return found?.id || normalized || provider.models[0]?.id || 'deepseek-chat';
}

function isLoopback(request) {
  const address = request.socket.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-aiw-employee, x-aiw-provider, x-aiw-simulate-network-fail-once'
  });
  response.end(JSON.stringify(payload));
}

function employeeId(request, body = '') {
  const explicit = String(request.headers['x-aiw-employee'] || '').trim();
  if (explicit) return explicit;
  const auth = String(request.headers.authorization || '');
  const tokenMatch = auth.match(/^Bearer\s+aiw\.([a-z0-9_-]+)/i);
  if (tokenMatch) return tokenMatch[1];
  try {
    const parsed = JSON.parse(body || '{}');
    return String(parsed.employee || parsed.agentId || 'unknown').trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(statusCode) {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

async function fetchWithRetry(provider, path, { method = 'GET', body = '', headers = {}, simulateFailOnce = false } = {}) {
  let lastError = null;
  let simulated = simulateFailOnce;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const started = Date.now();
    try {
      if (simulated) {
        simulated = false;
        throw new Error('simulated transient network failure');
      }
      const response = await fetch(`${provider.baseUrl}${path}`, {
        method,
        headers,
        body: method === 'GET' ? undefined : body
      });
      const text = await response.text();
      const durationMs = Date.now() - started;
      if (!response.ok && shouldRetry(response.status) && attempt < maxRetries) {
        lastError = new Error(`upstream returned ${response.status}`);
        await sleep(250 * attempt);
        continue;
      }
      return { response, text, attempts: attempt, durationMs };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      await sleep(250 * attempt);
    }
  }
  throw lastError || new Error('upstream request failed');
}

function appendCallLog(entry) {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, 'utf8');
}

async function forwardOpenAiCompatible(request, response, path) {
  const body = await readBody(request);
  const employee = employeeId(request, body);
  const started = Date.now();
  const provider = resolveProvider(request.headers['x-aiw-provider']);
  const credential = providerApiKey(provider);
  if (!credential.configured) {
    sendJson(response, 503, { error: { message: packagedMode ? '共享模型服务未配置，工作台可以先打开，请稍后重试。' : `本机模型代理缺少 ${provider.apiKeyEnv}。` } });
    return;
  }
  try {
    let upstreamBody = body;
    if (path === '/chat/completions') {
      try {
        const parsed = JSON.parse(body || '{}');
        parsed.model = resolveModel(provider, parsed.model);
        upstreamBody = JSON.stringify(parsed);
      } catch {}
    }
    const headers = {
      'Content-Type': request.headers['content-type'] || 'application/json'
    };
    let targetProvider = provider;
    let targetPath = path;
    if (credential.managed) {
      const managed = await ensureManagedToken();
      targetProvider = { ...provider, baseUrl: getManagedProxyUrl() };
      targetPath = '/v1/chat/completions';
      headers.Authorization = `Bearer ${managed.token}`;
      headers['x-aiw-installation-id'] = managed.installationId;
      headers['x-aiw-client-version'] = clientVersion;
    } else {
      headers.Authorization = `Bearer ${credential.value}`;
    }
    const result = await fetchWithRetry(targetProvider, targetPath, {
      method: request.method,
      body: upstreamBody,
      headers,
      simulateFailOnce: request.headers['x-aiw-simulate-network-fail-once'] === '1'
    });
    appendCallLog({
      employee,
      provider: provider.id,
      path,
      statusCode: result.response.status,
      attempts: result.attempts,
      durationMs: Date.now() - started
    });
    response.writeHead(result.response.status, {
      'Content-Type': result.response.headers.get('content-type') || 'application/json; charset=utf-8'
    });
    response.end(result.text);
  } catch (error) {
    appendCallLog({
      employee,
      provider: provider.id,
      path,
      statusCode: 502,
      attempts: maxRetries,
      durationMs: Date.now() - started,
      error: error.message
    });
    sendJson(response, 502, {
      error: {
        message: credential.managed
          ? `共享模型服务暂时不可用：${error.message || '请稍后再试'}。`
          : `本机模型代理重试 ${maxRetries} 次后仍失败：${error.message}`
      }
    });
  }
}

const server = createServer(async (request, response) => {
  try {
    if (!isLoopback(request)) {
      sendJson(response, 403, { error: { message: '本机模型代理只接受 127.0.0.1 请求。' } });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/health' && request.method === 'GET') {
      const provider = resolveProvider();
      const defaultCredential = providerApiKey(provider);
      sendJson(response, 200, {
        ok: defaultCredential.configured,
        status: defaultCredential.configured ? 'available' : 'missing_key',
        defaultProvider: provider.id,
        providers: Object.fromEntries(Object.values(providers).map((item) => [item.id, {
          type: item.type,
          baseUrl: item.baseUrl,
          configured: providerApiKey(item).configured,
          credentialSource: providerApiKey(item).source,
          models: item.models.map((model) => model.id)
        }])),
        port,
        loopbackOnly: true
      });
      return;
    }
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      sendJson(response, 200, {
        object: 'list',
        data: allModelEntries()
      });
      return;
    }
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      await forwardOpenAiCompatible(request, response, '/chat/completions');
      return;
    }
    sendJson(response, 404, { error: { message: 'not found' } });
  } catch (error) {
    sendJson(response, 500, { error: { message: error.message || 'model proxy failed' } });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    const payload = {
      ok: false,
      status: 'not_ready',
      service: 'model_proxy',
      port,
      userMessage: explainPortStatus(port, '模型代理', error),
      checkedAt: new Date().toISOString()
    };
    console.error(JSON.stringify(payload));
    process.exitCode = 0;
    setTimeout(() => process.exit(0), 30);
    return;
  }
  console.error(JSON.stringify({
    ok: false,
    status: 'not_ready',
    service: 'model_proxy',
    port,
    userMessage: `模型代理启动失败：${error.message || '未知错误'}。`,
    checkedAt: new Date().toISOString()
  }));
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Model proxy listening at http://127.0.0.1:${port}`);
});
