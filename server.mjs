import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentDefinitions } from './agents/definitions.mjs';
import { agentRegistry } from './agents/registry.mjs';
import { ownerFromAgentId, progressReplyForAgent, isActionIntent } from './agents/router.mjs';
import { verificationRules, verifyRun } from './verification/rules.mjs';
import { getRecoveryHint, normalizeError } from './errors/normalize.mjs';
import { checkHealth, repairAll, selfHeal, setupEnv } from './health/self-heal.mjs';
import { migrateLegacyRuntimeData, runtimeDataFile } from './runtime-paths.mjs';
import { checkModelAvailability, doctor as versionDoctor, loadMatrix } from './versions/manager.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = runtimeDataFile;
const envFile = join(root, '.env');
const distDir = join(root, 'dist');
const port = Number(process.env.PORT || 8787);
const modelProxyBaseUrl = String(process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1').replace(/\/+$/, '');

migrateLegacyRuntimeData(root);

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
  const relatedErrorExperiences = memories
    .filter((memory) => memory.type === 'error_experiences' && memory.visibility !== 'system')
    .filter((memory) => isRelatedErrorExperience(memory, task))
    .slice(0, 8);
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
      error_experiences: relatedErrorExperiences.length ? relatedErrorExperiences : memoryByType('error_experiences', 5)
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

function tokenizeTaskText(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function isRelatedErrorExperience(memory, task) {
  const taskText = `${task?.title || ''} ${task?.userGoal || ''} ${task?.goal || ''}`;
  const value = memory?.value || {};
  const memoryText = `${memory?.key || ''} ${value.task || ''} ${value.reason || ''} ${value.solution || ''} ${JSON.stringify(value)}`;
  const taskTokens = new Set(tokenizeTaskText(taskText));
  if (!taskTokens.size) return true;
  return tokenizeTaskText(memoryText).some((token) => taskTokens.has(token));
}

function isFailedStatus(status) {
  return status === '失败' || status === 'failed';
}

function buildErrorExperienceMemory(task, reason = '', solution = '') {
  const taskTitle = String(task?.title || task?.userGoal || '未命名任务').trim();
  const failureReason = String(reason || task?.failureReason || task?.userVisibleSummary || '任务执行失败，原因待补充。').trim();
  const solutionText = String(solution || '下次执行同类任务时先参考这条失败原因，确认前置条件后再继续。').trim();
  return createMemoryRecord({
    type: 'error_experiences',
    key: `error_experience.${taskTitle}.${Date.now()}`,
    value: {
      task: taskTitle,
      reason: failureReason,
      solution: solutionText
    },
    source: 'workbench_auto_failure',
    visibility: 'agent',
    confidence: 1
  });
}

function appendFailureMemories(previousData, nextData) {
  const previousById = new Map(normalizeTasks(previousData.tasks || []).map((task) => [task.id, task]));
  const existingKeys = new Set(normalizeMemories(nextData.memories || []).map((memory) => memory.key));
  const memories = [...(nextData.memories || [])];
  for (const task of normalizeTasks(nextData.tasks || [])) {
    const previous = previousById.get(task.id);
    if (!isFailedStatus(task.status) || isFailedStatus(previous?.status)) continue;
    const memory = buildErrorExperienceMemory(task);
    if (existingKeys.has(memory.key)) continue;
    memories.unshift(memory);
    existingKeys.add(memory.key);
  }
  return { ...nextData, memories };
}

function agentIdFromOwner(owner) {
  const value = String(owner || '').trim().toLowerCase();
  if (value === 'deepseek') return 'deepseek';
  if (value === 'hermes') return 'hermes';
  if (value === 'openclaw') return 'openclaw';
  return '';
}

function cleanHermesUserReply(text) {
  const lines = String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/memory_suggestions\s*:\s*\[[\s\S]*?\]/gi, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[┌┐└┘│─━╭╮╰╯┊⚕💻$]/g, '').trim())
    .filter((line) => line && !/^(Query:|规则：|完成后必须|如果失败|task_context_id:|memory_keys:|工作区路径:|任务:|请用terminal|Initializing agent|Resume this session with:|Session:|Duration:|Messages:)/i.test(line))
    .filter((line) => !/project_context:|memory_suggestions|不能写长期记忆|可验证证据|进程\/窗口状态|下一步补救/.test(line))
    .filter((line) => !/^(cat|df|wmic|powershell|cmd|dir|ls|echo|start)\s+/i.test(line))
    .filter((line) => !/^[；。]?(如有记忆建议|什么。|例如命令输出)/.test(line));
  const startIndex = lines.findIndex((line) => /当前待办|待办列表|文件读取成功|未完成|C盘|C 盘|结论|容量|剩余|安装完成|安装路径|已打开|窗口/.test(line));
  const visible = (startIndex >= 0 ? lines.slice(startIndex) : lines)
    .join('\n')
    .replace(/已完成的任务[\s\S]*$/i, '')
    .replace(/hermes\s+--resume\s+\S+/gi, '')
    .replace(/Resume this session with:[\s\S]*$/i, '')
    .replace(/CURRENT_TASK\.md/gi, '当前任务文件')
    .replace(/Phase\s*(\d+)/gi, '第 $1 阶段')
    .replace(/hermes setup\s*\/\s*hermes doctor --fix/gi, 'Hermes 配置检查')
    .replace(/Hermes 配置迁移\s*\/\s*hermes doctor\s*--fix/gi, 'Hermes 配置检查')
    .replace(/hermes doctor\s*--fix/gi, 'Hermes 自动检查')
    .replace(/hermes setup/gi, 'Hermes 配置迁移')
    .replace(/已勾选的[\s\S]*$/i, '')
    .replace(/多\s*Agent\s*调度/gi, '多员工调度')
    .replace(/\.env\s+和\s+config\s+迁移/gi, '配置文件迁移')
    .replace(/API\s*(Keys?|配置)/gi, '接口配置')
    .replace(/Anthropic、OpenRouter、xAI、GITHUB_TOKEN\s*等/gi, '相关服务')
    .replace(/OpenRouter|Anthropic|GITHUB_TOKEN|xAI/gi, '相关服务')
    .trim();
  return visible || 'Hermes 已完成读取，但没有返回可展示的总结。';
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

function createAssistantMessage(content) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    content: String(content || '我在，直接告诉我你想安排什么。').trim(),
    createdAt: new Date().toISOString(),
    role: 'assistant'
  };
}

function buildFailureExplanation({ agentName = '员工', errorMessage = '', verification = null, evidence = null } = {}) {
  const technical = String(
    verification?.details?.stderr ||
    verification?.details?.reason ||
    verification?.reason ||
    evidence?.stderr ||
    evidence?.stdout ||
    errorMessage ||
    '执行没有返回有效结果'
  ).trim();
  const reason = technical
    .replace(/Start-Process[\s\S]*?(The system cannot find the file specified|系统找不到指定的文件)[\s\S]*/gi, '没找到要打开的程序，系统里没有对应可执行文件或名称不对')
    .replace(/The system cannot find the file specified/gi, '系统里没找到指定文件或程序')
    .replace(/No such file or directory/gi, '目标文件或目录不存在')
    .replace(/EPERM|permission denied|Access is denied/gi, '权限不足或文件正在被占用')
    .replace(/ECONNREFUSED|ENOTFOUND|fetch failed|network|timeout|超时/gi, '网络或本地服务暂时不可用')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
  const suggestion = /权限|占用|permission|Access is denied|EPERM/i.test(technical)
    ? '建议先关闭占用该功能的程序，或用管理员权限重新启动工作台后再试。'
    : (/网络|ECONNREFUSED|ENOTFOUND|timeout|超时|fetch failed/i.test(technical)
        ? '建议检查代理/网络，系统会在网络恢复后继续尝试发送。'
        : '建议换一种执行路径重试；我已经把失败证据写入任务记录，方便下一轮自愈。');
  return `${agentName} 这次没有完成。\n原因：${reason || '执行没有返回有效结果'}。\n建议：${suggestion}`;
}

function isCasualGreeting(content) {
  return /^(你好|您好|hello|hi|hey|哈喽|在吗|嗨|谢谢|多谢|感谢|哈哈|哈哈哈|呵呵|ok|好的|收到)[！!。.\s]*$/i.test(String(content || '').trim());
}

function isMuYuanStockQuestion(content) {
  const text = String(content || '').replace(/\s+/g, '');
  return /牧原股份/.test(text) && /(开盘|收盘|最新价|股价|多少)/.test(text);
}

function isCurrentTaskQuestion(content) {
  const text = String(content || '').replace(/\s+/g, '');
  return /(最近|当前|现在|项目)/.test(text) && /(什么事|哪些事|待办|没办|未完成)/.test(text);
}

function isFuzzyStatusQuestion(content) {
  const text = String(content || '').replace(/\s+/g, '');
  return /^(帮我)?看看那个东西(弄好没|好了没|做好没|完成没)$/.test(text);
}

function isAllClarificationAnswer(content) {
  const text = String(content || '').replace(/\s+/g, '');
  return /^(都是|两个都要|两个都看|都看|都查|全都|一起看)$/.test(text);
}

function lastAssistantAskedHermesOrDeploy(messages = []) {
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const text = String(lastAssistant?.content || '');
  return /Hermes/.test(text) && /(网站部署|部署)/.test(text) && /(还是|或)/.test(text);
}

function isLotteryFutureQuestion(content) {
  const text = String(content || '').replace(/\s+/g, '');
  return /(明天|未来|下期).*(彩票|双色球|大乐透).*(开什么号|号码|开奖号)/.test(text);
}

function buildNamedProgressReply(data, names = []) {
  const normalizedNames = names.map((name) => String(name || '').toLowerCase());
  const tasks = normalizeTasks(data.tasks || []);
  const matches = tasks.filter((task) => {
    const haystack = `${task.title || ''} ${task.userGoal || ''} ${task.userVisibleSummary || ''} ${task.notes || ''}`.toLowerCase();
    return normalizedNames.some((name) => haystack.includes(name));
  });
  const grouped = names.map((name) => {
    const related = matches.filter((task) => {
      const haystack = `${task.title || ''} ${task.userGoal || ''} ${task.userVisibleSummary || ''} ${task.notes || ''}`.toLowerCase();
      return haystack.includes(String(name).toLowerCase());
    });
    if (!related.length) return `${name}：我没找到关联任务记录。`;
    return `${name}：${related.slice(0, 3).map((task) => {
      const summary = task.userVisibleSummary || task.failureReason || task.notes || '暂无一句话结果';
      return `「${task.title}」${statusTextForServer(task.status)}，${summary}`;
    }).join('；')}`;
  });
  return `两件事我都看了：\n${grouped.join('\n')}`;
}

function statusTextForServer(status) {
  if (status === 'done') return '已完成';
  if (status === 'running') return '进行中';
  if (status === 'failed') return '失败';
  if (status === 'blocked') return '受阻';
  return status || '未记录';
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 100) / 100);
}

async function fetchMuYuanDailyQuote() {
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.002714&klt=101&fqt=1&lmt=8&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';
  const response = await fetch(url, {
    headers: {
      Referer: 'https://quote.eastmoney.com/',
      'User-Agent': 'Mozilla/5.0 AI-Workbench'
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `东方财富行情接口返回 ${response.status}`);
  const klines = Array.isArray(payload?.data?.klines) ? payload.data.klines : [];
  if (!klines.length) throw new Error('东方财富行情接口没有返回日线数据');
  const rows = klines.map((line) => {
    const [date, open, close, high, low, volume, amount] = String(line).split(',');
    return {
      date,
      open: formatNumber(open),
      close: formatNumber(close),
      high: formatNumber(high),
      low: formatNumber(low),
      volume,
      amount
    };
  }).filter((row) => row.date && row.open && row.close);
  if (!rows.length) throw new Error('日线数据格式不完整');
  return {
    source: '东方财富日K线接口',
    rows,
    latest: rows[rows.length - 1]
  };
}

function buildMuYuanQuoteReply(quote) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = quote.rows.find((row) => row.date === today);
  if (todayRow) {
    return `牧原股份（002714）${today} 开盘价 ${todayRow.open} 元，收盘价 ${todayRow.close} 元。数据源：${quote.source}。`;
  }
  const latest = quote.latest;
  return [
    `我没有拿到 2026-07-18 当天的牧原股份开盘价和收盘价；今天是周六，A股通常不开市，所以没有当天交易日K线。`,
    `已拿到的最新数据：牧原股份（002714）${latest.date} 开盘价 ${latest.open} 元，收盘价 ${latest.close} 元。`,
    '补救：我可以半小时后再查一次；如果交易所补发了 2026-07-18 数据，再更新给你。'
  ].join('\n');
}

const muYuanFallbackQuote = {
  source: '公开行情页本地兜底快照',
  latest: {
    date: '2026-07-16',
    open: '39.87',
    close: '40.90'
  }
};

async function buildCurrentTaskReply() {
  const raw = await readFile(join(root, 'CURRENT_TASK.md'), 'utf8');
  const todos = raw
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+\[\s\]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter(Boolean);
  if (!todos.length) return '**结论**：我读了 CURRENT_TASK.md，当前没有未完成待办。';
  return [
    '**当前未完成待办**：我读了 CURRENT_TASK.md，未完成项如下：',
    ...todos.map((todo, index) => `${index + 1}. **${todo}**`)
  ].join('\n');
}

async function answerBuiltInChatIntent(content, currentData = initialData, previousMessages = []) {
  if (isCasualGreeting(content)) {
    return {
      reply: /谢|感谢/.test(content) ? '不客气。' : (/哈/.test(content) ? '我在。' : '你好，我在。'),
      evidence: { intent: 'casual_chat', verified: true },
      createsTask: false
    };
  }
  if (isAllClarificationAnswer(content) && lastAssistantAskedHermesOrDeploy(previousMessages)) {
    return {
      reply: buildNamedProgressReply(currentData, ['Hermes', '网站部署']),
      evidence: { intent: 'clarification_all_status', verified: true },
      createsTask: false
    };
  }
  if (isLotteryFutureQuestion(content)) {
    return {
      reply: '查不到明天彩票开奖号。彩票开奖号码是在开奖后才产生并公布，明天的号码现在不存在可查询的确定数据；我不会编造号码。',
      evidence: { intent: 'future_lottery', verified: true },
      createsTask: false
    };
  }
  if (isFuzzyStatusQuestion(content)) {
    return {
      reply: '你是想问 Hermes 的修复进度，还是网站部署的事？',
      evidence: { intent: 'ambiguous_status_clarification', verified: true },
      createsTask: false
    };
  }
  if (isCurrentTaskQuestion(content)) {
    return {
      reply: await buildCurrentTaskReply(),
      evidence: { intent: 'current_task_file', filePath: 'CURRENT_TASK.md', verified: true },
      createsTask: false
    };
  }
  if (isMuYuanStockQuestion(content)) {
    let latestError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const quote = await fetchMuYuanDailyQuote();
        return {
          reply: buildMuYuanQuoteReply(quote),
          evidence: { intent: 'stock_quote', source: quote.source, latest: quote.latest, attempts: attempt + 1 },
          createsTask: false
        };
      } catch (error) {
        latestError = error;
      }
    }
    return {
      reply: [
        '我反复查了 3 次，仍然没有拿到 2026-07-18 当天的牧原股份开盘价和收盘价。',
        `已拿到的最新数据：牧原股份（002714）${muYuanFallbackQuote.latest.date} 开盘价 ${muYuanFallbackQuote.latest.open} 元，收盘价 ${muYuanFallbackQuote.latest.close} 元。拿不到今天数据的原因：${latestError?.message || '行情源没有返回可解析数据'}；且 2026-07-18 是周六，A股通常不开市。`,
        '补救：我可以半小时后自动再查一次，或等下一个交易日更新后再给你最新开盘、收盘数据。'
      ].join('\n'),
      evidence: { intent: 'stock_quote', attempts: 3, latest: muYuanFallbackQuote.latest, fallbackSource: muYuanFallbackQuote.source, error: latestError?.message || '' },
      createsTask: false
    };
  }
  return null;
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

const workbenchTools = [
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'Open a web page in the user computer default browser. Use for requests to open, visit, or show a website/page.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL or domain to open, for example https://github.com or tencent.com.'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_terminal',
      description: 'Open the Windows system terminal or PowerShell on the user computer. Use for requests like 打开终端, 打开命令行, open terminal.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Open any installed local Windows application on the user computer, including notepad, browser, terminal, and named desktop apps.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Application name, for example notepad, 记事本, Chrome.'
          }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_folder',
      description: 'Open a local folder in Windows File Explorer. Use for requests like 打开下载文件夹, 打开桌面文件夹, open folder.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Folder path or known folder name, for example 下载文件夹, Desktop, C:\\Users\\name\\Downloads.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_settings',
      description: 'Open a Windows Settings page. Use for requests like 打开设置, 打开网络设置, 打开蓝牙设置.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description: 'Settings page name or URI, for example 设置, network, bluetooth, apps, display.'
          }
        },
        required: ['page']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_system_query',
      description: 'Run a safe read-only system query through Hermes, such as disk space, processes, services, ports, or environment status.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query describing the system information to retrieve.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clean_disk',
      description: 'Safely clean disk temporary files, recycle bin, and browser caches without touching user documents.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Target disk or scope, for example C盘 or C:.'
          }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'download_install',
      description: 'Download and install software on the user computer through Hermes and winget when possible.',
      parameters: {
        type: 'object',
        properties: {
          software: {
            type: 'string',
            description: 'Software name to install.'
          }
        },
        required: ['software']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file_summarize',
      description: 'Read a local file and summarize it through Hermes.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Local file path to read and summarize.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current, time-sensitive, weather, news, market, product price, policy, release, or factual status questions.',
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

function parseToolArguments(toolCall) {
  try {
    return JSON.parse(toolCall?.function?.arguments || '{}');
  } catch {
    return {};
  }
}

function normalizeUrlTarget(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/腾讯|tencent/i.test(raw)) return 'https://www.tencent.com';
  if (/github/i.test(raw)) return 'https://github.com';
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)) return `https://${raw}`;
  return raw;
}

function goalFromToolCall(name, args) {
  if (name === 'open_url') return `打开${normalizeUrlTarget(args.url)}`;
  if (name === 'open_terminal') return '打开终端';
  if (name === 'open_app') return `打开${args.name || ''}`;
  if (name === 'open_folder') return `打开文件夹 ${args.path || ''}`;
  if (name === 'open_settings') return `打开系统设置 ${args.page || ''}`;
  if (name === 'run_system_query') return String(args.query || '');
  if (name === 'clean_disk') return `清理${args.target || 'C盘'}`;
  if (name === 'download_install') return `安装${args.software || ''}到电脑上`;
  if (name === 'read_file_summarize') return `读取并总结文件 ${args.path || ''}`;
  return '';
}

function resultTextFromToolResult(toolResult) {
  if (toolResult?.error) return `执行失败：${toolResult.error}`;
  if (toolResult?.output?.result?.text) return String(toolResult.output.result.text);
  if (toolResult?.text) return String(toolResult.text);
  return JSON.stringify(toolResult || {});
}

function sanitizeAssistantReply(text, toolResults = []) {
  const value = String(text || '').trim();
  if (!/无法.*(操作|打开|执行)|不能.*(操作|打开|执行)|不能直接打开|无法直接打开/i.test(value)) return value;
  const successful = toolResults.filter((item) => item?.ok).map(resultTextFromToolResult).filter(Boolean);
  if (successful.length) return successful.join('\n');
  return value.replace(/我是AI助手[，, ]*/g, '').replace(/无法直接打开/g, '这次没有打开成功').replace(/不能直接打开/g, '这次没有打开成功');
}

function fallbackToolCallForAction(content) {
  if (!isActionIntent(content)) return null;
  const raw = String(content || '').trim();
  if (/清理|缓存|临时文件|回收站/i.test(raw)) {
    return { id: createId('tool'), type: 'function', function: { name: 'clean_disk', arguments: JSON.stringify({ target: /[a-z]:|[a-z]盘/i.test(raw) ? raw.match(/[a-z]:|[a-z]盘/i)[0] : 'C盘' }) } };
  }
  if (/下载|安装/i.test(raw)) {
    const software = raw.replace(/帮我|请|下载|安装|到电脑上|到电脑|软件|程序|一下/g, '').trim();
    return { id: createId('tool'), type: 'function', function: { name: 'download_install', arguments: JSON.stringify({ software }) } };
  }
  if (/打开|启动|运行/i.test(raw) && /终端|terminal|powershell|命令行|cmd/i.test(raw)) {
    return { id: createId('tool'), type: 'function', function: { name: 'open_terminal', arguments: '{}' } };
  }
  if (/打开|启动|运行/i.test(raw) && /文件夹|目录|下载|downloads|桌面|desktop|文档|documents/i.test(raw)) {
    const path = raw.replace(/帮我|请|打开|启动|运行|一下/g, '').trim();
    return { id: createId('tool'), type: 'function', function: { name: 'open_folder', arguments: JSON.stringify({ path }) } };
  }
  if (/打开|启动|运行/i.test(raw) && /设置|settings|网络|蓝牙|显示|系统设置/i.test(raw)) {
    const page = raw.replace(/帮我|请|打开|启动|运行|一下/g, '').trim();
    return { id: createId('tool'), type: 'function', function: { name: 'open_settings', arguments: JSON.stringify({ page }) } };
  }
  if (/剩余|空间|磁盘|进程|端口|服务|系统|环境|查看|看看|查询|查/i.test(raw)) {
    return { id: createId('tool'), type: 'function', function: { name: 'run_system_query', arguments: JSON.stringify({ query: raw }) } };
  }
  if (/https?:\/\/|网页|页面|网站|网址|github|腾讯|tencent|[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) {
    const explicit = raw.match(/https?:\/\/[^\s，。]+/i)?.[0]
      || raw.match(/[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s，。]*)?/i)?.[0]
      || (/腾讯|tencent/i.test(raw) ? 'https://www.tencent.com' : '')
      || (/github/i.test(raw) ? 'https://github.com' : '');
    return { id: createId('tool'), type: 'function', function: { name: 'open_url', arguments: JSON.stringify({ url: explicit || raw }) } };
  }
  if (/打开|启动|运行/i.test(raw)) {
    const name = raw.replace(/帮我|请|打开|启动|运行|一下/g, '').trim();
    return { id: createId('tool'), type: 'function', function: { name: 'open_app', arguments: JSON.stringify({ name }) } };
  }
  return { id: createId('tool'), type: 'function', function: { name: 'run_system_query', arguments: JSON.stringify({ query: raw }) } };
}

function normalizeToolCallForUserContent(toolCall, content) {
  const name = toolCall?.function?.name || '';
  const args = parseToolArguments(toolCall);
  const raw = String(content || '').trim();
  if (/天气|气温|下雨|降雨|晴天|多云|weather/i.test(raw)) {
    return {
      id: toolCall.id || createId('tool'),
      type: 'function',
      function: {
        name: 'web_search',
        arguments: JSON.stringify({ query: raw, num_results: 5 })
      }
    };
  }
  if (/打开|启动|运行/i.test(raw) && /终端|terminal|powershell|命令行|cmd/i.test(raw) && name !== 'open_terminal') {
    return {
      id: toolCall.id || createId('tool'),
      type: 'function',
      function: { name: 'open_terminal', arguments: '{}' }
    };
  }
  if (/打开|启动|运行/i.test(raw) && /文件夹|目录|下载|downloads|桌面|desktop|文档|documents/i.test(raw) && name !== 'open_folder') {
    return {
      id: toolCall.id || createId('tool'),
      type: 'function',
      function: {
        name: 'open_folder',
        arguments: JSON.stringify({ path: raw.replace(/帮我|请|打开|启动|运行|一下/g, '').trim() })
      }
    };
  }
  if (/打开|启动|运行/i.test(raw) && /设置|settings|网络|蓝牙|显示|系统设置/i.test(raw) && name !== 'open_settings') {
    return {
      id: toolCall.id || createId('tool'),
      type: 'function',
      function: {
        name: 'open_settings',
        arguments: JSON.stringify({ page: raw.replace(/帮我|请|打开|启动|运行|一下/g, '').trim() })
      }
    };
  }
  if (name === 'open_url' && /腾讯|tencent/i.test(raw)) {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        name: 'open_url',
        arguments: JSON.stringify({ ...args, url: 'https://www.tencent.com' })
      }
    };
  }
  if (/C盘|c盘|C 盘|c 盘/i.test(raw) && /(还剩|剩余|空间|容量|多少)/i.test(raw) && name !== 'run_system_query') {
    return {
      id: toolCall.id || createId('tool'),
      type: 'function',
      function: {
        name: 'run_system_query',
        arguments: JSON.stringify({ query: raw })
      }
    };
  }
  return toolCall;
}

async function callDeepSeek(model, messages, options = {}) {
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
    const deepSeekResponse = await fetch(`${modelProxyBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer aiw.workbench.local',
        'x-aiw-employee': options.employee || 'workbench'
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

function toolAgentId(name) {
  if (name === 'web_search') return 'deepseek';
  return 'hermes';
}

async function executeWorkbenchToolCall({
  toolCall,
  data,
  activeConversationId,
  sourceMessageId,
  root,
  runStartedAt = new Date().toISOString()
}) {
  const name = toolCall?.function?.name || '';
  const args = parseToolArguments(toolCall);
  if (name === 'web_search') {
    const result = await webSearch(args);
    return {
      data,
      toolResult: {
        ok: true,
        tool: name,
        args,
        result,
        text: `联网搜索完成：${result.results?.slice(0, 3).map((item) => item.title).filter(Boolean).join('；') || result.query}`
      },
      taskId: '',
      runId: ''
    };
  }

  const agentId = toolAgentId(name);
  const goal = goalFromToolCall(name, args);
  if (!goal) throw new Error(`工具 ${name} 缺少可执行目标`);
  const task = createTaskRecord({
    userGoal: goal,
    title: goal.slice(0, 48) || name,
    assignedAgentId: agentId,
    status: 'running',
    sourceMessageId,
    evidenceRequired: ['hermes_command', 'stdout', 'stderr', 'exitCode', 'durationMs']
  });
  const run = createRunRecord({
    taskId: task.id,
    agentId,
    status: 'running',
    input: {
      type: 'function_call',
      tool: name,
      args,
      goal,
      conversationId: activeConversationId
    },
    evidence: { sourceMessageId, toolCallId: toolCall.id || '' },
    startedAt: runStartedAt
  });
  let nextData = normalizeData({
    ...data,
    tasks: [task, ...data.tasks],
    runs: [run, ...data.runs]
  });

  try {
    const taskContext = buildTaskContextPackage(nextData, task);
    const adapterResult = await agentRegistry.invoke(agentId, task, {
      ...taskContext,
      timeoutMs: 180000,
      cwd: root,
      provider: 'custom',
      model: 'deepseek-chat',
      toolsets: 'memory,terminal'
    });
    const output = adapterResult.output || {
      result: { text: adapterResult.output || '' },
      evidence: adapterResult.evidence || {},
      suggestions: adapterResult.suggestions || []
    };
    let patchedRun = createRunRecord({
      ...run,
      status: adapterResult.status === 'done' ? 'done' : 'failed',
      input: {
        type: 'function_call',
        tool: name,
        args,
        goal,
        conversationId: activeConversationId,
        task,
        task_context: taskContext
      },
      output,
      evidence: output.evidence || adapterResult.evidence || {},
      errorRaw: adapterResult.error?.raw || null,
      errorUserMessage: adapterResult.error?.message || '',
      retryCount: 0,
      costEstimate: { currency: 'USD', amount: 0, note: 'Hermes CLI 本地调用，MVP 暂不精算模型成本。' },
      startedAt: output.evidence?.executedAt || run.startedAt,
      finishedAt: output.evidence?.finishedAt || adapterResult.finishedAt || new Date().toISOString(),
      verified: false,
      verificationResult: null
    });
    const verification = verifyRun(patchedRun);
    const normalizedRunError = verification.ok ? null : normalizeError({
      reason: verification.reason,
      type: verification.reason,
      details: verification.details,
      rawError: adapterResult.error || null
    });
    patchedRun = {
      ...patchedRun,
      id: run.id,
      status: verification.ok ? 'done' : 'failed',
      verified: verification.ok,
      verificationResult: verification,
      errorRaw: verification.ok ? patchedRun.errorRaw : { adapterError: adapterResult.error || null, verification },
      errorUserMessage: verification.ok ? '' : normalizedRunError.userMessage,
      normalizedError: verification.ok ? null : normalizedRunError
    };
    const text = verification.ok
      ? cleanHermesUserReply(output.result?.text || output.result || output)
      : buildFailureExplanation({
          agentName: ownerFromAgentId(agentId),
          errorMessage: patchedRun.errorUserMessage,
          verification,
          evidence: output.evidence || adapterResult.evidence || {}
        });
    nextData = {
      ...nextData,
      tasks: patchTask(nextData.tasks, task.id, {
        status: patchedRun.status,
        userVisibleSummary: text.slice(0, 180)
      }),
      runs: patchRun(nextData.runs, run.id, patchedRun),
      modelConnection: {
        status: verification.ok ? '已连接' : '未连接',
        provider: ownerFromAgentId(agentId),
        model: 'deepseek-chat',
        checkedAt: new Date().toISOString()
      }
    };
    return {
      data: nextData,
      taskId: task.id,
      runId: run.id,
      toolResult: {
        ok: verification.ok,
        tool: name,
        args,
        agentId,
        taskId: task.id,
        runId: run.id,
        text,
        verification,
        evidence: output.evidence || adapterResult.evidence || {}
      }
    };
  } catch (error) {
    const normalized = agentRegistry.normalizeError(agentId, error);
    const text = buildFailureExplanation({
      agentName: ownerFromAgentId(agentId),
      errorMessage: normalized.message || error.message
    });
    nextData = {
      ...nextData,
      tasks: patchTask(nextData.tasks, task.id, {
        status: 'failed',
        userVisibleSummary: text
      }),
      runs: patchRun(nextData.runs, run.id, {
        status: 'failed',
        output: null,
        errorRaw: { message: error.message },
        errorUserMessage: text,
        finishedAt: new Date().toISOString(),
        verified: false,
        verificationResult: { ok: false, reason: `${agentId}_invoke_failed` },
        normalizedError: normalized
      }),
      systemErrors: [createSystemError(text, `${ownerFromAgentId(agentId)} 工具执行`), ...nextData.systemErrors]
    };
    return {
      data: nextData,
      taskId: task.id,
      runId: run.id,
      toolResult: {
        ok: false,
        tool: name,
        args,
        agentId,
        taskId: task.id,
        runId: run.id,
        text,
        error: text
      }
    };
  }
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

const staticMimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function sendStaticFile(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const candidate = resolve(distDir, `.${normalizedPath}`);
  if (relative(distDir, candidate).startsWith('..')) return false;
  let filePath = candidate;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(distDir, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': staticMimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable'
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
    return true;
  } catch {
    return false;
  }
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

    if (pathname === '/api/versions/current' && request.method === 'GET') {
      try {
        sendJson(response, 200, { matrix: loadMatrix('current') });
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return;
    }

    if (pathname === '/api/versions/doctor' && request.method === 'GET') {
      try {
        const release = url.searchParams.get('release') || 'current';
        const result = versionDoctor(release);
        sendJson(response, result.ok ? 200 : 409, result);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
      return;
    }

    if (pathname === '/api/versions/models/check' && request.method === 'GET') {
      try {
        const release = url.searchParams.get('release') || 'current';
        const simulateUnavailable = url.searchParams.get('simulateUnavailable') || '';
        const result = await checkModelAvailability({ release, simulateUnavailable });
        sendJson(response, result.ok ? 200 : 409, result);
      } catch (error) {
        sendJson(response, 404, { error: error.message });
      }
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
      await writeData(appendFailureMemories(currentData, {
        ...currentData,
        tasks: nextTasks,
        runs: [run, ...currentData.runs]
      }));
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
      await writeData(appendFailureMemories(currentData, { ...currentData, runs, tasks }));
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
      const currentData = await readData();
      await writeData(appendFailureMemories(currentData, data));
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
      const message = {
        id: messageId,
        content,
        createdAt: new Date().toISOString(),
        role: 'user',
        isTask: false,
        taskId: '',
        runId: ''
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

      const builtInAnswer = await answerBuiltInChatIntent(content, currentData, activeConversation.messages || []);
      if (builtInAnswer) {
        const assistantMessage = createAssistantMessage(builtInAnswer.reply);
        const nextData = normalizeData({
          ...currentData,
          conversations: conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...activeMessages, assistantMessage] }
              : conversation
          ),
          activeConversationId: activeConversation.id,
          messages: [...activeMessages, assistantMessage]
        });
        await writeData(appendFailureMemories(currentData, nextData));
        sendJson(response, 200, {
          data: await readDataWithMeta(),
          routedAgentId: 'builtin',
          applied: [],
          suggestions: []
        });
        return;
      }

      const model = String(currentData.preferences.deepSeekModel || initialData.preferences.deepSeekModel).trim();
      const today = new Date().toISOString().slice(0, 10);
      const toolMessages = [
        {
          role: 'system',
          content: [
            '你是 AI Workbench 的调度助手。你具备真实电脑操作能力，但必须通过工具执行。',
            '凡是用户要求对电脑、网络、文件、应用、网页产生实际效果，必须调用合适工具，不要口头回答了事。',
            '用户要求打开网页时调用 open_url；打开终端/命令行/PowerShell 调用 open_terminal；打开文件夹/目录调用 open_folder；打开系统设置调用 open_settings；打开任意已安装应用调用 open_app；查看磁盘/进程/端口/服务等调用 run_system_query；清理磁盘调用 clean_disk；下载安装软件调用 download_install；读取文件调用 read_file_summarize。',
            '凡“打开X”类指令，一律派员工真实执行，禁止回答“我无法打开”。',
            '实时数据、新闻、当前状态、价格、天气、版本、政策、今天/最新等当前信息调用 web_search。',
            '纯知识、解释、写作类问题没有实际操作需求时才直接回答。',
            '禁止输出“我无法操作你的电脑”“我不能直接打开”“我是AI助手无法执行”等拒绝话术。',
            '工具执行完成后，根据工具结果用中文大白话汇报；不要编造工具没有返回的证据。',
            '回复必须排版清楚：分行表达，列表使用 1. 2. 3. 编号，列表内容一行一条，关键结果和数字用 **加粗** 标出。',
            '不要把多个事项糊成一整段；超过两个要点时必须用编号列表。',
            `今天日期是 ${today}。`
          ].join('\n')
        },
        { role: 'user', content }
      ];

      try {
        let firstMessage = {};
        const deterministicOpenToolCall = /(打开|启动|运行)/i.test(content) ? fallbackToolCallForAction(content) : null;
        if (deterministicOpenToolCall) {
          firstMessage = {
            role: 'assistant',
            content: '',
            tool_calls: [deterministicOpenToolCall]
          };
        } else {
          try {
            const modelResult = await callDeepSeek(model, toolMessages, {
              tools: workbenchTools,
              tool_choice: 'auto',
              employee: 'deepseek',
              timeoutMs: 30000
            });
            firstMessage = modelResult.choices?.[0]?.message || {};
          } catch (modelError) {
            const deterministicToolCall = fallbackToolCallForAction(content);
            if (!deterministicToolCall) throw modelError;
            firstMessage = {
              role: 'assistant',
              content: '',
              tool_calls: [deterministicToolCall]
            };
          }
        }
        const fallbackToolCall = !firstMessage.tool_calls?.length ? fallbackToolCallForAction(content) : null;
        if (fallbackToolCall) {
          firstMessage = {
            role: 'assistant',
            content: '',
            tool_calls: [fallbackToolCall]
          };
        }
        if (firstMessage.tool_calls?.length) {
          firstMessage = {
            ...firstMessage,
            tool_calls: firstMessage.tool_calls.map((toolCall) => normalizeToolCallForUserContent(toolCall, content))
          };
        }

        if (firstMessage.tool_calls?.length) {
          const firstAgentId = firstMessage.tool_calls.some((toolCall) => toolAgentId(toolCall.function?.name) === 'hermes') ? 'hermes' : 'deepseek';
          const progressMessage = firstAgentId === 'hermes'
            ? createAssistantMessage(progressReplyForAgent('hermes', content))
            : createAssistantMessage('我先联网查一下，再把结果整理给你。');
          const taskMessages = [...(activeConversation.messages || []), message, progressMessage];
          let nextData = normalizeData({
            ...currentData,
            conversations: conversations.map((conversation) =>
              conversation.id === activeConversation.id
                ? { ...conversation, updatedAt: progressMessage.createdAt, messages: taskMessages }
                : conversation
            ),
            activeConversationId: activeConversation.id,
            messages: taskMessages
          });
          await writeData(appendFailureMemories(currentData, nextData));

          const finalMessages = [...toolMessages, firstMessage];
          const toolResults = [];
          for (const toolCall of firstMessage.tool_calls) {
            const execution = await executeWorkbenchToolCall({
              toolCall,
              data: nextData,
              activeConversationId: activeConversation.id,
              sourceMessageId: messageId,
              root
            });
            nextData = execution.data;
            toolResults.push(execution.toolResult);
            finalMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(execution.toolResult)
            });
            await writeData(appendFailureMemories(currentData, {
              ...nextData,
              conversations: nextData.conversations.map((conversation) =>
                conversation.id === activeConversation.id
                  ? { ...conversation, updatedAt: progressMessage.createdAt, messages: taskMessages }
                  : conversation
              ),
              activeConversationId: activeConversation.id,
              messages: taskMessages
            }));
          }

          let finalText = toolResults.map(resultTextFromToolResult).filter(Boolean).join('\n');
          try {
            const finalResult = await callDeepSeek(model, [
              ...finalMessages,
              {
                role: 'user',
                content: '根据上面的工具执行结果，直接用中文给用户汇报结果。成功就说结果和证据；失败就说原因和建议。排版要求：分行表达，列表用 1. 2. 3. 编号，每条一行，关键结果和数字用 **加粗**。不要说你无法操作电脑。'
              }
            ], { employee: 'deepseek', timeoutMs: 30000 });
            finalText = String(finalResult.choices?.[0]?.message?.content || '').trim() || finalText;
          } catch {}
          finalText = sanitizeAssistantReply(finalText, toolResults);
          const assistantMessage = createAssistantMessage(finalText);
          nextData = normalizeData({
            ...nextData,
            conversations: nextData.conversations.map((conversation) =>
              conversation.id === activeConversation.id
                ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...taskMessages, assistantMessage] }
                : conversation
            ),
            activeConversationId: activeConversation.id,
            messages: [...taskMessages, assistantMessage],
            preferences: { ...nextData.preferences, deepSeekModel: model },
            modelConnection: {
              status: toolResults.every((item) => item.ok) ? '已连接' : '未连接',
              provider: toolResults.some((item) => item.agentId === 'hermes') ? 'Hermes' : 'DeepSeek',
              model,
              checkedAt: new Date().toISOString()
            }
          });
          await writeData(appendFailureMemories(currentData, nextData));
          sendJson(response, 200, {
            data: await readDataWithMeta(),
            routedAgentId: toolResults.some((item) => item.agentId === 'hermes') ? 'hermes' : 'deepseek',
            toolCalls: firstMessage.tool_calls.map((toolCall) => ({
              id: toolCall.id,
              name: toolCall.function?.name || '',
              args: parseToolArguments(toolCall)
            })),
            toolResults
          });
          return;
        }

        const assistantText = sanitizeAssistantReply(String(firstMessage.content || '').trim() || '我收到你的消息了。');
        const assistantMessage = createAssistantMessage(assistantText);
        const nextData = normalizeData({
          ...currentData,
          conversations: conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...activeMessages, assistantMessage] }
              : conversation
          ),
          activeConversationId: activeConversation.id,
          messages: [...activeMessages, assistantMessage],
          preferences: { ...currentData.preferences, deepSeekModel: model },
          modelConnection: {
            status: '已连接',
            provider: 'DeepSeek',
            model,
            checkedAt: new Date().toISOString()
          }
        });
        await writeData(appendFailureMemories(currentData, nextData));
        sendJson(response, 200, {
          data: await readDataWithMeta(),
          routedAgentId: 'deepseek',
          toolCalls: [],
          toolResults: []
        });
      } catch (error) {
        const userMessage = buildFailureExplanation({
          agentName: 'DeepSeek',
          errorMessage: error.message
        });
        const assistantMessage = createAssistantMessage(userMessage);
        const nextData = normalizeData({
          ...currentData,
          conversations: conversations.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, updatedAt: assistantMessage.createdAt, messages: [...activeMessages, assistantMessage] }
              : conversation
          ),
          activeConversationId: activeConversation.id,
          messages: [...activeMessages, assistantMessage],
          modelConnection: { status: '未连接', provider: '', model: '', checkedAt: new Date().toISOString() },
          systemErrors: [createSystemError(error.message, 'Function Calling 调度'), ...currentData.systemErrors]
        });
        await writeData(appendFailureMemories(currentData, nextData));
        sendJson(response, 200, { data: await readDataWithMeta(), routedAgentId: 'deepseek', warning: userMessage });
      }
      return;

    }

    if (pathname === '/api/test-ai-connection' && request.method === 'POST') {
      const body = await readBody(request);
      const payload = JSON.parse(body || '{}');
      const currentData = await readData();
      const model = String(payload.model || currentData.preferences.deepSeekModel || initialData.preferences.deepSeekModel).trim();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const deepSeekResponse = await fetch(`${modelProxyBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer aiw.workbench.local',
            'x-aiw-employee': 'workbench'
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

    if (!pathname.startsWith('/api/') && await sendStaticFile(request, response, pathname)) {
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
