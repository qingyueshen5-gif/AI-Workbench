import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';
import { acceptMessageOnce, claimProgress, claimResultDelivery, enqueueJob, listProgress, listResults, markAcknowledged, markDelivered, markProgressDelivered, recordProgressFailure, validateProgressEvent, wasDelivered, wasProgressDelivered } from './feishu-worker-ipc.mjs';

const root = process.cwd();
const stateRoot = join(runtimeRoot, 'feishu-workbench-bridge');
const dedupeDir = join(stateRoot, 'dedupe');
const eventsPath = join(stateRoot, 'events.jsonl');
const statusPath = join(stateRoot, 'status.json');
const adapterLockPath = join(stateRoot, 'locks', 'feishu-adapter.lock');
const gatewayHealthPath = join(stateRoot, 'gateway-health.json');
async function acquireAdapterLock() {
  await fsp.mkdir(dirname(adapterLockPath), { recursive: true });
  try {
    const handle = await fsp.open(adapterLockPath, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, projectRoot: root, startedAt: Date.now() })}\n`);
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let current = {};
    try { current = JSON.parse(await fsp.readFile(adapterLockPath, 'utf8')); } catch {}
    try { process.kill(Number(current.pid), 0); throw new Error(`Feishu Adapter already running: ${current.pid}`); }
    catch (probe) { if (!String(probe.message).startsWith('Feishu Adapter already running')) await fsp.rm(adapterLockPath, { force: true }); else throw probe; }
    return acquireAdapterLock();
  }
}

function loadEnv() {
  for (const path of [join(root, '.env.local'), join(root, '.env'), 'C:\\Users\\qingy\\AI-Workbench\\.env.local']) {
    try {
      for (const raw of fs.readFileSync(path, 'utf8').split(String.fromCharCode(10))) {
        const line = raw.endsWith(String.fromCharCode(13)) ? raw.slice(0, -1) : raw;
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    } catch {}
  }
}
loadEnv();
async function readStatus() { try { return JSON.parse(await fsp.readFile(statusPath, 'utf8')); } catch { return {}; } }
async function patchStatus(patch) {
  await fsp.mkdir(stateRoot, { recursive: true });
  const next = { ...(await readStatus()), ...patch, updatedAt: new Date().toISOString() };
  const tmp = `${statusPath}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, statusPath);
}
async function event(type, payload = {}) {
  await fsp.mkdir(stateRoot, { recursive: true });
  await fsp.appendFile(eventsPath, `${JSON.stringify({ at: new Date().toISOString(), type, payload })}\n`, 'utf8');
}
async function writeJsonAtomic(path, value) {
  await fsp.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await fsp.rename(tmp, path);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(error.code)) { await fsp.rm(tmp, { force: true }); throw error; }
    try { await fsp.copyFile(tmp, path); } finally { await fsp.rm(tmp, { force: true }); }
  }
}
async function appIdLockOwner(appId) {
  const fingerprint = createHash('sha256').update(String(appId)).digest('hex').slice(0, 16);
  const path = join(stateRoot, 'locks', `feishu-app-${fingerprint}.lock`);
  try {
    const handle = await fsp.open(path, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, projectRoot: root, startedAt: Date.now(), appIdFingerprint: fingerprint })}\n`);
    await handle.close();
    return { path, duplicate: false, fingerprint };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let current = {};
    try { current = JSON.parse(await fsp.readFile(path, 'utf8')); } catch {}
    try { process.kill(Number(current.pid), 0); return { path, duplicate: Number(current.pid) !== process.pid, fingerprint, owner: current }; }
    catch { await fsp.rm(path, { force: true }); return appIdLockOwner(appId); }
  }
}
function parseJsonContent(content) {
  if (content && typeof content === 'object') return { value: content, rawContentType: 'object' };
  if (typeof content !== 'string') return { value: content, rawContentType: typeof content };
  try { return { value: JSON.parse(content), rawContentType: 'json_string' }; }
  catch { return { value: content, rawContentType: 'string' }; }
}

function collectVisibleText(value, output = [], seen = new Set()) {
  if (typeof value === 'string') { output.push(value); return output; }
  if (!value || typeof value !== 'object' || seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectVisibleText(item, output, seen);
    return output;
  }
  if (typeof value.text === 'string') output.push(value.text);
  if (typeof value.content === 'string' && !('text' in value)) output.push(value.content);
  const preferred = ['title', 'zh_cn', 'en_us', 'ja_jp', 'content', 'elements'];
  for (const key of preferred) {
    if (!(key in value) || (key === 'content' && typeof value.content === 'string')) continue;
    collectVisibleText(value[key], output, seen);
  }
  if (output.length === 0) {
    for (const [key, nested] of Object.entries(value)) {
      if (['tag', 'type', 'msg_type', 'image_key', 'file_key', 'file_token'].includes(key)) continue;
      collectVisibleText(nested, output, seen);
    }
  }
  return output;
}

export function parseFeishuMessage(message = {}, sender = {}) {
  const messageId = String(message?.message_id || message?.messageId || '');
  const messageType = String(message?.message_type || message?.msg_type || message?.messageType || 'unknown');
  const chatId = String(message?.chat_id || message?.chatId || '');
  const parsed = parseJsonContent(message?.content);
  const supported = new Set(['text', 'post', 'interactive', 'unknown']);
  let text = '';
  if (messageType === 'text' || messageType === 'unknown') {
    if (typeof parsed.value === 'string') text = parsed.value;
    else if (parsed.value && typeof parsed.value.text === 'string') text = parsed.value.text;
    else text = collectVisibleText(parsed.value).join('\n');
  } else if (messageType === 'post' || messageType === 'interactive') {
    text = collectVisibleText(parsed.value).join('\n');
  }
  const attachments = [];
  const scanAttachments = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) scanAttachments(item, seen); return; }
    for (const key of ['image_key', 'file_key', 'file_token']) if (value[key]) attachments.push({ type: key, value: String(value[key]) });
    for (const nested of Object.values(value)) scanAttachments(nested, seen);
  };
  scanAttachments(parsed.value);
  return {
    messageId,
    messageType,
    text: String(text || '').replace(/\r\n/g, '\n'),
    sender: sender?.sender_id || sender || {},
    chatId,
    attachments,
    rawContentType: parsed.rawContentType,
    supported: supported.has(messageType),
  };
}
function safeName(id) { return createHash('sha256').update(String(id)).digest('hex'); }
async function claimMessage(messageId) {
  await fsp.mkdir(dedupeDir, { recursive: true });
  const path = join(dedupeDir, `${safeName(messageId)}.json`);
  try {
    const h = await fsp.open(path, 'wx');
    await h.writeFile(`${JSON.stringify({ messageId, claimedAt: Date.now() })}\n`);
    await h.close();
    return true;
  } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
}

export async function startWorkbenchFeishuAdapter() {
  await acquireAdapterLock();
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Feishu credentials not configured');
  const appLock = await appIdLockOwner(appId);
  if (appLock.duplicate) throw new Error(`Duplicate Feishu consumer detected for app identity; owner PID=${appLock.owner?.pid || 'unknown'}`);
  const lark = await import('@larksuiteoapi/node-sdk');
  const config = { appId, appSecret, loggerLevel: lark.LoggerLevel.warn };
  const client = new lark.Client(config);
  const reply = async (messageId, text, purpose = 'final') => {
    const uuid = createHash('sha256').update(`aiw-${purpose}:${messageId}`).digest('hex').slice(0, 32);
    let response;
    try {
      response = await client.im.v1.message.reply({ path: { message_id: messageId }, data: { msg_type: 'text', content: JSON.stringify({ text }), uuid } });
    } catch (error) {
      const code = error?.response?.data?.code ?? error?.code ?? '';
      const msg = error?.response?.data?.msg || error?.message || 'unknown';
      throw new Error(`Feishu reply rejected: code=${code}, msg=${msg}`);
    }
    if (response?.code && response.code !== 0) throw new Error(`Feishu reply rejected: code=${response.code}, msg=${response.msg || 'unknown'}`);
    return response?.data?.message_id || '';
  };
  const acknowledge = async (messageId) => {
    const response = await client.im.v1.messageReaction.create({ path: { message_id: messageId }, data: { reaction_type: { emoji_type: 'OK' } } });
    if (response?.code && response.code !== 0) throw new Error(`Feishu reaction rejected: code=${response.code}, msg=${response.msg || 'unknown'}`);
    return response?.data?.reaction_id || '';
  };
  const health = {
    pid: process.pid,
    projectRoot: root,
    gitCommit: process.env.AIW_GATEWAY_GIT_COMMIT || process.env.AIW_RUNTIME_GIT_COMMIT || '',
    startedAt: Date.now(),
    processAlive: true,
    websocketConnected: false,
    lastHeartbeatAt: 0,
    lastEventReceivedAt: 0,
    lastMessageAcceptedAt: 0,
    eventHandlerRegistered: true,
    duplicateConsumerDetected: false,
    appIdFingerprint: appLock.fingerprint,
    connectionState: 'connecting',
    reconnectCount: 0,
    lastReconnectAt: 0,
    lastError: ''
  };
  const dispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const rawReceivedAt = Date.now();
      const rawMessageId = String(data?.message?.message_id || '');
      health.lastEventReceivedAt = rawReceivedAt;
      health.lastEventType = 'im.message.receive_v1';
      await event('raw_event_received', { eventType: 'im.message.receive_v1', messageId: rawMessageId, eventId: String(data?.event_id || ''), receivedAt: rawReceivedAt, pid: process.pid });
      let parsedMessage;
      try {
        parsedMessage = parseFeishuMessage(data?.message || {}, data?.sender || {});
        await event('message_parsed', { messageId: parsedMessage.messageId, messageType: parsedMessage.messageType, rawContentType: parsedMessage.rawContentType, textLength: parsedMessage.text.length, attachmentCount: parsedMessage.attachments.length, pid: process.pid });
      } catch (error) {
        await event('message_parse_failed', { messageId: rawMessageId, messageType: String(data?.message?.message_type || 'unknown'), message: error?.message || String(error), pid: process.pid });
        return;
      }
      const { messageId, chatId, text } = parsedMessage;
      const openId = String(parsedMessage.sender?.open_id || data?.sender?.sender_id?.open_id || '');
      if (!messageId) { await event('message_parse_failed', { messageId, messageType: parsedMessage.messageType, message: 'missing_message_id', pid: process.pid }); return; }
      if (!parsedMessage.supported) { await event('unsupported_message_type', { messageId, messageType: parsedMessage.messageType, rawContentType: parsedMessage.rawContentType, attachmentCount: parsedMessage.attachments.length, pid: process.pid }); return; }
      if (!text) { await event('empty_message', { messageId, messageType: parsedMessage.messageType, rawContentType: parsedMessage.rawContentType, pid: process.pid }); return; }
      if (!(await claimMessage(messageId))) { await event('duplicate_event_ignored', { messageId, pid: process.pid }); return; }
      const receivedAt = rawReceivedAt;
      const metadata = { eventId: data?.event_id || '', chatId, conversationId: chatId, openId, text, receivedAt };
      const acceptedOnce = await acceptMessageOnce(messageId, metadata);
      if (!acceptedOnce) return;
      health.lastMessageAcceptedAt = Date.now();
      acknowledge(messageId).then(async (reactionId) => {
        const marked = await markAcknowledged(messageId, { reactionId, emojiType: 'OK' });
        if (marked) await event('message_acknowledged', { messageId, reactionId, emojiType: 'OK', acknowledgedAt: Date.now(), latencyMs: Date.now() - receivedAt });
      }).catch((error) => event('acknowledgement_failed', { messageId, failedAt: Date.now(), latencyMs: Date.now() - receivedAt, message: error.message }));
      const jobCreated = await enqueueJob({ messageId, originalMessageId: messageId, eventId: data?.event_id || '', chatId, conversationId: chatId, openId, text, receivedAt });
      await event('message_accepted', { messageId, receivedAt, acceptedAt: Date.now(), jobCreated, projectRoot: root, pid: process.pid, gitCommit: process.env.AIW_GATEWAY_GIT_COMMIT || '' });
      await patchStatus({ feishu: 'connected', currentStage: 'received', latestMessageId: messageId, latestError: '' });
    }
  });
  let delivering = false;
  const deliver = async () => {
    if (delivering) return;
    delivering = true;
    try {
    for (const result of await listResults()) {
      if (await wasDelivered(result.messageId)) { await markDelivered(result); continue; }
      if (!(await claimResultDelivery(result.messageId, { pid: process.pid }))) continue;
      await event('reply_sender_claimed', { messageId: result.messageId, claimedAt: Date.now(), pid: process.pid });
      try {
        const replyMessageId = await reply(result.originalMessageId || result.messageId, String(result.text || '这次没有完成。'));
        await markDelivered(result, { replyMessageId });
        await event('result_delivered', { messageId: result.messageId, replyMessageId, provider: result.provider || '', toolUsed: result.toolUsed || '', verified: result.verified === true });
        await patchStatus({ currentStage: result.ok ? 'completed' : 'failed', latestSuccessfulTask: result.ok ? result.messageId : (await readStatus()).latestSuccessfulTask || '', latestError: result.ok ? '' : String(result.errorClass || '任务失败') });
      } catch (error) {
        await event('delivery_failed', { messageId: result.messageId, failedAt: Date.now(), message: error.message });
        throw error;
      }
    }
    } finally { delivering = false; }
  };
  let deliveringProgress = false;
  const deliverProgress = async () => {
    if (deliveringProgress) return;
    deliveringProgress = true;
    try {
      for (const raw of await listProgress()) {
        let progress;
        try { progress = validateProgressEvent(raw); }
        catch (error) { await event('progress_rejected', { eventId: String(raw?.eventId || ''), message: error.message }); continue; }
        if (await wasProgressDelivered(progress.eventId)) { await markProgressDelivered(raw); continue; }
        if (!(await claimProgress(progress.eventId, { gatewayPid: process.pid }))) continue;
        try {
          const replyMessageId = await reply(progress.originalMessageId, progress.message);
          await markProgressDelivered(raw, { replyMessageId, stage: progress.stage });
          await event('progress_delivered', { eventId: progress.eventId, jobId: progress.jobId, originalMessageId: progress.originalMessageId, stage: progress.stage, replyMessageId, deliveredAt: Date.now() });
        } catch (error) {
          await recordProgressFailure(progress.eventId, { message: error.message }).catch(() => {});
          await event('progress_delivery_failed', { eventId: progress.eventId, jobId: progress.jobId, failedAt: Date.now(), message: error.message });
        }
      }
    } finally { deliveringProgress = false; }
  };
  const timer = setInterval(() => {
    deliver().catch(async (error) => { await patchStatus({ latestError: error.message }); });
    deliverProgress().catch((error) => event('progress_pump_failed', { message: error.message }).catch(() => {}));
  }, 1000);
  let ws;
  const wsConfig = {
    ...config,
    autoReconnect: true,
    handshakeTimeoutMs: Number(process.env.AIW_FEISHU_HANDSHAKE_TIMEOUT_MS || 15000),
    wsConfig: { pingTimeout: Number(process.env.AIW_FEISHU_PING_TIMEOUT_SECONDS || 15) },
    onReady: () => {
      const now = Date.now();
      health.websocketConnected = true; health.lastHeartbeatAt = now; health.connectionState = 'healthy'; health.lastError = '';
      event('websocket_connected', { pid: process.pid, projectRoot: root }).catch(() => {});
      patchStatus({ backend: 'online', feishu: 'connected', aiLink: 'not_used', hermes: 'not_used', adapterPid: process.pid, projectRoot: root, gatewayCommit: health.gitCommit, latestError: '' }).catch(() => {});
    },
    onReconnecting: () => {
      health.websocketConnected = false; health.connectionState = 'reconnecting'; health.reconnectCount += 1;
      event('websocket_reconnecting', { pid: process.pid, reconnectCount: health.reconnectCount }).catch(() => {});
      patchStatus({ feishu: 'connecting' }).catch(() => {});
    },
    onReconnected: () => {
      const now = Date.now();
      health.websocketConnected = true; health.lastHeartbeatAt = now; health.lastReconnectAt = now; health.connectionState = 'healthy'; health.lastError = '';
      event('websocket_reconnected', { pid: process.pid, reconnectCount: health.reconnectCount }).catch(() => {});
      patchStatus({ feishu: 'connected', latestError: '' }).catch(() => {});
    },
    onError: (error) => {
      health.websocketConnected = false; health.connectionState = 'offline'; health.lastError = error?.message || String(error);
      event('websocket_failed', { message: health.lastError }).catch(() => {});
      patchStatus({ feishu: 'disconnected', latestError: health.lastError }).catch(() => {});
    }
  };
  ws = new lark.WSClient(wsConfig);
  const socketActivity = () => { health.lastHeartbeatAt = Date.now(); if (health.connectionState !== 'reconnecting') health.connectionState = 'healthy'; };
  const bindSocketActivity = () => {
    const socket = ws?.wsConfig?.getWSInstance?.();
    if (!socket || socket.__aiwHealthBound) return;
    socket.__aiwHealthBound = true;
    socket.on?.('message', socketActivity); socket.on?.('ping', socketActivity); socket.on?.('pong', socketActivity);
    socket.on?.('close', () => { health.websocketConnected = false; health.connectionState = 'reconnecting'; });
    socket.on?.('error', (error) => { health.lastError = error?.message || String(error); });
  };
  const healthTimer = setInterval(async () => {
    try {
    const now = Date.now();
    bindSocketActivity();
    const sdk = ws?.getConnectionStatus?.() || {};
    const processAlive = true;
    const sdkConnected = sdk.state === 'connected';
    health.processAlive = processAlive;
    health.websocketConnected = sdkConnected;
    if (sdkConnected && !health.lastHeartbeatAt) health.lastHeartbeatAt = Number(sdk.lastConnectTime || now);
    const staleAfterMs = Number(process.env.AIW_FEISHU_STALE_AFTER_MS || 180000);
    const stale = sdkConnected && health.lastHeartbeatAt > 0 && now - health.lastHeartbeatAt > staleAfterMs;
    if (stale && health.connectionState !== 'reconnecting') {
      health.connectionState = 'stale';
      await event('websocket_stale', { pid: process.pid, lastHeartbeatAt: health.lastHeartbeatAt, staleForMs: now - health.lastHeartbeatAt });
      const socket = ws?.wsConfig?.getWSInstance?.();
      socket?.terminate?.();
    } else if (sdk.state === 'reconnecting' || sdk.state === 'connecting') health.connectionState = 'reconnecting';
    else if (sdkConnected && !stale) health.connectionState = 'healthy';
    else if (sdk.state === 'failed') health.connectionState = 'offline';
    await writeJsonAtomic(gatewayHealthPath, { ...health, sdkState: sdk.state || 'unknown', sdkLastConnectTime: sdk.lastConnectTime || 0, sdkNextConnectTime: sdk.nextConnectTime || 0, sdkReconnectAttempts: sdk.reconnectAttempts || 0, updatedAt: now });
    } catch (error) {
      health.lastError = `health_write_failed: ${error?.message || String(error)}`;
      await event('gateway_health_write_failed', { pid: process.pid, message: health.lastError }).catch(() => {});
    }
  }, 1000);
  await patchStatus({ backend: 'online', feishu: 'connecting', aiLink: 'not_used', hermes: 'not_used', adapterPid: process.pid, projectRoot: root, gatewayCommit: health.gitCommit, latestError: '' });
  await ws.start({ eventDispatcher: dispatcher });
  await event('adapter_started', { pid: process.pid, projectRoot: root, gitCommit: health.gitCommit, eventHandlerRegistered: true, appIdFingerprint: appLock.fingerprint });
  const stop = async () => { clearInterval(timer); clearInterval(healthTimer); health.processAlive = false; health.connectionState = 'offline'; await writeJsonAtomic(gatewayHealthPath, { ...health, updatedAt: Date.now() }); await patchStatus({ feishu: 'disconnected' }); await fsp.rm(adapterLockPath, { force: true }); await fsp.rm(appLock.path, { force: true }); ws.close?.(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startWorkbenchFeishuAdapter().catch(async (error) => { await patchStatus({ feishu: 'disconnected', latestError: error.message }); process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
