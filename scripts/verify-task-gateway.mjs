import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const tmpRoot = fs.mkdtempSync(join(tmpdir(), 'aiw-task-gateway-'));
const repo = join(tmpRoot, 'repo');
const runtime = join(tmpRoot, 'runtime');
process.env.AI_WORKBENCH_RUNTIME_DIR = runtime;
process.env.AIW_TASK_GATEWAY_DIR = join(runtime, 'task-gateway');
process.env.AIW_TASK_GATEWAY_CODEX_ADAPTER = 'mock';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repo,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...(options.env || {}) },
  });
  if (options.allowFailure) return result;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

await fsp.mkdir(repo, { recursive: true });
run('git', ['init'], { cwd: repo });
run('git', ['config', 'user.email', 'gateway-test@example.invalid'], { cwd: repo });
run('git', ['config', 'user.name', 'Gateway Test'], { cwd: repo });
await fsp.writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { verify: 'node -e "true"' } }, null, 2), 'utf8');
await fsp.writeFile(join(repo, 'README.md'), '# test\n', 'utf8');
await fsp.mkdir(join(repo, 'src'), { recursive: true });
await fsp.writeFile(join(repo, 'src', 'index.js'), 'console.log("ok");\n', 'utf8');
run('git', ['add', '.'], { cwd: repo });
run('git', ['commit', '-m', 'init'], { cwd: repo });
const head = run('git', ['rev-parse', 'HEAD'], { cwd: repo }).stdout.trim();

const gateway = await import(`./task-gateway.mjs?verify=${Date.now()}`);

const launcherDir = join(tmpRoot, 'launcher path with spaces');
await fsp.mkdir(launcherDir, { recursive: true });
const fixtureCmd = join(launcherDir, 'fixture launcher.cmd');
const injectionMarker = join(launcherDir, 'INJECTED.txt');
await fsp.writeFile(fixtureCmd, [
  '@echo off',
  'echo ARGS:%*',
  'echo CWD:%CD%',
  'set /p LINE=',
  'echo STDIN:%LINE%',
  'echo STDERR:%~1 1>&2',
  'if "%~1"=="fail" exit /b 7',
  'if "%~1"=="sleep" powershell.exe -NoProfile -Command "Start-Sleep -Seconds 5"',
  'exit /b 0',
].join('\r\n'), 'utf8');

const launcherSuccess = await gateway.spawnCapture(fixtureCmd, ['arg one', `safe&echo injected>${injectionMarker}`], {
  cwd: launcherDir,
  input: 'stdin payload\n',
  timeoutMs: 5000,
});
assert.equal(launcherSuccess.ok, true);
assert.equal(launcherSuccess.code, 0);
assert.match(launcherSuccess.stdout, /ARGS:"arg one" "safe&echo injected>/);
assert.match(launcherSuccess.stdout, /CWD:.*launcher path with spaces/);
assert.match(launcherSuccess.stdout, /STDIN:stdin payload/);
assert.match(launcherSuccess.stderr, /STDERR:arg one/);
assert.equal(fs.existsSync(injectionMarker), false);

const launcherFailure = await gateway.spawnCapture(fixtureCmd, ['fail'], {
  cwd: launcherDir,
  input: 'stdin payload\n',
  timeoutMs: 5000,
});
assert.equal(launcherFailure.ok, false);
assert.equal(launcherFailure.code, 7);

const launcherTimeout = await gateway.spawnCapture(fixtureCmd, ['sleep'], {
  cwd: launcherDir,
  input: 'stdin payload\n',
  timeoutMs: 100,
});
assert.equal(launcherTimeout.ok, false);
assert.equal(launcherTimeout.timedOut, true);

const launcherSpec = gateway.buildSpawnSpec(fixtureCmd, ['--flag'], { cwd: launcherDir });
assert.equal(launcherSpec.usesComSpec, process.platform === 'win32');
assert.equal(launcherSpec.shell, false);
assert.equal(JSON.stringify(launcherSpec).includes('secret prompt'), false);

const prompt = join(tmpRoot, 'prompt.md');
await fsp.writeFile(prompt, 'Read git status only.\n', 'utf8');
const card = {
  task_id: 'verify-readonly',
  title: 'Readonly smoke',
  role: 'testing_quality',
  repository: repo,
  baseline_head: head,
  prompt_file: prompt,
  allowed_paths: [],
  forbidden_paths: ['managed-proxy', 'secrets'],
  requires_codex: true,
  max_codex_runs: 1,
  max_retries: 0,
  concurrency_group: 'verify',
  approval_required: true,
  acceptance_commands: [],
  stop_conditions: ['no push', 'no deploy'],
};
const cardFile = join(tmpRoot, 'card.json');
await fsp.writeFile(cardFile, JSON.stringify(card, null, 2), 'utf8');

const task = await gateway.createTask(cardFile);
assert.equal(task.status, 'waiting_approval');
assert.equal(task.role, 'testing_quality');
assert.throws(() => gateway.assertTransition('draft', 'running'), /Illegal status transition/);

await assert.rejects(() => gateway.runTask(task.task_id), /not approved/);
let approved = await gateway.approveTask(task.task_id);
assert.equal(approved.status, 'approved');
let completed = await gateway.runTask(task.task_id);
assert.equal(completed.status, 'completed');
assert.equal(completed.codex_run_count, 1);
assert.ok(completed.branch.startsWith('task-gateway/'));
assert.ok(completed.worktree.includes('verify-readonly'));
await assert.rejects(() => gateway.runTask(task.task_id), /max_codex_runs/);
const logs = await gateway.readLogs(task.task_id);
assert.ok(logs.some((event) => event.type === 'codex_finished'));

const redacted = gateway.redact(`Authori${'zation'}: Bearer abcdefghijklmnopqrstuvwxyz\npass${'word'}=supersecretvalue\nC:\\Users\\Someone\\file.txt`);
assert.ok(!redacted.includes('abcdefghijklmnopqrstuvwxyz'));
assert.ok(!redacted.includes('supersecretvalue'));

assert.equal(gateway.classifyCodexFailure('quota exceeded'), 'codex_quota_or_billing');
assert.equal(gateway.classifyCodexFailure('auth failed'), 'codex_auth_failed');
assert.throws(() => gateway.checkScope({ allowed_paths: ['src'], forbidden_paths: ['src/private'] }, ['src/private/key.txt']), /Forbidden path/);
assert.throws(() => gateway.checkScope({ allowed_paths: ['src'], forbidden_paths: [] }, ['README.md']), /outside allowed_paths/);

const mismatchCard = {
  ...card,
  task_id: 'baseline-mismatch',
  baseline_head: '0000000000000000000000000000000000000000',
};
const mismatchFile = join(tmpRoot, 'mismatch.json');
await fsp.writeFile(mismatchFile, JSON.stringify(mismatchCard, null, 2), 'utf8');
await gateway.createTask(mismatchFile);
await gateway.approveTask('baseline-mismatch');
const mismatch = await gateway.runTask('baseline-mismatch');
assert.equal(mismatch.status, 'blocked');
assert.equal(mismatch.blocked_reason, 'baseline_mismatch');

const failCard = { ...card, task_id: 'quota-failure', baseline_head: head };
const failFile = join(tmpRoot, 'quota.json');
await fsp.writeFile(failFile, JSON.stringify(failCard, null, 2), 'utf8');
await gateway.createTask(failFile);
await gateway.approveTask('quota-failure');
process.env.AIW_TASK_GATEWAY_MOCK_MODE = 'quota';
const failed = await gateway.runTask('quota-failure');
assert.equal(failed.status, 'failed');
assert.equal(failed.blocked_reason, 'codex_quota_or_billing');
process.env.AIW_TASK_GATEWAY_MOCK_MODE = 'success';

const cancellableCard = { ...card, task_id: 'cancel-before-run', baseline_head: head };
const cancellableFile = join(tmpRoot, 'cancel.json');
await fsp.writeFile(cancellableFile, JSON.stringify(cancellableCard, null, 2), 'utf8');
await gateway.createTask(cancellableFile);
const cancelled = await gateway.cancelTask('cancel-before-run');
assert.equal(cancelled.status, 'cancelled');

await gateway.cleanupTask('verify-readonly');
assert.equal(fs.existsSync(completed.worktree), false);

const listed = await gateway.listTasks();
assert.ok(listed.length >= 4);
const contract = gateway.codexContract();
assert.equal(contract.command, 'codex.cmd');
assert.ok(contract.arguments.includes('--json'));
assert.ok(contract.arguments.includes('read-only'));
assert.equal(contract.arguments.includes('--ask-for-approval'), false);

console.log(JSON.stringify({
  status: 'passed',
  tmpRoot,
  covered: [
    'task_card_parsing',
    'required_fields',
    'status_transitions',
    'approval_gate',
    'baseline_mismatch',
    'branch_generation',
    'worktree_isolation',
    'max_codex_runs',
    'cancel',
    'codex_failure',
    'quota_billing_classification',
    'stdout_stderr_events',
    'log_redaction',
    'forbidden_paths',
    'no_push_or_deploy_by_gateway',
    'cleanup_boundary',
    'windows_cmd_launcher',
    'cmd_path_with_spaces',
    'launcher_stdin_stdout_stderr',
    'launcher_exit_code',
    'launcher_timeout_cancel',
    'launcher_shell_injection_guard',
    'prompt_not_in_command_log'
  ]
}, null, 2));
