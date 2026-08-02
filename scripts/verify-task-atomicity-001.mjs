import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../channels/task-store.mjs';

const root = await fs.mkdtemp(join(os.tmpdir(), 'aiw-task-atomicity-'));
const store = new TaskStore({ root });
await store.create({ taskId: 'atomic', messageId: 'atomic', originalMessageId: 'atomic', conversationId: 'conversation' });

const transitions = await Promise.allSettled([
  store.transitionTask('atomic', 'accepted', 'interpreting', 'first', 'worker-a', { sequence: 1 }),
  store.transitionTask('atomic', 'accepted', 'cancelled', 'second', 'worker-b', { sequence: 2 })
]);
assert.equal(transitions.filter((item) => item.status === 'fulfilled').length, 1);
assert.equal(transitions.filter((item) => item.status === 'rejected').length, 1);
assert.match(transitions.find((item) => item.status === 'rejected').reason.message, /Task state conflict/);
const afterTransition = await store.load('atomic');
assert.equal(afterTransition.stateHistory.length, 2);
assert.equal(afterTransition.evidence.filter((item) => item.type === 'state_transition').length, 1);

await Promise.all([
  store.patch('atomic', { providerExecution: { provider: 'one' } }),
  store.patch('atomic', { verification: { verified: true } })
]);
const afterPatch = await store.load('atomic');
assert.equal(afterPatch.providerExecution.provider, 'one');
assert.equal(afterPatch.verification.verified, true);

await fs.rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, module: 'TASK-ATOMICITY-001', competingTransitionSingleWinner: true, noLostPatchUpdate: true, historyConsistent: true }));