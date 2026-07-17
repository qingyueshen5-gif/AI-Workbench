import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentDefinitions } from './agents/definitions.mjs';
import { agentRegistry } from './agents/registry.mjs';
import { verificationRules, verifyRun } from './verification/rules.mjs';
import { getRecoveryHint, normalizeError } from './errors/normalize.mjs';
import { checkHealth, repairAll, selfHeal, setupEnv } from './health/self-heal.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = join(root, 'data', 'workbench.json');
const envFile = join(root, '.env');
const port = Number(process.env.PORT || 8787);
const deepSeekBaseUrl = 'https://api.deepseek.com';

const initialData = {
  dailyGoals: {},
  messages: [],
  conversations: [],
  activeConversationId: '',
  tasks: [],
  runs: [],
  memories: [],
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
  agents: agentDefinitions,
  systemErrors: []
};

const extractionConfidenceThreshold = 0.75;
const ownerOptions = ['DeepSeek', '人工', 'Codex', 'GPT', 'Claude'];
const internalActionTexts = new Set(['把这条消息同步为任务']);

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
  const legacyMessages = Array.isArray(data.messages) ? data.messages : [];
  let conversations = Array.isArray(data.conversations) ? data.conversations : [];
  if (!conversations.length && legacyMessages.length) {
    const firstMessage = legacyMessages[0];
    conversations = [{
      id: 'default-conversation',
      title: deriveConversationTitle({ messages: legacyMessages }),
      createdAt: firstMessage.createdAt || new Date().toISOString(),
      updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt || new Date().toISOString(),
      messages: legacyMessages
    }];
  }
  conversations = conversations.map((conversation) => ({
    ...conversation,
    title: deriveConversationTitle(conversation)
  }));
  const activeConversationId = data.activeConversationId || conversations[0]?.id || '';
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  return {
    ...initialData,
    ...data,
    dailyGoals: data.dailyGoals || {},
    conversations,
    activeConversationId,
    messages: activeConversation?.messages || legacyMessages,
    tasks: normalizeTasks(data.tasks),
    runs: normalizeRuns(data.runs),
    memories: normalizeMemories(data.memories),
    preferences: { ...initialData.preferences, ...(data.preferences || {}) },
    modelConnection: { ...initialData.modelConnection, ...(data.modelConnection || {}) },
    agents: normalizeAgents(data.agents),
    systemErrors: data.systemErrors || []
  };
}

function normalizeAgents(agents) {
  const byId = new Map((Array.isArray(agents) ? agents : []).map((agent) => [agent.id, agent]));
  return agentDefinitions.map((definition) => ({
    ...definition,
    ...(byId.get(definition.id) || {}),
    id: definition.id,
    type: definition.type,
    capabilities: definition.capabilities,
    healthCheck: definition.healthCheck,
    invoke: definition.invoke
  }));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeTitleText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

function isInternalActionMessage(message) {
  const content = sanitizeTitleText(message?.content);
  return !content || internalActionTexts.has(content) || message?.isTask === true;
}

function deriveConversationTitle(conversation) {
  const current = sanitizeTitleText(conversation?.title);
  if (current && current !== '新对话' && !internalActionTexts.has(current)) return current;
  const firstUserMessage = (conversation?.messages || []).find((message) =>
    message.role === 'user' && !isInternalActionMessage(message)
  );
  const fallbackUserLikeMessage = (conversation?.messages || []).find((message) => !isInternalActionMessage(message));
  return sanitizeTitleText(firstUserMessage?.content || fallbackUserLikeMessage?.content) || '新对话';
}

function createFailureReason(task) {
  const title = String(task?.title || '未命名任务').trim();
  const owner = String(task?.owner || '未指定负责人').trim();
  const notes = String(task?.notes || '').trim();
  const noteText = notes ? `；备注：${notes.slice(0, 80)}` : '';
  return `系统自动记录：任务「${title}」被标记为失败。当前负责人：${owner}${noteText}。`;
}

function normalizeTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).map((task) => {
    const createdAt = task.createdAt || new Date().toISOString();
    const assignedAgentId = task.assignedAgentId || agentIdFromOwner(task.owner) || agentIdFromOwner(task.assignee) || task.assignee || '';
    const normalized = {
      parentTaskId: '',
      userGoal: task.userGoal || task.goal || task.title || '',
      priority: task.priority || 'normal',
      riskLevel: task.riskLevel || 'low',
      assignedAgentId,
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      evidenceRequired: Array.isArray(task.evidenceRequired)
        ? task.evidenceRequired
        : (Array.isArray(task.evidence_required) ? task.evidence_required : ['output']),
      createdAt,
      updatedAt: task.updatedAt || createdAt,
      userVisibleSummary: task.userVisibleSummary || task.title || task.userGoal || '',
      goal: task.goal || task.userGoal || task.title || '',
      assignee: task.assignee || assignedAgentId,
      evidence_required: Array.isArray(task.evidence_required)
        ? task.evidence_required
        : (Array.isArray(task.evidenceRequired) ? task.evidenceRequired : ['output']),
      retry_policy: task.retry_policy || { maxRetries: 1, retryOn: ['timeout', 'temporary_failure'] },
      ...task
    };
    if (task?.status === '失败' && !String(task.failureReason || '').trim()) {
      return { ...normalized, failureReason: createFailureReason(task) };
    }
    return normalized;
  });
}

function normalizeRuns(runs) {
  return (Array.isArray(runs) ? runs : []).map((run) => {
    const startedAt = run.startedAt || run.createdAt || new Date().toISOString();
    return {
      id: run.id || createId('run'),
      taskId: run.taskId || '',
      agentId: run.agentId || '',
      status: run.status || 'pending',
      input: run.input || {},
      output: run.output || null,
      evidence: run.evidence || {},
      errorRaw: run.errorRaw || null,
      errorUserMessage: run.errorUserMessage || '',
      retryCount: Number(run.retryCount || 0),
      costEstimate: run.costEstimate || { currency: 'USD', amount: 0, note: 'MVP estimate' },
      startedAt,
      finishedAt: run.finishedAt || '',
      verified: Boolean(run.verified),
      verificationResult: run.verificationResult || null,
      durationMs: Number(run.durationMs || 0),
      memorySuggestions: normalizeMemorySuggestions(run.memorySuggestions, run.id || '')
    };
  });
}

const memoryTypes = new Set(['user_preferences', 'project_context', 'task_history', 'error_experiences']);
const memoryVisibilities = new Set(['user', 'agent', 'system']);

function normalizeMemories(memories) {
  return (Array.isArray(memories) ? memories : [])
    .filter((memory) => memory && memory.type && memory.key)
    .map((memory) => ({
      id: memory.id || createId('memory'),
      type: memoryTypes.has(memory.type) ? memory.type : 'project_context',
      key: String(memory.key || '').trim(),
      value: memory.value ?? '',
      source: memory.source || memory.who_created || 'workbench',
      visibility: memoryVisibilities.has(memory.visibility) ? memory.visibility : 'agent',
      confidence: Number.isFinite(Number(memory.confidence)) ? Number(memory.confidence) : 1,
      lastUpdated: memory.lastUpdated || memory.updatedAt || memory.createdAt || new Date().toISOString(),
      expiresAt: memory.expiresAt || ''
    }));
}

function normalizeMemorySuggestions(suggestions, runId = '') {
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((suggestion) => suggestion && suggestion.type && suggestion.key)
    .map((suggestion) => ({
      id: suggestion.id || createId('memory-suggestion'),
      runId: suggestion.runId || runId,
      type: memoryTypes.has(suggestion.type) ? suggestion.type : 'project_context',
      key: String(suggestion.key || '').trim(),
      value: suggestion.value ?? '',
      source: suggestion.source || 'agent',
      visibility: memoryVisibilities.has(suggestion.visibility) ? suggestion.visibility : 'agent',
      confidence: Number.isFinite(Number(suggestion.confidence)) ? Number(suggestion.confidence) : 0.8,
      status: suggestion.status || 'pending',
      reason: suggestion.reason || '',
      createdAt: suggestion.createdAt || new Date().toISOString(),
      decidedAt: suggestion.decidedAt || '',
      memoryId: suggestion.memoryId || ''
    }));
}

function createMemoryRecord({
  type,
  key,
  value,
  source = 'workbench',
  visibility = 'agent',
  confidence = 1,
  expiresAt = ''
} = {}) {
  return {
    id: createId('memory'),
    type: memoryTypes.has(type) ? type : 'project_context',
    key: String(key || '').trim(),
    value: value ?? '',
    source,
    visibility: memoryVisibilities.has(visibility) ? visibility : 'agent',
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 1,
    lastUpdated: new Date().toISOString(),
    expiresAt
  };
}

function isHighRiskMemory(memory) {
  const text = `${memory?.key || ''} ${JSON.stringify(memory?.value || '')}`.toLowerCase();
  return /api[_ -]?key|token|secret|password|账号|密码|权限|credential|auth|登录|长期偏好/.test(text);
}

function readProjectDocumentMemory(fileName, key) {
  try {
    const content = readFileSync(join(root, fileName), 'utf8');
    return {
      ...createMemoryRecord({
        type: 'project_context',
        key,
        value: {
          file: fileName,
          content,
          summary: `${fileName} 的当前项目上下文全文`
        },
        source: 'workspace_document',
        visibility: 'agent',
        confidence: 1
      }),
      id: `memory-${key.replace(/[^a-z0-9]+/gi, '-')}`
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function getProjectDocumentMemories() {
  return [
    readProjectDocumentMemory('CONTEXT.md', 'document.context'),
    readProjectDocumentMemory('VISION.md', 'document.vision'),
    readProjectDocumentMemory('CURRENT_TASK.md', 'document.current_task'),
    readProjectDocumentMemory('ARCHITECTURE.md', 'document.architecture')
  ].filter(Boolean);
}

function listMemories(data, type = '') {
  const stored = normalizeMemories(data.memories);
  const combined = [...stored, ...getProjectDocumentMemories()];
  const now = Date.now();
  return combined
    .filter((memory) => !type || memory.type === type)
    .filter((memory) => !memory.expiresAt || new Date(memory.expiresAt).getTime() > now)
    .sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
}

function buildTaskContextPackage(data, task) {
  const memories = listMemories(data);
  const memoryByType = (type, limit = 8) => memories
    .filter((memory) => memory.type === type && memory.visibility !== 'system')
    .slice(0, limit);
  const relatedRuns = data.runs
    .filter((run) => run.taskId === task.id || run.agentId === task.assignedAgentId)
    .slice(0, 5);
  return {
    id: createId('task-context'),
    taskId: task.id,
    generatedAt: new Date().toISOString(),
    policy: {
      owner: 'workbench',
      agentCanRead: true,
      agentCanWriteMainMemory: false,
      agentMaySubmitMemorySuggestions: true,
      highRiskMemoryRequiresWorkbenchOrUserApproval: true
    },
    task: {
      id: task.id,
      userGoal: task.userGoal,
      title: task.title,
      assignedAgentId: task.assignedAgentId,
      dependencies: task.dependencies,
      evidenceRequired: task.evidenceRequired,
      retry_policy: task.retry_policy
    },
    memories: {
      user_preferences: memoryByType('user_preferences'),
      project_context: memoryByType('project_context', 10),
      task_history: memoryByType('task_history'),
      error_experiences: memoryByType('error_experiences')
    },
    recentRuns: relatedRuns.map((run) => ({
      id: run.id,
      taskId: run.taskId,
      agentId: run.agentId,
      status: run.status,
      verified: run.verified,
      errorUserMessage: run.errorUserMessage,
      verificationResult: run.verificationResult
    }))
  };
}

function agentIdFromOwner(owner) {
  const value = String(owner || '').trim().toLowerCase();
  if (value === 'deepseek') return 'deepseek';
  if (value === 'hermes') return 'hermes';
  return '';
}

function ownerFromAgentId(agentId) {
  if (agentId === 'deepseek') return 'DeepSeek';
  if (agentId === 'hermes') return 'Hermes';
  return '人工';
}

function createTaskRecord({
  userGoal,
  title,
  assignedAgentId = 'deepseek',
  status = 'pending',
  sourceMessageId = '',
  parentTaskId = '',
  dependencies = [],
  evidenceRequired = ['assistant_reply', 'model_response'],
  priority = 'normal',
  riskLevel = 'low'
} = {}) {
  const now = new Date().toISOString();
  const goal = String(userGoal || title || '').trim();
  const taskTitle = String(title || goal || '未命名任务').trim();
  const normalizedAgentId = agentIdFromOwner(assignedAgentId) || assignedAgentId;
  return {
    id: createId('task'),
    parentTaskId,
    userGoal: goal,
    title: taskTitle,
    status,
    priority,
    riskLevel,
    assignedAgentId: normalizedAgentId,
    dependencies,
    evidenceRequired,
    createdAt: now,
    updatedAt: now,
    userVisibleSummary: taskTitle,
    goal,
    assignee: normalizedAgentId,
    evidence_required: evidenceRequired,
    retry_policy: { maxRetries: 1, retryOn: ['timeout', 'temporary_failure'] },
    owner: ownerFromAgentId(normalizedAgentId),
    notes: '从聊天自动生成的统一任务记录',
    failureReason: '',
    sourceMessageId
  };
}

function createRunRecord({
  taskId,
  agentId = 'deepseek',
  status = 'running',
  input = {},
  output = null,
  evidence = {},
  errorRaw = null,
  errorUserMessage = '',
  retryCount = 0,
  costEstimate = { currency: 'USD', amount: 0, note: 'MVP estimate' },
  startedAt = new Date().toISOString(),
  finishedAt = '',
  verified = false,
  verificationResult = null
} = {}) {
  const durationMs = finishedAt ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()) : 0;
  return {
    id: createId('run'),
    taskId,
    agentId,
    status,
    input,
    output,
    evidence,
    errorRaw,
    errorUserMessage,
    retryCount,
    costEstimate,
    startedAt,
    finishedAt,
    verified,
    verificationResult,
    durationMs
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
  const messageCount = data.conversations.length
    ? data.conversations.reduce((total, conversation) => total + (conversation.messages?.length || 0), 0)
    : data.messages.length;
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
      runCount: data.runs.length,
      memoryCount: data.memories.length,
      messageCount,
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

function createAssistantMessage(content) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    content: String(content || '我在，直接告诉我你想安排什么。').trim(),
    createdAt: new Date().toISOString(),
    role: 'assistant'
  };
}

function isCasualGreeting(content) {
  return /^(你好|您好|hello|hi|hey|哈喽|在吗|嗨)[！!。.\s]*$/i.test(String(content || '').trim());
}

async function webSearch({ query, num_results = 5 }) {
  const searchQuery = String(query || '').trim();
  if (!searchQuery) throw new Error('缺少搜索关键词');
  loadLocalEnv();
  const apiKey = String(process.env.SERPER_API_KEY || '').trim();
  if (!apiKey) throw new Error('等待用户提供SERPER_API_KEY，无法执行联网搜索');
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({
      q: searchQuery,
      num: Math.min(Math.max(Number(num_results) || 5, 1), 10)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || `搜索服务返回错误 ${response.status}`;
    throw new Error(message);
  }
  const organic = Array.isArray(payload.organic) ? payload.organic : [];
  const news = Array.isArray(payload.news) ? payload.news : [];
  const answerBox = payload.answerBox ? [{
    title: payload.answerBox.title || 'Answer box',
    snippet: payload.answerBox.answer || payload.answerBox.snippet || '',
    link: payload.answerBox.link || '',
    date: payload.answerBox.date || ''
  }] : [];
  const results = [...answerBox, ...news, ...organic].slice(0, Math.min(Math.max(Number(num_results) || 5, 1), 10));
  return {
    query: searchQuery,
    source: 'Serper Google Search API',
    results: results.map((item) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      link: item.link || '',
      date: item.date || item.publishedDate || ''
    }))
  };
}

const runtimeTools = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current, time-sensitive, news, market, product price, policy, release, or factual status questions. Do not use for stable common knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A concise search query that captures what must be looked up.'
          },
          num_results: {
            type: 'integer',
            description: 'Number of search results to retrieve, from 1 to 10.'
          }
        },
        required: ['query']
      }
    }
  }
];

async function executeToolCall(toolCall) {
  const name = toolCall?.function?.name;
  const args = JSON.parse(toolCall?.function?.arguments || '{}');
  if (name === 'web_search') return webSearch(args);
  throw new Error(`未知工具：${name}`);
}

async function callDeepSeek(apiKey, model, messages, options = {}) {
  const timeoutMs = options.timeoutMs || 20000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = {
      model,
      messages,
      stream: false
    };
    if (options.tools) body.tools = options.tools;
    if (options.tool_choice) body.tool_choice = options.tool_choice;
    if (options.response_format) body.response_format = options.response_format;
    const deepSeekResponse = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
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
  const messages = [
    {
      role: 'system',
      content: [
        '你是AI Workbench的信息提炼器和简洁助手。',
        '只返回JSON，不要Markdown，不要解释。',
        'JSON格式：{"reply":"","goal":{"text":"","confidence":0},"tasks":[{"title":"","owner":"","confidence":0}],"preferences":{"defaultOwner":"","dailyTaskLimit":null,"communicationStyle":"","confidence":0},"needsConfirmation":[{"type":"goal|task|preference","text":"","reason":""}]}',
        '只有明确表达今天目标、待办任务或偏好时才填写；不确定时不要自动写入，放到needsConfirmation。',
        '如果只是寒暄、问候或闲聊，goal.text留空、tasks为空、preferences保持空值，reply给出简短自然回应。',
        '你可以按需调用web_search工具。实时数据、新闻、当前状态、价格、版本、政策、公司人物等可能变化的问题必须先搜索；稳定常识或历史问题不要搜索。',
        '如果用户的问题需要当前信息但你没有调用web_search，不要猜测答案；请调用工具。',
        '搜索结果只作为依据，reply需要你整理后回答用户，不要原样倾倒搜索结果；涉及当前信息时简要说明来源名称或链接。',
        'reply必须始终填写，语气简洁，不要说自己已经执行了任务。',
        'owner只能是DeepSeek、人工、Codex、GPT、Claude之一；当前真实接入的是DeepSeek，Codex/GPT/Claude暂未接入，无法判断则留空。',
        `今天日期是${today}。`
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        message: content,
        webSearchAvailable: Boolean(String(process.env.SERPER_API_KEY || '').trim()),
        webSearchToolName: 'web_search',
        currentGoal: currentData.dailyGoals[today] || '',
        currentPreferences: currentData.preferences,
        existingTasks: currentData.tasks.slice(0, 20).map((task) => ({
          title: task.title,
          status: task.status,
          owner: task.owner
        }))
      })
    }
  ];
  const jsonResponseFormat = { type: 'json_object' };
  let result = await callDeepSeek(apiKey, model, messages, { tools: runtimeTools });
  const firstMessage = result.choices?.[0]?.message;
  const toolResults = [];
  if (firstMessage?.tool_calls?.length) {
    messages.push(firstMessage);
    for (const toolCall of firstMessage.tool_calls) {
      try {
        const toolResult = await executeToolCall(toolCall);
        toolResults.push({ name: toolCall.function?.name || '', result: toolResult });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      } catch (error) {
        toolResults.push({ name: toolCall.function?.name || '', error: error.message });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error.message })
        });
      }
    }
    result = await callDeepSeek(apiKey, model, messages, { response_format: jsonResponseFormat });
  } else if (firstMessage?.content) {
    result = { ...result, choices: [{ ...result.choices?.[0], message: firstMessage }] };
  }
  const text = result.choices?.[0]?.message?.content || '';
  const extraction = extractJsonObject(text);
  if (toolResults.length) extraction.toolResults = toolResults;
  if (isCasualGreeting(content)) {
    return {
      ...extraction,
      goal: { text: '', confidence: 0 },
      tasks: [],
      preferences: { defaultOwner: '', dailyTaskLimit: null, communicationStyle: '', confidence: 0 },
      needsConfirmation: []
    };
  }
  return extraction;
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
  return ownerOptions.includes(owner) ? owner : '';
}

function patchTask(tasks, taskId, patch) {
  return normalizeTasks(tasks).map((task) =>
    task.id === taskId
      ? { ...task, ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }
      : task
  );
}

function patchRun(runs, runId, patch) {
  return normalizeRuns(runs).map((run) =>
    run.id === runId
      ? {
          ...run,
          ...patch,
          durationMs: patch.finishedAt
            ? Math.max(0, new Date(patch.finishedAt).getTime() - new Date(run.startedAt).getTime())
            : run.durationMs
        }
      : run
  );
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
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const pathname = requestUrl.pathname;

    if (pathname === '/api/data' && request.method === 'GET') {
      sendJson(response, 200, await readDataWithMeta());
      return;
    }

    if (pathname === '/api/agents' && request.method === 'GET') {
      sendJson(response, 200, { agents: agentRegistry.listAgents() });
      return;
    }

    if (pathname === '/api/agents/health' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const requested = Array.isArray(payload.agentIds) && payload.agentIds.length
        ? payload.agentIds.map(String)
        : agentRegistry.listAgents().map((agent) => agent.id);
      const results = [];
      for (const agentId of requested) {
        results.push(await agentRegistry.healthCheck(agentId));
      }
      const currentData = await readData();
      const resultById = new Map(results.map((result) => [result.agentId, result]));
      await writeData({
        ...currentData,
        agents: normalizeAgents(currentData.agents).map((agent) => {
          const result = resultById.get(agent.id);
          if (!result) return agent;
          return {
            ...agent,
            status: result.status || (result.ok ? 'available' : 'unavailable'),
            lastHealthCheckAt: result.checkedAt || new Date().toISOString(),
            failureCount: result.ok ? 0 : Number(agent.failureCount || 0) + 1
          };
        })
      });
      sendJson(response, 200, { results, data: await readDataWithMeta() });
      return;
    }

    if (pathname === '/api/verification-rules' && request.method === 'GET') {
      sendJson(response, 200, { rules: verificationRules });
      return;
    }

    if (pathname === '/api/errors/normalize' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      sendJson(response, 200, { normalized: normalizeError(payload.rawError || payload) });
      return;
    }

    const recoveryHintMatch = pathname.match(/^\/api\/errors\/recovery-hints\/([^/]+)$/);
    if (recoveryHintMatch && request.method === 'GET') {
      sendJson(response, 200, { hint: getRecoveryHint(decodeURIComponent(recoveryHintMatch[1])) });
      return;
    }

    if (pathname === '/api/health/status' && request.method === 'GET') {
      sendJson(response, 200, await checkHealth({ root, dataFile, envFile }));
      return;
    }

    if (pathname === '/api/health/self-heal' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const result = await selfHeal(payload.issue || payload, {
        root,
        dataFile,
        envFile,
        defaultData: initialData,
        maxRetries: payload.maxRetries,
        retryDelayMs: payload.retryDelayMs
      });
      sendJson(response, 200, result);
      return;
    }

    if (pathname === '/api/health/fix-permission' && request.method === 'POST') {
      sendJson(response, 200, {
        ok: false,
        requiresUserAction: true,
        userMessage: '这里需要更高权限，点下面按钮后按系统提示确认。',
        suggestedActions: [
          { action: '点这里获取权限', isClickable: true, url: '/help/permissions' }
        ],
        fallbackDescription: '工作台不能静默提权；需要用户确认后才能继续。'
      });
      return;
    }

    if (pathname === '/api/health/setup-env' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      sendJson(response, 200, await setupEnv({ envFile, key: payload.key || payload.envKey, value: payload.value }));
      return;
    }

    if (pathname === '/api/health/repair' && request.method === 'POST') {
      sendJson(response, 200, await repairAll({ root, dataFile, envFile, defaultData: initialData }));
      return;
    }

    if (pathname === '/api/agents/hermes/invoke' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      let task = payload.taskId
        ? currentData.tasks.find((item) => item.id === payload.taskId)
        : null;
      let tasks = currentData.tasks;
      if (!task) {
        task = createTaskRecord({
          userGoal: payload.userGoal || payload.goal || payload.prompt,
          title: payload.title || payload.userGoal || payload.goal || payload.prompt,
          assignedAgentId: 'hermes',
          status: 'running',
          evidenceRequired: ['hermes_command', 'stdout', 'exit_code']
        });
        tasks = [task, ...tasks];
      } else {
        tasks = patchTask(tasks, task.id, { status: 'running', assignedAgentId: 'hermes', assignee: 'hermes', owner: 'Hermes' });
        task = tasks.find((item) => item.id === task.id);
      }
      const taskContext = payload.context || buildTaskContextPackage({ ...currentData, tasks }, task);
      const adapterResult = await agentRegistry.invoke('hermes', task, {
        ...taskContext,
        timeoutMs: payload.timeoutMs || 180000,
        cwd: root,
        provider: payload.provider || 'custom',
        model: payload.model || 'deepseek-chat',
        toolsets: payload.toolsets || 'memory,terminal'
      });
      const adapterVerification = agentRegistry.verify('hermes', adapterResult);
      const output = adapterResult.output || {
        result: { text: adapterResult.output || '' },
        evidence: adapterResult.evidence || {},
        suggestions: adapterResult.suggestions || []
      };
      let run = createRunRecord({
        taskId: task.id,
        agentId: 'hermes',
        status: adapterResult.status === 'done' && adapterVerification.ok ? 'done' : 'failed',
        input: {
          task,
          task_context: taskContext
        },
        output,
        evidence: output.evidence || adapterResult.evidence || {},
        errorRaw: adapterResult.error?.raw || null,
        errorUserMessage: adapterResult.error?.message || '',
        retryCount: 0,
        costEstimate: { currency: 'USD', amount: 0, note: 'Hermes CLI 本地调用，MVP 暂不精算模型成本。' },
        startedAt: output.evidence?.executedAt || new Date().toISOString(),
        finishedAt: output.evidence?.finishedAt || adapterResult.finishedAt || new Date().toISOString(),
        verified: false,
        verificationResult: adapterVerification
      });
      const verification = verifyRun(run);
      const normalizedRunError = verification.ok ? null : normalizeError({
        reason: verification.reason,
        type: verification.reason,
        details: verification.details,
        rawError: adapterResult.error || null
      });
      run = {
        ...run,
        status: verification.ok ? run.status : 'failed',
        verified: verification.ok,
        verificationResult: verification,
        errorRaw: verification.ok ? run.errorRaw : { adapterError: adapterResult.error || null, verification },
        errorUserMessage: verification.ok ? run.errorUserMessage : normalizedRunError.userMessage,
        normalizedError: verification.ok ? run.normalizedError : normalizedRunError
      };
      if (Array.isArray(output.suggestions) && output.suggestions.length) {
        run.memorySuggestions = normalizeMemorySuggestions(output.suggestions.map((suggestion) => ({
          ...suggestion,
          runId: run.id,
          source: suggestion.source || 'hermes'
        })), run.id);
      }
      const nextTasks = patchTask(tasks, task.id, {
        status: run.status === 'done' ? 'done' : 'failed',
        userVisibleSummary: run.status === 'done' ? 'Hermes 已完成执行。' : (run.errorUserMessage || 'Hermes 执行失败。')
      });
      await writeData({
        ...currentData,
        tasks: nextTasks,
        runs: [run, ...currentData.runs]
      });
      sendJson(response, 200, {
        task: nextTasks.find((item) => item.id === task.id),
        run,
        invoke_result: output,
        verification,
        data: await readDataWithMeta()
      });
      return;
    }

    if (pathname === '/api/memories' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      let memoryPayload = payload;
      let acceptedSuggestion = null;

      if (payload.runId && payload.suggestionId) {
        const run = currentData.runs.find((item) => item.id === payload.runId);
        const suggestion = run?.memorySuggestions?.find((item) => item.id === payload.suggestionId);
        if (!run || !suggestion) {
          sendJson(response, 404, { error: '记忆建议不存在' });
          return;
        }
        if (!payload.approved) {
          sendJson(response, 400, { error: '工作台未确认，不能写入主记忆' });
          return;
        }
        acceptedSuggestion = suggestion;
        memoryPayload = {
          type: suggestion.type,
          key: suggestion.key,
          value: suggestion.value,
          source: payload.source || 'workbench_approved_suggestion',
          visibility: suggestion.visibility,
          confidence: suggestion.confidence,
          expiresAt: payload.expiresAt || ''
        };
      }

      const memory = createMemoryRecord({
        type: memoryPayload.type,
        key: memoryPayload.key,
        value: memoryPayload.value,
        source: memoryPayload.source || 'workbench',
        visibility: memoryPayload.visibility || 'agent',
        confidence: memoryPayload.confidence ?? 1,
        expiresAt: memoryPayload.expiresAt || ''
      });
      if (!memory.key) {
        sendJson(response, 400, { error: '记忆 key 不能为空' });
        return;
      }
      if (isHighRiskMemory(memory) && memory.source !== 'workbench' && !payload.approved) {
        sendJson(response, 403, { error: '高风险记忆必须由工作台验证或用户确认后写入' });
        return;
      }

      const nextRuns = acceptedSuggestion
        ? currentData.runs.map((run) =>
            run.id === payload.runId
              ? {
                  ...run,
                  memorySuggestions: run.memorySuggestions.map((suggestion) =>
                    suggestion.id === payload.suggestionId
                      ? {
                          ...suggestion,
                          status: 'accepted',
                          decidedAt: new Date().toISOString(),
                          memoryId: memory.id
                        }
                      : suggestion
                  )
                }
              : run
          )
        : currentData.runs;
      await writeData({
        ...currentData,
        memories: [memory, ...currentData.memories],
        runs: nextRuns
      });
      sendJson(response, 201, { memory, data: await readDataWithMeta() });
      return;
    }

    const memoryMatch = pathname.match(/^\/api\/memories\/([^/]+)$/);
    if (memoryMatch && request.method === 'GET') {
      const currentData = await readData();
      const type = decodeURIComponent(memoryMatch[1]);
      if (!memoryTypes.has(type)) {
        sendJson(response, 400, { error: '未知记忆类型' });
        return;
      }
      sendJson(response, 200, { memories: listMemories(currentData, type) });
      return;
    }

    if (pathname === '/api/tasks' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      const task = createTaskRecord({
        userGoal: payload.userGoal || payload.goal,
        title: payload.title,
        assignedAgentId: payload.assignedAgentId || payload.assignee || 'deepseek',
        status: payload.status || 'pending',
        sourceMessageId: payload.sourceMessageId || '',
        parentTaskId: payload.parentTaskId || '',
        dependencies: Array.isArray(payload.dependencies) ? payload.dependencies : [],
        evidenceRequired: Array.isArray(payload.evidenceRequired)
          ? payload.evidenceRequired
          : (Array.isArray(payload.evidence_required) ? payload.evidence_required : ['output']),
        priority: payload.priority || 'normal',
        riskLevel: payload.riskLevel || 'low'
      });
      await writeData({ ...currentData, tasks: [task, ...currentData.tasks] });
      sendJson(response, 201, { task, data: await readDataWithMeta() });
      return;
    }

    const taskContextMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/context$/);
    if (taskContextMatch && request.method === 'GET') {
      const currentData = await readData();
      const task = currentData.tasks.find((item) => item.id === decodeURIComponent(taskContextMatch[1]));
      if (!task) {
        sendJson(response, 404, { error: '任务不存在' });
        return;
      }
      sendJson(response, 200, { task_context: buildTaskContextPackage(currentData, task) });
      return;
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'GET') {
      const currentData = await readData();
      const task = currentData.tasks.find((item) => item.id === decodeURIComponent(taskMatch[1]));
      if (!task) {
        sendJson(response, 404, { error: '任务不存在' });
        return;
      }
      sendJson(response, 200, { task });
      return;
    }

    if (pathname === '/api/runs' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      const run = createRunRecord({
        taskId: payload.taskId,
        agentId: agentIdFromOwner(payload.agentId) || payload.agentId || 'deepseek',
        status: payload.status || 'pending',
        input: payload.input || {},
        output: payload.output || null,
        evidence: payload.evidence || {},
        errorRaw: payload.errorRaw || null,
        errorUserMessage: payload.errorUserMessage || '',
        retryCount: payload.retryCount || 0,
        costEstimate: payload.costEstimate || { currency: 'USD', amount: 0, note: 'MVP estimate' },
        startedAt: payload.startedAt || new Date().toISOString(),
        finishedAt: payload.finishedAt || '',
        verified: Boolean(payload.verified),
        verificationResult: payload.verificationResult || null
      });
      await writeData({ ...currentData, runs: [run, ...currentData.runs] });
      sendJson(response, 201, { run, data: await readDataWithMeta() });
      return;
    }

    const runSuggestionMatch = pathname.match(/^\/api\/runs\/([^/]+)\/memory-suggestions$/);
    if (runSuggestionMatch && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      const runId = decodeURIComponent(runSuggestionMatch[1]);
      const run = currentData.runs.find((item) => item.id === runId);
      if (!run) {
        sendJson(response, 404, { error: '执行记录不存在' });
        return;
      }
      const rawSuggestions = Array.isArray(payload.memory_suggestions)
        ? payload.memory_suggestions
        : (Array.isArray(payload.suggestions) ? payload.suggestions : []);
      const suggestions = normalizeMemorySuggestions(rawSuggestions.map((suggestion) => ({
        ...suggestion,
        runId,
        source: suggestion.source || run.agentId || 'agent',
        status: 'pending'
      })), runId);
      if (!suggestions.length) {
        sendJson(response, 400, { error: '记忆建议不能为空' });
        return;
      }
      const runs = currentData.runs.map((item) =>
        item.id === runId
          ? { ...item, memorySuggestions: [...(item.memorySuggestions || []), ...suggestions] }
          : item
      );
      await writeData({ ...currentData, runs });
      sendJson(response, 201, {
        suggestions,
        memoryWritten: false,
        rule: 'Agent 只能提交建议，主记忆仍由工作台决定是否写入。',
        data: await readDataWithMeta()
      });
      return;
    }

    const runVerifyMatch = pathname.match(/^\/api\/runs\/([^/]+)\/verify$/);
    if (runVerifyMatch && request.method === 'POST') {
      const currentData = await readData();
      const runId = decodeURIComponent(runVerifyMatch[1]);
      const run = currentData.runs.find((item) => item.id === runId);
      if (!run) {
        sendJson(response, 404, { error: '执行记录不存在' });
        return;
      }
      const verification = verifyRun(run);
      const normalizedVerificationError = verification.ok ? null : normalizeError({
        reason: verification.reason,
        type: verification.reason,
        details: verification.details,
        runId
      });
      const nextStatus = verification.ok ? run.status : 'failed';
      const runs = currentData.runs.map((item) =>
        item.id === runId
          ? {
              ...item,
              status: nextStatus,
              verified: verification.ok,
              verificationResult: verification,
              errorRaw: verification.ok ? item.errorRaw : { verification },
              errorUserMessage: verification.ok ? item.errorUserMessage : normalizedVerificationError.userMessage,
              normalizedError: verification.ok ? item.normalizedError : normalizedVerificationError
            }
          : item
      );
      const tasks = currentData.tasks.map((task) =>
        task.id === run.taskId && !verification.ok
          ? {
              ...task,
              status: 'failed',
              updatedAt: new Date().toISOString(),
              userVisibleSummary: '执行结果没有通过工作台验证，不能算完成。'
            }
          : task
      );
      await writeData({ ...currentData, runs, tasks });
      sendJson(response, 200, {
        verification,
        run: runs.find((item) => item.id === runId),
        data: await readDataWithMeta()
      });
      return;
    }

    const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && request.method === 'GET') {
      const currentData = await readData();
      const run = currentData.runs.find((item) => item.id === decodeURIComponent(runMatch[1]));
      if (!run) {
        sendJson(response, 404, { error: '执行记录不存在' });
        return;
      }
      sendJson(response, 200, { run });
      return;
    }

    if (pathname === '/api/data' && request.method === 'PUT') {
      const body = await readBody(request);
      const data = normalizeData(JSON.parse(body || '{}'));
      await writeData(data);
      sendJson(response, 200, await readDataWithMeta());
      return;
    }

    if (pathname === '/api/chat-message' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const content = String(payload.content || '').trim();
      if (!content) {
        sendJson(response, 400, { error: '消息不能为空' });
        return;
      }

      const currentData = await readData();
      const requestedConversationId = String(payload.conversationId || currentData.activeConversationId || '').trim();
      let conversations = currentData.conversations.length ? currentData.conversations : [];
      let activeConversation = requestedConversationId
        ? conversations.find((conversation) => conversation.id === requestedConversationId)
        : conversations[0];
      if (!activeConversation) {
        activeConversation = {
          id: requestedConversationId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: content.slice(0, 32) || '新对话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: currentData.conversations.length ? [] : currentData.messages || []
        };
        conversations = [activeConversation, ...conversations];
      }
      const messageId = createId('message');
      const task = createTaskRecord({
        userGoal: content,
        title: content.slice(0, 48) || '聊天消息处理',
        assignedAgentId: 'deepseek',
        status: 'running',
        sourceMessageId: messageId,
        evidenceRequired: ['assistant_reply', 'model_response']
      });
      const runStartedAt = new Date().toISOString();
      const run = createRunRecord({
        taskId: task.id,
        agentId: task.assignedAgentId,
        status: 'running',
        input: {
          type: 'chat_message',
          content,
          conversationId: activeConversation.id
        },
        evidence: {
          sourceMessageId: messageId
        },
        startedAt: runStartedAt
      });
      const message = {
        id: messageId,
        content,
        createdAt: new Date().toISOString(),
        role: 'user',
        isTask: false,
        taskId: task.id,
        runId: run.id
      };
      const activeMessages = [...(activeConversation.messages || []), message];
      conversations = conversations.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              title: conversation.title || content.slice(0, 32) || '新对话',
              updatedAt: message.createdAt,
              messages: activeMessages
            }
          : conversation
      );
      let nextData = normalizeData({
        ...currentData,
        conversations,
        activeConversationId: activeConversation.id,
        messages: activeMessages,
        tasks: [task, ...currentData.tasks],
        runs: [run, ...currentData.runs]
      });
      await writeData(nextData);

      loadLocalEnv();
      const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
      const model = String(nextData.preferences.deepSeekModel || initialData.preferences.deepSeekModel).trim();
      if (!apiKey) {
        const errorLog = createSystemError('等待用户提供API Key，聊天内容已保存但未自动提炼', '聊天自动提炼');
        const assistantMessage = createAssistantMessage('我已收到消息，但当前还没有配置 DeepSeek API Key，所以暂时不能自动提炼。');
        const finishedAt = new Date().toISOString();
        nextData = {
          ...nextData,
          conversations: nextData.conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...activeMessages, assistantMessage] }
              : conversation
          ),
          messages: [...activeMessages, assistantMessage],
          tasks: patchTask(nextData.tasks, task.id, {
            status: 'blocked',
            userVisibleSummary: '已收到消息，等待 AI 连接配置完成后处理。'
          }),
          runs: patchRun(nextData.runs, run.id, {
            status: 'failed',
            output: null,
            evidence: {
              sourceMessageId: message.id,
              assistantMessageId: assistantMessage.id
            },
            errorRaw: { message: errorLog.description },
            errorUserMessage: 'AI 连接还没配置好，消息已保存。',
            finishedAt,
            verified: false,
            verificationResult: {
              ok: false,
              reason: '缺少 DeepSeek API Key'
            }
          }),
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
        const assistantMessage = createAssistantMessage(extraction.reply);
        const finishedAt = new Date().toISOString();
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
          conversations: appliedResult.data.conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...updatedMessages, assistantMessage] }
              : conversation
          ),
          activeConversationId: activeConversation.id,
          messages: [...updatedMessages, assistantMessage],
          tasks: patchTask(appliedResult.data.tasks, task.id, {
            status: 'done',
            userVisibleSummary: extraction.reply || '聊天消息已处理'
          }),
          runs: patchRun(appliedResult.data.runs, run.id, {
            status: 'done',
            output: {
              reply: extraction.reply || '',
              applied: appliedResult.applied,
              suggestions: appliedResult.suggestions
            },
            evidence: {
              sourceMessageId: message.id,
              assistantMessageId: assistantMessage.id,
              provider: 'DeepSeek',
              model,
              toolResults: extraction.toolResults || []
            },
            costEstimate: {
              currency: 'USD',
              amount: 0,
              note: 'MVP 阶段暂不精算 token 成本，先记录为 0。'
            },
            finishedAt,
            verified: Boolean(extraction.reply),
            verificationResult: {
              ok: Boolean(extraction.reply),
              method: 'assistant_reply_present',
              evidence: ['assistantMessageId', 'model']
            }
          }),
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
        const assistantMessage = createAssistantMessage(`这次没有处理成功：${error.message}`);
        const finishedAt = new Date().toISOString();
        nextData = {
          ...nextData,
          conversations: nextData.conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...activeMessages, assistantMessage] }
              : conversation
          ),
          messages: [...activeMessages, assistantMessage],
          tasks: patchTask(nextData.tasks, task.id, {
            status: 'failed',
            userVisibleSummary: `这次没有处理成功：${error.message}`
          }),
          runs: patchRun(nextData.runs, run.id, {
            status: 'failed',
            output: null,
            evidence: {
              sourceMessageId: message.id,
              assistantMessageId: assistantMessage.id,
              provider: 'DeepSeek',
              model
            },
            errorRaw: {
              message: error.message,
              statusCode: error.statusCode || null
            },
            errorUserMessage: `这次没有处理成功：${error.message}`,
            finishedAt,
            verified: false,
            verificationResult: {
              ok: false,
              reason: error.message
            }
          }),
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [errorLog, ...nextData.systemErrors]
        };
        await writeData(nextData);
        sendJson(response, error.statusCode || 500, { error: error.message, data: await readDataWithMeta() });
      }
      return;
    }

    if (pathname === '/api/test-ai-connection' && request.method === 'POST') {
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
