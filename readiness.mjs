import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runtimeConfigDir, runtimeDataDir, runtimeEvidenceDir, runtimeLogsDir, runtimeRoot } from './runtime-paths.mjs';

const defaultPorts = {
  modelProxy: Number(process.env.MODEL_PROXY_PORT || 18800),
  api: Number(process.env.PORT || 8787),
  vite: Number(process.env.VITE_PORT || 5173),
  openclawGateway: Number(process.env.OPENCLAW_GATEWAY_PORT || 18789)
};

function cnNetworkError(error) {
  const message = String(error?.message || error || '').trim();
  if (/ECONNREFUSED|connect|fetch failed/i.test(message)) return '本机服务还没启动或端口不可达。';
  if (/EADDRINUSE|address already in use/i.test(message)) return '端口已被其他程序占用。';
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return '网络解析暂时不可用。';
  if (/timeout|AbortError/i.test(message)) return '连接超时，服务可能正在启动或网络不可达。';
  return message || '状态检查失败。';
}

async function fetchJson(url, timeoutMs = 900) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, statusCode: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function commandExists(command) {
  return new Promise((resolve) => {
    const checker = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'where', command], { windowsHide: true, stdio: 'ignore' })
      : spawn('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    checker.on('error', () => resolve(false));
    checker.on('close', (code) => resolve(code === 0));
  });
}

function openClawShimPath() {
  const profile = String(process.env.USERPROFILE || homedir() || '').trim();
  const appData = String(process.env.APPDATA || (profile ? join(profile, 'AppData', 'Roaming') : '')).trim();
  return appData ? join(appData, 'npm', 'openclaw.cmd') : '';
}

function result(id, ok, title, userMessage, details = {}) {
  return {
    id,
    ok,
    status: ok ? 'ready' : 'not_ready',
    title,
    userMessage,
    details
  };
}

export function explainPortStatus(port, serviceName, error = null) {
  const message = cnNetworkError(error || '');
  return `${serviceName} 使用的本机端口 ${port} 当前不可用：${message}`;
}

export async function collectReadiness(options = {}) {
  const simulateDown = Boolean(options.simulateDown || process.env.AIW_SIMULATE_DEPENDENCIES_DOWN === '1');
  const checkDevPorts = Boolean(options.checkDevPorts || process.env.AIW_CHECK_DEV_PORTS === '1');
  const ports = { ...defaultPorts, ...(options.ports || {}) };
  const checks = [];

  checks.push(result(
    'paths',
    [runtimeRoot, runtimeConfigDir, runtimeDataDir, runtimeLogsDir, runtimeEvidenceDir].every(Boolean),
    '本机目录',
    '本机配置、数据、日志和验收目录会自动创建。',
    { runtimeRoot, configDir: runtimeConfigDir, dataDir: runtimeDataDir, logsDir: runtimeLogsDir, evidenceDir: runtimeEvidenceDir }
  ));

  if (simulateDown) {
    checks.push(result('model_proxy', false, '模型代理', '模型代理未就绪：本机 18800 没有可用响应，聊天入口仍可打开。', { port: ports.modelProxy }));
    checks.push(result('hermes', false, 'Hermes 员工', 'Hermes 未就绪：干净机器上可能还没有安装员工二进制，涉及电脑操作的任务会先解释原因。'));
    checks.push(result('openclaw', false, 'OpenClaw 员工', 'OpenClaw 未就绪：浏览器/长任务员工暂不可用，主程序不会因此崩溃。'));
  } else {
    try {
      const health = await fetchJson(`http://127.0.0.1:${ports.modelProxy}/health`);
      checks.push(result(
        'model_proxy',
        Boolean(health.ok && health.payload?.ok),
        '模型代理',
        health.ok && health.payload?.ok
          ? '模型代理已就绪。'
          : '模型代理未就绪：本机 18800 已响应但上游 key 或供应商配置不可用，聊天入口仍可打开。',
        { port: ports.modelProxy, health: health.payload, statusCode: health.statusCode }
      ));
    } catch (error) {
      checks.push(result('model_proxy', false, '模型代理', `模型代理未就绪：${cnNetworkError(error)} 聊天入口仍可打开。`, { port: ports.modelProxy }));
    }

    const [hermesOk, openclawInPath] = await Promise.all([
      commandExists('hermes'),
      commandExists('openclaw')
    ]);
    const openclawShim = openClawShimPath();
    const openclawOk = openclawInPath || Boolean(openclawShim && existsSync(openclawShim));
    checks.push(result(
      'hermes',
      hermesOk,
      'Hermes 员工',
      hermesOk ? 'Hermes 员工入口已找到。' : 'Hermes 未就绪：没有找到 hermes 命令，涉及电脑操作的任务会先解释原因。',
      { command: 'hermes' }
    ));
    checks.push(result(
      'openclaw',
      openclawOk,
      'OpenClaw 员工',
      openclawOk ? 'OpenClaw 员工入口已找到。' : 'OpenClaw 未就绪：没有找到 openclaw 命令，浏览器/长任务会先解释原因。',
      { command: 'openclaw', shimPath: openclawShim || '<not-resolved>' }
    ));
  }

  if (checkDevPorts) {
    try {
      const response = await fetch(`http://127.0.0.1:${ports.vite}/`, { signal: AbortSignal.timeout(700) });
      const text = await response.text().catch(() => '');
      const looksLikeVite = response.ok && /vite|src\/main\.jsx|@react-refresh/i.test(text);
      checks.push(result(
        'dev_server',
        looksLikeVite,
        '开发预览服务',
        looksLikeVite
          ? '开发预览服务已就绪。'
          : `开发预览端口 ${ports.vite} 已被其他程序占用或不是工作台开发服务；安装版不依赖它，主程序不会崩溃。`,
        { port: ports.vite, statusCode: response.status }
      ));
    } catch (error) {
      checks.push(result(
        'dev_server',
        false,
        '开发预览服务',
        `开发预览端口 ${ports.vite} 不可达：${cnNetworkError(error)} 安装版不依赖它，主程序不会崩溃。`,
        { port: ports.vite }
      ));
    }
  }

  const notReady = checks.filter((check) => !check.ok);
  return {
    ok: notReady.length === 0,
    status: notReady.length ? 'degraded' : 'ready',
    checkedAt: new Date().toISOString(),
    userMessage: notReady.length
      ? `有 ${notReady.length} 项未就绪，但工作台可以先打开。`
      : '工作台已就绪。',
    ports,
    checks
  };
}
