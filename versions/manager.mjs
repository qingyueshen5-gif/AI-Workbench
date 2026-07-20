import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versionsDir = join(root, 'versions');
const releasesDir = join(versionsDir, 'releases');
const backupsDir = join(versionsDir, 'backups');
const currentFile = join(versionsDir, 'current.json');
const lockFile = join(versionsDir, 'lock.json');

export const paths = {
  root,
  versionsDir,
  releasesDir,
  backupsDir,
  currentFile,
  lockFile
};

const employeeSpecs = {
  hermes: {
    id: 'hermes',
    name: 'Hermes',
    packageName: 'hermes',
    versionCommand: ['hermes', ['--version']],
    pathCommand: process.platform === 'win32' ? ['where.exe', ['hermes']] : ['which', ['hermes']],
    managers: ['pipx', 'pip', 'uv', 'binary']
  },
  openclaw: {
    id: 'openclaw',
    name: 'OpenClaw',
    packageName: 'openclaw',
    versionCommand: [resolveOpenClawCommand(), ['--version']],
    pathCommand: process.platform === 'win32' ? ['where.exe', ['openclaw']] : ['which', ['openclaw']],
    managers: ['npm', 'binary']
  }
};

function nowIso() {
  return new Date().toISOString();
}

function resolveOpenClawCommand() {
  if (process.platform !== 'win32') return 'openclaw';
  const appData = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const cmdPath = join(appData, 'npm', 'openclaw.cmd');
  return existsSync(cmdPath) ? cmdPath : 'openclaw.cmd';
}

function run(command, args = [], options = {}) {
  const useCmdShim = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const executable = useCmdShim ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = useCmdShim ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', ...(options.env || {}) },
    timeout: options.timeoutMs || 15000
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: result.error?.message || ''
  };
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function extractVersion(text) {
  const value = String(text || '').trim();
  if (!value) return 'unavailable';
  const match = value.match(/(?:v)?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? match[1] : value.split(/\r?\n/)[0].trim();
}

function git(args) {
  return run('git', args, { timeoutMs: 10000 });
}

export function currentWorkbench() {
  const packageJson = readJson(join(root, 'package.json'), {});
  const commit = git(['rev-parse', '--short', 'HEAD']);
  const exactTag = git(['describe', '--tags', '--exact-match']);
  const latestTag = git(['describe', '--tags', '--abbrev=0']);
  const fallbackRelease = packageJson.version ? `v${packageJson.version}` : 'unversioned';
  return {
    version: packageJson.version || '',
    release: exactTag.ok ? exactTag.stdout : fallbackRelease,
    tag: exactTag.ok ? exactTag.stdout : (latestTag.ok ? latestTag.stdout : ''),
    commit: commit.ok ? commit.stdout : '',
    dirty: !git(['diff', '--quiet']).ok || !git(['diff', '--cached', '--quiet']).ok
  };
}

function detectManager(employeeId, installPath) {
  if (employeeId === 'openclaw') {
    if (/\\npm\\openclaw\.cmd$/i.test(String(installPath || ''))) return 'npm';
    const npm = run('npm.cmd', ['list', '-g', 'openclaw', '--depth=0', '--json'], { timeoutMs: 20000 });
    if (npm.ok && /openclaw/i.test(npm.stdout)) return 'npm';
  }
  if (employeeId === 'hermes') {
    const pipx = run('pipx', ['list', '--json'], { timeoutMs: 20000 });
    if (pipx.ok && /hermes/i.test(pipx.stdout)) return 'pipx';
    const uv = run('uv', ['tool', 'list'], { timeoutMs: 20000 });
    if (uv.ok && /hermes/i.test(uv.stdout)) return 'uv';
    const pip = run('pip', ['show', 'hermes'], { timeoutMs: 20000 });
    if (pip.ok && /Name:\s*hermes/i.test(pip.stdout)) return 'pip';
  }
  return installPath ? 'binary' : 'unknown';
}

export function collectEmployeeVersion(employeeId) {
  const spec = employeeSpecs[employeeId];
  if (!spec) throw new Error(`Unknown employee "${employeeId}"`);
  const [versionCommand, versionArgs] = spec.versionCommand;
  const [pathCommand, pathArgs] = spec.pathCommand;
  const versionResult = run(versionCommand, versionArgs);
  const pathResult = run(pathCommand, pathArgs);
  const installPath = pathResult.ok
    ? pathResult.stdout.split(/\r?\n/).filter(Boolean)[0] || ''
    : (employeeId === 'openclaw' && existsSync(resolveOpenClawCommand()) ? resolveOpenClawCommand() : '');
  const manager = detectManager(employeeId, installPath);
  return {
    id: spec.id,
    name: spec.name,
    version: versionResult.ok ? extractVersion(`${versionResult.stdout}\n${versionResult.stderr}`) : 'unavailable',
    available: versionResult.ok,
    manager,
    packageName: spec.packageName,
    installPath,
    command: `${versionCommand} ${versionArgs.join(' ')}`.trim(),
    checkedAt: nowIso(),
    error: versionResult.ok ? '' : (versionResult.error || versionResult.stderr || versionResult.stdout || 'version check failed')
  };
}

export function collectEmployees() {
  return {
    hermes: collectEmployeeVersion('hermes'),
    openclaw: collectEmployeeVersion('openclaw')
  };
}

export function collectModels(options = {}) {
  const provider = 'deepseek';
  const model = String(options.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim();
  const baseUrl = String(options.baseUrl || process.env.MODEL_PROXY_UPSTREAM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  return {
    deepseek: {
      provider,
      model,
      version: model,
      baseUrl,
      purpose: 'default_chat_and_extraction',
      lockedAt: nowIso()
    }
  };
}

export function collectVersionMatrix(options = {}) {
  const workbench = currentWorkbench();
  const release = options.release || workbench.release;
  const matrix = {
    schemaVersion: 1,
    release,
    workbench: {
      version: workbench.version,
      commit: workbench.commit,
      tag: workbench.tag,
      dirty: workbench.dirty
    },
    createdAt: nowIso(),
    employees: options.employees || collectEmployees(),
    models: options.models || collectModels(options),
    verification: options.verification || {
      snapshot: 'passed',
      doctor: 'not_run',
      modelAvailability: 'not_run'
    },
    notes: options.notes || 'Generated by versions:snapshot.'
  };
  return matrix;
}

export function saveSnapshot(options = {}) {
  const matrix = collectVersionMatrix(options);
  writeJson(currentFile, matrix);
  writeJson(lockFile, matrix);
  writeJson(join(releasesDir, `${matrix.release}.json`), matrix);
  return matrix;
}

export function loadMatrix(release = 'current', options = {}) {
  const baseDir = options.versionsDir || versionsDir;
  const file = release === 'current'
    ? join(baseDir, 'current.json')
    : join(baseDir, 'releases', `${release}.json`);
  const matrix = readJson(file);
  if (!matrix) throw new Error(`Version matrix not found: ${file}`);
  return matrix;
}

export function doctor(release = 'current', options = {}) {
  const matrix = loadMatrix(release, options);
  const currentEmployees = options.currentEmployees || collectEmployees();
  const currentModels = options.currentModels || collectModels();
  const checks = [];
  for (const [id, locked] of Object.entries(matrix.employees || {})) {
    const current = currentEmployees[id];
    const ok = Boolean(current?.available) && String(current.version) === String(locked.version);
    checks.push({
      type: 'employee',
      id,
      ok,
      lockedVersion: locked.version,
      currentVersion: current?.version || 'unavailable',
      message: ok ? `${id} matches locked version` : `${id} version drift or unavailable`
    });
  }
  for (const [id, locked] of Object.entries(matrix.models || {})) {
    const current = currentModels[id];
    const ok = String(current?.model || '') === String(locked.model || '');
    checks.push({
      type: 'model',
      id,
      ok,
      lockedVersion: locked.model,
      currentVersion: current?.model || 'unavailable',
      message: ok ? `${id} matches locked model` : `${id} model drift`
    });
  }
  return {
    ok: checks.every((check) => check.ok),
    release: matrix.release,
    checkedAt: nowIso(),
    checks
  };
}

export function backupCurrentVersions(options = {}) {
  const backup = collectVersionMatrix({
    release: `backup-${nowIso().replace(/[:.]/g, '-')}`,
    notes: options.reason || 'Automatic backup before employee version change.'
  });
  const file = join(options.backupsDir || backupsDir, `${backup.release}.json`);
  writeJson(file, backup);
  return { file, backup };
}

export function restorePlan(release = 'current', options = {}) {
  const matrix = loadMatrix(release, options);
  const commands = [];
  for (const [id, employee] of Object.entries(matrix.employees || {})) {
    if (!employee.version || employee.version === 'unavailable') {
      commands.push({ id, action: 'manual', reason: 'locked version is unavailable' });
      continue;
    }
    if (employee.manager === 'npm') {
      commands.push({ id, action: 'install', manager: 'npm', command: 'npm.cmd', args: ['install', '-g', `${employee.packageName || id}@${employee.version}`] });
    } else if (employee.manager === 'pip') {
      commands.push({ id, action: 'install', manager: 'pip', command: 'pip', args: ['install', `${employee.packageName || id}==${employee.version}`] });
    } else if (employee.manager === 'pipx') {
      commands.push({ id, action: 'uninstall', manager: 'pipx', command: 'pipx', args: ['uninstall', employee.packageName || id] });
      commands.push({ id, action: 'install', manager: 'pipx', command: 'pipx', args: ['install', `${employee.packageName || id}==${employee.version}`] });
    } else if (employee.manager === 'uv') {
      commands.push({ id, action: 'install', manager: 'uv', command: 'uv', args: ['tool', 'install', `${employee.packageName || id}==${employee.version}`] });
    } else {
      commands.push({ id, action: 'manual', manager: employee.manager || 'unknown', reason: `restore from binary/config backup for ${employee.name || id}` });
    }
  }
  return {
    release: matrix.release,
    createdAt: nowIso(),
    dryRun: options.dryRun !== false,
    commands
  };
}

export function restoreEmployees(release = 'current', options = {}) {
  const backup = backupCurrentVersions({ reason: `Backup before restoring ${release}` });
  const plan = restorePlan(release, options);
  const results = [];
  for (const command of plan.commands) {
    if (plan.dryRun || command.action === 'manual') {
      results.push({ ...command, ok: true, skipped: true, manualRequired: command.action === 'manual' });
      continue;
    }
    const result = run(command.command, command.args, { timeoutMs: 120000 });
    results.push({ ...command, ok: result.ok, stdout: result.stdout, stderr: result.stderr, error: result.error });
    if (!result.ok) break;
  }
  return { backupFile: backup.file, plan, results };
}

export async function checkModelAvailability(options = {}) {
  const matrix = options.matrix || loadMatrix(options.release || 'current', options);
  const simulatedUnavailable = String(options.simulateUnavailable || process.env.AIW_SIMULATE_MODEL_UNAVAILABLE || '');
  const remoteCheck = Boolean(options.remoteCheck || process.env.AIW_MODEL_REMOTE_CHECK === '1');
  const results = [];
  for (const [id, modelLock] of Object.entries(matrix.models || {})) {
    const model = modelLock.model;
    if (simulatedUnavailable && (simulatedUnavailable === '1' || simulatedUnavailable === model || simulatedUnavailable === id)) {
      results.push({
        id,
        provider: modelLock.provider,
        model,
        ok: false,
        severity: 'high',
        reason: 'simulated_model_unavailable',
        message: `${model} 不可用：锁定模型疑似下线或无权限。请在候选模型通过验收后再切换，或保持旧模型并接受功能降级。`
      });
      continue;
    }
    if (remoteCheck) {
      try {
        const key = String(process.env.DEEPSEEK_API_KEY || '').trim();
        const response = await fetch(`${String(modelLock.baseUrl || '').replace(/\/+$/, '')}/models`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {}
        });
        const payload = await response.json().catch(() => ({}));
        const modelIds = Array.isArray(payload.data) ? payload.data.map((item) => String(item.id || item.model || '')) : [];
        const available = response.ok && modelIds.includes(model);
        results.push({
          id,
          provider: modelLock.provider,
          model,
          ok: available,
          severity: available ? 'none' : 'high',
          reason: available ? 'listed_by_provider' : `provider_models_check_${response.status}`,
          message: available
            ? `${model} 仍在官方模型列表中。`
            : `${model} 未出现在官方模型列表或模型列表不可用。请评估候选模型，不要静默切换。`,
          availableModels: modelIds
        });
      } catch (error) {
        results.push({
          id,
          provider: modelLock.provider,
          model,
          ok: false,
          severity: 'medium',
          reason: 'provider_models_check_failed',
          message: `无法完成官方模型列表检测：${error.message}。保持锁定模型，稍后重试或人工确认。`
        });
      }
      continue;
    }
    results.push({
      id,
      provider: modelLock.provider,
      model,
      ok: true,
      severity: 'none',
      reason: 'locked_model_configured',
      message: `${model} 已锁定；未请求外网时只做配置一致性检查。`
    });
  }
  return {
    ok: results.every((result) => result.ok),
    checkedAt: nowIso(),
    results
  };
}

export function writeVerificationReport(name, payload, options = {}) {
  const outDir = join(options.root || root, 'verification', 'version-management');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, name);
  writeJson(file, payload);
  return file;
}
