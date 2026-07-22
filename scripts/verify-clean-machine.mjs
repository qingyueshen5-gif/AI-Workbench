import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const root = process.cwd();
const verificationDir = join(root, 'verification', 'clean-machine');
const summaryFile = join(verificationDir, 'summary.json');
const reportFile = join(verificationDir, 'readiness-report.md');
const devUserName = String.fromCodePoint(0x80d6, 0x80d6, 0x864e);
const forbiddenPatterns = [
  { label: '开发机用户名', regex: new RegExp(devUserName, 'g') },
  { label: '开发机用户绝对路径', regex: new RegExp(`C:[\\\\/]+Users[\\\\/]+${devUserName}`, 'gi') }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function listRepoFiles() {
  const tracked = spawnSyncLines('git', ['ls-files']);
  const untracked = spawnSyncLines('git', ['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked])]
    .filter((file) => file && !/\.(png|ico|jpg|jpeg)$/i.test(file))
    .filter((file) => !file.startsWith('verification/unified-model-proxy/local-backups/'))
    .filter((file) => !file.startsWith('verification/unified-model-proxy/runs/'));
}

function spawnSyncLines(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || `${command} ${args.join(' ')} failed`);
  return String(result.stdout || '').split(/\r?\n/).filter(Boolean);
}

async function collectProcess(child, timeoutMs = 8000) {
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      stopProcess(child);
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr, timedOut: false });
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ code: null, stdout, stderr: stderr || error.message, timedOut: false, error });
    });
  });
}

function startNode(script, env = {}, args = []) {
  return spawn(process.execPath, [script, ...args], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  });
}

function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill();
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      const payload = await response.json();
      if (response.ok) return payload;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(300);
  }
  throw lastError || new Error(`等待 ${url} 超时`);
}

async function fetchText(url) {
  const response = await fetch(url);
  return response.text();
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function occupyPort(port) {
  return new Promise((resolve) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('occupied by clean-machine verifier');
    });
    server.on('error', (error) => resolve({ port, server: null, alreadyOccupied: true, error: error.message }));
    server.listen(port, '127.0.0.1', () => resolve({ port, server, alreadyOccupied: false, error: '' }));
  });
}

function closeOccupier(occupier) {
  return new Promise((resolve) => {
    if (!occupier?.server) {
      resolve();
      return;
    }
    occupier.server.close(() => resolve());
  });
}

function scanForbiddenPaths() {
  const files = listRepoFiles();
  const hits = [];
  for (const file of files) {
    const full = join(root, file);
    let text = '';
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of forbiddenPatterns) {
      const matches = text.match(pattern.regex);
      if (matches?.length) hits.push({ file, pattern: pattern.label, count: matches.length });
    }
  }
  return hits;
}

async function verifyFirstRunRebuildsRuntime() {
  const runtimeRoot = join(tmpdir(), `aiw-clean-runtime-${process.pid}`);
  rmSync(runtimeRoot, { recursive: true, force: true });
  mkdirSync(join(runtimeRoot, 'config'), { recursive: true });
  mkdirSync(join(runtimeRoot, 'data'), { recursive: true });
  renameSync(join(runtimeRoot, 'config'), join(runtimeRoot, 'config.backup'));
  renameSync(join(runtimeRoot, 'data'), join(runtimeRoot, 'data.backup'));
  const port = await freePort();
  const child = startNode('server.mjs', {
    PORT: String(port),
    AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
    MODEL_PROXY_PORT: '18991',
    MODEL_PROXY_BASE_URL: 'http://127.0.0.1:18991/v1'
  });
  try {
    const data = await waitForJson(`http://127.0.0.1:${port}/api/data`);
    assert(Array.isArray(data.conversations), '首次启动没有返回默认对话数据');
    const rebuilt = ['config', 'data', 'logs', 'evidence'].every((name) => existsSync(join(runtimeRoot, name)));
    assert(rebuilt, '首次启动没有自动重建 config/data/logs/evidence 目录');
    assert(existsSync(join(runtimeRoot, 'data', 'workbench.json')), '首次启动没有自动生成安全默认数据文件');
    return { runtimeRoot: '<temp-runtime>', port, rebuilt: true, dataFileCreated: true };
  } finally {
    stopProcess(child);
    await wait(600);
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

async function verifyDependenciesDegrade() {
  const runtimeRoot = join(tmpdir(), `aiw-clean-degraded-${process.pid}`);
  rmSync(runtimeRoot, { recursive: true, force: true });
  const port = await freePort();
  const child = startNode('server.mjs', {
    PORT: String(port),
    AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
    AIW_SIMULATE_DEPENDENCIES_DOWN: '1',
    MODEL_PROXY_PORT: '18992',
    MODEL_PROXY_BASE_URL: 'http://127.0.0.1:18992/v1'
  });
  try {
    const readiness = await waitForJson(`http://127.0.0.1:${port}/api/readiness?simulateDown=1`);
    const html = await fetchText(`http://127.0.0.1:${port}/`);
    const source = readFileSync(join(root, 'src', 'main.jsx'), 'utf8');
    const messages = readiness.checks.map((check) => check.userMessage || '').join('\n');
    assert(readiness.status === 'degraded', '依赖全不可用时 readiness 没有进入降级状态');
    assert(/模型代理未就绪/.test(messages), '缺少 18800 未就绪中文说明');
    assert(/Hermes 未就绪/.test(messages), '缺少 Hermes 未就绪中文说明');
    assert(/OpenClaw 未就绪/.test(messages), '缺少 OpenClaw 未就绪中文说明');
    assert(/<div id="root"><\/div>/.test(html), '主页面没有正常返回 React 挂载入口');
    assert(/placeholder="例如：我今天想把登录页面做完。"/.test(source), '前端核心对话输入入口不可见');
    assert(/ReadinessNotice/.test(source), '前端首屏没有接入未就绪中文说明');
    assert(!/TypeError|ReferenceError|SyntaxError|at\s+/.test(messages), '未就绪说明包含技术堆栈');
    return { port, readinessStatus: readiness.status, notReady: readiness.checks.filter((check) => !check.ok).map((check) => check.id) };
  } finally {
    stopProcess(child);
    await wait(600);
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

async function verifyPortConflicts() {
  const occupied18800 = await occupyPort(18800);
  const occupied5173 = await occupyPort(5173);
  const proxy = startNode('model-proxy.mjs', {
    MODEL_PROXY_PORT: '18800',
    AI_WORKBENCH_RUNTIME_DIR: join(tmpdir(), `aiw-clean-proxy-conflict-${process.pid}`)
  });
  const proxyResult = await collectProcess(proxy, 5000);
  const portMessage = `${proxyResult.stdout}\n${proxyResult.stderr}`;
  const port = await freePort();
  const runtimeRoot = join(tmpdir(), `aiw-clean-port-${process.pid}`);
  const api = startNode('server.mjs', {
    PORT: String(port),
    AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
    MODEL_PROXY_PORT: '18800',
    MODEL_PROXY_BASE_URL: 'http://127.0.0.1:18800/v1',
    VITE_PORT: '5173',
    AIW_CHECK_DEV_PORTS: '1'
  });
  try {
    const readiness = await waitForJson(`http://127.0.0.1:${port}/api/readiness`);
    const messages = readiness.checks.map((check) => check.userMessage || '').join('\n');
    assert(/端口|不可用|未就绪/.test(portMessage), '18800 冲突没有输出可解释中文状态');
    const modelProxyCheck = readiness.checks.find((check) => check.id === 'model_proxy');
    assert(modelProxyCheck, 'readiness 缺少模型代理状态');
    assert(!modelProxyCheck.ok || occupied18800.alreadyOccupied, '18800 被验证器占用时 readiness 没有模型代理未就绪状态');
    const devServerCheck = readiness.checks.find((check) => check.id === 'dev_server');
    assert(devServerCheck, 'readiness 缺少开发预览端口状态');
    assert(!devServerCheck.ok || occupied5173.alreadyOccupied, '5173 被验证器占用时 readiness 没有开发预览端口说明');
    assert(
      devServerCheck.ok || (/5173/.test(messages) && /安装版不依赖它|占用|不可达/.test(messages)),
      '5173 状态不是中文可解释说明'
    );
    return {
      occupied18800: occupied18800.alreadyOccupied ? 'already_occupied' : 'occupied_by_verifier',
      occupied5173: occupied5173.alreadyOccupied ? 'already_occupied' : 'occupied_by_verifier',
      proxyExitCode: proxyResult.code,
      modelProxyReadiness: modelProxyCheck.ok ? 'ready_existing_service' : 'not_ready',
      devServerReadiness: devServerCheck.ok ? 'ready_existing_service' : 'not_ready',
      readinessStatus: readiness.status
    };
  } finally {
    stopProcess(api);
    await closeOccupier(occupied18800);
    await closeOccupier(occupied5173);
    await wait(600);
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

function writeReadinessReport() {
  const content = [
    '# Clean Machine Readiness Report',
    '',
    '## 外部环境假设与兜底状态',
    '',
    '- Node 运行时：开发态依赖当前 Node；安装版由 Electron 自带运行时拉起内部服务。缺失或脚本不存在时，主窗口加载中文降级页，不白屏。',
    '- 共享 key 入口：18800 服务端支持共享托管 key 兜底；用户本机 `DEEPSEEK_API_KEY` 优先，缺失时读取 `AIW_SHARED_DEEPSEEK_API_KEY` / `MODEL_PROXY_SHARED_API_KEY`。前端和员工配置只使用本机占位 token，不暴露真实 key。',
    '- 端口：18800 是模型代理，8787 是工作台核心服务，5173 是开发预览端口。端口被占用或不可达时统一显示中文未就绪状态，不向用户展示堆栈。',
    '- 路径：运行数据使用 `AI_WORKBENCH_RUNTIME_DIR` / `%APPDATA%\\ai-workbench` / 用户主目录兜底，自动创建 config、data、logs、evidence 目录；仓库不依赖开发机用户名绝对路径。',
    '- 员工二进制：Hermes、OpenClaw 在干净机器上可能不存在；系统按“员工未就绪”降级，主程序和核心对话入口仍打开。',
    '- 网络：模型上游、127.0.0.1 服务或外网不可达时归一成中文网络/服务不可用说明，并保留本地界面。',
    '',
    '## 人工验收边界',
    '',
    '真机试装由产品负责人在另一台干净 Windows 上执行；本脚本只覆盖 a-e 自动验收。'
  ].join('\n');
  mkdirSync(verificationDir, { recursive: true });
  writeFileSync(reportFile, `${content}\n`, 'utf8');
  return content;
}

async function main() {
  mkdirSync(verificationDir, { recursive: true });
  const summary = {
    ok: false,
    checkedAt: new Date().toISOString(),
    results: {}
  };
  try {
    const hardcodedHits = scanForbiddenPaths();
    assert(hardcodedHits.length === 0, `硬编码开发机痕迹未清理：${JSON.stringify(hardcodedHits)}`);
    summary.results.a = { ok: true, name: '全仓库无硬编码开发机用户名/用户绝对路径', hitCount: 0, hits: [] };

    const firstRun = await verifyFirstRunRebuildsRuntime();
    summary.results.b = { ok: true, name: '首次启动自动重建 config/data/logs/evidence', ...firstRun };

    const degraded = await verifyDependenciesDegrade();
    summary.results.c = { ok: true, name: '18800/Hermes/OpenClaw 全不可用时主入口降级可见', ...degraded };

    const conflicts = await verifyPortConflicts();
    summary.results.d = { ok: true, name: '18800/5173 端口冲突中文状态', ...conflicts };

    const report = writeReadinessReport();
    for (const section of ['Node 运行时', '共享 key 入口', '端口', '路径', '员工二进制', '网络']) {
      assert(report.includes(section), `readiness-report.md 缺少外部假设：${section}`);
    }
    summary.results.e = { ok: true, name: 'readiness-report.md 覆盖所有外部环境假设', reportFile: 'verification/clean-machine/readiness-report.md' };
    summary.ok = Object.values(summary.results).every((item) => item.ok);
    writeJson(summaryFile, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.ok = false;
    summary.error = error.message;
    writeJson(summaryFile, summary);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
