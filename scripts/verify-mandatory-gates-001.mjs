import { spawn } from 'node:child_process';

export const existingMandatoryGates = [
  ['Checkpoint Protection', 'scripts/verify-checkpoint-protection-001.mjs'],
  ['Git Destructive Bypass Scan', 'scripts/scan-git-destructive-bypasses.mjs'],
  ['Execution Protocol Checkpoint Rules', 'scripts/verify-execution-protocol-checkpoint.mjs'],
  ['External Skill Drift', 'scripts/verify-external-skill-drift-001.mjs'],
  ['Save Decoupled From Gate', 'scripts/verify-save-decoupled-from-gate-001.mjs'],
  ['Authorization Boundary', 'scripts/verify-authorization-boundary-001.mjs'],
  ['Feishu Delivery Idempotency', 'scripts/verify-feishu-delivery-idempotency-001.mjs'],
  ['IPC Acceptance Recovery', 'scripts/verify-ipc-acceptance-recovery-001.mjs'],
  ['Run Lease', 'scripts/verify-run-lease-001.mjs'],
  ['Task Atomicity', 'scripts/verify-task-atomicity-001.mjs'],
  ['Provider Control', 'scripts/verify-provider-control-001.mjs'],
  ['Run Recovery', 'scripts/verify-run-recovery-001.mjs'],
  ['Task Lifecycle', 'scripts/verify-task-lifecycle-001.mjs'],
  ['Cancellation', 'scripts/verify-runtime-cancellation-gate.mjs'],
  ['Critical/High', 'scripts/verify-v1-critical-high-gates.mjs'],
  ['IPC Closed Loop', 'scripts/verify-ipc-closed-loop.mjs'],
  ['Progress', 'scripts/verify-minimal-progress-protocol.mjs'],
  ['Runtime Switch', 'scripts/verify-gateway-runtime-switch.mjs'],
  ['Gateway Pure Transport', 'scripts/verify-gateway-runtime-business-boundary.mjs'],
  ['Existing Product Regression', 'scripts/verify.mjs'],
];
export const step7SpecialistGates = [
  ['Run API Verified Injection Rejection', 'scripts/verify-run-api-verified-injection-rejection-001.mjs'],
  ['Data Import Verified Injection Rejection', 'scripts/verify-data-import-verified-injection-rejection-001.mjs'],
  ['Legacy Persisted Verified Claim Fail Closed', 'scripts/verify-legacy-persisted-verified-claim-fail-closed-001.mjs'],
  ['Isolated Verification Not Business Verified', 'scripts/verify-isolated-run-verification-not-business-verified-001.mjs'],
  ['Server Owned Run Fact Preservation', 'scripts/verify-server-owned-run-fact-preservation-001.mjs'],
  ['UI Writable DTO', 'scripts/verify-ui-writable-dto-001.mjs'],
  ['Run Trust Path Rejection Baseline', 'scripts/verify-run-trust-path-rejection-baseline-001.mjs'],
  ['Trust Field Protocol Path Matching', 'scripts/verify-trust-field-protocol-path-matching-001.mjs'],
  ['Workbench Context Trust Boundary', 'scripts/verify-workbench-context-verified-trust-boundary-001.mjs'],
  ['Agent Context Injection Rejection', 'scripts/verify-agent-context-injection-rejection-001.mjs'],
  ['UI Run Status Verification Separation', 'scripts/verify-ui-run-status-verification-separation-001.mjs'],
  ['Verified Assignment Invariant', 'scripts/verify-verified-assignment-invariant-001.mjs'],
];
export const step7LegacyGates = [
  ['Legacy Memories Trust Semantics', 'scripts/verify-memories.mjs'],
  ['Legacy Verification Layer Trust Semantics', 'scripts/verify-verification-layer.mjs'],
  ['Legacy Tasks Runs Trust Semantics', 'scripts/verify-tasks-runs.mjs'],
];
export const mandatoryGates = [...existingMandatoryGates, ...step7SpecialistGates, ...step7LegacyGates];

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: false });
    child.once('error', (error) => resolve({ ok: false, code: null, error: error.message }));
    child.once('exit', (code, signal) => resolve({ ok: code === 0, code, signal: signal || null }));
  });
}

const results = [];
for (const [name, script] of mandatoryGates) {
  process.stdout.write(`\n[MANDATORY GATE] ${name} -> ${script}\n`);
  const result = await run(script);
  results.push({ name, script, started: true, completed: true, skipped: false, ...result });
  if (!result.ok) {
    process.stderr.write(`${JSON.stringify({ ok: false, module: 'MANDATORY-GATES-STEP7-001', deployment: 'BLOCKED', executionMode: 'SEQUENTIAL', failureMode: 'FAIL_FAST', requiredGateCount: mandatoryGates.length, allRequiredGatesStarted: false, allRequiredGatesCompleted: false, missingGateCount: 0, duplicateGateCount: mandatoryGates.length-new Set(mandatoryGates.map(x=>x[0])).size, skippedGateCount: 0, firstFailure: results.at(-1), completed: results.slice(0,-1).map(x=>x.name) }, null, 2)}\n`);
    process.exit(1);
  }
}
process.stdout.write(`${JSON.stringify({ ok: true, module: 'MANDATORY-GATES-STEP7-001', deployment: 'GATE_PASSED_NOT_DEPLOYED', executionMode: 'SEQUENTIAL', failureMode: 'FAIL_FAST', requiredGateCount: mandatoryGates.length, existingMandatoryGateCount: existingMandatoryGates.length, specialistGateCount: step7SpecialistGates.length, legacyGateCount: step7LegacyGates.length, allRequiredGatesStarted: results.length===mandatoryGates.length, allRequiredGatesCompleted: results.every(x=>x.completed&&x.ok), missingGateCount: mandatoryGates.filter(([,script])=>!script).length, duplicateGateCount: mandatoryGates.length-new Set(mandatoryGates.map(x=>x[0])).size, skippedGateCount: results.filter(x=>x.skipped).length, firstFailure: null, gates: results.map(({name,script,code})=>({name,script,exitCode:code})) }, null, 2)}\n`);
