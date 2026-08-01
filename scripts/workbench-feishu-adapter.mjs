import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';
import { acceptAndEnqueueJob, claimResultDelivery, listResults, markAcknowledged, markDelivered, wasDelivered } from './feishu-worker-ipc.mjs';

const root = process.cwd();
const stateRoot = join(runtimeRoot, 'feishu-workbench-bridge');
const dedupeDir = join(stateRoot, 'dedupe');
const eventsPath = join(stateRoot, 'events.jsonl');
const statusPath = join(stateRoot, 'status.json');
const adapterLockPath = join(stateRoot, 'locks', 'feishu-adapter.lock');
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
function textOf(content) { try { return JSON.parse(content || '{}').text || ''; } catch { return ''; } }
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
  const lark = await import('@larksuiteoapi/node-sdk');
  const config = { appId, appSecret, loggerLevel: lark.LoggerLevel.warn };
  const client = new lark.Client(config);
  const reply = async (messageId, text) => {
    const uuid = createHash('sha256').update(`aiw-final:${messageId}`).digest('hex').slice(0, 32);
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
  const dispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const messageId = String(data?.message?.message_id || '');
      const chatId = String(data?.message?.chat_id || '');
      const openId = String(data?.sender?.sender_id?.open_id || '');
      const text = textOf(data?.message?.content);
      if (!messageId || !text || !(await claimMessage(messageId))) return;
      const receivedAt = Date.now();
      const accepted = await acceptAndEnqueueJob({ messageId, originalMessageId: messageId, eventId: data?.event_id || '', chatId, conversationId: chatId, openId, text, receivedAt }, { eventId: data?.event_id || '', chatId, conversationId: chatId, openId, text, receivedAt });
      await event('message_accepted', { messageId, receivedAt, acceptedAt: Date.now(), jobCreated: accepted.enqueued, projectRoot: root, pid: process.pid, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '' });
      acknowledge(messageId).then(async (reactionId) => {
        const marked = await markAcknowledged(messageId, { reactionId, emojiType: 'OK' });
        if (marked) await event('message_acknowledged', { messageId, reactionId, emojiType: 'OK', acknowledgedAt: Date.now(), latencyMs: Date.now() - receivedAt });
      }).catch((error) => event('acknowledgement_failed', { messageId, failedAt: Date.now(), latencyMs: Date.now() - receivedAt, message: error.message }));
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
  const timer = setInterval(() => deliver().catch(async (error) => { await patchStatus({ latestError: error.message }); }), 250);
  const ws = new lark.WSClient({
    ...config,
    onReady: () => {
      event('websocket_connected', { pid: process.pid, projectRoot: root }).catch(() => {});
      patchStatus({ backend: 'online', feishu: 'connected', aiLink: 'not_used', hermes: 'not_used', adapterPid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', latestError: '' }).catch(() => {});
    },
    onReconnecting: () => patchStatus({ feishu: 'connecting' }).catch(() => {}),
    onReconnected: () => {
      event('websocket_reconnected', { pid: process.pid }).catch(() => {});
      patchStatus({ feishu: 'connected', latestError: '' }).catch(() => {});
    },
    onError: (error) => {
      event('websocket_failed', { message: error?.message || String(error) }).catch(() => {});
      patchStatus({ feishu: 'disconnected', latestError: error?.message || String(error) }).catch(() => {});
    }
  });
  await patchStatus({ backend: 'online', feishu: 'connecting', aiLink: 'not_used', hermes: 'not_used', adapterPid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', latestError: '' });
  ws.start({ eventDispatcher: dispatcher });
  await event('adapter_started', { pid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '' });
  const stop = async () => { clearInterval(timer); await patchStatus({ feishu: 'disconnected' }); await fsp.rm(adapterLockPath, { force: true }); ws.close?.(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startWorkbenchFeishuAdapter().catch(async (error) => { await patchStatus({ feishu: 'disconnected', latestError: error.message }); process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
