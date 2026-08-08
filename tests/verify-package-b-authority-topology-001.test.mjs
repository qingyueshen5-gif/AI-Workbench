import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const script = resolve(root, 'scripts/verify-package-b-authority-topology-001.mjs');

test('Package B authority topology probe passes through desktop API to AgentRuntime', () => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', shell: false, timeout: 30000 });
  const payload = JSON.parse(result.stdout);
  assert.equal(result.status, 0, JSON.stringify(payload.failures));
  assert.equal(payload.ok, true);
  assert.ok(payload.checks.some((check) => check.code === 'DESKTOP_RUNTIME_AUTHORITY' && check.ok));
});
