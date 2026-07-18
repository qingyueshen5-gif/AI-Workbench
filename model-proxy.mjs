import { createServer } from 'node:http';
import { readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateLegacyRuntimeData, runtimeModelProxyLogFile } from './runtime-paths.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const envFile = join(root, '.env');
const logFile = runtimeModelProxyLogFile;
const port = Number(process.env.MODEL_PROXY_PORT || 18800);
const upstreamBaseUrl = String(process.env.MODEL_PROXY_UPSTREAM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const maxRetries = Number(process.env.MODEL_PROXY_MAX_RETRIES || 3);

migrateLegacyRuntimeData(root);

function loadLocalEnv() {
  try {
    const raw = readFileSync(envFile, 'utf8');
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

loadLocalEnv();

function apiKey() {
  return String(process.env.DEEPSEEK_API_KEY || '').trim();
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-aiw-employee, x-aiw-simulate-network-fail-once'
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

async function fetchWithRetry(path, { method = 'GET', body = '', headers = {}, simulateFailOnce = false } = {}) {
  let lastError = null;
  let simulated = simulateFailOnce;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const started = Date.now();
    try {
      if (simulated) {
        simulated = false;
        throw new Error('simulated transient network failure');
      }
      const response = await fetch(`${upstreamBaseUrl}${path}`, {
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
  const key = apiKey();
  if (!key) {
    sendJson(response, 503, { error: { message: '本机模型代理缺少 DEEPSEEK_API_KEY。' } });
    return;
  }
  try {
    const result = await fetchWithRetry(path, {
      method: request.method,
      body,
      headers: {
        'Content-Type': request.headers['content-type'] || 'application/json',
        Authorization: `Bearer ${key}`
      },
      simulateFailOnce: request.headers['x-aiw-simulate-network-fail-once'] === '1'
    });
    appendCallLog({
      employee,
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
      path,
      statusCode: 502,
      attempts: maxRetries,
      durationMs: Date.now() - started,
      error: error.message
    });
    sendJson(response, 502, {
      error: {
        message: `本机模型代理重试 ${maxRetries} 次后仍失败：${error.message}`
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
      sendJson(response, 200, {
        ok: Boolean(apiKey()),
        status: apiKey() ? 'available' : 'missing_key',
        upstreamBaseUrl,
        port,
        loopbackOnly: true
      });
      return;
    }
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      await forwardOpenAiCompatible(request, response, '/models');
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

server.listen(port, '127.0.0.1', () => {
  console.log(`Model proxy listening at http://127.0.0.1:${port}`);
});
