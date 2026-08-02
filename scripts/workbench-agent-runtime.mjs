import fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { claimJob, completeJob, enqueueProgress, ensureIpcDirs, listJobs, releaseClaim, writeWorkerState } from './feishu-worker-ipc.mjs';
const runtimeEventsPath = join(process.env.AI_WORKBENCH_RUNTIME_DIR || join(process.env.APPDATA || process.env.USERPROFILE || process.cwd(), 'ai-workbench'), 'feishu-workbench-bridge', 'events.jsonl');
async function runtimeEvent(type, payload = {}) { await fs.mkdir(dirname(runtimeEventsPath), { recursive: true }); await fs.appendFile(runtimeEventsPath, `${JSON.stringify({ at: new Date().toISOString(), type, payload })}\n`, 'utf8'); }
import { createHash } from 'node:crypto';
import { ActiveTaskStore } from '../channels/active-task-store.mjs';
import { loadApprovedDeepSeekEnv } from './load-approved-deepseek-env.mjs';

loadApprovedDeepSeekEnv();

const root = process.cwd();
const activeTasks = new ActiveTaskStore();
const allowedRoots = [...new Set([root, ...(process.env.AIW_ASSISTANT_ALLOWED_ROOTS || '').split(';').filter(Boolean)])];
const statusPath = join(process.env.AI_WORKBENCH_RUNTIME_DIR || join(process.env.APPDATA || process.env.USERPROFILE || root, 'ai-workbench'), 'feishu-workbench-bridge', 'status.json');
async function patchStatus(patch) {
  let current = {};
  try { current = JSON.parse(await fs.readFile(statusPath, 'utf8')); } catch {}
  const parent = dirname(statusPath);
  await fs.mkdir(parent, { recursive: true });
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const tmp = `${statusPath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, statusPath);
}
const runtimeLockPath = join(process.env.AI_WORKBENCH_RUNTIME_DIR || join(process.env.APPDATA || process.env.USERPROFILE || root, 'ai-workbench'), 'feishu-workbench-bridge', 'locks', 'runtime.lock');
async function acquireRuntimeLock() {
  await fs.mkdir(dirname(runtimeLockPath), { recursive: true });
  try {
    const handle = await fs.open(runtimeLockPath, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, projectRoot: root, startedAt: Date.now() })}\n`);
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let current = {};
    try { current = JSON.parse(await fs.readFile(runtimeLockPath, 'utf8')); } catch {}
    try { process.kill(Number(current.pid), 0); throw new Error(`AI Workbench Runtime already running: ${current.pid}`); }
    catch (probe) { if (!String(probe.message).startsWith('AI Workbench Runtime already running')) await fs.rm(runtimeLockPath, { force: true }); else throw probe; }
    return acquireRuntimeLock();
  }
}
const runtime = new AgentRuntime({
  root,
  allowedRoots,
  onProgress: async (progress) => { await enqueueProgress(progress); await runtimeEvent('progress_generated', { eventId: progress.eventId, jobId: progress.jobId, stage: progress.stage, createdAt: progress.createdAt }); },
  onStage: async (job, stage) => { await runtimeEvent('job_stage', { messageId: job.messageId, stage, atMs: Date.now(), runtimePid: process.pid }); await patchStatus({ currentStage: stage, latestMessageId: job.messageId, codex: stage === 'executing' ? 'busy' : undefined }); }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runningJobs=new Map();
async function executeClaimedJob(job,workerId) {
  try {
    const result=await runtime.handle(job);
    const active=await activeTasks.load(job.conversationId||job.chatId);
    const stale=!result.controlKind&&active?.originalMessageId===(job.originalMessageId||job.messageId)&&(active.cancelled||active.stage==='failed'||active.paused);
    const finishedAt=Date.now();
    await completeJob(job, stale
      ? {messageId:job.messageId,originalMessageId:job.originalMessageId||job.messageId,conversationId:job.conversationId||job.chatId,chatId:job.chatId,ok:false,text:'',suppressed:true,errorClass:'Superseded',finishedAt}
      : { messageId: job.messageId, originalMessageId: job.originalMessageId || job.messageId, conversationId: job.conversationId || job.chatId, chatId: job.chatId, ok: true, text: result.text, provider: result.provider, providerSessionId: result.providerSessionId, toolUsed: result.toolUsed, verified: result.verified, controlKind: result.controlKind || '', activeTaskId: result.activeTaskId || job.messageId, classification: result.classification || null, finishedAt });
    await runtimeEvent(stale?'result_suppressed':'result_generated',{messageId:job.messageId,finishedAt,provider:result.provider,toolUsed:result.toolUsed,verified:result.verified});
    if(!stale)await patchStatus({ currentStage: 'completed', latestSuccessfulTask: job.messageId, latestError: '', deepseek: 'online', codex: 'online', localTools: 'online' });
  } catch(error) {
    await completeJob(job,{messageId:job.messageId,originalMessageId:job.originalMessageId||job.messageId,conversationId:job.conversationId||job.chatId,chatId:job.chatId,ok:false,text:'这次没有完成，我已经停止。你可以继续发送新消息。',errorClass:error.name||'Error',finishedAt:Date.now()});
    await patchStatus({currentStage:'failed',codex:'online',latestError:error.message||String(error)});
  } finally { await releaseClaim(job.messageId).catch(()=>{});runningJobs.delete(job.messageId); }
}

export async function supervisorLoop() {
  await acquireRuntimeLock();
  await ensureIpcDirs();
  const workerId = `workbench-runtime-${process.pid}`;
  const health = await runtime.models.healthCheck();
  if (!health.deepseek?.ok) {
    await patchStatus({ backend: 'online', languageModel: 'DeepSeek', deepseek: 'offline', computerExecutor: 'Codex', codex: health.codex?.ok ? 'online' : 'offline', localTools: 'online', aiLink: 'not_used', hermes: 'not_used', runtimePid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', currentStage: 'failed', latestError: health.deepseek?.error || 'DeepSeek provider is not ready' });
  }
  if (!health.codex?.ok || health.codex.authClass !== 'chatgpt_subscription') throw new Error('Codex subscription provider is not ready');
  await writeWorkerState({
    workerId, pid: process.pid, status: 'online', role: 'ai-workbench-agent-runtime', gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '',
    projectRoot: root,
    chain: ['Feishu Adapter', 'AI Workbench Runtime', 'DeepSeek Understanding', 'Codex Executor when required', 'AI Workbench Verifier', 'DeepSeek Expression', 'Feishu Reply Sender'],
    languageModel: { provider: 'deepseek', model: health.deepseek.model, transport: health.deepseek.transport, status: health.deepseek.ok ? 'online' : 'offline' },
    computerExecutor: { provider: 'codex', transport: 'official_cli_subscription', endpoint: null, aiLink: false, hermes: false, authClass: health.codex.authClass, version: health.codex.version }
  });
  await patchStatus({ backend: 'online', languageModel: 'DeepSeek', deepseek: health.deepseek.ok ? 'online' : 'offline', computerExecutor: 'Codex', codex: 'online', localTools: 'online', aiLink: 'not_used', hermes: 'not_used', runtimePid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', currentStage: health.deepseek.ok ? 'completed' : 'failed', latestError: health.deepseek.ok ? '' : (health.deepseek.error || 'DeepSeek provider is not ready') });
  let stopping = false;
  process.once('SIGINT', () => { stopping = true; });
  process.once('SIGTERM', () => { stopping = true; });
  try {
  while (!stopping) {
    for (const job of await listJobs()) {
      const active = await activeTasks.load(job.conversationId || job.chatId);
      if (active?.cancelled || active?.stage === 'failed') {
        await completeJob(job, { messageId: job.messageId, originalMessageId: job.originalMessageId || job.messageId, conversationId: job.conversationId || job.chatId, chatId: job.chatId, ok: false, text: '任务已取消，不会继续执行。', errorClass: 'Cancelled', finishedAt: Date.now() });
        continue;
      }
      if (active?.paused || active?.stage === 'paused' || active?.waitingUser) continue;
      if (!(await claimJob(job, workerId))) continue;
      await runtimeEvent('job_claimed', { messageId: job.messageId, claimedAt: Date.now(), workerId, runtimePid: process.pid });
      const execution=executeClaimedJob(job,workerId);
      runningJobs.set(job.messageId,execution);
    }
    await sleep(250);
  }
  } finally { await fs.rm(runtimeLockPath, { force: true }); }
}

async function main() {
  const once = process.argv.indexOf('--job-json');
  if (once >= 0) {
    const result = await runtime.handle(JSON.parse(process.argv[once + 1] || '{}'));
    process.stdout.write(JSON.stringify(result));
    return;
  }
  await supervisorLoop();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
