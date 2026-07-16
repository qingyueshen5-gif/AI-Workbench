import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'workbench.json');
const envFile = join(root, '.env');
const port = 18787;
const baseUrl = `http://127.0.0.1:${port}`;
const api = `${baseUrl}/api/data`;

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

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(api);
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

async function request(method, payload) {
  const response = await fetch(api, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function requestUrl(url, method, payload) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function hasDeepSeekApiKey() {
  if (String(process.env.DEEPSEEK_API_KEY || '').trim()) return true;
  try {
    const raw = await readFile(envFile, 'utf8');
    return raw
      .split(/\r?\n/)
      .some((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        const separator = trimmed.indexOf('=');
        if (separator === -1) return false;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
        return key === 'DEEPSEEK_API_KEY' && Boolean(value);
      });
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function hasSerperApiKey() {
  if (String(process.env.SERPER_API_KEY || '').trim()) return true;
  try {
    const raw = await readFile(envFile, 'utf8');
    return raw
      .split(/\r?\n/)
      .some((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        const separator = trimmed.indexOf('=');
        if (separator === -1) return false;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
        return key === 'SERPER_API_KEY' && Boolean(value);
      });
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function verifyUiSource() {
  const main = await readFile(join(root, 'src', 'main.jsx'), 'utf8');
  const styles = await readFile(join(root, 'src', 'styles.css'), 'utf8');
  const serverSource = await readFile(join(root, 'server.mjs'), 'utf8');
  const expectations = [
    [main.includes('aria-label="更多对话操作"') && main.includes('删除'), 'Conversation more menu with delete action is missing'],
    [styles.includes('.conversation-row:hover .conversation-menu-button'), 'Conversation menu hover style is missing'],
    [main.includes('scrollTo({ top: container.scrollHeight'), 'Chat stream auto-scroll is missing'],
    [main.includes('查看关联任务') && main.includes('setSelectedTaskId(task.id)'), 'Today goal task expansion is missing'],
    [main.includes('负责人') && main.includes('DeepSeek') && main.includes('未接入'), 'Owner connection state options are missing'],
    [main.includes('今天要推进什么？'), 'Empty conversation welcome state is missing'],
    [!main.includes('聊天驱动目标、任务和偏好'), 'Technical top-bar helper text should not be permanently visible'],
    [!main.includes('F:\\AI-Workbench'), 'Local workspace path should not be permanently visible'],
    [serverSource.includes("name: 'web_search'") && serverSource.includes('https://google.serper.dev/search'), 'Generic web_search tool is missing'],
    [serverSource.includes('tool_calls') && serverSource.includes('实时数据、新闻、当前状态、价格'), 'DeepSeek web_search tool-call policy is missing'],
    [serverSource.includes('Serper Google Search API'), 'Search results should identify the Serper source']
  ];
  for (const [passes, message] of expectations) {
    if (!passes) throw new Error(message);
  }
}

async function main() {
  await rm(dataFile, { force: true });
  await waitForServer();
  await verifyUiSource();

  const today = new Date().toISOString().slice(0, 10);
  const validData = {
    dailyGoals: { [today]: '验证 MVP 闭环' },
    preferences: {
      defaultOwner: 'DeepSeek',
      dailyTaskLimit: 7,
      deepSeekModel: 'deepseek-chat'
    },
    modelConnection: {
      status: '未连接',
      provider: '',
      model: '',
      checkedAt: ''
    },
    systemErrors: [],
    messages: [
      {
        id: 'verify-message',
        content: '把这条消息同步为任务',
        createdAt: new Date().toISOString(),
        isTask: true,
        taskId: 'verify-task'
      },
      {
        id: 'verify-user-message',
        content: '验证 MVP 闭环',
        createdAt: new Date().toISOString(),
        role: 'user',
        isTask: false,
        taskId: ''
      }
    ],
    conversations: [
      {
        id: 'verify-conversation',
        title: '把这条消息同步为任务',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'verify-message',
            content: '把这条消息同步为任务',
            createdAt: new Date().toISOString(),
            isTask: true,
            taskId: 'verify-task'
          },
          {
            id: 'verify-user-message',
            content: '验证 MVP 闭环',
            createdAt: new Date().toISOString(),
            role: 'user',
            isTask: false,
            taskId: ''
          }
        ]
      },
      {
        id: 'empty-conversation',
        title: '新对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      }
    ],
    activeConversationId: 'verify-conversation',
    tasks: [
      {
        id: 'verify-task',
        title: '验证任务持久化',
        status: '已完成',
        owner: 'DeepSeek',
        createdAt: new Date().toISOString(),
        notes: 'verify script',
        failureReason: ''
      }
    ]
  };

  const saved = await request('PUT', validData);
  if (!saved.response.ok) {
    throw new Error(`Expected valid data to save, got ${saved.response.status}`);
  }

  const persisted = JSON.parse(await readFile(dataFile, 'utf8'));
  if (persisted.dailyGoals[today] !== validData.dailyGoals[today]) {
    throw new Error('Daily goal was not persisted');
  }
  if (persisted.tasks[0]?.status !== '已完成') {
    throw new Error('Task status was not persisted');
  }
  if (persisted.preferences?.defaultOwner !== 'DeepSeek') {
    throw new Error('Preferences were not persisted');
  }
  if (persisted.conversations[0]?.title !== '验证 MVP 闭环') {
    throw new Error('Internal action text should not be used as a conversation title');
  }
  if (persisted.tasks[0]?.owner !== 'DeepSeek') {
    throw new Error('DeepSeek owner should be persisted');
  }

  const loaded = await request('GET');
  if (!loaded.response.ok || loaded.body.storage?.taskCount !== 1) {
    throw new Error('Storage status was not returned');
  }

  const invalidFailedTask = {
    ...validData,
    tasks: [{ ...validData.tasks[0], status: '失败', failureReason: '' }]
  };
  const rejected = await request('PUT', invalidFailedTask);
  if (rejected.response.status !== 400 || rejected.body.error !== '失败任务必须填写失败原因') {
    throw new Error('Failed tasks without a failure reason should be rejected');
  }

  const validFailedTask = {
    ...validData,
    tasks: [{ ...validData.tasks[0], status: '失败', failureReason: '验证失败原因必填' }]
  };
  const accepted = await request('PUT', validFailedTask);
  if (!accepted.response.ok) {
    throw new Error('Failed tasks with a failure reason should be accepted');
  }

  const aiTest = await requestUrl(`${baseUrl}/api/test-ai-connection`, 'POST', {
    model: 'deepseek-chat'
  });
  const apiKeyConfigured = await hasDeepSeekApiKey();
  if (!apiKeyConfigured) {
    if (aiTest.response.status !== 400 || aiTest.body.error !== '等待用户提供API Key') {
      throw new Error('Missing API key should be recorded as a system error');
    }
    if (!aiTest.body.data?.systemErrors?.some((error) => error.operation === '测试AI连接')) {
      throw new Error('AI connection errors should be visible in system error logs');
    }
  } else {
    if (!aiTest.response.ok || aiTest.body.data?.modelConnection?.status !== '已连接') {
      throw new Error(`DeepSeek connection test failed: ${aiTest.body.error || aiTest.response.status}`);
    }
  }

  if (await hasSerperApiKey()) {
    const raw = await readFile(envFile, 'utf8').catch(() => '');
    const keyLine = raw.split(/\r?\n/).find((line) => line.trim().startsWith('SERPER_API_KEY='));
    const serperKey = String(process.env.SERPER_API_KEY || keyLine?.split('=')?.slice(1).join('=') || '').trim().replace(/^['"]|['"]$/g, '');
    const searchResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': serperKey
      },
      body: JSON.stringify({ q: 'OpenAI latest news', num: 3 })
    });
    const searchBody = await searchResponse.json().catch(() => ({}));
    if (!searchResponse.ok || !Array.isArray(searchBody.organic)) {
      throw new Error(`Serper search failed: ${searchBody.message || searchResponse.status}`);
    }
  }

  console.log('MVP verification passed');
}

try {
  await main();
} finally {
  server.kill();
}
