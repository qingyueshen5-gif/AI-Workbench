import { spawn } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { connect } from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const appData = process.env.APPDATA || join(userProfile, 'AppData', 'Roaming');
const openclawHome = join(userProfile, '.openclaw');
const tempOpenclaw = join(process.env.TEMP || process.env.TMP || '', 'openclaw');
const gatewayEntry = join(appData, 'npm', 'node_modules', 'openclaw', 'dist', 'index.js');
const nodeExe = join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = join(root, 'evidence', 'openclaw-runtime-deep-dive', timestamp);
const verificationDir = join(root, 'verification', 'openclaw-runtime-deep-dive');
const summaryFile = join(verificationDir, 'summary.json');
const backupDir = join(evidenceDir, 'backups');
const beforeDir = join(evidenceDir, 'before-clean');
const afterDir = join(evidenceDir, 'after-clean');
const probeMs = Number.parseInt(process.env.OPENCLAW_DEEP_DIVE_PROBE_MS || '90000', 10);

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function safeStat(file) {
  try {
    const stat = statSync(file);
    return {
      path: file,
      relativePath: file.startsWith(openclawHome) ? relative(openclawHome, file) : file,
      type: stat.isDirectory() ? 'directory' : 'file',
      bytes: stat.isFile() ? stat.size : null,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch (error) {
    return {
      path: file,
      relativePath: file.startsWith(openclawHome) ? relative(openclawHome, file) : file,
      type: 'missing',
      error: error.message
    };
  }
}

function redact(text) {
  return String(text || '')
    .replace(/(sk-[A-Za-z0-9_-]{8,})/g, 'sk-***')
    .replace(/(Bearer\s+)[A-Za-z0-9._:-]{8,}/gi, '$1***')
    .replace(/("?(?:token|apiKey|api_key|client_secret|secret|authorization|password)"?\s*[:=]\s*"?)[^",\r\n]+/gi, '$1***')
    .replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, 'telegram-token-***');
}

function walk(dir, visit, results = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const lower = fullPath.toLowerCase();
    if (lower.includes('\\agents\\main\\sessions\\') || lower.includes('\\workspace\\牧原股份\\')) continue;
    const value = visit(fullPath, entry);
    if (value) results.push(value);
    if (entry.isDirectory()) walk(fullPath, visit, results);
  }
  return results;
}

function classifyResidual(fullPath, entry) {
  const name = entry.name.toLowerCase();
  const lower = fullPath.toLowerCase();
  if (name.endsWith('.lock') || name.endsWith('.pid') || name === 'lock.json') return 'lock';
  if (name.endsWith('.tmp')) return 'tmp';
  if (name.includes('state') && name.endsWith('.json')) return 'state-json';
  if (name === 'paired.json' || name === 'pending.json') return 'device-state';
  if (lower.includes('\\browser\\') && (name === 'lock' || name.endsWith('-journal') || name.endsWith('-wal'))) return 'browser-runtime';
  return '';
}

function parseJsonHealth(file) {
  if (!file.toLowerCase().endsWith('.json')) return null;
  try {
    JSON.parse(readText(file).replace(/^\uFEFF/, ''));
    return { parseOk: true };
  } catch (error) {
    return { parseOk: false, error: error.message };
  }
}

function scanResiduals() {
  const found = walk(openclawHome, (fullPath, entry) => {
    const kind = classifyResidual(fullPath, entry);
    if (!kind) return null;
    const info = safeStat(fullPath);
    return {
      ...info,
      kind,
      json: entry.isFile() ? parseJsonHealth(fullPath) : null
    };
  });

  const temp = walk(tempOpenclaw, (fullPath, entry) => {
    const info = safeStat(fullPath);
    return {
      ...info,
      kind: entry.name.toLowerCase().endsWith('.lock') || entry.name.toLowerCase().endsWith('.pid')
        ? 'temp-lock'
        : 'temp-openclaw'
    };
  });

  return { openclawHome, tempOpenclaw, found, temp };
}

function shouldClean(item) {
  const rel = item.relativePath.replace(/\//g, '\\').toLowerCase();
  if (item.kind === 'lock') return true;
  if (item.kind === 'temp-lock') return true;
  if (item.kind === 'tmp') return true;
  if (item.kind === 'state-json' && item.json?.parseOk === false) return true;
  if (item.kind === 'browser-runtime' && (rel.endsWith('\\lock') || rel.endsWith('-journal') || rel.endsWith('-wal'))) return true;
  return false;
}

function backupPathFor(file) {
  const base = file.startsWith(openclawHome)
    ? join(backupDir, '.openclaw', relative(openclawHome, file))
    : file.startsWith(tempOpenclaw)
      ? join(backupDir, 'temp-openclaw', relative(tempOpenclaw, file))
      : join(backupDir, 'absolute', file.replace(/[:\\\/]/g, '_'));
  mkdirSync(dirname(base), { recursive: true });
  return base;
}

function backupAndClean(items) {
  const cleaned = [];
  const skipped = [];
  mkdirSync(backupDir, { recursive: true });
  for (const item of items) {
    if (!shouldClean(item)) {
      skipped.push({ ...item, reason: 'not in cleanup whitelist' });
      continue;
    }
    try {
      const target = backupPathFor(item.path);
      if (item.type === 'directory') cpSync(item.path, target, { recursive: true, force: true });
      else copyFileSync(item.path, target);
      if (item.type === 'directory') rmSync(item.path, { recursive: true, force: true });
      else renameSync(item.path, `${item.path}.cleaned.${timestamp}`);
      cleaned.push({ ...item, backupPath: target, cleanedPath: `${item.path}.cleaned.${timestamp}` });
    } catch (error) {
      skipped.push({ ...item, reason: error.message });
    }
  }
  return { cleaned, skipped };
}

function checkPort(port, timeoutMs = 1200) {
  return new Promise((resolveCheck) => {
    const started = Date.now();
    const socket = connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveCheck({ durationMs: Date.now() - started, ...payload });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, status: 'listening' }));
    socket.once('timeout', () => finish({ ok: false, status: 'timeout', error: `tcp connect timed out after ${timeoutMs}ms` }));
    socket.once('error', (error) => finish({ ok: false, status: 'closed', error: error.message }));
  });
}

async function runGatewayProbe(label, outDir) {
  mkdirSync(outDir, { recursive: true });
  const stdoutFile = join(outDir, 'gateway.stdout.log');
  const stderrFile = join(outDir, 'gateway.stderr.log');
  const openclawLogBefore = readText(join(tempOpenclaw, 'openclaw.log'));
  const before = await checkPort(18789);
  if (!existsSync(gatewayEntry)) {
    return { label, started: false, reason: 'OpenClaw gateway Node entry not found', before, after: before, stdoutFile, stderrFile };
  }

  const command = existsSync(nodeExe) ? nodeExe : process.execPath;
  const args = [
    '--trace-uncaught',
    '--trace-warnings',
    '--trace-exit',
    gatewayEntry,
    'gateway',
    '--port',
    '18789'
  ];
  const child = spawn(command, args, {
    cwd: openclawHome,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      OPENCLAW_LOG_LEVEL: 'trace',
      OPENCLAW_CONSOLE_LOG_LEVEL: 'trace',
      DEBUG: 'openclaw*,gateway*,browser*,playwright*'
    }
  });

  let stdout = '';
  let stderr = '';
  let exit = null;
  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  child.once('exit', (code, signal) => {
    exit = { code, signal };
  });

  const samples = [];
  const startedAt = Date.now();
  let after = before;
  while (Date.now() - startedAt < probeMs) {
    await wait(1000);
    after = await checkPort(18789);
    samples.push({
      second: Math.round((Date.now() - startedAt) / 1000),
      ok: after.ok,
      status: after.status,
      error: after.error || '',
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr)
    });
    if (after.ok || exit) break;
  }

  const stillRunning = !exit && child.exitCode === null && !child.killed;
  if (stillRunning && child.pid) {
    if (after.ok) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).unref();
    } else {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).unref();
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.destroy();
  child.unref();
  await wait(1000);

  const openclawLogAfter = readText(join(tempOpenclaw, 'openclaw.log'));
  const newLog = openclawLogAfter.startsWith(openclawLogBefore) ? openclawLogAfter.slice(openclawLogBefore.length) : openclawLogAfter;
  writeFileSync(stdoutFile, redact(stdout), 'utf8');
  writeFileSync(stderrFile, redact(stderr), 'utf8');
  writeFileSync(join(outDir, 'openclaw-runtime.log'), redact(newLog), 'utf8');

  return {
    label,
    started: true,
    pid: child.pid,
    command: `${command} ${args.join(' ')}`,
    exit,
    killedAfterProbe: stillRunning,
    before,
    after,
    samples,
    stdoutFile,
    stderrFile,
    runtimeLogFile: join(outDir, 'openclaw-runtime.log'),
    stdoutPreview: redact(stdout).slice(0, 2000),
    stderrPreview: redact(stderr).slice(0, 2000),
    runtimeLogTail: redact(newLog).slice(-5000),
    conclusion: after.ok
      ? `gateway listened on 127.0.0.1:18789 during ${label}`
      : `gateway did not listen on 127.0.0.1:18789 during ${label}: ${after.error || after.status}`
  };
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const beforeScan = scanResiduals();
  const beforeProbe = await runGatewayProbe('before-clean', beforeDir);
  const cleanupCandidates = [...beforeScan.found, ...beforeScan.temp];
  const cleanup = beforeProbe.after?.ok
    ? { cleaned: [], skipped: cleanupCandidates, reason: 'gateway already started before cleanup' }
    : backupAndClean(cleanupCandidates);
  const afterScan = scanResiduals();
  const afterProbe = beforeProbe.after?.ok
    ? null
    : await runGatewayProbe('after-clean', afterDir);
  const postProbeScan = scanResiduals();
  const postProbeCleanup = beforeProbe.killedAfterProbe || afterProbe?.killedAfterProbe
    ? backupAndClean([...postProbeScan.temp, ...postProbeScan.found].filter((item) => item.kind === 'temp-lock' || item.kind === 'tmp'))
    : { cleaned: [], skipped: [], reason: 'no probe process was killed' };
  const finalScan = scanResiduals();
  const summary = {
    ok: Boolean(beforeProbe.after?.ok || afterProbe?.after?.ok),
    checkedAt: new Date().toISOString(),
    openclawHome,
    gatewayEntry,
    evidenceDir,
    backupDir,
    probeMs,
    beforeScan,
    beforeProbe,
    cleanup,
    afterScan,
    afterProbe,
    postProbeScan,
    postProbeCleanup,
    finalScan,
    conclusion: beforeProbe.after?.ok
      ? 'Gateway starts before cleanup; residual cleanup was not required.'
      : afterProbe?.after?.ok
        ? 'Gateway starts after residual cleanup; stale runtime state was the likely blocker.'
        : 'Gateway still fails after residual cleanup; inspect detailed startup logs for an OpenClaw runtime/version issue.'
  };
  mkdirSync(verificationDir, { recursive: true });
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
