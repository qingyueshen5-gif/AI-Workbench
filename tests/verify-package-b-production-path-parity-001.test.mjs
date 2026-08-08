import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const script = resolve(root, 'scripts/verify-package-b-production-path-parity-001.mjs');

test('Package B production path parity probe fails legacy starts closed', () => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', shell: false });
  const payload = JSON.parse(result.stdout);
  assert.equal(result.status, 0, JSON.stringify(payload.failures));
  assert.equal(payload.ok, true);
  assert.equal(payload.currentProductionBindingProven, false);
});
