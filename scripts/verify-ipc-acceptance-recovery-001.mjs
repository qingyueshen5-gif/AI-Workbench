import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-ipc-acceptance-recovery-'));
process.env.AIW_FEISHU_IPC_DIR = root;
const ipc = await import(`./feishu-worker-ipc.mjs?acceptance=${Date.now()}`);
const base = { messageId: 'accepted-1', originalMessageId: 'accepted-1', eventId: 'event-1', chatId: 'chat-1', conversationId: 'chat-1', openId: 'owner', text: 'recover me', receivedAt: Date.now() };

process.env.AIW_TEST_CRASH_AFTER_ACCEPT = '1';
await assert.rejects(() => ipc.acceptAndEnqueueJob(base, base), /injected crash after accept/);
delete process.env.AIW_TEST_CRASH_AFTER_ACCEPT;
let state = await ipc.messageState(base.messageId);
assert.deepEqual({ accepted: state.accepted, job: state.job, claim: state.claim, result: state.result, delivered: state.delivered }, { accepted: true, job: false, claim: false, result: false, delivered: false });

const replay = await ipc.acceptAndEnqueueJob({ ...base, text: 'event replay must not replace durable payload' }, { ...base, text: 'event replay must not replace durable payload' });
assert.equal(replay.accepted, false);
assert.equal(replay.recovered, true);
const [job] = await ipc.listJobs();
assert.equal(job.text, 'recover me');
assert.equal(job.originalMessageId, base.messageId);

const staleId = 'accepted-stale';
await ipc.acceptMessageOnce(staleId, { ...base, messageId: staleId, originalMessageId: staleId, acceptedAt: 1, receivedAt: 1 });
const report = await ipc.reconcileIpcState({ nowMs: 20 * 60 * 1000, recoveryMaxAgeMs: 10 * 60 * 1000 });
assert.equal(report.recoveredJobs.includes(staleId), false);
assert.equal((await ipc.messageState(staleId)).job, false);

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, module: 'IPC-ACCEPTANCE-RECOVERY-001', acceptBeforeCrashDurable: true, replayRecovery: true, durablePayloadPreserved: true, staleAcceptanceNotRecovered: true }));
