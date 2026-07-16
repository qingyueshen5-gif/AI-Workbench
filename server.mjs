import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = join(root, 'data', 'workbench.json');
const envFile = join(root, '.env');
const port = Number(process.env.PORT || 8787);
const deepSeekBaseUrl = 'https://api.deepseek.com';

const initialData = {
  dailyGoals: {},
  messages: [],
  tasks: [],
  preferences: {
    defaultOwner: '人工',
    dailyTaskLimit: 5,
    deepSeekModel: 'deepseek-chat'
  },
  modelConnection: {
    status: '未连接',
    provider: '',
    model: '',
    checkedAt: ''
  },
  systemErrors: []
};

const extractionConfidenceThreshold = 0.75;

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

function normalizeData(data) {
  return {
    ...initialData,
    ...data,
    dailyGoals: data.dailyGoals || {},
    messages: data.messages || [],
    tasks: data.tasks || [],
    preferences: { ...initialData.preferences, ...(data.preferences || {}) },
    modelConnection: { ...initialData.modelConnection, ...(data.modelConnection || {}) },
    systemErrors: data.systemErrors || []
  };
}

async function readData() {
  try {
    const raw = await readFile(dataFile, 'utf8');
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeData(initialData);
    return initialData;
  }
}

async function writeData(data) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(normalizeData(data), null, 2), 'utf8');
}

async function readDataWithMeta() {
  const data = await readData();
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = (await stat(dataFile)).size;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return {
    ...data,
    storage: {
      fileSizeBytes,
      taskCount: data.tasks.length,
      messageCount: data.messages.length,
      historyDayCount: new Set([
        ...Object.keys(data.dailyGoals),
        ...data.tasks.map((task) => String(task.createdAt || '').slice(0, 10)).filter(Boolean)
      ]).size,
      systemErrorCount: data.systemErrors.length
    }
  };
}

function createSystemError(description, operation) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    description,
    operation
  };
}

function describeDeepSeekError(statusCode, payload) {
  const message = payload?.error?.message || payload?.message || '';
  const code = payload?.error?.code || '';
  if (statusCode === 401) return 'API Key无效或无权限';
  if (statusCode === 403) return 'API Key权限不足';
  if (statusCode === 408) return '网络超时';
  if (statusCode === 429 && (code === 'insufficient_quota' || message.includes('quota'))) return '余额不足或额度已用尽';
  if (statusCode === 429) return '请求过于频繁或额度受限';
  if (statusCode >= 500) return 'DeepSeek服务暂时不可用';
  return message || `DeepSeek API返回错误 ${statusCode}`;
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('DeepSeek未返回提炼结果');
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('DeepSeek返回结果不是JSON');
    return JSON.parse(match[0]);
  }
}

async function callDeepSeek(apiKey, model, messages, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const deepSeekResponse = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      }),
      signal: controller.signal
    });
    const result = await deepSeekResponse.json().catch(() => ({}));
    if (!deepSeekResponse.ok) {
      const error = new Error(describeDeepSeekError(deepSeekResponse.status, result));
      error.statusCode = deepSeekResponse.status;
      error.payload = result;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('网络超时');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractStructureFromMessage(apiKey, model, content, currentData) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await callDeepSeek(apiKey, model, [
    {
      role: 'system',
      content: [
        '你是AI Workbench的信息提炼器，只把用户聊天内容转换成结构化数据，不执行任务。',
        '只返回JSON，不要Markdown，不要解释。',
        'JSON格式：{"goal":{"text":"","confidence":0},"tasks":[{"title":"","owner":"","confidence":0}],"preferences":{"defaultOwner":"","dailyTaskLimit":null,"communicationStyle":"","confidence":0},"needsConfirmation":[{"type":"goal|task|preference","text":"","reason":""}]}',
        '只有明确表达今天目标、待办任务或偏好时才填写；不确定时不要自动写入，放到needsConfirmation。',
        'owner只能是GPT、Codex、Claude、人工之一；无法判断则留空。',
        `今天日期是${today}。`
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        message: content,
        currentGoal: currentData.dailyGoals[today] || '',
        currentPreferences: currentData.preferences,
        existingTasks: currentData.tasks.slice(0, 20).map((task) => ({
          title: task.title,
          status: task.status,
          owner: task.owner
        }))
      })
    }
  ]);
  const text = result.choices?.[0]?.message?.content || '';
  return extractJsonObject(text);
}

function applyExtraction(data, extraction, sourceMessageId) {
  const today = new Date().toISOString().slice(0, 10);
  const next = normalizeData(data);
  const applied = [];
  const suggestions = Array.isArray(extraction.needsConfirmation) ? extraction.needsConfirmation : [];
  const goal = extraction.goal || {};
  if (goal.text && Number(goal.confidence || 0) >= extractionConfidenceThreshold) {
    next.dailyGoals = { ...next.dailyGoals, [today]: String(goal.text).trim() };
    applied.push(`更新今日目标：${goal.text}`);
  } else if (goal.text) {
    suggestions.push({ type: 'goal', text: String(goal.text), reason: '目标判断不够确定' });
  }

  const existingTitles = new Set(next.tasks.map((task) => task.title.trim().toLowerCase()));
  for (const item of Array.isArray(extraction.tasks) ? extraction.tasks : []) {
    const title = String(item.title || '').trim();
    if (!title) continue;
    if (Number(item.confidence || 0) >= extractionConfidenceThreshold) {
      if (existingTitles.has(title.toLowerCase())) continue;
      next.tasks = [{
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        status: '待开始',
        owner: ownersFromValue(item.owner) || next.preferences.defaultOwner || '人工',
        createdAt: new Date().toISOString(),
        notes: '从聊天自动提炼',
        failureReason: '',
        sourceMessageId
      }, ...next.tasks];
      existingTitles.add(title.toLowerCase());
      applied.push(`创建任务：${title}`);
    } else {
      suggestions.push({ type: 'task', text: title, reason: '任务判断不够确定' });
    }
  }

  const preferences = extraction.preferences || {};
  if (Number(preferences.confidence || 0) >= extractionConfidenceThreshold) {
    const patch = {};
    const owner = ownersFromValue(preferences.defaultOwner);
    if (owner) patch.defaultOwner = owner;
    if (Number.isFinite(Number(preferences.dailyTaskLimit)) && Number(preferences.dailyTaskLimit) >= 0) {
      patch.dailyTaskLimit = Number(preferences.dailyTaskLimit);
    }
    if (preferences.communicationStyle) patch.communicationStyle = String(preferences.communicationStyle).trim();
    if (Object.keys(patch).length) {
      next.preferences = { ...next.preferences, ...patch };
      applied.push('更新用户偏好');
    }
  } else if (preferences.defaultOwner || preferences.dailyTaskLimit || preferences.communicationStyle) {
    suggestions.push({ type: 'preference', text: JSON.stringify(preferences), reason: '偏好判断不够确定' });
  }

  return { data: next, applied, suggestions };
}

function ownersFromValue(value) {
  const owner = String(value || '').trim();
  return ['GPT', 'Codex', 'Claude', '人工'].includes(owner) ? owner : '';
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
      response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }

  try {
    if (request.url === '/api/data' && request.method === 'GET') {
      sendJson(response, 200, await readDataWithMeta());
      return;
    }

    if (request.url === '/api/data' && request.method === 'PUT') {
      const body = await readBody(request);
      const data = normalizeData(JSON.parse(body || '{}'));
      const invalidFailedTask = data.tasks?.find(
        (task) => task.status === '失败' && !task.failureReason?.trim()
      );
      if (invalidFailedTask) {
        sendJson(response, 400, { error: '失败任务必须填写失败原因' });
        return;
      }
      await writeData(data);
      sendJson(response, 200, await readDataWithMeta());
      return;
    }

    if (request.url === '/api/chat-message' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const content = String(payload.content || '').trim();
      if (!content) {
        sendJson(response, 400, { error: '消息不能为空' });
        return;
      }

      const currentData = await readData();
      const message = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        content,
        createdAt: new Date().toISOString(),
        role: 'user',
        isTask: false,
        taskId: ''
      };
      let nextData = normalizeData({
        ...currentData,
        messages: [...currentData.messages, message]
      });

      loadLocalEnv();
      const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
      const model = String(nextData.preferences.deepSeekModel || initialData.preferences.deepSeekModel).trim();
      if (!apiKey) {
        const errorLog = createSystemError('等待用户提供API Key，聊天内容已保存但未自动提炼', '聊天自动提炼');
        nextData = {
          ...nextData,
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [errorLog, ...nextData.systemErrors]
        };
        await writeData(nextData);
        sendJson(response, 200, { data: await readDataWithMeta(), applied: [], suggestions: [], warning: errorLog.description });
        return;
      }

      try {
        const extraction = await extractStructureFromMessage(apiKey, model, content, nextData);
        const appliedResult = applyExtraction(nextData, extraction, message.id);
        const updatedMessages = appliedResult.data.messages.map((item) =>
          item.id === message.id
            ? {
                ...item,
                extraction: {
                  applied: appliedResult.applied,
                  suggestions: appliedResult.suggestions,
                  raw: extraction
                }
              }
            : item
        );
        nextData = {
          ...appliedResult.data,
          messages: updatedMessages,
          preferences: { ...appliedResult.data.preferences, deepSeekModel: model },
          modelConnection: {
            status: '已连接',
            provider: 'DeepSeek',
            model,
            checkedAt: new Date().toISOString()
          }
        };
        await writeData(nextData);
        sendJson(response, 200, {
          data: await readDataWithMeta(),
          applied: appliedResult.applied,
          suggestions: appliedResult.suggestions
        });
      } catch (error) {
        const errorLog = createSystemError(error.message, '聊天自动提炼');
        nextData = {
          ...nextData,
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [errorLog, ...nextData.systemErrors]
        };
        await writeData(nextData);
        sendJson(response, error.statusCode || 500, { error: error.message, data: await readDataWithMeta() });
      }
      return;
    }

    if (request.url === '/api/test-ai-connection' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      loadLocalEnv();
      const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
      const model = String(payload.model || currentData.preferences.deepSeekModel || initialData.preferences.deepSeekModel).trim();

      if (!apiKey) {
        const errorLog = createSystemError('等待用户提供API Key', '测试AI连接');
        await writeData({
          ...currentData,
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [errorLog, ...currentData.systemErrors]
        });
        sendJson(response, 400, { error: errorLog.description, data: await readDataWithMeta() });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const deepSeekResponse = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Reply with OK.' }],
            stream: false
          }),
          signal: controller.signal
        });
        const result = await deepSeekResponse.json().catch(() => ({}));
        if (!deepSeekResponse.ok) {
          const description = describeDeepSeekError(deepSeekResponse.status, result);
          const errorLog = createSystemError(description, '测试AI连接');
          await writeData({
            ...currentData,
            modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
            systemErrors: [errorLog, ...currentData.systemErrors]
          });
          sendJson(response, deepSeekResponse.status, { error: description, data: await readDataWithMeta() });
          return;
        }

        const connectedModel = result.model || model;
        await writeData({
          ...currentData,
          preferences: { ...currentData.preferences, deepSeekModel: model },
          modelConnection: {
            status: '已连接',
            provider: 'DeepSeek',
            model: connectedModel,
            checkedAt: new Date().toISOString()
          }
        });
        sendJson(response, 200, { model: connectedModel, data: await readDataWithMeta() });
      } catch (error) {
        const description = error.name === 'AbortError' ? '网络超时' : error.message;
        const errorLog = createSystemError(description, '测试AI连接');
        await writeData({
          ...currentData,
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [errorLog, ...currentData.systemErrors]
        });
        sendJson(response, 500, { error: description, data: await readDataWithMeta() });
      } finally {
        clearTimeout(timeout);
      }
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`API server port ${port} is already in use. Stop the existing process or set PORT to another value.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`API server listening at http://127.0.0.1:${port}`);
});
