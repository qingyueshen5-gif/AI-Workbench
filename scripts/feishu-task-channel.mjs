import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join, dirname, resolve, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';
import * as gateway from './task-gateway.mjs';

const root = process.cwd();
function usableChannelRoot() {
  if (process.env.AIW_FEISHU_CHANNEL_DIR) return process.env.AIW_FEISHU_CHANNEL_DIR;
  const preferred = join(runtimeRoot, 'feishu-task-channel');
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    return join(root, '.feishu-task-channel-runtime');
  }
}

const channelRoot = usableChannelRoot();
const configPath = join(channelRoot, 'config.json');
const eventsPath = join(channelRoot, 'events.jsonl');
const promptDir = join(channelRoot, 'prompts');
const sentNotificationsPath = join(channelRoot, 'sent-notifications.json');
const processedEventsPath = join(channelRoot, 'processed-events.json');
const maxEventIds = 1000;
const eventTtlMs = 24 * 60 * 60 * 1000;
const validRoles = new Set(['architecture', 'interface', 'multimodal_context', 'security_privacy', 'testing_quality', 'integration', 'research', 'supervisor']);

function now() {
  return new Date().toISOString();
}

function redact(value) {
  return gateway.redact(value)
    .replace(/\bcli_[A-Za-z0-9]{8,}\b/g, '[REDACTED_FEISHU_APP_ID]')
    .replace(/\bFEISHU_(?:APP_SECRET|APP_ID|REPORT_CHAT_ID|ALLOWED_OPEN_IDS)\s*[:=]\s*["']?[^"'\s,}]+/gi, (match) => match.replace(/[:=].*/, '= [REDACTED]'))
    .replace(/\b(?:tenant_access_token|user_access_token|app_access_token)\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[REDACTED]')
    .replace(/\bwebhook\s*[:=]\s*["']?https?:\/\/[^"'\s,}]+/gi, 'webhook=[REDACTED]');
}

function maskId(value = '') {
  const text = String(value || '');
  if (text.length <= 8) return text ? '[masked]' : '';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function truncate(text, limit = 1800) {
  const value = String(text ?? '');
  return value.length > limit ? `${value.slice(0, limit)}\n...[truncated]` : value;
}

async function ensureDirs() {
  await fsp.mkdir(channelRoot, { recursive: true });
  await fsp.mkdir(promptDir, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, payload) {
  await fsp.mkdir(dirname(file), { recursive: true });
  await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function appendEvent(type, payload = {}) {
  await ensureDirs();
  await fsp.appendFile(eventsPath, `${JSON.stringify({ at: now(), type, payload: JSON.parse(redact(payload)) })}\n`, 'utf8');
}

function parseEnvList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function sourceFromEvent(event) {
  const sender = event?.sender?.sender_id || {};
  const message = event?.message || {};
  return {
    eventId: event?.event_id || event?.uuid || message.message_id,
    openId: sender.open_id || '',
    chatId: message.chat_id || '',
    chatType: message.chat_type || '',
    messageType: message.message_type || '',
    content: message.content || '',
    mentions: Array.isArray(message.mentions) ? message.mentions : [],
    senderType: event?.sender?.sender_type || '',
    messageId: message.message_id || '',
  };
}

function parseTextContent(content) {
  try {
    const parsed = JSON.parse(content);
    return String(parsed.text || '').trim();
  } catch {
    return String(content || '').trim();
  }
}

function parseTaskCreate(text) {
  const lines = text.replace(/^\s*\/task create\s*/i, '').split(/\r?\n/);
  let title = '';
  let role = '';
  let prompt = '';
  let inPrompt = false;
  for (const line of lines) {
    if (/^title\s*:/i.test(line) && !inPrompt) {
      title = line.replace(/^title\s*:\s*/i, '').trim();
    } else if (/^role\s*:/i.test(line) && !inPrompt) {
      role = line.replace(/^role\s*:\s*/i, '').trim();
    } else if (/^prompt\s*:/i.test(line)) {
      inPrompt = true;
      const sameLine = line.replace(/^prompt\s*:\s*/i, '');
      if (sameLine) prompt += `${sameLine}\n`;
    } else if (inPrompt) {
      prompt += `${line}\n`;
    }
  }
  title = title || 'Feishu task';
  role = role || 'research';
  prompt = prompt.trim();
  if (!validRoles.has(role)) throw new Error(`role must be one of ${[...validRoles].join(', ')}`);
  if (!prompt) throw new Error('prompt is required');
  return { title, role, prompt };
}

function formatTaskSummary(task, label = 'task') {
  return [
    `${label}`,
    `task_id: ${task.task_id}`,
    `title: ${task.title}`,
    `role: ${task.role}`,
    `baseline: ${task.baseline_head}`,
    `status: ${task.status}`,
    `codex_runs: ${task.codex_run_count}`,
    `cost: ${task.cost_status || 'unknown'}`,
    task.blocked_reason ? `blocked_reason: ${task.blocked_reason}` : '',
  ].filter(Boolean).join('\n');
}

class MemoryTransport {
  constructor() {
    this.sent = [];
    this.failNext = false;
  }
  async send(target, text) {
    if (this.failNext) {
      this.failNext = false;
      const error = new Error('mock send failed');
      error.code = 'mock_failed';
      throw error;
    }
    const id = `mock-${this.sent.length + 1}`;
    this.sent.push({ id, target, text });
    return { ok: true, messageId: id, code: 0, retries: 0 };
  }
}

class FeishuTaskChannel {
  constructor(options = {}) {
    this.gateway = options.gateway || gateway;
    this.transport = options.transport || new MemoryTransport();
    this.repository = resolve(options.repository || root);
    this.allowedOpenIds = new Set(options.allowedOpenIds || parseEnvList(process.env.FEISHU_ALLOWED_OPEN_IDS));
    this.botOpenId = options.botOpenId || process.env.FEISHU_BOT_OPEN_ID || '';
    this.enabled = options.enabled ?? process.env.FEISHU_CHANNEL_ENABLED !== '0';
    this.pairing = null;
    this.awaitRuns = Boolean(options.awaitRuns);
    this.channelRoot = options.channelRoot || channelRoot;
  }

  async init() {
    await ensureDirs();
    const config = await readJson(configPath, {});
    if (config.owner_open_id) this.allowedOpenIds.add(config.owner_open_id);
    return this;
  }

  async config() {
    return readJson(configPath, {});
  }

  async saveConfig(patch) {
    const next = { ...(await this.config()), ...patch, updated_at: now() };
    await writeJson(configPath, next);
    return next;
  }

  generatePairingCode(ttlMs = 10 * 60 * 1000) {
    this.pairing = {
      code: randomBytes(4).toString('hex'),
      expiresAt: Date.now() + ttlMs,
      attempts: 0,
      maxAttempts: 5,
    };
    return this.pairing.code;
  }

  isOwner(openId) {
    return Boolean(openId && this.allowedOpenIds.has(openId));
  }

  async isDuplicate(eventId) {
    if (!eventId) return false;
    const data = await readJson(processedEventsPath, {});
    const cutoff = Date.now() - eventTtlMs;
    const entries = Object.entries(data).filter(([, ts]) => Number(ts) >= cutoff).slice(-maxEventIds);
    const next = Object.fromEntries(entries);
    if (next[eventId]) {
      await writeJson(processedEventsPath, next);
      return true;
    }
    next[eventId] = Date.now();
    await writeJson(processedEventsPath, next);
    return false;
  }

  shouldHandleGroupMessage(source) {
    if (source.chatType !== 'group') return true;
    if (!source.mentions.length) return false;
    if (!this.botOpenId) return true;
    return source.mentions.some((item) => item.id?.open_id === this.botOpenId);
  }

  async handleEvent(rawEvent) {
    if (!this.enabled) return { text: 'channel disabled' };
    const source = sourceFromEvent(rawEvent);
    if (source.senderType === 'bot') return { ignored: true, reason: 'bot_message' };
    if (await this.isDuplicate(source.eventId)) return { ignored: true, reason: 'duplicate_event' };
    if (source.messageType !== 'text') return this.replyToSource(source, '只支持文本命令。');
    if (!this.shouldHandleGroupMessage(source)) return { ignored: true, reason: 'group_message_without_mention' };
    const text = parseTextContent(source.content);
    if (!text.startsWith('/gateway') && !text.startsWith('/task')) return { ignored: true, reason: 'not_gateway_command' };
    try {
      const response = await this.handleCommand(text, source);
      return this.replyToSource(source, response);
    } catch (error) {
      return this.replyToSource(source, error.publicMessage || '命令处理失败。');
    }
  }

  async handleCommand(text, source) {
    const [head, sub, taskId] = text.trim().split(/\s+/);
    if (head === '/gateway') return this.handleGatewayCommand(sub || 'help', text, source);
    if (head === '/task') return this.handleTaskCommand(sub || '', taskId, text, source);
    return '未知命令。';
  }

  async handleGatewayCommand(command, text, source) {
    if (command === 'help') {
      return [
        '/gateway help',
        '/gateway ping',
        '/gateway whoami',
        '/gateway status',
        '/gateway pair <code>',
        '/gateway bind-report',
        '/gateway unbind-report',
        '/task create',
        '/task show|approve|reject|run|status|logs|cancel|cleanup <task-id>',
      ].join('\n');
    }
    if (command === 'ping') return 'pong';
    if (command === 'whoami') {
      return [
        `paired: ${this.isOwner(source.openId)}`,
        `open_id: ${maskId(source.openId)}`,
        `owner: ${this.isOwner(source.openId)}`,
      ].join('\n');
    }
    if (command === 'status') {
      const running = (await this.gateway.listTasks()).filter((task) => ['preparing', 'running', 'cancelling'].includes(task.status)).length;
      return [`channel: online`, `task_gateway: available`, `running_tasks: ${running}`].join('\n');
    }
    if (command === 'pair') {
      const code = text.trim().split(/\s+/)[2] || '';
      if (source.chatType === 'group') return '配对码只能在机器人单聊中使用。';
      if (!this.pairing) return '当前没有有效配对码。';
      this.pairing.attempts += 1;
      if (Date.now() > this.pairing.expiresAt) return '配对码已过期。';
      if (this.pairing.attempts > this.pairing.maxAttempts) return '配对失败次数过多。';
      if (code !== this.pairing.code) return '配对码不正确。';
      this.allowedOpenIds.add(source.openId);
      this.pairing = null;
      await this.saveConfig({ owner_open_id: source.openId });
      return `配对成功：${maskId(source.openId)}`;
    }
    if (command === 'bind-report') {
      this.assertOwner(source);
      if (source.chatType !== 'group') return '请在工作台群里 @ 机器人执行绑定。';
      await this.saveConfig({ report_chat_id: source.chatId });
      return `报告群已绑定：${maskId(source.chatId)}`;
    }
    if (command === 'unbind-report') {
      this.assertOwner(source);
      await this.saveConfig({ report_chat_id: '' });
      return '报告群已解绑。';
    }
    return '未知 /gateway 命令。';
  }

  async handleTaskCommand(command, taskId, text, source) {
    this.assertOwner(source);
    if (command === 'create') {
      const parsed = parseTaskCreate(text);
      const baseline = await this.originMainHead();
      const taskSafeId = `feishu-${Date.now()}-${randomBytes(3).toString('hex')}`;
      const promptFile = join(promptDir, `${taskSafeId}.md`);
      await fsp.writeFile(promptFile, parsed.prompt, 'utf8');
      const card = {
        task_id: taskSafeId,
        title: parsed.title,
        role: parsed.role,
        repository: this.repository,
        baseline_head: baseline,
        prompt_file: promptFile,
        allowed_paths: [],
        forbidden_paths: ['managed-proxy', 'secrets', '.env', '.env.local', '.wrangler', 'wrangler.toml', 'wrangler.jsonc'],
        requires_codex: true,
        max_codex_runs: 1,
        max_retries: 0,
        concurrency_group: 'feishu',
        approval_required: true,
        acceptance_commands: ['git status --short --branch'],
        stop_conditions: ['no push', 'no deploy', 'no production changes'],
      };
      const cardFile = join(promptDir, `${taskSafeId}.json`);
      await writeJson(cardFile, card);
      const task = await this.gateway.createTask(cardFile);
      return `${formatTaskSummary(task, 'created')}\n尚未启动Codex。`;
    }

    if (!taskId) return '缺少 task_id。';
    if (!/^[A-Za-z0-9._-]+$/.test(taskId)) return 'task_id 不合法。';
    if (command === 'show' || command === 'status') return formatTaskSummary(await this.gateway.loadTask(taskId), command);
    if (command === 'logs') return this.safeLogs(taskId);
    if (command === 'approve') return formatTaskSummary(await this.gateway.approveTask(taskId), 'approved');
    if (command === 'reject') return formatTaskSummary(await this.gateway.rejectTask(taskId, 'Rejected from Feishu channel'), 'rejected');
    if (command === 'cancel') {
      const task = await this.gateway.cancelTask(taskId);
      await this.notifyTaskStatus(task, 'cancelled');
      return formatTaskSummary(task, 'cancelled');
    }
    if (command === 'cleanup') return formatTaskSummary(await this.gateway.cleanupTask(taskId), 'cleanup');
    if (command === 'run') {
      const task = await this.gateway.loadTask(taskId);
      if (task.status !== 'approved') return `任务未批准，当前状态：${task.status}`;
      await this.notifyTaskStatus(task, 'started');
      const runPromise = this.gateway.runTask(taskId)
        .then(async (result) => {
          await this.notifyTaskStatus(result, result.status);
          return result;
        })
        .catch(async (error) => {
          await appendEvent('task_run_failed', { task_id: taskId, message: error.message });
          throw error;
        });
      if (this.awaitRuns) {
        const result = await runPromise;
        return formatTaskSummary(result, 'run finished');
      }
      runPromise.catch(() => {});
      return `任务已启动：${taskId}`;
    }
    return '未知 /task 命令。';
  }

  assertOwner(source) {
    if (!this.isOwner(source.openId)) {
      const error = new Error('未授权。');
      error.publicMessage = '未授权。';
      throw error;
    }
  }

  async originMainHead() {
    const result = await this.gateway.spawnCapture('git', ['rev-parse', 'origin/main'], {
      cwd: this.repository,
      timeoutMs: 30000,
    });
    if (!result.ok) throw new Error('无法读取 origin/main baseline。');
    return result.stdout.trim();
  }

  async safeLogs(taskId) {
    const logs = await this.gateway.readLogs(taskId);
    return truncate(logs.map((event) => `${event.at} ${event.type} ${event.payload?.reason || ''}`).join('\n') || 'no logs', 1800);
  }

  async replyToSource(source, text) {
    try {
      const result = await this.transport.send({ type: 'source', chatId: source.chatId }, truncate(redact(text)));
      await appendEvent('message_sent', { target: 'source', message_id: result.messageId, code: result.code, retries: result.retries });
      return { text, send: result };
    } catch (error) {
      await appendEvent('notification_failed', { target: 'source', code: error.code || 'unknown', message: error.message });
      return { text, send: { ok: false, code: error.code || 'unknown' } };
    }
  }

  async notifyTaskStatus(task, status) {
    const config = await this.config();
    if (!config.report_chat_id) return { skipped: true, reason: 'no_report_chat' };
    const key = `${task.task_id}:${status}`;
    const sent = await readJson(sentNotificationsPath, {});
    if (sent[key]) return { skipped: true, reason: 'duplicate_notification' };
    const summary = [
      `任务状态：${status}`,
      `task_id: ${task.task_id}`,
      `role: ${task.role}`,
      `title: ${task.title}`,
      `baseline: ${task.baseline_head}`,
      `current_head: ${task.current_head || task.commit_sha || ''}`,
      `tests: ${(task.tests || []).join(', ') || '(none)'}`,
      `blocked_reason: ${task.blocked_reason || ''}`,
      `requires_owner_decision: ${Boolean(task.requires_owner_decision)}`,
      `codex_runs: ${task.codex_run_count}`,
      `cost: ${task.cost_status || 'unknown'}`,
    ].join('\n');
    try {
      const result = await this.transport.send({ type: 'report_chat', chatId: config.report_chat_id }, truncate(redact(summary)));
      sent[key] = { at: now(), message_id: result.messageId };
      await writeJson(sentNotificationsPath, sent);
      await appendEvent('report_notification_sent', { task_id: task.task_id, status, message_id: result.messageId, code: result.code, retries: result.retries });
      return result;
    } catch (error) {
      await appendEvent('notification_failed', { task_id: task.task_id, status, code: error.code || 'unknown', message: error.message });
      return { ok: false, code: error.code || 'unknown' };
    }
  }
}

class FeishuSdkTransport {
  constructor(client) {
    this.client = client;
  }
  async send(target, text) {
    const receiveId = target.chatId;
    const response = await this.client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
    return { ok: true, messageId: response?.data?.message_id || '', code: response?.code ?? 0, retries: 0 };
  }
}

async function buildLiveChannel() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId) throw new Error('FEISHU_APP_ID is required');
  if (!appSecret) throw new Error('FEISHU_APP_SECRET is required');
  const lark = await import('@larksuiteoapi/node-sdk');
  const baseConfig = {
    appId,
    appSecret,
    domain: process.env.FEISHU_DOMAIN || undefined,
    loggerLevel: process.env.FEISHU_LOG_LEVEL === 'debug' ? lark.LoggerLevel.debug : lark.LoggerLevel.warn,
  };
  const client = new lark.Client(baseConfig);
  const channel = await new FeishuTaskChannel({ transport: new FeishuSdkTransport(client) }).init();
  const dispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        await channel.handleEvent(data);
      } catch (error) {
        await appendEvent('event_handler_failed', { message: error.publicMessage || error.message });
      }
    },
  });
  const wsClient = new lark.WSClient(baseConfig);
  return { lark, channel, wsClient, dispatcher };
}

async function check() {
  const missing = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'].filter((name) => !process.env[name]);
  const sdk = await import('@larksuiteoapi/node-sdk');
  const status = {
    ok: missing.length === 0,
    sdkPackage: '@larksuiteoapi/node-sdk',
    sdkVersion: JSON.parse(await fsp.readFile(resolve('node_modules/@larksuiteoapi/node-sdk/package.json'), 'utf8')).version,
    hasWSClient: typeof sdk.WSClient === 'function',
    hasEventDispatcher: typeof sdk.EventDispatcher === 'function',
    missingEnv: missing,
    taskGateway: 'available',
    runtimeWritable: true,
  };
  await ensureDirs();
  return status;
}

async function start() {
  if (process.env.AIW_ENABLE_LEGACY_FEISHU_TASK_CHANNEL_START !== '1') {
    throw new Error('Legacy Feishu task channel production start is disabled; use npm run bridge:start.');
  }
  const { wsClient, dispatcher, channel } = await buildLiveChannel();
  const code = channel.allowedOpenIds.size ? '' : channel.generatePairingCode();
  if (code) console.log(`Feishu owner pairing code, expires in 10 minutes: ${code}`);
  console.log('Starting Feishu channel with WebSocket long connection.');
  wsClient.start({ eventDispatcher: dispatcher });
  const stop = async () => {
    await appendEvent('channel_stopping', {});
    wsClient.close?.();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'help';
  try {
    if (command === 'check') {
      console.log(JSON.stringify(await check(), null, 2));
      return;
    }
    if (command === 'start') {
      await start();
      return;
    }
    console.log('Usage: node scripts/feishu-task-channel.mjs <check|start>');
  } catch (error) {
    console.error(JSON.stringify({ ok: false, message: redact(error.message) }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export {
  FeishuTaskChannel,
  MemoryTransport,
  parseTextContent,
  parseTaskCreate,
  sourceFromEvent,
  maskId,
  redact,
  check,
};
