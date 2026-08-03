import assert from 'node:assert/strict';

export const saveStatuses = Object.freeze(['UNSAVED', 'SAVED']);
export const gateStatuses = Object.freeze(['NOT_RUN', 'WIP_NOT_GATED', 'GATE_PASSED', 'BLOCKED']);
export const failureClasses = Object.freeze([
  'ENVIRONMENT_OR_DEPENDENCY_FAILURE',
  'PRODUCT_OR_SECURITY_FAILURE',
  'UNKNOWN_FAILURE'
]);

export function validateCheckpointState(input) {
  const state = {
    saveStatus: input.saveStatus,
    gateStatus: input.gateStatus,
    finalAcceptance: input.finalAcceptance === true,
    saved: input.saved === true,
    failureClassification: input.failureClassification ?? null
  };
  assert.ok(saveStatuses.includes(state.saveStatus), `invalid saveStatus: ${state.saveStatus}`);
  assert.ok(gateStatuses.includes(state.gateStatus), `invalid gateStatus: ${state.gateStatus}`);
  assert.equal(state.saved, state.saveStatus === 'SAVED', 'saved must agree with saveStatus');
  if (state.finalAcceptance) {
    assert.equal(state.saveStatus, 'SAVED', 'final acceptance requires SAVED');
    assert.equal(state.gateStatus, 'GATE_PASSED', 'final acceptance requires GATE_PASSED');
  }
  if (state.gateStatus === 'WIP_NOT_GATED') assert.equal(state.finalAcceptance, false, 'WIP cannot be final acceptance');
  if (state.failureClassification !== null) assert.ok(failureClasses.includes(state.failureClassification), `invalid failure classification: ${state.failureClassification}`);
  return state;
}

export function classifyGateFailure(kind) {
  if (kind === 'environment' || kind === 'dependency') return { failureClassification: 'ENVIRONMENT_OR_DEPENDENCY_FAILURE', action: 'MINIMAL_REPAIR_AND_RERUN_ALLOWED', gateStatus: 'BLOCKED' };
  if (kind === 'product' || kind === 'security') return { failureClassification: 'PRODUCT_OR_SECURITY_FAILURE', action: 'HARD_STOP_NO_ASSERTION_WEAKENING', gateStatus: 'BLOCKED' };
  return { failureClassification: 'UNKNOWN_FAILURE', action: 'HARD_STOP_BLOCKED', gateStatus: 'BLOCKED' };
}
