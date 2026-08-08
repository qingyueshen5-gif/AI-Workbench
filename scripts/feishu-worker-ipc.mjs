import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runtimeRoot } from '../runtime-paths.mjs';
import { TaskStore, TERMINAL_TASK_STATES } from '../channels/task-store.mjs';

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

export function deliveryIdempotencyKey(messageId, purpose = 'final', identity = {}) {
  if (!String(messageId || '').trim()) throw new Error('message_id is required');
  const scope = purpose === 'final'
    ? `${identity.channelAccount || 'feishu'}:${identity.originalMessageId || messageId}:${identity.taskId || ''}:${identity.taskRevision ?? ''}`
    : `${identity.channelAccount || 'feishu'}:${identity.originalMessageId || messageId}:${identity.progressEventId || identity.eventId || ''}`;
  return createHash('sha256').update(`aiw-${purpose}:${scope}`).digest('hex').slice(0, 32);
}

export async function ensureIpcDirs() {
  await Promise.all([jobsDir, resultsDir, claimsDir, deliveredDir, deliveryClaimsDir, progressDir, progressClaimsDir, progressDeliveredDir, acceptedDir, acknowledgedDir, archiveDir].map((path) => fsp.mkdir(path, { recursive: true })));
}

const progressStages = new Set(['understanding', 'planning', 'executing', 'verifying', 'finalizing']);
export function validateProgressEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Progress event must be an object');
  for (const key of ['eventId', 'jobId', 'originalMessageId', 'conversationId', 'stage', 'message']) if (!String(event[key] || '').trim()) throw new Error(`Progress missing ${key}`);
  const progressEventId = String(event.progressEventId || event.eventId || '').trim();
  if (!progressEventId) throw new Error('Progress missing progressEventId');
  if (!progressStages.has(event.stage)) throw new Error('Progress stage is invalid');
  if (!Number.isFinite(Number(event.createdAt)) || Number(event.createdAt) <= 0) throw new Error('Progress createdAt is invalid');
  if (String(event.message).length > 500) throw new Error('Progress message is too long');
  const serialized = JSON.stringify(event);
  if (/(?:prompt|token|pid|api[_-]?key|secret|authorization|internal[_ -]?reasoning)/i.test(serialized)) throw new Error('Progress contains forbidden internal data');
  return { eventId: String(event.eventId), progressEventId, jobId: String(event.jobId), taskId: String(event.taskId || event.jobId), runId: String(event.runId || ''), attemptId: String(event.attemptId || ''), leaseOwner: String(event.leaseOwner || ''), taskRevision: Number.isFinite(Number(event.taskRevision)) ? Number(event.taskRevision) : null, originalMessageId: String(event.originalMessageId), channelAccount: String(event.channelAccount || 'feishu'), conversationId: String(event.conversationId), stage: event.stage, message: String(event.message), createdAt: Number(event.createdAt) };
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

async function commitTerminalResultOnce(messageId, result) {
  const target = fileFor(resultsDir, messageId);
  try {
    const handle = await fsp.open(target, 'wx');
    try { await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

async function failTaskIfPresent(taskId, reason, evidence = {}) {
  const store = new TaskStore();
  const task = await store.load(taskId);
  if (!task || TERMINAL_TASK_STATES.has(task.currentState)) return false;
  if (task.activeRunId) {
    const run = task.runs.find((item) => item.runId === task.activeRunId);
    if (run) {
      await store.failActiveRunAndTask(task.taskId, {
        runId: run.runId,
        attemptId: run.attemptId,
        leaseOwner: run.leaseOwner,
        taskRevision: run.taskRevision
      }, {
        failure: { errorCode: 'IPC_RECONCILIATION_FAILED', failureStage: 'runtime_internal', failureClassification: 'runtime_failure', message: reason, evidence }
      });
      return true;
    }
  }
  await store.transitionTask(task.taskId, task.currentState, 'failed', reason, 'feishu-ipc-reconcile', evidence);
  await store.patch(task.taskId, { failure: { errorCode: 'IPC_RECONCILIATION_FAILED', failureStage: 'runtime_internal', failureClassification: 'runtime_failure', message: reason, taskId: task.taskId, taskRevision: task.taskRevision + 1, failedAt: Date.now(), evidence } }).catch(() => {});
  return true;
}

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
    if (!acceptedAt || nowMs - acceptedAt > recoveryMaxAgeMs) {
      const taskId = accepted.taskId || accepted.messageId;
      const failedTask = await failTaskIfPresent(taskId, 'stale_accepted_terminal_fail_closed', { messageId: accepted.messageId, acceptedAt });
      const committed = await commitTerminalResultOnce(accepted.messageId, {
        messageId: accepted.messageId,
        originalMessageId: accepted.originalMessageId || accepted.messageId,
        channelAccount: accepted.channelAccount || 'feishu',
        conversationId: accepted.conversationId || accepted.chatId || '',
        chatId: accepted.chatId || '',
        ok: false,
        text: 'Runtime did not accept this request before the recovery window expired.',
        terminalState: 'failed',
        errorClass: 'StaleAccepted',
        failClosed: true,
        taskId,
        taskFailed: failedTask,
        finishedAt: nowMs
      });
      if (committed) report.cleanedResults.push(accepted.messageId);
      continue;
    }
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
      await failTaskIfPresent(job.taskId || job.messageId, `orphan_job_archived_${reason}`, { messageId: job.messageId, age, accepted: state.accepted }).catch(() => {});
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

export async function recoverExpiredRunClaims({ nowMs = Date.now(), staleMs = Number(process.env.AIW_WORKER_CLAIM_STALE_MS || 150000) } = {}) {
  await ensureIpcDirs();
  const recovered = [];
  for (const name of (await fsp.readdir(claimsDir)).filter((item) => item.endsWith('.json'))) {
    const path = join(claimsDir, name);
    const claim = await readJson(path, null);
    if (!claim?.messageId || !exists(jobsDir, claim.messageId)) continue;
    const heartbeat = Number(claim.renewedAt || claim.claimedAt || 0);
    if (heartbeat && nowMs - heartbeat <= staleMs) continue;
    await archiveFile(path, 'claims', claim.messageId, 'expired_run_lease');
    recovered.push(claim.messageId);
  }
  return recovered;
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

function sameRunIdentity(current = {}, identity = {}) {
  if (!identity || !identity.runId) return true;
  if (!current || typeof current !== 'object') return false;
  return current.workerId === identity.leaseOwner
    && current.runId === identity.runId
    && current.attemptId === identity.attemptId
    && Number(current.taskRevision) === Number(identity.taskRevision);
}

export async function claimJob(job, workerId) {
  await ensureIpcDirs();
  const claim = fileFor(claimsDir, job.messageId);
  try {
    const handle = await fsp.open(claim, 'wx');
    try { await handle.writeFile(`${JSON.stringify({ messageId: job.messageId, originalMessageId: job.originalMessageId || job.messageId, taskId: job.taskId || job.messageId, workerId, leaseOwner: workerId, runId: '', attemptId: '', taskRevision: null, claimedAt: Date.now(), renewedAt: Date.now() }, null, 2)}\n`, 'utf8'); }
    finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const current = await readJson(claim, {});
    const staleMs = Number(process.env.AIW_WORKER_CLAIM_STALE_MS || 150000);
    if (Date.now() - Number(current.renewedAt || current.claimedAt || 0) <= staleMs) return false;
    await fsp.rm(claim, { force: true });
    return claimJob(job, workerId);
  }
}

export async function renewJobClaim(messageId, workerId, metadata = {}) {
  const path = fileFor(claimsDir, messageId);
  const current = await readJson(path, null);
  if (!current || current.workerId !== workerId) return false;
  if (metadata.runId && !sameRunIdentity(current, { ...metadata, leaseOwner: workerId })) return false;
  await writeJsonAtomic(path, { ...current, ...metadata, messageId, workerId, renewedAt: Date.now() });
  return true;
}

export async function bindJobClaimToRun(messageId, workerId, identity = {}) {
  const path = fileFor(claimsDir, messageId);
  const current = await readJson(path, null);
  if (!current || current.workerId !== workerId) return false;
  const leaseOwner = String(identity.leaseOwner || workerId);
  if (leaseOwner !== workerId) return false;
  await writeJsonAtomic(path, { ...current, workerId, leaseOwner, runId: String(identity.runId || ''), attemptId: String(identity.attemptId || ''), taskRevision: Number(identity.taskRevision), taskId: String(identity.taskId || current.taskId || messageId), renewedAt: Date.now() });
  return true;
}

export async function completeJob(job, result, identity = null) {
  await ensureIpcDirs();
  const currentClaim = await readJson(fileFor(claimsDir, job.messageId), null);
  if (identity && !sameRunIdentity(currentClaim, identity)) throw new Error('Stale worker cannot complete current claim');
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

export async function releaseClaim(messageId, identity = null) {
  if (identity) {
    const currentClaim = await readJson(fileFor(claimsDir, messageId), null);
    if (!sameRunIdentity(currentClaim, identity)) return false;
  }
  await fsp.rm(fileFor(claimsDir, messageId), { force: true });
  return true;
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
    try { await handle.writeFile(`${JSON.stringify({ messageId, deliveryKey: deliveryIdempotencyKey(messageId, 'final', metadata), claimedAt: Date.now(), ...metadata }, null, 2)}\n`, 'utf8'); }
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
