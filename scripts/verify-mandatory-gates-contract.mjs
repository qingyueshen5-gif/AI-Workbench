import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const required = [
  'verify-checkpoint-protection-001.mjs','scan-git-destructive-bypasses.mjs','verify-execution-protocol-checkpoint.mjs','verify-authorization-boundary-001.mjs','verify-feishu-delivery-idempotency-001.mjs','verify-ipc-acceptance-recovery-001.mjs','verify-run-lease-001.mjs','verify-task-atomicity-001.mjs','verify-provider-control-001.mjs','verify-run-recovery-001.mjs','verify-task-lifecycle-001.mjs','verify-runtime-cancellation-gate.mjs','verify-v1-critical-high-gates.mjs','verify-ipc-closed-loop.mjs','verify-minimal-progress-protocol.mjs','verify-gateway-runtime-switch.mjs','verify-gateway-runtime-business-boundary.mjs','verify.mjs'
];
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
assert.equal(pkg.scripts.verify, 'node scripts/verify-mandatory-gates-001.mjs');
assert.equal(pkg.scripts['verify:product'], 'node scripts/verify.mjs');
const source = await fs.readFile('scripts/verify-mandatory-gates-001.mjs', 'utf8');
for (const script of required) assert.match(source, new RegExp(script.replaceAll('.', '\\.')));
assert.match(source, /deployment: 'BLOCKED'/);
assert.match(source, /process\.exit\(1\)/);
assert.match(source, /if \(!result\.ok\)/);
console.log(JSON.stringify({ ok: true, module: 'MANDATORY-GATES-001', requiredGateCount: required.length, standardVerifyMandatory: true, failClosedDeployment: true }));
