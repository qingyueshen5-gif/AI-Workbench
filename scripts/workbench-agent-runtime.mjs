import fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { bindJobClaimToRun, claimJob, completeJob, enqueueProgress, ensureIpcDirs, listJobs, recoverExpiredRunClaims, releaseClaim, renewJobClaim, writeWorkerState } from './feishu-worker-ipc.mjs';
const runtimeEventsPath = join(process.env.AI_WORKBENCH_RUNTIME_DIR || join(process.env.APPDATA || process.env.USERPROFILE || process.cwd(), 'ai-workbench'), 'feishu-workbench-bridge', 'events.jsonl');
async function runtimeEvent(type, payload = {}) { await fs.mkdir(dirname(runtimeEventsPath), { recursive: true }); await fs.appendFile(runtimeEventsPath, `${JSON.stringify({ at: new Date().toISOString(), type, payload })}\n`, 'utf8'); }
import { createHash } from 'node:crypto';
import { TaskStore, TERMINAL_TASK_STATES } from '../channels/task-store.mjs';
import { loadApprovedDeepSeekEnv } from './load-approved-deepseek-env.mjs';

loadApprovedDeepSeekEnv();

const root = process.cwd();
const tasks = new TaskStore();
const allowedRoots = [...new Set([root, ...(process.env.AIW_ASSISTANT_ALLOWED_ROOTS || '').split(';').filter(Boolean)])];
const statusPath = join(process.env.AI_WORKBENCH_RUNTIME_DIR || join(process.env.APPDATA || process.env.USERPROFILE || root, 'ai-workbench'), 'feishu-workbench-bridge', 'status.json');
const healthStatusKeys = new Set(['backend','languageModel','deepseek','computerExecutor','codex','localTools','aiLink','hermes','runtimePid','projectRoot','gitCommit','latestError']);
async function patchStatus(patch) {
  let current = {};
  try { current = JSON.parse(await fs.readFile(statusPath, 'utf8')); } catch {}
  const parent = dirname(statusPath);
  await fs.mkdir(parent, { recursive: true });
  const healthPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => healthStatusKeys.has(key)));
  const next = { ...current, ...healthPatch, updatedAt: new Date().toISOString() };
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
  onRunStarted: async ({ job, identity }) => {
    if (job) job.__runIdentity = identity;
    if (job?.messageId && job?.workerId) await bindJobClaimToRun(job.messageId, job.workerId, identity);
  },
  onProgress: async (progress) => { const task=await tasks.load(progress.taskId||progress.jobId);const gate=shouldStopJobForActiveTask({taskId:progress.taskId||progress.jobId,messageId:progress.originalMessageId,originalMessageId:progress.originalMessageId},task);if(gate.shouldStop){await runtimeEvent('progress_suppressed',{eventId:progress.eventId,taskId:gate.taskId,reason:gate.reason});return;}await enqueueProgress(progress);await runtimeEvent('progress_generated', { eventId: progress.eventId, jobId: progress.jobId, stage: progress.stage, createdAt: progress.createdAt }); },
  onStage: async (job, stage) => { await runtimeEvent('job_stage', { messageId: job.messageId, taskId: job.taskId, stage, atMs: Date.now(), runtimePid: process.pid }); await patchStatus({ codex: stage === 'executing' ? 'busy' : undefined }); }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runningJobs=new Map();
export function shouldStopJobForActiveTask(job, task) {
  const taskId = String(job.taskId || job.messageId || '');
  const originalMessageId = String(job.originalMessageId || job.messageId || '');
  const sameTask = Boolean(task && task.taskId === taskId && task.originalMessageId === originalMessageId);
  const terminalState = sameTask ? String(task.currentState || '') : '';
  const shouldStop = sameTask && terminalState === 'cancelled' && task.cancelledByUser === true;
  return { shouldStop, reason: shouldStop ? 'task_cancelled_by_user' : sameTask ? 'task_not_cancelled' : 'different_task', taskId, terminalState, sameTask, cancelled: shouldStop, blocked: shouldStop };
}
export function shouldSuppressCompletedResult(job,task,result={}){const gate=shouldStopJobForActiveTask(job,task);return gate.shouldStop||(!result.controlKind&&task?.originalMessageId===(job.originalMessageId||job.messageId)&&TERMINAL_TASK_STATES.has(task.currentState)&&!task.finalResult);}
async function executeClaimedJob(job,workerId) {
  let runIdentity=null;
  const claimedJob={...job,workerId,leaseOwner:workerId,channelAccount:job.channelAccount||'feishu'};
  const leaseTimer=setInterval(()=>renewJobClaim(job.messageId,workerId,{runtimePid:process.pid,...(runIdentity||{})}).catch(()=>{}),Number(process.env.AIW_RUN_LEASE_RENEW_MS||30000));
  leaseTimer.unref?.();
  try {
    const result=await runtime.handle(claimedJob);
    runIdentity=claimedJob.__runIdentity||runIdentity;
    if(result?.runId)runIdentity={runId:result.runId,attemptId:result.attemptId,leaseOwner:result.leaseOwner||workerId,taskRevision:result.taskRevision,taskId:result.taskId||job.taskId||job.messageId};
    const task=await tasks.load(job.taskId||job.messageId);
    const stale=shouldSuppressCompletedResult(job,task,result);
    const finishedAt=Date.now();
    const payload=stale
      ? {messageId:job.messageId,originalMessageId:job.originalMessageId||job.messageId,conversationId:job.conversationId||job.chatId,chatId:job.chatId,ok:false,text:'',suppressed:true,errorClass:'Superseded',finishedAt}
      : {messageId:job.messageId,originalMessageId:job.originalMessageId||job.messageId,channelAccount:result.channelAccount||job.channelAccount||'feishu',conversationId:job.conversationId||job.chatId,chatId:job.chatId,ok:true,text:result.text,provider:result.provider,providerSessionId:result.providerSessionId,toolUsed:result.toolUsed,verified:result.verified,taskId:result.taskId||job.taskId||job.messageId,runId:result.runId||'',attemptId:result.attemptId||'',leaseOwner:result.leaseOwner||workerId,taskRevision:result.taskRevision??null,controlKind:result.controlKind||'',...(result.activeTaskId?{activeTaskId:result.activeTaskId}:{}),classification:result.classification||null,finishedAt};
    await completeJob(job,payload,runIdentity);
    await runtimeEvent(stale?'result_suppressed':'result_generated',{messageId:job.messageId,finishedAt,provider:result.provider,toolUsed:result.toolUsed,verified:result.verified});
    if(!stale)await patchStatus({latestError:'',deepseek:'online',codex:'online',localTools:'online'});
  } catch(error) {
    await completeJob(job,{messageId:job.messageId,originalMessageId:job.originalMessageId||job.messageId,conversationId:job.conversationId||job.chatId,chatId:job.chatId,ok:false,text:'Runtime did not complete this request.',errorClass:error.name||'Error',finishedAt:Date.now()},runIdentity);
    await patchStatus({codex:'online',latestError:error.message||String(error)});
  } finally { clearInterval(leaseTimer);await releaseClaim(job.messageId,runIdentity).catch(()=>{});runningJobs.delete(job.messageId); }
}
export async function supervisorLoop() {
  await acquireRuntimeLock();
  await ensureIpcDirs();
  await recoverExpiredRunClaims();
  const workerId = `workbench-runtime-${process.pid}`;
  const health = await runtime.models.healthCheck();
  if (!health.deepseek?.ok) {
    await patchStatus({ backend: 'online', languageModel: 'DeepSeek', deepseek: 'offline', computerExecutor: 'Codex', codex: health.codex?.ok ? 'online' : 'offline', localTools: 'online', aiLink: 'not_used', hermes: 'not_used', runtimePid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', latestError: health.deepseek?.error || 'DeepSeek provider is not ready' });
  }
  if (!health.codex?.ok || health.codex.authClass !== 'chatgpt_subscription') throw new Error('Codex subscription provider is not ready');
  await writeWorkerState({
    workerId, pid: process.pid, status: 'online', role: 'ai-workbench-agent-runtime', gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '',
    projectRoot: root,
    chain: ['Feishu Adapter', 'AI Workbench Runtime', 'DeepSeek Understanding', 'Codex Executor when required', 'AI Workbench Verifier', 'DeepSeek Expression', 'Feishu Reply Sender'],
    languageModel: { provider: 'deepseek', model: health.deepseek.model, transport: health.deepseek.transport, status: health.deepseek.ok ? 'online' : 'offline' },
    computerExecutor: { provider: 'codex', transport: 'official_cli_subscription', endpoint: null, aiLink: false, hermes: false, authClass: health.codex.authClass, version: health.codex.version }
  });
  await patchStatus({ backend: 'online', languageModel: 'DeepSeek', deepseek: health.deepseek.ok ? 'online' : 'offline', computerExecutor: 'Codex', codex: 'online', localTools: 'online', aiLink: 'not_used', hermes: 'not_used', runtimePid: process.pid, projectRoot: root, gitCommit: process.env.AIW_RUNTIME_GIT_COMMIT || '', latestError: health.deepseek.ok ? '' : (health.deepseek.error || 'DeepSeek provider is not ready') });
  let stopping = false;
  process.once('SIGINT', () => { stopping = true; });
  process.once('SIGTERM', () => { stopping = true; });
  try {
  while (!stopping) {
    for (const job of await listJobs()) {
      const active = await tasks.load(job.taskId || job.messageId);
      const taskGate = shouldStopJobForActiveTask(job, active);
      if (taskGate.shouldStop) {
        await completeJob(job, { taskId: taskGate.taskId, messageId: job.messageId, originalMessageId: job.originalMessageId || job.messageId, conversationId: job.conversationId || job.chatId, chatId: job.chatId, ok: false, text: 'Task was cancelled and will not continue.', terminalState: taskGate.terminalState, errorClass: 'Cancelled', finishedAt: Date.now() });
        continue;
      }
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
