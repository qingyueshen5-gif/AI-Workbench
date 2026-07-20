import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const openclawHome = join(userProfile, '.openclaw');
const currentConfigPath = join(openclawHome, 'openclaw.json');
const goodConfigPath = join(openclawHome, 'openclaw.json.bak.3');
const candidatePath = join(openclawHome, 'openclaw.json.candidate');
const gatewayCmd = join(openclawHome, 'gateway.cmd');
const gatewayEntry = join(process.env.APPDATA || join(userProfile, 'AppData', 'Roaming'), 'npm', 'node_modules', 'openclaw', 'dist', 'index.js');
const nodeExe = join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = join(root, 'evidence', 'openclaw-candidate', timestamp);
const verificationDir = join(root, 'verification', 'openclaw-candidate');
const summaryFile = join(verificationDir, 'summary.json');
const stdoutFile = join(evidenceDir, 'gateway.stdout.log');
const stderrFile = join(evidenceDir, 'gateway.stderr.log');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(file, payload) {
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function redact(text) {
  return String(text || '')
    .replace(/(sk-[A-Za-z0-9_-]{8,})/g, 'sk-***')
    .replace(/(Bearer\s+)[A-Za-z0-9._:-]{8,}/gi, '$1***')
    .replace(/("?(?:token|apiKey|api_key|client_secret|appSecret|botToken|secret|authorization)"?\s*[:=]\s*"?)[^",\r\n]+/gi, '$1***')
    .replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, 'telegram-token-***');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPort(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ durationMs: Date.now() - started, ...payload });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, status: 'listening' }));
    socket.once('timeout', () => finish({ ok: false, status: 'timeout', error: `tcp connect timed out after ${timeoutMs}ms` }));
    socket.once('error', (error) => finish({ ok: false, status: 'closed', error: error.message }));
  });
}

function fileInfo(file) {
  try {
    const stat = statSync(file);
    return { path: file, exists: true, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
  } catch {
    return { path: file, exists: false, bytes: 0, modifiedAt: '' };
  }
}

function createCandidate() {
  const good = readJson(goodConfigPath);
  const current = readJson(currentConfigPath);
  if (current.channels?.telegram) {
    good.channels = good.channels || {};
    good.channels.telegram = current.channels.telegram;
  }
  writeJson(candidatePath, good);
  return {
    hasTelegram: Boolean(good.channels?.telegram),
    hasFeishu: Boolean(good.channels?.feishu),
    gateway: {
      port: good.gateway?.port,
      mode: good.gateway?.mode,
      bind: good.gateway?.bind,
      authMode: good.gateway?.auth?.mode,
      hasAuthToken: Boolean(good.gateway?.auth?.token)
    },
    providers: Object.fromEntries(Object.entries(good.models?.providers || {}).map(([id, provider]) => [id, {
      baseUrl: provider.baseUrl || provider.base_url || '',
      models: Array.isArray(provider.models) ? provider.models.map((model) => model.id || model.name).filter(Boolean) : [],
      hasApiKey: Boolean(provider.apiKey || provider.api_key || provider.token)
    }])),
    agentPrimaryModel: good.agents?.defaults?.model?.primary || ''
  };
}

function validateCandidate() {
  const candidate = readJson(candidatePath);
  const issues = [];
  if (candidate.gateway?.port !== 18789) issues.push('gateway.port is not 18789');
  if (candidate.gateway?.mode !== 'local') issues.push('gateway.mode is not local');
  if (candidate.gateway?.bind !== 'loopback') issues.push('gateway.bind is not loopback');
  if (!candidate.gateway?.auth?.token) issues.push('gateway auth token missing');
  if (!candidate.models?.providers?.['custom-api-deepseek-com']) issues.push('DeepSeek provider missing');
  if (!candidate.models?.providers?.['custom-token-sensenova-cn']) issues.push('SenseNova provider missing');
  if (!candidate.channels?.feishu) issues.push('Feishu channel missing');
  if (!candidate.channels?.telegram) issues.push('Telegram channel missing');
  if (!candidate.agents?.defaults?.model?.primary) issues.push('agent primary model missing');
  return {
    ok: issues.length === 0,
    issues
  };
}

async function backupInputs() {
  const backupDir = join(root, 'evidence', 'openclaw-candidate-backups', timestamp);
  mkdirSync(backupDir, { recursive: true });
  if (existsSync(currentConfigPath)) await copyFile(currentConfigPath, join(backupDir, 'openclaw.current.json'));
  if (existsSync(goodConfigPath)) await copyFile(goodConfigPath, join(backupDir, 'openclaw.last-known-good.json'));
  return backupDir;
}

async function withCandidateAsCurrent(fn) {
  const swapBackupPath = join(openclawHome, `openclaw.json.before-candidate-${timestamp}`);
  renameSync(currentConfigPath, swapBackupPath);
  await copyFile(candidatePath, currentConfigPath);
  try {
    return await fn(swapBackupPath);
  } finally {
    try {
      if (existsSync(currentConfigPath)) renameSync(currentConfigPath, join(openclawHome, `openclaw.json.candidate-tested-${timestamp}`));
    } catch {}
    renameSync(swapBackupPath, currentConfigPath);
  }
}

async function runGatewayProbe() {
  mkdirSync(evidenceDir, { recursive: true });
  const before = await checkPort(18789);
  if (!existsSync(gatewayEntry)) {
    return { started: false, reason: 'OpenClaw gateway Node entry not found', before, after: before };
  }

  const child = spawn(existsSync(nodeExe) ? nodeExe : process.execPath, [gatewayEntry, 'gateway', '--port', '18789'], {
    cwd: openclawHome,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: '1',
      LOG_LEVEL: process.env.LOG_LEVEL || 'trace',
      OPENCLAW_LOG_LEVEL: process.env.OPENCLAW_LOG_LEVEL || 'trace',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--trace-uncaught --trace-warnings'
    }
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  const portSamples = [];
  let after = await checkPort(18789);
  for (let i = 0; i < 45; i += 1) {
    await wait(1000);
    after = await checkPort(18789);
    portSamples.push({
      second: i + 1,
      ok: after.ok,
      status: after.status,
      error: after.error || ''
    });
    if (after.ok || child.exitCode !== null) break;
  }
  const stillRunning = child.exitCode === null && !child.killed;
  if (stillRunning && process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.unref();
  } else if (stillRunning) {
    child.kill();
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.destroy();
  child.removeAllListeners('close');
  child.removeAllListeners('error');
  child.unref();
  await wait(500);

  const redactedStdout = redact(stdout);
  const redactedStderr = redact(stderr);
  writeFileSync(stdoutFile, redactedStdout, 'utf8');
  writeFileSync(stderrFile, redactedStderr, 'utf8');
  return {
    started: true,
    pid: child.pid,
    exitCode: child.exitCode,
    killedAfterProbe: stillRunning,
    before,
    after,
    portSamples,
    stdoutFile,
    stderrFile,
    stdoutPreview: redactedStdout.slice(0, 1600),
    stderrPreview: redactedStderr.slice(0, 1600),
    command: `${existsSync(nodeExe) ? nodeExe : process.execPath} ${gatewayEntry} gateway --port 18789`,
    conclusion: after.ok
      ? `candidate 配置下 gateway 在第 ${portSamples.find((sample) => sample.ok)?.second || '?'} 秒监听 18789。`
      : `candidate 配置下 gateway 45 秒内仍未监听 18789：${after.error || after.status}`
  };
}

async function main() {
  if (!existsSync(currentConfigPath)) throw new Error(`Current config not found: ${currentConfigPath}`);
  if (!existsSync(goodConfigPath)) throw new Error(`Last-known-good config not found: ${goodConfigPath}`);
  const backupDir = await backupInputs();
  const candidateSummary = createCandidate();
  const validation = validateCandidate();
  const gateway = validation.ok
    ? await withCandidateAsCurrent(() => runGatewayProbe())
    : { started: false, reason: 'candidate validation failed' };
  const summary = {
    ok: Boolean(validation.ok && gateway.after?.ok),
    checkedAt: new Date().toISOString(),
    backupDir,
    openclawHome,
    candidate: {
      path: candidatePath,
      info: fileInfo(candidatePath),
      summary: candidateSummary,
      validation
    },
    gateway,
    result: validation.ok && gateway.after?.ok
      ? 'gateway_started_with_candidate'
      : 'gateway_failed_with_candidate'
  };
  mkdirSync(verificationDir, { recursive: true });
  writeJson(summaryFile, summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
