import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runtimeRoot } from '../runtime-paths.mjs';

const configuredIpcRoot = String(process.env.AIW_FEISHU_IPC_DIR || '').trim();
if (!configuredIpcRoot) throw new Error('AIW_FEISHU_IPC_DIR is required');
if (!isAbsolute(configuredIpcRoot)) throw new Error('AIW_FEISHU_IPC_DIR must be absolute');
export const ipcRoot = resolve(configuredIpcRoot);
const jobsDir = join(ipcRoot, 'jobs');
const resultsDir = join(ipcRoot, 'results');
const claimsDir = join(ipcRoot, 'claims');
const deliveredDir = join(ipcRoot, 'delivered');
const deliveryClaimsDir = join(ipcRoot, 'delivery-claims');
const progressDir = join(ipcRoot, 'progress');
const progressClaimsDir = join(ipcRoot, 'progress-claims');
const progressDeliveredDir = join(ipcRoot, 'progress-delivered');
const dedupePath = join(ipcRoot, 'message-dedupe.json');
const workerStatePath = process.env.AIW_WORKER_STATE_PATH || join(ipcRoot, 'worker-state.json');
const acceptedDir = join(ipcRoot, 'accepted');
const acknowledgedDir = join(ipcRoot, 'acknowledged');
const archiveDir = join(ipcRoot, 'archive');

async function writeJsonAtomic(path, value) {
  await fsp.mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(temp, path);
}
async function readJson(path, fallback = null) {
  try { return JSON.parse(await fsp.readFile(path, 'utf8')); } catch { return fallback; }
}
function safeName(id) { return String(id || '').replace(/[^A-Za-z0-9._-]/g, '_'); }
function fileFor(dir, id) { return join(dir, `${safeName(id)}.json`); }

export function deliveryIdempotencyKey(messageId, purpose = 'final') {
  if (!String(messageId || '').trim()) throw new Error('message_id is required');
  return createHash('sha256').update(`aiw-${purpose}:${messageId}`).digest('hex').slice(0, 32);
}

export async function ensureIpcDirs() {
  await Promise.all([jobsDir, resultsDir, claimsDir, deliveredDir, deliveryClaimsDir, progressDir, progressClaimsDir, progressDeliveredDir, acceptedDir, acknowledgedDir, archiveDir].map((path) => fsp.mkdir(path, { recursive: true })));
}

const progressStages = new Set(['understanding', 'planning', 'executing', 'verifying', 'finalizing']);
export function validateProgressEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Progress event must be an object');
  for (const key of ['eventId', 'jobId', 'originalMessageId', 'conversationId', 'stage', 'message']) if (!String(event[key] || '').trim()) throw new Error(`Progress missing ${key}`);
  if (!progressStages.has(event.stage)) throw new Error('Progress stage is invalid');
  if (!Number.isFinite(Number(event.createdAt)) || Number(event.createdAt) <= 0) throw new Error('Progress createdAt is invalid');
  if (String(event.message).length > 500) throw new Error('Progress message is too long');
  const serialized = JSON.stringify(event);
  if (/(?:prompt|token|pid|api[_-]?key|secret|authorization|internal[_ -]?reasoning)/i.test(serialized)) throw new Error('Progress contains forbidden internal data');
  return { eventId: String(event.eventId), jobId: String(event.jobId), originalMessageId: String(event.originalMessageId), conversationId: String(event.conversationId), stage: event.stage, message: String(event.message), createdAt: Number(event.createdAt) };
}
export async function enqueueProgress(event) {
  await ensureIpcDirs();
  const value = validateProgressEvent(event); const target = fileFor(progressDir, value.eventId);
  try { const handle = await fsp.open(target, 'wx'); try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); } finally { await handle.close(); } return true; }
  catch (error) { if (error.code === 'EEXIST') return false; throw error; }
}
export async function listProgress() {
  await ensureIpcDirs(); const items = [];
  for (const name of (await fsp.readdir(progressDir)).filter((item) => item.endsWith('.json')).sort()) { const item = await readJson(join(progressDir, name)); if (item) items.push({ ...item, _path: join(progressDir, name) }); }
  return items.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}
export async function wasProgressDelivered(eventId) { return exists(progressDeliveredDir, eventId); }
export async function claimProgress(eventId, metadata = {}) {
  await ensureIpcDirs(); if (await wasProgressDelivered(eventId)) return false; const target = fileFor(progressClaimsDir, eventId);
  try { const handle = await fsp.open(target, 'wx'); try { await handle.writeFile(`${JSON.stringify({ eventId, claimedAt: Date.now(), attempts: Number(metadata.attempts || 1), ...metadata }, null, 2)}\n`, 'utf8'); } finally { await handle.close(); } return true; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error; const current = await readJson(target, {}); const staleMs = Number(process.env.AIW_PROGRESS_CLAIM_STALE_MS || 5000);
    if (Date.now() - Number(current.claimedAt || 0) <= staleMs || Number(current.attempts || 1) >= Number(process.env.AIW_PROGRESS_MAX_ATTEMPTS || 3)) return false;
    await fsp.rm(target, { force: true }); return claimProgress(eventId, { ...metadata, attempts: Number(current.attempts || 1) + 1 });
  }
}
export async function releaseProgressClaim(eventId) { await fsp.rm(fileFor(progressClaimsDir, eventId), { force: true }); }
export async function recordProgressFailure(eventId, metadata = {}) {
  const target = fileFor(progressClaimsDir, eventId); const current = await readJson(target, {});
  await writeJsonAtomic(target, { eventId, claimedAt: Date.now(), attempts: Number(current.attempts || 1), failedAt: Date.now(), ...metadata });
}
export async function markProgressDelivered(event, metadata = {}) {
  await ensureIpcDirs(); const target = fileFor(progressDeliveredDir, event.eventId);
  try { const handle = await fsp.open(target, 'wx'); try { await handle.writeFile(`${JSON.stringify({ eventId: event.eventId, jobId: event.jobId, deliveredAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8'); } finally { await handle.close(); } }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await fsp.rm(event._path || fileFor(progressDir, event.eventId), { force: true }); await releaseProgressClaim(event.eventId);
}

function exists(dir, messageId) { return fs.existsSync(fileFor(dir, messageId)); }

export async function messageState(messageId) {
  await ensureIpcDirs();
  const acceptedRecord = await readJson(fileFor(acceptedDir, messageId), null);
  return {
    accepted: Boolean(acceptedRecord),
    acceptedAt: Number(acceptedRecord?.acceptedAt || acceptedRecord?.receivedAt || 0),
    acknowledged: exists(acknowledgedDir, messageId),
    job: exists(jobsDir, messageId),
    claim: exists(claimsDir, messageId),
    result: exists(resultsDir, messageId),
    delivered: exists(deliveredDir, messageId),
  };
}

export async function markAcknowledged(messageId, metadata = {}) {
  await ensureIpcDirs();
  const target = fileFor(acknowledgedDir, messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try { await handle.writeFile(`${JSON.stringify({ messageId, acknowledgedAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

export async function wasAcknowledged(messageId) {
  return exists(acknowledgedDir, messageId);
}

export async function acceptMessageOnce(messageId, metadata = {}) {
  if (!messageId) throw new Error('message_id is required');
  await ensureIpcDirs();
  const target = fileFor(acceptedDir, messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify({ messageId, acceptedAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

export async function acceptAndEnqueueJob(job, metadata = {}) {
  if (!job?.messageId) throw new Error('message_id is required');
  const accepted = await acceptMessageOnce(job.messageId, { ...job, ...metadata, originalMessageId: job.originalMessageId || job.messageId });
  if (!accepted) {
    const state=await messageState(job.messageId);
    if(!state.job&&!state.claim&&!state.result&&!state.delivered){const recovered=await recoverAcceptedJob(job);return {accepted:false,enqueued:recovered,recovered,state:await messageState(job.messageId)};}
    return { accepted: false, enqueued: false, state };
  }
  if (process.env.AIW_TEST_CRASH_AFTER_ACCEPT === '1') throw Object.assign(new Error('injected crash after accept'), { code: 'AIW_TEST_CRASH_AFTER_ACCEPT' });
  const enqueued = await enqueueJob(job);
  return { accepted: true, enqueued, state: await messageState(job.messageId) };
}

export async function enqueueJob(job) {
  await ensureIpcDirs();
  const target = fileFor(jobsDir, job.messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try { await handle.writeFile(`${JSON.stringify(job, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

export async function recoverAcceptedJob(job, { recoveryMaxAgeMs = 10 * 60 * 1000, nowMs = Date.now() } = {}) {
  if (!job?.messageId) throw new Error('message_id is required');
  await ensureIpcDirs();
  const accepted = await readJson(fileFor(acceptedDir, job.messageId), null);
  if (!accepted) return false;
  const acceptedAt = Number(accepted.acceptedAt || accepted.receivedAt || 0);
  if (!acceptedAt || nowMs - acceptedAt > recoveryMaxAgeMs) return false;
  if ([jobsDir, claimsDir, resultsDir, deliveredDir].some((dir) => fs.existsSync(fileFor(dir, job.messageId)))) return false;
  return enqueueJob({ ...job, ...accepted, messageId: job.messageId, originalMessageId: accepted.originalMessageId || job.originalMessageId || job.messageId, acceptedAt });
}

async function archiveFile(path, category, messageId, reason) {
  if (!fs.existsSync(path)) return false;
  const targetDir = join(archiveDir, category);
  await fsp.mkdir(targetDir, { recursive: true });
  const target = join(targetDir, `${safeName(messageId)}.${Date.now()}.${safeName(reason)}.json`);
  await fsp.rename(path, target);
  return true;
}

export async function reconcileIpcState({ nowMs = Date.now(), recoveryMaxAgeMs = 10 * 60 * 1000 } = {}) {
  await ensureIpcDirs();
  const report = { recoveredJobs: [], archivedJobs: [], archivedClaims: [], cleanedResults: [] };
  const acceptedNames = (await fsp.readdir(acceptedDir)).filter((name) => name.endsWith('.json'));
  for (const name of acceptedNames) {
    const accepted = await readJson(join(acceptedDir, name), null);
    if (!accepted?.messageId) continue;
    const state = await messageState(accepted.messageId);
    if (state.delivered) {
      if (state.result) {
        await fsp.rm(fileFor(resultsDir, accepted.messageId), { force: true });
        report.cleanedResults.push(accepted.messageId);
      }
      await fsp.rm(fileFor(jobsDir, accepted.messageId), { force: true });
      await fsp.rm(fileFor(claimsDir, accepted.messageId), { force: true });
      continue;
    }
    if (state.result || state.job || state.claim) continue;
    const acceptedAt = Number(accepted.acceptedAt || accepted.receivedAt || 0);
    if (!acceptedAt || nowMs - acceptedAt > recoveryMaxAgeMs) continue;
    if (!accepted.text || !accepted.chatId) continue;
    const recovered = await enqueueJob({
      messageId: accepted.messageId,
      originalMessageId: accepted.messageId,
      eventId: accepted.eventId || '',
      chatId: accepted.chatId,
      conversationId: accepted.conversationId || accepted.chatId,
      openId: accepted.openId || '',
      text: accepted.text,
      receivedAt: Number(accepted.receivedAt || acceptedAt),
      acceptedAt,
      recoveredAt: nowMs,
    });
    if (recovered) report.recoveredJobs.push(accepted.messageId);
  }

  const jobNames = (await fsp.readdir(jobsDir)).filter((name) => name.endsWith('.json'));
  for (const name of jobNames) {
    const path = join(jobsDir, name);
    const job = await readJson(path, null);
    if (!job?.messageId) continue;
    const state = await messageState(job.messageId);
    const age = nowMs - Number(job.acceptedAt || job.receivedAt || 0);
    if (state.delivered || age > recoveryMaxAgeMs || !state.accepted) {
      const reason = state.delivered ? 'already_delivered' : age > recoveryMaxAgeMs ? 'stale' : 'orphan';
      if (await archiveFile(path, 'jobs', job.messageId, reason)) report.archivedJobs.push(job.messageId);
      if (state.claim && await archiveFile(fileFor(claimsDir, job.messageId), 'claims', job.messageId, 'paired_job_archived')) report.archivedClaims.push(job.messageId);
    }
  }

  const claimNames = (await fsp.readdir(claimsDir)).filter((name) => name.endsWith('.json'));
  for (const name of claimNames) {
    const path = join(claimsDir, name);
    const claim = await readJson(path, null);
    if (!claim?.messageId) continue;
    if (!exists(jobsDir, claim.messageId) || nowMs - Number(claim.claimedAt || 0) > recoveryMaxAgeMs) {
      if (await archiveFile(path, 'claims', claim.messageId, 'stale_or_orphan')) report.archivedClaims.push(claim.messageId);
    }
  }
  return report;
}

export async function listJobs() {
  await ensureIpcDirs();
  const names = (await fsp.readdir(jobsDir)).filter((name) => name.endsWith('.json')).sort();
  const jobs = [];
  for (const name of names) {
    const path = join(jobsDir, name);
    const item = await readJson(path);
    if (item) jobs.push({ ...item, _path: path, _name: name });
  }
  return jobs.sort((a, b) => Number(a.acceptedAt || 0) - Number(b.acceptedAt || 0));
}

export async function claimJob(job, workerId) {
  await ensureIpcDirs();
  const claim = fileFor(claimsDir, job.messageId);
  try {
    const handle = await fsp.open(claim, 'wx');
    try { await handle.writeFile(`${JSON.stringify({ messageId: job.messageId, originalMessageId: job.originalMessageId || job.messageId, workerId, claimedAt: Date.now() }, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const current = await readJson(claim, {});
    const staleMs = Number(process.env.AIW_WORKER_CLAIM_STALE_MS || 150000);
    if (Date.now() - Number(current.claimedAt || 0) <= staleMs) return false;
    await fsp.rm(claim, { force: true });
    return claimJob(job, workerId);
  }
}

export async function completeJob(job, result) {
  await ensureIpcDirs();
  const target = fileFor(resultsDir, job.messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try { await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  await fsp.rm(job._path || fileFor(jobsDir, job.messageId), { force: true });
  await fsp.rm(fileFor(claimsDir, job.messageId), { force: true });
}

export async function releaseClaim(messageId) {
  await fsp.rm(fileFor(claimsDir, messageId), { force: true });
}

export async function listResults() {
  await ensureIpcDirs();
  const names = (await fsp.readdir(resultsDir)).filter((name) => name.endsWith('.json')).sort();
  const results = [];
  for (const name of names) {
    const path = join(resultsDir, name);
    const item = await readJson(path);
    if (item) results.push({ ...item, _path: path, _name: name });
  }
  return results.sort((a, b) => Number(a.finishedAt || 0) - Number(b.finishedAt || 0));
}

export async function claimResultDelivery(messageId, metadata = {}) {
  await ensureIpcDirs();
  if (exists(deliveredDir, messageId)) return false;
  const target = fileFor(deliveryClaimsDir, messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try { await handle.writeFile(`${JSON.stringify({ messageId, deliveryKey: deliveryIdempotencyKey(messageId), claimedAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    if (exists(deliveredDir, messageId)) { await fsp.rm(target, { force: true }); return false; }
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const current = await readJson(target, {});
    const staleMs = Number(process.env.AIW_DELIVERY_CLAIM_STALE_MS || 150000);
    if (Date.now() - Number(current.claimedAt || 0) <= staleMs) return false;
    await fsp.rm(target, { force: true });
    return claimResultDelivery(messageId, metadata);
  }
}

export async function releaseResultDelivery(messageId) {
  await fsp.rm(fileFor(deliveryClaimsDir, messageId), { force: true });
}

export async function markDelivered(result, metadata = {}) {
  await ensureIpcDirs();
  const marker = fileFor(deliveredDir, result.messageId);
  try {
    const handle = await fsp.open(marker, 'wx');
    try { await handle.writeFile(`${JSON.stringify({ messageId: result.messageId, deliveredAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  await fsp.rm(result._path || fileFor(resultsDir, result.messageId), { force: true });
  await releaseResultDelivery(result.messageId);
}

export async function wasDelivered(messageId) {
  return fs.existsSync(fileFor(deliveredDir, messageId));
}

export async function writeWorkerState(state) {
  await ensureIpcDirs();
  await writeJsonAtomic(workerStatePath, { ...state, updatedAt: Date.now() });
}

export async function readWorkerState() { return readJson(workerStatePath, {}); }
export { jobsDir, resultsDir, claimsDir, deliveredDir, acceptedDir, acknowledgedDir, archiveDir, dedupePath };
