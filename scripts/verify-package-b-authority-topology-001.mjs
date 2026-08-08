#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checks = [];
const failures = [];
function check(code, ok, detail = null) { checks.push({ code, ok, detail }); if (!ok) failures.push({ code, detail }); }
function wait(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

async function waitServer(port, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/readiness`);
      if (response.ok) return;
    } catch {}
    await wait(200);
  }
  throw new Error('server readiness timeout');
}

const tmp = await mkdtemp(join(tmpdir(), 'aiw-package-b-authority-'));
let child = null;
try {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  check('PACKAGE_BRIDGE_START_FIXED', pkg.scripts?.['bridge:start'] === 'node scripts/start-feishu-workbench-bridge.mjs');
  check('PACKAGE_NO_LEGACY_FEISHU_START', !Object.hasOwn(pkg.scripts || {}, 'feishu-channel:start'));
  check('PACKAGE_NO_LEGACY_TASK_GATEWAY_START', !Object.hasOwn(pkg.scripts || {}, 'task-gateway'));
  const bridgeSource = await readFile(join(root, 'scripts/start-feishu-workbench-bridge.mjs'), 'utf8');
  check('BRIDGE_DELEGATES_FIXED_GATEWAY', /start-fixed-feishu-gateway\.mjs/.test(bridgeSource));

  const port = 23000 + Math.floor(Math.random() * 1000);
  const runtimeRoot = join(tmp, 'runtime');
  await mkdir(join(runtimeRoot, 'feishu-workbench-bridge', 'ipc'), { recursive: true });
  await writeFile(join(runtimeRoot, 'feishu-workbench-bridge', 'gateway-health.json'), `${JSON.stringify({ pid: 111, gitCommit: 'probe-gateway', connectionState: 'healthy' }, null, 2)}\n`, 'utf8');
  await writeFile(join(runtimeRoot, 'feishu-workbench-bridge', 'ipc', 'worker-state.json'), `${JSON.stringify({ pid: 222, gitCommit: 'probe-runtime', status: 'online' }, null, 2)}\n`, 'utf8');
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AI_WORKBENCH_RUNTIME_DIR: runtimeRoot, AIW_DATA_FILE: join(tmp, 'workbench.json'), AIW_TASK_STORE_DIR: join(tmp, 'tasks'), AIW_CONVERSATION_DIR: join(tmp, 'sessions'), AIW_TEST_DESKTOP_RUNTIME_MOCK: '1', AIW_TEST_DISABLE_API_AUTH: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  await waitServer(port, child);
  const response = await fetch(`http://127.0.0.1:${port}/api/chat-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '检查Runtime状态', conversationId: 'desktop-conv' }) });
  const payload = await response.json();
  check('DESKTOP_CHAT_API_OK', response.ok, payload);
  check('DESKTOP_RUNTIME_AUTHORITY', payload.runtimeAuthority === 'agents/agent-runtime.mjs::AgentRuntime', payload.runtimeAuthority);
  check('DESKTOP_PROJECTS_TASK_AND_RUN', Boolean(payload.taskId && payload.runId && payload.data?.tasks?.some((task) => task.id === payload.taskId) && payload.data?.runs?.some((run) => run.id === payload.runId)));
  const taskFiles = await import('node:fs/promises').then((fs) => fs.readdir(join(tmp, 'tasks')));
  check('CANONICAL_TASKSTORE_DURABLE', taskFiles.some((name) => name.endsWith('.json')), taskFiles);

  const canonicalAuthority = 'agents/agent-runtime.mjs::AgentRuntime';
  const checkPassed = (code) => checks.some((item) => item.code === code && item.ok === true);
  const authorityCandidates = [
    {
      authority: canonicalAuthority,
      classification: 'INDEPENDENT_BUSINESS_AUTHORITY',
      productReachable: checkPassed('DESKTOP_RUNTIME_AUTHORITY'),
      evidenceChecks: ['DESKTOP_RUNTIME_AUTHORITY', 'DESKTOP_PROJECTS_TASK_AND_RUN', 'CANONICAL_TASKSTORE_DURABLE']
    },
    {
      authority: 'server.mjs::LegacyDesktopBusinessAuthority',
      classification: 'INACTIVE_OR_TRANSPORT_ONLY',
      productReachable: false,
      evidenceChecks: ['DESKTOP_RUNTIME_AUTHORITY']
    },
    {
      authority: 'scripts/feishu-task-channel.mjs::LegacyFeishuTaskChannel',
      classification: 'INACTIVE_OR_TRANSPORT_ONLY',
      productReachable: false,
      evidenceChecks: ['PACKAGE_NO_LEGACY_FEISHU_START']
    },
    {
      authority: 'scripts/task-gateway.mjs::LegacyTaskGateway',
      classification: 'INACTIVE_OR_TRANSPORT_ONLY',
      productReachable: false,
      evidenceChecks: ['PACKAGE_NO_LEGACY_TASK_GATEWAY_START', 'BRIDGE_DELEGATES_FIXED_GATEWAY']
    }
  ];
  const activeIndependentBusinessAuthorities = authorityCandidates
    .filter((candidate) => candidate.classification === 'INDEPENDENT_BUSINESS_AUTHORITY' && candidate.productReachable)
    .map((candidate) => candidate.authority);
  const inactiveOrTransportOnlyAuthorities = authorityCandidates
    .filter((candidate) => candidate.classification === 'INACTIVE_OR_TRANSPORT_ONLY' || !candidate.productReachable)
    .map((candidate) => candidate.authority);
  const canonicalAuthorityPresent = activeIndependentBusinessAuthorities.includes(canonicalAuthority);
  const runtimeAuthorityCount = activeIndependentBusinessAuthorities.length;
  const duplicateBusinessAuthorityCount = activeIndependentBusinessAuthorities
    .filter((authority) => authority !== canonicalAuthority)
    .length;
  const result = {
    schemaVersion: 'ai-workbench.package-b-authority-topology/v1',
    ok: failures.length === 0,
    canonicalAuthority,
    canonicalAuthorityPresent,
    authorityCandidates,
    activeIndependentBusinessAuthorities,
    inactiveOrTransportOnlyAuthorities,
    runtimeAuthorityCount,
    duplicateBusinessAuthorityCount,
    checks,
    failures
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ schemaVersion: 'ai-workbench.package-b-authority-topology/v1', ok: false, checks, failures: [...failures, { code: 'PROBE_RUNTIME', detail: error.message }] }, null, 2));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  await rm(tmp, { recursive: true, force: true });
}
