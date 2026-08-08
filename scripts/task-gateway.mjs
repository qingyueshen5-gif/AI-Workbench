import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, basename, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';

const root = process.cwd();
function usableGatewayRoot() {
  if (process.env.AIW_TASK_GATEWAY_DIR) return process.env.AIW_TASK_GATEWAY_DIR;
  const preferred = join(runtimeRoot, 'task-gateway');
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    return join(root, '.task-gateway-runtime');
  }
}

const gatewayRoot = usableGatewayRoot();
const tasksDir = join(gatewayRoot, 'tasks');
const worktreesDir = join(gatewayRoot, 'worktrees');
const locksDir = join(gatewayRoot, 'locks');
const globalMaxConcurrent = Math.min(2, Math.max(1, Number(process.env.AIW_TASK_GATEWAY_MAX_CONCURRENT || 1)));
const validRoles = new Set(['architecture', 'interface', 'multimodal_context', 'security_privacy', 'testing_quality', 'integration', 'research', 'supervisor']);
const validStatuses = new Set(['draft', 'waiting_approval', 'approved', 'preparing', 'running', 'blocked', 'cancelling', 'cancelled', 'completed', 'failed', 'awaiting_integration']);
const terminalStatuses = new Set(['blocked', 'cancelled', 'completed', 'failed', 'awaiting_integration']);
const allowedTransitions = new Map([
  ['draft', new Set(['waiting_approval', 'blocked'])],
  ['waiting_approval', new Set(['approved', 'blocked', 'cancelled'])],
  ['approved', new Set(['preparing', 'blocked', 'cancelled'])],
  ['preparing', new Set(['running', 'blocked', 'failed', 'cancelled'])],
  ['running', new Set(['cancelling', 'completed', 'failed', 'blocked', 'awaiting_integration'])],
  ['cancelling', new Set(['cancelled', 'failed'])],
  ['blocked', new Set(['waiting_approval', 'cancelled'])],
  ['failed', new Set(['waiting_approval', 'cancelled'])],
]);

function now() {
  return new Date().toISOString();
}

function usage() {
  return [
    'AI Workbench local Codex task gateway v0.1',
    '',
    'Commands:',
    '  create --file <task-card.json>',
    '  show <task-id>',
    '  list',
    '  approve <task-id>',
    '  reject <task-id> [reason]',
    '  run <task-id>',
    '  status <task-id>',
    '  logs <task-id>',
    '  cancel <task-id>',
    '  cleanup <task-id>',
    '  codex-contract',
  ].join('\n');
}

function redact(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  text = text
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bAIza[0-9A-Za-z_-]{12,}\b/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]')
    .replace(/\b(?:Authorization|Cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]')
    .replace(/\b(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*["']?[^"'\s,}]+/gi, (match) => match.replace(/[:=].*/, '= [REDACTED]'));
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) text = text.split(home).join('%USER_HOME%');
  return text.length > 8000 ? `${text.slice(0, 8000)}\n...[truncated]` : text;
}

async function ensureDirs() {
  for (const dir of [gatewayRoot, tasksDir, worktreesDir, locksDir]) {
    await fsp.mkdir(dir, { recursive: true });
  }
}

function taskPath(taskId) {
  return join(tasksDir, taskId, 'task.json');
}

function eventPath(taskId) {
  return join(tasksDir, taskId, 'events.jsonl');
}

function stdoutPath(taskId) {
  return join(tasksDir, taskId, 'stdout.log');
}

function stderrPath(taskId) {
  return join(tasksDir, taskId, 'stderr.log');
}

function finalMessagePath(taskId) {
  return join(tasksDir, taskId, 'last-message.txt');
}

async function appendEvent(taskId, type, payload = {}) {
  await fsp.mkdir(join(tasksDir, taskId), { recursive: true });
  const event = {
    at: now(),
    type,
    payload: JSON.parse(redact(payload)),
  };
  await fsp.appendFile(eventPath(taskId), `${JSON.stringify(event)}\n`, 'utf8');
}

async function readJson(file) {
  const text = await fsp.readFile(file, 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

async function writeJson(file, payload) {
  await fsp.mkdir(dirname(file), { recursive: true }).catch(() => {});
  await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function loadTask(taskId) {
  const task = await readJson(taskPath(taskId));
  if (!validStatuses.has(task.status)) throw gatewayError('invalid_task', `Invalid task status ${task.status}`);
  return task;
}

async function saveTask(task) {
  task.updated_at = now();
  await writeJson(taskPath(task.task_id), task);
}

function gatewayError(reason, message) {
  const error = new Error(message || reason);
  error.reason = reason;
  return error;
}

function assertTransition(from, to) {
  if (from === to) return;
  const allowed = allowedTransitions.get(from);
  if (!allowed?.has(to)) throw gatewayError('invalid_task', `Illegal status transition ${from} -> ${to}`);
}

async function setStatus(task, status, patch = {}) {
  assertTransition(task.status, status);
  const next = { ...task, ...patch, status };
  await saveTask(next);
  await appendEvent(next.task_id, 'status_changed', { from: task.status, to: status, patch });
  return next;
}

function normalizeTaskCard(card) {
  const taskId = String(card.task_id || `task-${Date.now()}-${randomUUID().slice(0, 8)}`).trim();
  const baseline = String(card.baseline_head || '').trim();
  const promptFile = String(card.prompt_file || '').trim();
  const task = {
    task_id: taskId,
    title: String(card.title || '').trim(),
    role: String(card.role || '').trim(),
    repository: resolve(String(card.repository || root)),
    baseline_head: baseline,
    prompt_file: promptFile ? resolve(promptFile) : '',
    allowed_paths: normalizePathList(card.allowed_paths),
    forbidden_paths: normalizePathList(card.forbidden_paths),
    requires_codex: Boolean(card.requires_codex ?? true),
    max_codex_runs: Number(card.max_codex_runs ?? 1),
    max_retries: Number(card.max_retries ?? 0),
    concurrency_group: String(card.concurrency_group || 'default').trim() || 'default',
    approval_required: Boolean(card.approval_required ?? true),
    acceptance_commands: Array.isArray(card.acceptance_commands) ? card.acceptance_commands.map(String) : [],
    stop_conditions: Array.isArray(card.stop_conditions) ? card.stop_conditions.map(String) : [],
    status: card.approval_required === false ? 'draft' : 'waiting_approval',
    created_at: now(),
    updated_at: now(),
    branch: '',
    worktree: '',
    codex_run_count: 0,
    process_id: null,
    exit_code: null,
    changed_files: [],
    commit_sha: '',
    tests: [],
    blocked_reason: '',
    requires_owner_decision: Boolean(card.approval_required ?? true),
    cost_status: 'unknown',
  };
  validateTask(task);
  return task;
}

function normalizePathList(items) {
  return Array.isArray(items) ? items.map((item) => String(item).replace(/\\/g, '/').replace(/^\/+/, '').trim()).filter(Boolean) : [];
}

function validateTask(task) {
  if (!task.task_id || !/^[A-Za-z0-9._-]+$/.test(task.task_id)) throw gatewayError('invalid_task', 'task_id is required and must be path safe');
  if (!task.title) throw gatewayError('invalid_task', 'title is required');
  if (!validRoles.has(task.role)) throw gatewayError('invalid_task', `role must be one of ${[...validRoles].join(', ')}`);
  if (!task.repository) throw gatewayError('invalid_task', 'repository is required');
  if (!task.baseline_head) throw gatewayError('invalid_task', 'baseline_head is required');
  if (!task.prompt_file) throw gatewayError('invalid_task', 'prompt_file is required');
  if (task.max_codex_runs < 1) throw gatewayError('invalid_task', 'max_codex_runs must be at least 1');
  if (task.max_retries < 0) throw gatewayError('invalid_task', 'max_retries must be 0 or greater');
}

function buildSpawnSpec(command, args = [], options = {}) {
  const normalizedArgs = args.map((arg) => {
    if (arg === undefined || arg === null) throw gatewayError('invalid_task', 'Process arguments must be strings');
    return String(arg);
  });
  const normalizedCommand = String(command || '').trim();
  if (!normalizedCommand) throw gatewayError('invalid_task', 'Process command is required');

  if (process.platform === 'win32' && ['.cmd', '.bat'].includes(extname(normalizedCommand).toLowerCase())) {
    const commandLine = ['call', quoteCmdArg(normalizedCommand), ...normalizedArgs.map(quoteCmdArg)].join(' ');
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', commandLine],
      displayCommand: `${basename(process.env.ComSpec || 'cmd.exe')} /d /s /c ${basename(normalizedCommand)}`,
      usesComSpec: true,
      shell: false,
      windowsVerbatimArguments: true,
      cwd: options.cwd || root,
    };
  }

  return {
    command: normalizedCommand,
    args: normalizedArgs,
    displayCommand: basename(normalizedCommand),
    usesComSpec: false,
    shell: false,
    windowsVerbatimArguments: false,
    cwd: options.cwd || root,
  };
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function spawnCapture(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    let child;
    let spec;
    try {
      spec = buildSpawnSpec(command, args, options);
      child = spawn(spec.command, spec.args, {
        cwd: spec.cwd,
        windowsHide: true,
        shell: spec.shell,
        windowsVerbatimArguments: spec.windowsVerbatimArguments,
        env: options.env || process.env,
        stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolvePromise({ ok: false, code: null, stdout: '', stderr: error.message, timedOut: false, pid: null });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = options.timeoutMs ? setTimeout(() => {
      timedOut = true;
      killProcess(child.pid);
    }, options.timeoutMs) : null;
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); options.onStdout?.(chunk.toString('utf8')); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); options.onStderr?.(chunk.toString('utf8')); });
    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      resolvePromise({ ok: false, code: null, stdout, stderr: stderr || error.message, timedOut, pid: child.pid });
    });
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolvePromise({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut, pid: child.pid });
    });
    if (options.input !== undefined) {
      child.stdin.end(options.input);
    }
    options.onChild?.(child);
  });
}

function spawnCodex(args, options = {}) {
  return spawnCapture(process.platform === 'win32' ? 'codex.cmd' : 'codex', args, options);
}

function killProcess(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).unref();
  }
}

async function git(args, cwd = root, options = {}) {
  const safeArgs = ['-c', `safe.directory=${cwd.replace(/\\/g, '/')}`, ...args];
  const result = await spawnCapture('git', safeArgs, { cwd, timeoutMs: options.timeoutMs || 30000 });
  if (!result.ok && !options.allowFailure) {
    throw gatewayError(options.reason || 'worktree_failed', `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function currentHead(cwd = root) {
  const result = await git(['rev-parse', 'HEAD'], cwd);
  return result.stdout.trim();
}

async function dirtyState(cwd = root) {
  const result = await git(['status', '--short'], cwd, { allowFailure: true });
  return result.stdout.trim();
}

function branchName(task) {
  const safe = task.task_id.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 48);
  return `task-gateway/${safe}`;
}

async function assertBaseline(task) {
  const head = await currentHead(task.repository);
  if (head !== task.baseline_head) {
    throw gatewayError('baseline_mismatch', `Baseline mismatch: expected ${task.baseline_head}, got ${head}`);
  }
}

async function prepareWorktree(task) {
  await assertBaseline(task);
  const branch = task.branch || branchName(task);
  const worktree = task.worktree || join(worktreesDir, task.task_id);
  if (fs.existsSync(worktree)) throw gatewayError('worktree_failed', `Worktree already exists: ${worktree}`);
  await git(['worktree', 'add', '-b', branch, worktree, task.baseline_head], task.repository);
  return { branch, worktree };
}

async function changedFiles(worktree) {
  const result = await git(['status', '--short'], worktree, { allowFailure: true });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^.. /, '').replace(/.* -> /, '').replace(/\\/g, '/'));
}

function pathMatches(path, patterns) {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return patterns.some((pattern) => normalized === pattern || normalized.startsWith(`${pattern.replace(/\/+$/, '')}/`));
}

function checkScope(task, files) {
  const forbidden = files.filter((file) => pathMatches(file, task.forbidden_paths));
  if (forbidden.length) throw gatewayError('scope_violation', `Forbidden path changed: ${forbidden.join(', ')}`);
  if (task.allowed_paths.length) {
    const outside = files.filter((file) => !pathMatches(file, task.allowed_paths));
    if (outside.length) throw gatewayError('scope_violation', `Changed files outside allowed_paths: ${outside.join(', ')}`);
  }
}

function classifyCodexFailure(text, fallback = 'unknown') {
  const value = String(text || '').toLowerCase();
  if (/auth|login|unauthorized|credential/.test(value)) return 'codex_auth_failed';
  if (/quota|billing|payment|insufficient/.test(value)) return 'codex_quota_or_billing';
  if (/timeout|timed out/.test(value)) return 'timeout';
  if (/not found|enoent|recognized/.test(value)) return 'codex_not_found';
  return fallback;
}

async function buildPrompt(task) {
  const prompt = await fsp.readFile(task.prompt_file, 'utf8');
  return [
    'You are running under AI Workbench local Codex task gateway v0.1.',
    'Follow the task card boundaries exactly.',
    'Do not push, deploy, install dependencies, read secrets, or modify production configuration.',
    `Allowed paths: ${task.allowed_paths.join(', ') || '(read-only or task-specific)'}`,
    `Forbidden paths: ${task.forbidden_paths.join(', ') || '(none listed)'}`,
    '',
    prompt,
  ].join('\n');
}

async function runCodex(task) {
  if (process.env.AIW_TASK_GATEWAY_CODEX_ADAPTER === 'mock') {
    const mode = process.env.AIW_TASK_GATEWAY_MOCK_MODE || 'success';
    if (mode === 'timeout') {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      return { ok: false, exitCode: null, stdout: '', stderr: 'mock timeout', reason: 'timeout', timedOut: true };
    }
    if (mode === 'quota') {
      return { ok: false, exitCode: 1, stdout: '', stderr: 'quota or billing required', reason: 'codex_quota_or_billing' };
    }
    if (mode === 'fail') {
      return { ok: false, exitCode: 1, stdout: 'mock stdout', stderr: 'mock process failed', reason: 'codex_process_failed' };
    }
    return { ok: true, exitCode: 0, stdout: 'mock codex completed', stderr: '', reason: '' };
  }

  const prompt = await buildPrompt(task);
  const args = [
    'exec',
    '--json',
    '--sandbox',
    'read-only',
    '--cd',
    task.worktree,
    '--output-last-message',
    finalMessagePath(task.task_id),
    '-',
  ];
  const result = await spawnCodex(args, {
    cwd: task.worktree,
    input: prompt,
    timeoutMs: Number(process.env.AIW_TASK_GATEWAY_CODEX_TIMEOUT_MS || 120000),
    onChild: async (child) => {
      task.process_id = child.pid || null;
      await saveTask(task);
      const spec = buildSpawnSpec(process.platform === 'win32' ? 'codex.cmd' : 'codex', args, { cwd: task.worktree });
      await appendEvent(task.task_id, 'codex_started', { pid: child.pid, command: spec.displayCommand, args });
    },
    onStdout: async (chunk) => fsp.appendFile(stdoutPath(task.task_id), redact(chunk), 'utf8').catch(() => {}),
    onStderr: async (chunk) => fsp.appendFile(stderrPath(task.task_id), redact(chunk), 'utf8').catch(() => {}),
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    ok: result.ok,
    exitCode: result.code,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
    reason: result.ok ? '' : classifyCodexFailure(combined, result.timedOut ? 'timeout' : 'codex_process_failed'),
    timedOut: result.timedOut,
  };
}

async function runningTasks() {
  await ensureDirs();
  const ids = await fsp.readdir(tasksDir).catch(() => []);
  const tasks = [];
  for (const id of ids) {
    try {
      const task = await loadTask(id);
      if (task.status === 'running' || task.status === 'preparing' || task.status === 'cancelling') tasks.push(task);
    } catch {}
  }
  return tasks;
}

async function assertConcurrency(task) {
  const active = await runningTasks();
  if (active.length >= globalMaxConcurrent) throw gatewayError('blocked', `Concurrency limit reached: ${globalMaxConcurrent}`);
  if (active.some((item) => item.concurrency_group === task.concurrency_group)) {
    throw gatewayError('blocked', `Concurrency group already running: ${task.concurrency_group}`);
  }
  if (active.some((item) => item.worktree && item.worktree === task.worktree)) throw gatewayError('blocked', 'Worktree already in use');
  if (active.some((item) => item.branch && item.branch === task.branch)) throw gatewayError('blocked', 'Branch already in use');
}

async function createTask(file) {
  await ensureDirs();
  const card = await readJson(resolve(file));
  const task = normalizeTaskCard(card);
  if (fs.existsSync(taskPath(task.task_id))) throw gatewayError('invalid_task', `Task already exists: ${task.task_id}`);
  await fsp.mkdir(join(tasksDir, task.task_id), { recursive: true });
  await saveTask(task);
  await appendEvent(task.task_id, 'created', { task: { ...task, prompt_file: basename(task.prompt_file) } });
  return task;
}

async function approveTask(taskId) {
  let task = await loadTask(taskId);
  if (task.status !== 'waiting_approval') throw gatewayError('invalid_task', `Task must be waiting_approval, got ${task.status}`);
  task = await setStatus(task, 'approved', { requires_owner_decision: false });
  return task;
}

async function rejectTask(taskId, reason = 'Rejected by product owner') {
  let task = await loadTask(taskId);
  if (!['waiting_approval', 'approved', 'blocked', 'failed'].includes(task.status)) throw gatewayError('invalid_task', `Cannot reject task in ${task.status}`);
  task = await setStatus(task, 'cancelled', { blocked_reason: reason, requires_owner_decision: false });
  return task;
}

async function runTask(taskId) {
  let task = await loadTask(taskId);
  if (task.codex_run_count >= task.max_codex_runs) throw gatewayError('invalid_task', 'max_codex_runs reached');
  if (task.approval_required && task.status !== 'approved') throw gatewayError('invalid_task', `Task is not approved: ${task.status}`);
  await assertConcurrency(task);
  task = await setStatus(task, 'preparing');
  try {
    const prepared = await prepareWorktree(task);
    task = { ...task, ...prepared };
    await saveTask(task);
    await appendEvent(task.task_id, 'worktree_prepared', prepared);
    task = await setStatus(task, 'running', { codex_run_count: task.codex_run_count + 1 });
    const result = await runCodex(task);
    const files = task.worktree ? await changedFiles(task.worktree) : [];
    checkScope(task, files);
    const head = task.worktree ? await currentHead(task.worktree) : '';
    task = {
      ...task,
      process_id: null,
      exit_code: result.exitCode,
      changed_files: files,
      current_head: head,
      dirty_state: await dirtyState(task.worktree),
      blocked_reason: result.ok ? '' : result.reason,
    };
    await saveTask(task);
    await appendEvent(task.task_id, 'codex_finished', { ok: result.ok, exitCode: result.exitCode, reason: result.reason, stdout: result.stdout, stderr: result.stderr });
    return result.ok
      ? await setStatus(task, files.length ? 'awaiting_integration' : 'completed')
      : await setStatus(task, 'failed', { blocked_reason: result.reason || 'codex_process_failed' });
  } catch (error) {
    const reason = error.reason || 'unknown';
    task = { ...task, process_id: null, blocked_reason: reason, dirty_state: task.worktree ? await dirtyState(task.worktree).catch(() => '') : '' };
    await saveTask(task);
    await appendEvent(task.task_id, 'failed', { reason, message: error.message });
    return await setStatus(task, reason === 'scope_violation' || reason === 'baseline_mismatch' ? 'blocked' : 'failed', { blocked_reason: reason });
  }
}

async function cancelTask(taskId) {
  let task = await loadTask(taskId);
  if (!['running', 'preparing'].includes(task.status)) {
    if (terminalStatuses.has(task.status)) return task;
    return await setStatus(task, 'cancelled', { blocked_reason: 'cancelled before run' });
  }
  task = await setStatus(task, 'cancelling');
  killProcess(task.process_id);
  await appendEvent(task.task_id, 'cancel_requested', { pid: task.process_id });
  return await setStatus(task, 'cancelled', { process_id: null, blocked_reason: 'cancelled' });
}

async function cleanupTask(taskId) {
  const task = await loadTask(taskId);
  if (!terminalStatuses.has(task.status)) throw gatewayError('invalid_task', `Task is not ended: ${task.status}`);
  if (task.worktree && fs.existsSync(task.worktree)) {
    const worktreeRoot = resolve(worktreesDir);
    const target = resolve(task.worktree);
    if (!target.startsWith(worktreeRoot)) throw gatewayError('worktree_failed', `Refusing cleanup outside gateway worktrees: ${target}`);
    await git(['worktree', 'remove', '--force', target], task.repository, { allowFailure: true });
    await appendEvent(task.task_id, 'worktree_cleaned', { worktree: target });
  }
  return task;
}

async function listTasks() {
  await ensureDirs();
  const ids = await fsp.readdir(tasksDir).catch(() => []);
  const tasks = [];
  for (const id of ids) {
    try {
      const task = await loadTask(id);
      tasks.push({
        task_id: task.task_id,
        status: task.status,
        role: task.role,
        title: task.title,
        branch: task.branch,
        worktree: task.worktree,
        updated_at: task.updated_at,
      });
    } catch {}
  }
  return tasks.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

async function readLogs(taskId) {
  const text = await fsp.readFile(eventPath(taskId), 'utf8').catch(() => '');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function codexContract() {
  return {
    command: 'codex.cmd',
    arguments: ['exec', '--json', '--sandbox', 'read-only', '--cd', '<worktree>', '--output-last-message', '<runtime-file>', '-'],
    working_directory: '<task worktree>',
    prompt_input: 'stdin via "-"',
    stdout: 'JSONL events captured and redacted to runtime task log',
    stderr: 'captured and redacted to runtime task log',
    exit_code: 'child process close code',
    cancellation: 'taskkill /pid <pid> /T /F on Windows',
    timeout: 'AIW_TASK_GATEWAY_CODEX_TIMEOUT_MS, default 120000',
    approval_mode: 'gateway-level explicit approve; current codex-cli 0.144.4 exec does not expose --ask-for-approval',
    sandbox: 'read-only for v0.1 real smoke by default',
    secret_redaction: 'Token/API Key/Cookie/Authorization/password/user home path redaction before event persistence',
    connection_source: 'uses existing local Codex CLI auth/config; gateway does not read or copy credentials',
    cost_status: 'unknown unless external billing data is separately provided',
  };
}

async function main(argv = process.argv.slice(2)) {
  if (process.env.AIW_ENABLE_LEGACY_TASK_GATEWAY_CLI !== '1') {
    console.error(JSON.stringify({ ok: false, reason: 'legacy_task_gateway_cli_disabled', message: 'Legacy task-gateway product CLI is disabled; use the Package B bridge path.' }, null, 2));
    process.exitCode = 1;
    return;
  }
  const [command, ...args] = argv;
  await ensureDirs();
  try {
    if (!command || command === '--help' || command === '-h') {
      console.log(usage());
      return;
    }
    if (command === 'create') {
      const file = args[args.indexOf('--file') + 1];
      if (!file || args.indexOf('--file') === -1) throw gatewayError('invalid_task', 'create requires --file');
      console.log(JSON.stringify(await createTask(file), null, 2));
      return;
    }
    if (command === 'show' || command === 'status') {
      console.log(JSON.stringify(await loadTask(args[0]), null, 2));
      return;
    }
    if (command === 'list') {
      console.log(JSON.stringify(await listTasks(), null, 2));
      return;
    }
    if (command === 'approve') {
      console.log(JSON.stringify(await approveTask(args[0]), null, 2));
      return;
    }
    if (command === 'reject') {
      console.log(JSON.stringify(await rejectTask(args[0], args.slice(1).join(' ') || undefined), null, 2));
      return;
    }
    if (command === 'run') {
      console.log(JSON.stringify(await runTask(args[0]), null, 2));
      return;
    }
    if (command === 'logs') {
      console.log(JSON.stringify(await readLogs(args[0]), null, 2));
      return;
    }
    if (command === 'cancel') {
      console.log(JSON.stringify(await cancelTask(args[0]), null, 2));
      return;
    }
    if (command === 'cleanup') {
      console.log(JSON.stringify(await cleanupTask(args[0]), null, 2));
      return;
    }
    if (command === 'codex-contract') {
      console.log(JSON.stringify(codexContract(), null, 2));
      return;
    }
    throw gatewayError('invalid_task', `Unknown command: ${command}`);
  } catch (error) {
    const reason = error.reason || classifyCodexFailure(error.message, 'unknown');
    console.error(JSON.stringify({ ok: false, reason, message: redact(error.message) }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export {
  createTask,
  approveTask,
  rejectTask,
  runTask,
  cancelTask,
  cleanupTask,
  loadTask,
  listTasks,
  readLogs,
  currentHead,
  codexContract,
  redact,
  normalizeTaskCard,
  assertTransition,
  checkScope,
  classifyCodexFailure,
  buildSpawnSpec,
  spawnCapture,
  spawnCodex,
  gatewayRoot,
};
