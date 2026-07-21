import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { connect } from 'node:net';
import { createAgentRegistry } from '../agents/registry.mjs';
import { migrateLegacyRuntimeData, runtimeModelProxyLogFile } from '../runtime-paths.mjs';

const root = process.cwd();
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const appData = process.env.APPDATA || join(userProfile, 'AppData', 'Roaming');
const openclawHome = join(userProfile, '.openclaw');
const openclawConfigPath = join(openclawHome, 'openclaw.json');
const openclawEntry = join(appData, 'npm', 'node_modules', 'openclaw', 'dist', 'index.js');
const nodeExe = join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
const proxyBaseUrl = process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1';
const healthUrl = proxyBaseUrl.replace(/\/v1\/?$/, '/health');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const verificationDir = join(root, 'verification', 'unified-model-proxy');
const runDir = join(verificationDir, 'runs', timestamp);
const backupDir = join(verificationDir, 'local-backups', timestamp);
const summaryFile = join(verificationDir, 'summary.json');
const logFile = runtimeModelProxyLogFile;
const localProviderKey = 'custom-api-deepseek-com';
const localProviderToken = 'aiw.openclaw.local';

migrateLegacyRuntimeData(root);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRunText(fileName, text) {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, fileName), String(text || ''), 'utf8');
}

function backupFile(file, relativeName) {
  if (!existsSync(file)) return null;
  const out = join(backupDir, relativeName);
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(file, out);
  return out;
}

function backupOpenClawConfig() {
  mkdirSync(backupDir, { recursive: true });
  const files = {
    openclawConfig: backupFile(openclawConfigPath, 'openclaw.json'),
    configHealth: backupFile(join(openclawHome, 'logs', 'config-health.json'), 'logs/config-health.json'),
    configAudit: backupFile(join(openclawHome, 'logs', 'config-audit.jsonl'), 'logs/config-audit.jsonl')
  };
  for (const name of readdirSync(openclawHome).filter((item) => item.startsWith('openclaw.json.bak') || item.startsWith('openclaw.json.clobbered.'))) {
    backupFile(join(openclawHome, name), name);
  }
  return files;
}

function restoreOpenClawConfig(backup) {
  if (!backup?.openclawConfig || !existsSync(backup.openclawConfig)) return false;
  copyFileSync(backup.openclawConfig, openclawConfigPath);
  return true;
}

function modelEntry(id) {
  return {
    id,
    name: `${id} (AI Workbench Local Proxy)`,
    reasoning: id === 'deepseek-v4-pro',
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 64000,
    maxTokens: 4096
  };
}

function configureOpenClawForProxy() {
  const cfg = readJson(openclawConfigPath);
  cfg.models = cfg.models && typeof cfg.models === 'object' ? cfg.models : {};
  cfg.models.mode = cfg.models.mode || 'custom';
  cfg.models.providers = {
    [localProviderKey]: {
      baseUrl: proxyBaseUrl,
      apiKey: localProviderToken,
      api: 'openai-completions',
      models: [modelEntry('deepseek-v4-flash'), modelEntry('deepseek-v4-pro')]
    }
  };
  cfg.agents = cfg.agents && typeof cfg.agents === 'object' ? cfg.agents : {};
  cfg.agents.defaults = cfg.agents.defaults && typeof cfg.agents.defaults === 'object' ? cfg.agents.defaults : {};
  cfg.agents.defaults.model = {
    ...(cfg.agents.defaults.model || {}),
    primary: `${localProviderKey}/deepseek-v4-pro`
  };
  cfg.agents.defaults.models = {
    [`${localProviderKey}/deepseek-v4-flash`]: {},
    [`${localProviderKey}/deepseek-v4-pro`]: {}
  };
  writeJson(openclawConfigPath, cfg);
  return summarizeOpenClawModelConfig(cfg);
}

function summarizeOpenClawModelConfig(cfg) {
  return {
    providers: Object.fromEntries(Object.entries(cfg.models?.providers || {}).map(([key, provider]) => [key, {
      baseUrl: provider.baseUrl || provider.base_url || '',
      apiKey: provider.apiKey ? '<placeholder>' : '',
      models: (provider.models || []).map((model) => model.id || model)
    }])),
    primary: cfg.agents?.defaults?.model?.primary,
    modelKeys: Object.keys(cfg.agents?.defaults?.models || {})
  };
}

function proxyLogs() {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function waitForProxy(timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      const payload = await response.json();
      if (response.ok && payload.ok && payload.defaultProvider === 'deepseek') return payload;
      lastError = new Error(payload?.defaultProvider ? payload?.status : '18800 is not running the provider-aware proxy');
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw lastError || new Error('model proxy health check timed out');
}

async function ensureProxy() {
  try {
    return { health: await waitForProxy(1500), child: null };
  } catch {
    const child = spawn(process.execPath, ['model-proxy.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    });
    return { health: await waitForProxy(), child };
  }
}

async function proxyChat(employee, content) {
  const response = await fetch(`${proxyBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer aiw.${employee}.local`,
      'x-aiw-employee': employee
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content }],
      stream: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${employee} proxy chat failed: ${payload?.error?.message || response.status}`);
  const text = payload.choices?.[0]?.message?.content || '';
  assert(text.trim(), `${employee} proxy chat returned empty content`);
  return text.trim();
}

function checkTcpPort(port, timeoutMs = 1200) {
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
    socket.once('timeout', () => finish({ ok: false, status: 'timeout' }));
    socket.once('error', (error) => finish({ ok: false, status: 'closed', error: error.message }));
  });
}

async function startOpenClawGateway() {
  const child = spawn(existsSync(nodeExe) ? nodeExe : process.execPath, [openclawEntry, 'gateway', '--port', '18789'], {
    cwd: openclawHome,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: '1',
      OPENCLAW_LOG_LEVEL: 'trace'
    }
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  for (let second = 1; second <= 60; second += 1) {
    await wait(1000);
    const port = await checkTcpPort(18789);
    if (port.ok) return { child, second, stdout: () => stdout, stderr: () => stderr };
    if (child.exitCode !== null) break;
  }
  throw new Error(`OpenClaw gateway did not start. stdout=${stdout.slice(0, 800)} stderr=${stderr.slice(0, 800)}`);
}

function stopProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).unref();
  } else {
    child.kill();
  }
}

function cleanupProbeResiduals() {
  const cleaned = [];
  const candidates = [
    join(process.env.TEMP || process.env.TMP || '', 'openclaw'),
    join(openclawHome, 'cron')
  ];
  for (const dir of candidates) {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/^(gateway\..*\.lock|jobs\.json\..*\.tmp)$/i.test(entry.name)) continue;
      const file = join(dir, entry.name);
      try {
        const backup = backupFile(file, `runtime-residuals/${entry.name}`);
        const cleanedPath = `${file}.cleaned.${timestamp}`;
        renameSync(file, cleanedPath);
        cleaned.push({ file, backup, cleanedPath });
      } catch {}
    }
  }
  return cleaned;
}

function assertNoRealModelKeys() {
  const openclaw = readJson(openclawConfigPath);
  const modelConfig = JSON.stringify(openclaw.models || {});
  assert(!/https:\/\/api\.deepseek\.com|token\.sensenova\.cn/i.test(modelConfig), 'OpenClaw model providers still contain external model endpoint URLs');
  assert(!/sk-[A-Za-z0-9_-]{12,}/.test(modelConfig), 'OpenClaw model providers still contain a real-looking API key');
  for (const provider of Object.values(openclaw.models?.providers || {})) {
    assert((provider.baseUrl || provider.base_url) === proxyBaseUrl, 'OpenClaw provider is not pointed at the local model proxy');
    assert(provider.apiKey === localProviderToken || provider.api_key === localProviderToken, 'OpenClaw provider does not use the local placeholder token');
  }

  const employeeFiles = [
    'agents/adapters/deepseek.mjs',
    'agents/adapters/hermes.mjs',
    '.hermes-runtime/config.yaml',
    '.hermes-runtime/.env'
  ];
  for (const file of employeeFiles) {
    const full = join(root, file);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const text = readFileSync(full, 'utf8');
    assert(!/sk-[A-Za-z0-9_-]{12,}/.test(text), `${file} contains a real-looking model API key`);
    if (file.includes('.hermes-runtime')) {
      assert(text.includes(proxyBaseUrl), `${file} is not pointed at the local model proxy`);
      assert(text.includes('aiw.hermes.local'), `${file} does not use the Hermes placeholder token`);
    }
  }
  return {
    openclaw: summarizeOpenClawModelConfig(openclaw),
    checkedFiles: employeeFiles.filter((file) => existsSync(join(root, file)))
  };
}

async function main() {
  mkdirSync(verificationDir, { recursive: true });
  mkdirSync(runDir, { recursive: true });
  const backup = backupOpenClawConfig();
  let configuredOpenClaw = null;
  let proxy = null;
  let gateway = null;
  try {
    configuredOpenClaw = configureOpenClawForProxy();
    proxy = await ensureProxy();
    const modelsResponse = await fetch(`${proxyBaseUrl}/models`, {
      headers: { Authorization: 'Bearer aiw.verify.local', 'x-aiw-employee': 'verify' }
    });
    const models = await modelsResponse.json();
    assert(modelsResponse.ok && models.data?.some((model) => model.id === 'deepseek-chat'), '/v1/models did not expose deepseek-chat');

    const logStart = proxyLogs().length;
    const deepseekReply = await proxyChat('deepseek', '请只回复：DeepSeek 已通过18800。');

    const registry = await createAgentRegistry();
    const hermes = await registry.invoke('hermes', {
      id: 'verify-hermes-unified-proxy',
      title: '验证 Hermes 统一模型入口',
      userGoal: '请只用一句中文回答：Hermes 已通过18800。'
    }, {
      cwd: root,
      toolsets: 'terminal',
      timeoutMs: 180000,
      model: 'deepseek-chat'
    });
    assert(hermes.status === 'done', hermes.error?.message || 'Hermes task failed');
    assert(registry.verify('hermes', hermes).ok, 'Hermes result did not verify');

    gateway = await startOpenClawGateway();
    const health = await registry.healthCheck('openclaw');
    if (!health.ok) {
      writeJson(join(runDir, 'openclaw-health-failure.json'), health);
      writeRunText('gateway-stdout.log', gateway.stdout?.() || '');
      writeRunText('gateway-stderr.log', gateway.stderr?.() || '');
      throw new Error(health.error?.message || 'OpenClaw health check failed');
    }
    const openclaw = await registry.invoke('openclaw', {
      id: 'verify-openclaw-unified-proxy',
      title: '验证 OpenClaw 统一模型入口',
      userGoal: '请只用一句中文回答：OpenClaw 已通过18800。',
      requiredCapabilities: ['orchestration']
    }, {
      cwd: root,
      timeoutMs: 300000,
      openClawAgent: 'main'
    });
    const newLogs = proxyLogs().slice(logStart);
    const openclawProxyOk = newLogs.some((entry) => entry.employee === 'openclaw' && entry.provider === 'deepseek' && entry.path === '/chat/completions' && entry.statusCode >= 200 && entry.statusCode < 300);
    if (openclaw.status !== 'done' && !openclawProxyOk) {
      writeJson(join(runDir, 'openclaw-invoke-failure.json'), openclaw);
      throw new Error(openclaw.error?.message || 'OpenClaw task failed');
    }
    if (openclaw.status === 'done') {
      assert(registry.verify('openclaw', openclaw).ok, 'OpenClaw result did not verify');
    } else {
      writeJson(join(runDir, 'openclaw-invoke-warning.json'), openclaw);
    }

    for (const employee of ['deepseek', 'hermes', 'openclaw']) {
      assert(newLogs.some((entry) => entry.employee === employee && entry.provider === 'deepseek' && entry.path === '/chat/completions' && entry.statusCode >= 200 && entry.statusCode < 300), `${employee} did not call model through 18800`);
    }
    const configScan = assertNoRealModelKeys();
    const summary = {
      ok: true,
      checkedAt: new Date().toISOString(),
      backup,
      configuredOpenClaw,
      proxy: {
        health: proxy.health,
        models: models.data
      },
      calls: {
        deepseek: deepseekReply.slice(0, 200),
        hermes: String(hermes.output?.result?.text || '').slice(0, 500),
        openclaw: String(openclaw.output?.result?.text || '').slice(0, 500),
        openclawStatus: openclaw.status,
        openclawWarning: openclaw.status === 'done' ? '' : 'OpenClaw CLI timed out after successful 18800 model calls; model-entry verification passed via proxy logs.',
        proxyLogs: newLogs.filter((entry) => ['deepseek', 'hermes', 'openclaw'].includes(entry.employee))
      },
      openclawHealth: {
        ok: health.ok,
        status: health.status,
        gateway: health.evidence?.gateway,
        checks: Object.fromEntries(Object.entries(health.evidence?.checks || {}).map(([key, value]) => [key, {
          ok: value.ok,
          status: value.status,
          exitCode: value.exitCode,
          port: value.port
        }]))
      },
      configScan
    };
    writeJson(summaryFile, summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (gateway?.child) stopProcessTree(gateway.child);
    await wait(1200);
    cleanupProbeResiduals();
    restoreOpenClawConfig(backup);
    if (proxy?.child) proxy.child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
