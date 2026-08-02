import { spawn } from 'node:child_process';

export const mandatoryGates = [
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
  ['Existing Product Regression', 'scripts/verify.mjs']
];

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
    child.once('error', (error) => resolve({ ok: false, code: null, error: error.message }));
    child.once('exit', (code, signal) => resolve({ ok: code === 0, code, signal: signal || null }));
  });
}

const results = [];
for (const [name, script] of mandatoryGates) {
  process.stdout.write(`\n[MANDATORY GATE] ${name} -> ${script}\n`);
  const result = await run(script);
  results.push({ name, script, ...result });
  if (!result.ok) {
    process.stderr.write(`${JSON.stringify({ ok: false, deployment: 'BLOCKED', firstFailure: results.at(-1), completed: results.slice(0, -1).map((item) => item.name) }, null, 2)}\n`);
    process.exit(1);
  }
}
process.stdout.write(`${JSON.stringify({ ok: true, module: 'MANDATORY-GATES-001', deployment: 'GATE_PASSED_NOT_DEPLOYED', gates: results.map(({ name, script }) => ({ name, script })) }, null, 2)}\n`);
