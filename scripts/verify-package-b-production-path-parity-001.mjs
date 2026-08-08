#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checks = [];
const failures = [];
function check(code, ok, detail = null) { checks.push({ code, ok, detail }); if (!ok) failures.push({ code, detail }); }

const tmp = await mkdtemp(join(tmpdir(), 'aiw-package-b-parity-'));
try {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  check('PRODUCTION_BRIDGE_SINGLE_ENTRY', pkg.scripts?.['bridge:start'] === 'node scripts/start-feishu-workbench-bridge.mjs');
  check('NO_STANDALONE_RUNTIME_PACKAGE_START', !Object.hasOwn(pkg.scripts || {}, 'bridge:runtime'));
  check('NO_STANDALONE_FEISHU_PACKAGE_START', !Object.hasOwn(pkg.scripts || {}, 'bridge:feishu'));
  const fixed = await readFile(resolve(root, 'scripts/start-fixed-feishu-gateway.mjs'), 'utf8');
  check('FIXED_GATEWAY_STARTS_ADAPTER', /workbench-feishu-adapter\.mjs/.test(fixed));
  check('FIXED_GATEWAY_STARTS_SUPERVISOR', /runtime-supervisor\.mjs/.test(fixed));
  check('FIXED_GATEWAY_WRITES_BINDING', /ipc-bindings\.json/.test(fixed) && /allMatch:\s*true/.test(fixed));

  const legacyChannel = spawnSync(process.execPath, ['scripts/feishu-task-channel.mjs', 'start'], { cwd: root, encoding: 'utf8', env: { ...process.env, FEISHU_APP_ID: 'dummy', FEISHU_APP_SECRET: 'dummy' }, shell: false });
  check('LEGACY_FEISHU_START_FAILS_CLOSED', legacyChannel.status !== 0 && /disabled/.test(`${legacyChannel.stdout}${legacyChannel.stderr}`), { status: legacyChannel.status, stderr: legacyChannel.stderr });
  const legacyGateway = spawnSync(process.execPath, ['scripts/task-gateway.mjs', 'list'], { cwd: root, encoding: 'utf8', shell: false });
  check('LEGACY_TASK_GATEWAY_CLI_FAILS_CLOSED', legacyGateway.status !== 0 && /legacy_task_gateway_cli_disabled/.test(`${legacyGateway.stdout}${legacyGateway.stderr}`), { status: legacyGateway.status, stderr: legacyGateway.stderr });
  process.env.AI_WORKBENCH_RUNTIME_DIR = join(tmp, 'runtime');
  process.env.AIW_FEISHU_IPC_DIR = join(tmp, 'runtime', 'feishu-workbench-bridge', 'ipc');
  const adapter = await import(`./workbench-feishu-adapter.mjs?package_b=${Date.now()}`);
  check('PRODUCTION_ADAPTER_PARSE_API_AVAILABLE', typeof adapter.parseFeishuMessage === 'function');
  check('PRODUCTION_ADAPTER_AUTH_API_AVAILABLE', typeof adapter.authorizeFeishuSender === 'function');

  const result = { schemaVersion: 'ai-workbench.package-b-production-path-parity/v1', ok: failures.length === 0, checks, failures, currentProductionBindingProven: false, releaseBindingIsolatedProof: true };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ schemaVersion: 'ai-workbench.package-b-production-path-parity/v1', ok: false, checks, failures: [...failures, { code: 'PROBE_RUNTIME', detail: error.message }], currentProductionBindingProven: false }, null, 2));
  process.exitCode = 1;
} finally {
  await rm(tmp, { recursive: true, force: true });
}
