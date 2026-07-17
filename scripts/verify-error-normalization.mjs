import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userMessageContainsForbiddenTerms } from '../errors/normalize.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19882;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const { response } = await request('/api/data');
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scenarios = [
  {
    id: 'timeout',
    rawError: {
      message: 'Hermes timeout after 30000ms',
      stack: 'TimeoutError: operation timeout\n    at hermes.invoke',
      retryAttempt: 2,
      retryMax: 3
    },
    forbidden: ['timeout'],
    requiredText: ['我在等待 Hermes 回复', '继续等'],
    requiredAction: '点这里查看 Hermes 状态'
  },
  {
    id: 'permission_denied',
    rawError: {
      message: 'EACCES: Permission denied, open C:\\Users\\user\\AppData\\Local\\hermes\\logs\\.__agent.lock',
      code: 'EACCES'
    },
    forbidden: ['EACCES', 'Permission denied'],
    requiredText: ['需要更高权限', '手动确认'],
    requiredAction: '点这里了解怎么解决'
  },
  {
    id: 'api_key_invalid',
    rawError: {
      message: 'invalid_api_key: 401 Unauthorized',
      provider: 'DeepSeek'
    },
    forbidden: ['invalid_api_key', '401 Unauthorized'],
    requiredText: ['DeepSeek API 配置不对', '重新填'],
    requiredAction: '点这里配置 API'
  },
  {
    id: 'connection_refused',
    rawError: {
      message: 'ECONNREFUSED network error while connecting proxy',
      retryAttempt: 1,
      retryMax: 5
    },
    forbidden: ['ECONNREFUSED', 'network error'],
    requiredText: ['连接断掉了', '自动重连', '第 1/5 次重试'],
    requiredAction: '点这里查看连接状态'
  },
  {
    id: 'fake_completion',
    rawError: {
      reason: 'missing_evidence',
      message: 'verification failed: employee returned done without evidence'
    },
    forbidden: ['missing_evidence', 'verification'],
    requiredText: ['员工说完成了', '没查出真正的证据', '不算有效'],
    requiredAction: '点这里看具体是哪里出了问题'
  }
];

async function main() {
  await waitForServer();
  const results = {};
  for (const scenario of scenarios) {
    const normalizedResponse = await request('/api/errors/normalize', 'POST', { rawError: scenario.rawError });
    assert(normalizedResponse.response.ok, `${scenario.id} normalize endpoint failed`);
    const normalized = normalizedResponse.body.normalized;
    const leaked = userMessageContainsForbiddenTerms(normalized.userMessage);
    assert(!leaked.length, `${scenario.id} leaked technical terms: ${leaked.join(', ')}`);
    for (const term of scenario.forbidden) {
      assert(!normalized.userMessage.toLowerCase().includes(term.toLowerCase()), `${scenario.id} leaked ${term}`);
    }
    for (const text of scenario.requiredText) {
      assert(normalized.userMessage.includes(text), `${scenario.id} missing user text: ${text}`);
    }
    assert(
      normalized.suggestedActions.some((action) => action.isClickable === true && action.action === scenario.requiredAction),
      `${scenario.id} missing clickable action: ${scenario.requiredAction}`
    );
    const hintResponse = await request(`/api/errors/recovery-hints/${encodeURIComponent(normalized.type)}`);
    assert(hintResponse.response.ok, `${scenario.id} recovery hint endpoint failed`);
    results[scenario.id] = {
      normalized,
      recoveryHint: hintResponse.body.hint
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
