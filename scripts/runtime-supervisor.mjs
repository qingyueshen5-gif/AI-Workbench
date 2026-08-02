import fs from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';

const execFileAsync = promisify(execFile);
export const bridgeStateRoot = join(runtimeRoot, 'feishu-workbench-bridge');
export const selectionPath = process.env.AIW_RUNTIME_SELECTION_FILE || join(bridgeStateRoot, 'runtime-selection.json');
export const deploymentPath = process.env.AIW_DEPLOYMENT_STATE_FILE || join(bridgeStateRoot, 'deployment-state.json');
export const workerStatePath = join(bridgeStateRoot, 'ipc', 'worker-state.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(path, fallback = null) { try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; } }
async function writeJson(path, value) { await fs.mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.${Date.now()}.tmp`; await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); await fs.rename(temp, path); }
async function git(root, args) { const { stdout } = await execFileAsync('git', ['-c', `safe.directory=${root.replaceAll('\\','/')}`, ...args], { cwd: root, timeout: 10000, windowsHide: true }); return stdout.trim(); }

export async function validateRuntimeTarget(target) {
  const root = resolve(target.root || '');
  const expectedCommit = String(target.commit || '').trim();
  if (!root || !expectedCommit) throw new Error('Runtime target requires root and full commit');
  if (target.skipGitValidation === true) {
    await fs.access(join(root, 'scripts', 'workbench-agent-runtime.mjs'));
    return { root, commit: expectedCommit, tag: String(target.tag || ''), skipGitValidation: true, validatedAt: Date.now() };
  }
  const actualCommit = await git(root, ['rev-parse', 'HEAD']);
  if (actualCommit !== expectedCommit) throw new Error(`Runtime commit mismatch: expected ${expectedCommit}, got ${actualCommit}`);
  await fs.access(join(root, 'scripts', 'workbench-agent-runtime.mjs'));
  return { root, commit: actualCommit, tag: String(target.tag || ''), validatedAt: Date.now() };
}

export async function writeRuntimeSelection(selection) {
  const selected = await validateRuntimeTarget(selection.selected);
  const fallback = await validateRuntimeTarget(selection.fallback);
  const next = { selected, fallback, requestedAt: Date.now(), requestedBy: String(selection.requestedBy || 'operator') };
  await writeJson(selectionPath, next);
  return next;
}

export class RuntimeSupervisor {
  constructor(options = {}) {
    this.selectionPath = options.selectionPath || selectionPath;
    this.deploymentPath = options.deploymentPath || deploymentPath;
    this.workerStatePath = options.workerStatePath || workerStatePath;
    this.ipcRoot = options.ipcRoot || dirname(this.workerStatePath);
    this.pollMs = Number(options.pollMs || 1000);
    this.startTimeoutMs = Number(options.startTimeoutMs || 90000);
    this.child = null; this.current = null; this.stopping = false;
  }
  async record(patch) { const current = await readJson(this.deploymentPath, {}); await writeJson(this.deploymentPath, { ...current, ...patch, updatedAt: Date.now() }); }
  async stopCurrent(reason = 'switch') {
    if (!this.child) return;
    const child = this.child; this.child = null;
    await this.record({ runtimeSwitchInProgress: true, stoppingCommit: this.current?.commit || '', switchReason: reason });
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(10000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await sleep(150);
    this.current = null;
  }
  async waitReady(target, child) {
    const deadline = Date.now() + this.startTimeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Runtime exited before ready: ${child.exitCode}`);
      const state = await readJson(this.workerStatePath, {});
      if (state.status === 'online' && state.gitCommit === target.commit && resolve(state.projectRoot || '').toLowerCase() === target.root.toLowerCase()) return state;
      await sleep(500);
    }
    throw new Error(`Runtime readiness timeout for ${target.commit}`);
  }
  async startTarget(target, reason = 'selection') {
    const validated = await validateRuntimeTarget(target);
    const env = {
      ...process.env,
      AIW_FEISHU_IPC_DIR: this.ipcRoot,
      AIW_CONVERSATION_DIR: join(bridgeStateRoot, 'conversations'),
      AIW_ACTIVE_TASK_DIR: join(bridgeStateRoot, 'active-tasks'),
      AIW_ASSISTANT_ALLOWED_ROOTS: [validated.root, join(bridgeStateRoot, 'acceptance')].join(';'),
      AIW_RUNTIME_GIT_COMMIT: validated.commit
    };
    const child = spawn(process.execPath, [join(validated.root, 'scripts', 'workbench-agent-runtime.mjs')], { cwd: validated.root, env, stdio: 'inherit', windowsHide: true });
    this.child = child; this.current = validated;
    await this.record({ runtimeSwitchInProgress: true, selected: validated, switchReason: reason, supervisorPid: process.pid });
    try {
      const state = await this.waitReady(validated, child);
      await this.record({ runtimeSwitchInProgress: false, active: validated, runtimePid: state.pid, lastSwitchCompletedAt: Date.now(), lastSwitchError: '' });
      return state;
    } catch (error) {
      child.kill('SIGTERM'); this.child = null; this.current = null;
      await this.record({ runtimeSwitchInProgress: false, lastSwitchError: error.message, failedTarget: validated });
      throw error;
    }
  }
  async apply(selection) {
    const desired = await validateRuntimeTarget(selection.selected);
    if (this.current?.commit === desired.commit && this.current?.root === desired.root && this.child?.exitCode === null) return;
    await this.stopCurrent('selection_changed');
    try { await this.startTarget(desired, 'selected'); }
    catch (error) {
      const fallback = await validateRuntimeTarget(selection.fallback);
      await this.record({ rollbackInProgress: true, rollbackReason: error.message });
      const state = await this.startTarget(fallback, 'automatic_fallback');
      await this.record({ rollbackInProgress: false, lastRollback: { completed: true, at: Date.now(), from: desired, to: fallback, reason: error.message }, runtimePid: state.pid });
    }
  }
  async run() {
    while (!this.stopping) {
      const selection = await readJson(this.selectionPath, null);
      if (selection?.selected && selection?.fallback) await this.apply(selection);
      await sleep(this.pollMs);
    }
    await this.stopCurrent('supervisor_stop');
  }
}

async function main() {
  const supervisor = new RuntimeSupervisor();
  process.once('SIGINT', () => { supervisor.stopping = true; });
  process.once('SIGTERM', () => { supervisor.stopping = true; });
  await supervisor.run();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
