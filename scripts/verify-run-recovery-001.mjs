import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-run-recovery-'));
process.env.AIW_FEISHU_IPC_DIR = root;
const ipc = await import(`./feishu-worker-ipc.mjs?recovery=${Date.now()}`);
const job = { messageId: 'run-recovery', originalMessageId: 'run-recovery', chatId: 'chat', conversationId: 'chat', text: 'resume after crash', receivedAt: 1000, acceptedAt: 1000 };
await ipc.acceptMessageOnce(job.messageId, job);
await ipc.enqueueJob(job);
assert.equal(await ipc.claimJob(job, 'dead-worker'), true);
const claimPath = join(root, 'claims', 'run-recovery.json');
const claim = JSON.parse(await fs.readFile(claimPath, 'utf8'));
await fs.writeFile(claimPath, JSON.stringify({ ...claim, claimedAt: 1000, renewedAt: 1000 }));

assert.deepEqual(await ipc.recoverExpiredRunClaims({ nowMs: 1500, staleMs: 1000 }), []);
assert.equal((await ipc.messageState(job.messageId)).claim, true);
assert.deepEqual(await ipc.recoverExpiredRunClaims({ nowMs: 3000, staleMs: 1000 }), [job.messageId]);
assert.equal((await ipc.messageState(job.messageId)).claim, false);
assert.equal((await ipc.messageState(job.messageId)).job, true);
assert.equal(await ipc.claimJob(job, 'replacement-worker'), true);
const replacement = JSON.parse(await fs.readFile(claimPath, 'utf8'));
assert.equal(replacement.workerId, 'replacement-worker');

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, module: 'RUN-RECOVERY-001', freshRunPreserved: true, expiredRunReleased: true, jobRetained: true, replacementWorkerCanResume: true }));
