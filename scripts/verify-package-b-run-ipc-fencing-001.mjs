#!/usr/bin/env node
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const checks = [];
const failures = [];
function check(code, ok, detail = null) { checks.push({ code, ok, detail }); if (!ok) failures.push({ code, detail }); }

const tmp = await mkdtemp(join(tmpdir(), 'aiw-package-b-ipc-'));
try {
  process.env.AI_WORKBENCH_RUNTIME_DIR = join(tmp, 'runtime');
  process.env.AIW_FEISHU_IPC_DIR = join(tmp, 'runtime', 'feishu-workbench-bridge', 'ipc');
  process.env.AIW_TASK_STORE_DIR = join(tmp, 'tasks');
  const ipc = await import(`./feishu-worker-ipc.mjs?package_b=${Date.now()}`);
  const { TaskStore } = await import(`../channels/task-store.mjs?package_b=${Date.now()}`);
  const tasks = new TaskStore({ root: join(tmp, 'tasks'), newRunId: (() => { let i = 0; return () => `run-${++i}`; })() });
  const job = { messageId: 'msg-1', originalMessageId: 'msg-1', conversationId: 'conv-1', chatId: 'conv-1', text: 'hello', taskId: 'task-1' };
  await tasks.create(job);
  await ipc.enqueueJob(job);
  check('CLAIM_CREATED', await ipc.claimJob(job, 'worker-a'));
  let task = await tasks.load('task-1');
  task = await tasks.transitionTask(task.taskId, task.currentState, 'interpreting', 'probe', 'probe', {});
  task = await tasks.transitionTask(task.taskId, task.currentState, 'scheduling', 'probe', 'probe', {});
  task = await tasks.transitionTask(task.taskId, task.currentState, 'ready', 'probe', 'probe', {});
  task = await tasks.transitionTask(task.taskId, task.currentState, 'executing', 'probe', 'probe', {});
  task = await tasks.startRun(task.taskId, { expectedTaskRevision: task.taskRevision, leaseOwner: 'worker-a', providerId: 'probe-provider' });
  const run = task.runs.find((item) => item.runId === task.activeRunId);
  const identity = { taskId: task.taskId, runId: run.runId, attemptId: run.attemptId, leaseOwner: run.leaseOwner, taskRevision: task.taskRevision };
  check('CLAIM_BINDS_RUN', await ipc.bindJobClaimToRun(job.messageId, 'worker-a', identity));
  check('STALE_RENEW_REJECTED', await ipc.renewJobClaim(job.messageId, 'worker-b', identity) === false);
  let staleCompleteRejected = false;
  try { await ipc.completeJob(job, { ok: true }, { ...identity, leaseOwner: 'worker-b' }); } catch { staleCompleteRejected = true; }
  check('STALE_COMPLETE_REJECTED', staleCompleteRejected);
  check('STALE_RELEASE_REJECTED', await ipc.releaseClaim(job.messageId, { ...identity, leaseOwner: 'worker-b' }) === false);
  await tasks.transitionRun(task.taskId, { ...identity, from: 'created', to: 'starting' });
  await tasks.transitionRun(task.taskId, { ...identity, from: 'starting', to: 'running' });
  await tasks.bindRunVerification(task.taskId, identity, { passed: true, verifierId: 'probe', verificationMethod: 'probe', evidenceReferences: [], verifiedAt: Date.now(), ...identity });
  task = await tasks.load(task.taskId);
  task = await tasks.transitionTask(task.taskId, task.currentState, 'verifying', 'probe_verifying', 'probe', { runId: identity.runId });
  const completed = await tasks.finalizeRun(task.taskId, identity, { finalResult: { messageId: job.messageId, text: 'done', runId: identity.runId, taskRevision: identity.taskRevision }, finalEvidence: { probe: true, ...identity } });
  check('RUN_FINAL_ATOMIC_TERMINAL', completed.currentState === 'completed' && completed.activeRunId === null && completed.runs[0].status === 'completed');
  await ipc.completeJob(job, { messageId: job.messageId, ok: true, text: 'done', ...identity }, identity);
  check('RESULT_WRITTEN_ON_CURRENT_IDENTITY', (await ipc.listResults()).length === 1);

  const stale = { messageId: 'stale-accepted', originalMessageId: 'stale-accepted', conversationId: 'conv-1', chatId: 'conv-1', text: 'old', taskId: 'stale-accepted', acceptedAt: 1 };
  await tasks.create(stale);
  await writeFile(join(ipc.acceptedDir, 'stale-accepted.json'), `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
  await ipc.reconcileIpcState({ nowMs: 60_000, recoveryMaxAgeMs: 10 });
  await ipc.reconcileIpcState({ nowMs: 60_001, recoveryMaxAgeMs: 10 });
  const staleResults = (await ipc.listResults()).filter((item) => item.messageId === 'stale-accepted');
  const staleTask = await tasks.load('stale-accepted');
  check('STALE_ACCEPTED_TERMINAL_EXACTLY_ONCE', staleResults.length === 1 && staleResults[0].failClosed === true);
  check('STALE_ACCEPTED_TASK_FAILED', staleTask.currentState === 'failed');

  const result = { schemaVersion: 'ai-workbench.package-b-run-ipc-fencing/v1', ok: failures.length === 0, checks, failures };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ schemaVersion: 'ai-workbench.package-b-run-ipc-fencing/v1', ok: false, checks, failures: [...failures, { code: 'PROBE_RUNTIME', detail: error.message }] }, null, 2));
  process.exitCode = 1;
} finally {
  await rm(tmp, { recursive: true, force: true });
}
