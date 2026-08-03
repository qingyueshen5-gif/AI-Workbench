import assert from 'node:assert/strict';
import { classifyGateFailure, validateCheckpointState } from './checkpoint-state-model.mjs';

const scenarios = [];
function pass(name, fn) { fn(); scenarios.push({ name, ok: true }); }
function rejects(name, fn, pattern) { assert.throws(fn, pattern); scenarios.push({ name, ok: true }); }

pass('01_unsaved_not_run', () => validateCheckpointState({ saveStatus: 'UNSAVED', gateStatus: 'NOT_RUN', finalAcceptance: false, saved: false }));
pass('02_saved_wip_not_gated', () => validateCheckpointState({ saveStatus: 'SAVED', gateStatus: 'WIP_NOT_GATED', finalAcceptance: false, saved: true }));
pass('03_saved_blocked_preserves_save', () => validateCheckpointState({ saveStatus: 'SAVED', gateStatus: 'BLOCKED', finalAcceptance: false, saved: true, failureClassification: 'ENVIRONMENT_OR_DEPENDENCY_FAILURE' }));
pass('04_formal_final_acceptance', () => validateCheckpointState({ saveStatus: 'SAVED', gateStatus: 'GATE_PASSED', finalAcceptance: true, saved: true }));
rejects('05_wip_cannot_claim_final', () => validateCheckpointState({ saveStatus: 'SAVED', gateStatus: 'WIP_NOT_GATED', finalAcceptance: true, saved: true }), /GATE_PASSED|final acceptance/);
rejects('06_saved_boolean_must_match', () => validateCheckpointState({ saveStatus: 'SAVED', gateStatus: 'BLOCKED', finalAcceptance: false, saved: false }), /saved must agree/);
pass('07_environment_classification', () => assert.deepEqual(classifyGateFailure('environment'), { failureClassification: 'ENVIRONMENT_OR_DEPENDENCY_FAILURE', action: 'MINIMAL_REPAIR_AND_RERUN_ALLOWED', gateStatus: 'BLOCKED' }));
pass('08_dependency_classification', () => assert.equal(classifyGateFailure('dependency').failureClassification, 'ENVIRONMENT_OR_DEPENDENCY_FAILURE'));
pass('09_product_classification', () => assert.deepEqual(classifyGateFailure('product'), { failureClassification: 'PRODUCT_OR_SECURITY_FAILURE', action: 'HARD_STOP_NO_ASSERTION_WEAKENING', gateStatus: 'BLOCKED' }));
pass('10_security_classification', () => assert.equal(classifyGateFailure('security').failureClassification, 'PRODUCT_OR_SECURITY_FAILURE'));
pass('11_unknown_classification', () => assert.deepEqual(classifyGateFailure('other'), { failureClassification: 'UNKNOWN_FAILURE', action: 'HARD_STOP_BLOCKED', gateStatus: 'BLOCKED' }));

console.log(JSON.stringify({ ok: true, module: 'SAVE-DECOUPLED-FROM-GATE-001', scenarios }, null, 2));
