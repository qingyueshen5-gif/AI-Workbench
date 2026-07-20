import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const openclawHome = join(userProfile, '.openclaw');
const configPath = join(openclawHome, 'openclaw.json');
const gatewayCmd = join(openclawHome, 'gateway.cmd');
const gatewayEntry = join(process.env.APPDATA || join(userProfile, 'AppData', 'Roaming'), 'npm', 'node_modules', 'openclaw', 'dist', 'index.js');
const nodeExe = join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = join(root, 'evidence', 'openclaw-gateway', timestamp);
const verificationDir = join(root, 'verification', 'openclaw-health');
const summaryFile = join(verificationDir, 'summary.json');
const stdoutFile = join(evidenceDir, 'gateway.stdout.log');
const stderrFile = join(evidenceDir, 'gateway.stderr.log');

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readText(file).replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

function fileInfo(file) {
  try {
    const stat = statSync(file);
    return {
      path: file,
      exists: true,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return { path: file, exists: false, bytes: 0, modifiedAt: '' };
  }
}

function redact(text) {
  return String(text || '')
    .replace(/(sk-[A-Za-z0-9_-]{8,})/g, 'sk-***')
    .replace(/(Bearer\s+)[A-Za-z0-9._:-]{8,}/gi, '$1***')
    .replace(/("?(?:token|apiKey|api_key|client_secret|secret|authorization)"?\s*[:=]\s*"?)[^",\r\n]+/gi, '$1***')
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

function listClobberedConfigs() {
  try {
    return readdirSync(openclawHome)
      .filter((name) => name.startsWith('openclaw.json.clobbered.'))
      .map((name) => fileInfo(join(openclawHome, name)))
      .sort((a, b) => String(a.modifiedAt).localeCompare(String(b.modifiedAt)));
  } catch {
    return [];
  }
}

function analyzeConfig() {
  const current = fileInfo(configPath);
  const health = readJson(join(openclawHome, 'logs', 'config-health.json'), {});
  const entry = health?.entries?.[configPath] || Object.values(health?.entries || {})[0] || {};
  const lastGood = entry?.lastKnownGood || null;
  const suspiciousSignature = entry?.lastObservedSuspiciousSignature || '';
  const clobbered = listClobberedConfigs();
  return {
    current,
    lastKnownGood: lastGood ? {
      bytes: lastGood.bytes,
      observedAt: lastGood.observedAt || '',
      gatewayMode: lastGood.gatewayMode || ''
    } : null,
    suspiciousSignature,
    clobbered,
    sizeDropDetected: Boolean(lastGood?.bytes && current.bytes && current.bytes < Number(lastGood.bytes) * 0.7),
    conclusion: suspiciousSignature
      ? `OpenClaw health 已记录可疑配置签名：${suspiciousSignature}`
      : '未在 config-health.json 中发现可疑配置签名。'
  };
}

async function backupCurrentConfig() {
  const backupDir = join(root, 'evidence', 'openclaw-backups', `openclaw-${timestamp}`);
  mkdirSync(backupDir, { recursive: true });
  if (existsSync(configPath)) await copyFile(configPath, join(backupDir, 'openclaw.json'));
  const healthLog = join(openclawHome, 'logs', 'config-health.json');
  const auditLog = join(openclawHome, 'logs', 'config-audit.jsonl');
  if (existsSync(healthLog)) await copyFile(healthLog, join(backupDir, 'config-health.json'));
  if (existsSync(auditLog)) await copyFile(auditLog, join(backupDir, 'config-audit.jsonl'));
  for (const item of listClobberedConfigs()) {
    if (item.exists) await copyFile(item.path, join(backupDir, item.path.split(/[\\/]/).pop()));
  }
  return backupDir;
}

async function runGatewayProbe() {
  mkdirSync(evidenceDir, { recursive: true });
  const before = await checkPort(18789);
  if (!existsSync(gatewayEntry)) {
    return {
      started: false,
      reason: 'OpenClaw gateway Node entry not found',
      before,
      after: before,
      stdoutFile,
      stderrFile,
      stdoutPreview: '',
      stderrPreview: ''
    };
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
    stdoutPreview: redactedStdout.slice(0, 1200),
    stderrPreview: redactedStderr.slice(0, 1200),
    command: `${existsSync(nodeExe) ? nodeExe : process.execPath} ${gatewayEntry} gateway --port 18789`,
    conclusion: after.ok
      ? `gateway 在第 ${portSamples.find((sample) => sample.ok)?.second || '?'} 秒监听 18789。`
      : `gateway 诊断启动后 45 秒内 18789 仍不可达：${after.error || after.status}`
  };
}

async function main() {
  const backupDir = await backupCurrentConfig();
  const config = analyzeConfig();
  const gateway = await runGatewayProbe();
  const summary = {
    ok: Boolean(gateway.after?.ok),
    checkedAt: new Date().toISOString(),
    backupDir,
    openclawHome,
    gateway,
    config
  };
  mkdirSync(verificationDir, { recursive: true });
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
