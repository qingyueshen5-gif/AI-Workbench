import assert from 'node:assert/strict';
import { checkpointState } from './checkpoint-protection-core.mjs';

assert.deepEqual(checkpointState(), { saveStatus: 'UNSAVED', gateStatus: 'NOT_RUN', finalAcceptance: false, saved: false });
assert.deepEqual(checkpointState({ saveStatus: 'SAVED', saved: true, gateStatus: 'WIP_NOT_GATED', finalAcceptance: false }), { saveStatus: 'SAVED', gateStatus: 'WIP_NOT_GATED', finalAcceptance: false, saved: true });
assert.deepEqual(checkpointState({ saveStatus: 'SAVED', saved: true, gateStatus: 'GATE_PASSED', finalAcceptance: true }), { saveStatus: 'SAVED', gateStatus: 'GATE_PASSED', finalAcceptance: true, saved: true });
assert.deepEqual(checkpointState({ gateStatus: 'BLOCKED' }), { saveStatus: 'UNSAVED', gateStatus: 'BLOCKED', finalAcceptance: false, saved: false });
for (const input of [
  { saveStatus: 'SAVED', saved: true, gateStatus: 'WIP_NOT_GATED', finalAcceptance: true },
  { saveStatus: 'SAVED', saved: true, gateStatus: 'BLOCKED', finalAcceptance: true },
  { saveStatus: 'SAVED', saved: true, gateStatus: 'NOT_RUN', finalAcceptance: true },
  { saveStatus: 'UNSAVED', saved: false, gateStatus: 'GATE_PASSED', finalAcceptance: true }
]) assert.throws(() => checkpointState(input));

console.log(JSON.stringify({ ok: true, module: 'CHECKPOINT-MANIFEST-INTEGRITY-001', defaults: checkpointState(), explicitWipPreserved: true, explicitPassPreserved: true, illegalCombinationsRejected: 4 }));
