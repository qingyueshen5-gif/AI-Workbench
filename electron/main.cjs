const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const packageInfo = require('../package.json');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-vulkan');

function logMain(message) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'electron-main.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

const appVersion = packageInfo.version;
const windowTitle = `AI Workbench v${appVersion}`;
const smokeTestMode = process.argv.includes('--smoke-test') || process.env.AIW_SMOKE_TEST === '1';
const remoteDebugArg = process.argv.find((arg) => arg.startsWith('--remote-debugging-port='));
if (remoteDebugArg) {
  const [, port] = remoteDebugArg.split('=');
  if (port) app.commandLine.appendSwitch('remote-debugging-port', port);
}
const modelProxyPort = Number(process.env.MODEL_PROXY_PORT || 18800);
const apiPort = Number(process.env.PORT || 8787);
const endpoints = {
  modelProxy: `http://127.0.0.1:${modelProxyPort}/health`,
  api: `http://127.0.0.1:${apiPort}/api/data`,
  readiness: `http://127.0.0.1:${apiPort}/api/readiness`,
  app: `http://127.0.0.1:${apiPort}/`
};
const ownedChildren = [];
const serviceState = {
  modelProxy: { ok: false, userMessage: '模型代理还没有完成检查。' },
  api: { ok: false, userMessage: '工作台核心服务还没有完成检查。' }
};
let shuttingDown = false;
let mainWindow = null;

process.on('uncaughtException', (error) => {
  logMain(`uncaughtException ${error?.stack || error}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadFallbackPage(mainWindow, [`工作台遇到启动问题：${friendlyError(error)}。`]).catch(() => {});
  }
});
process.on('unhandledRejection', (error) => {
  logMain(`unhandledRejection ${error?.stack || error}`);
});

function checkUrl(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      request.destroy();
      finish(false);
    }, timeoutMs);
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      finish(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('timeout', () => {
      request.destroy();
      finish(false);
    });
    request.on('error', () => finish(false));
  });
}

function readJsonUrl(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let settled = false;
    let body = '';
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          finish({ ok: response.statusCode >= 200 && response.statusCode < 300, statusCode: response.statusCode, payload });
        } catch (error) {
          finish({ ok: false, statusCode: response.statusCode, error });
        }
      });
    });
    const timer = setTimeout(() => {
      request.destroy();
      finish({ ok: false, error: new Error('timeout') });
    }, timeoutMs);
    request.on('timeout', () => {
      request.destroy();
      finish({ ok: false, error: new Error('timeout') });
    });
    request.on('error', (error) => finish({ ok: false, error }));
  });
}

async function checkApiReady(timeoutMs = 1200) {
  const result = await readJsonUrl(endpoints.api, timeoutMs);
  return Boolean(result.ok && result.payload && Array.isArray(result.payload.conversations));
}

async function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkUrl(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function startNodeScript(name, scriptPath) {
  const serviceCwd = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  if (!fs.existsSync(scriptPath)) {
    serviceState[name === 'model-proxy' ? 'modelProxy' : 'api'] = {
      ok: false,
      userMessage: `${name === 'model-proxy' ? '模型代理' : '工作台核心服务'}未就绪：启动文件不存在。`
    };
    logMain(`${name}:script-missing ${scriptPath}`);
    return null;
  }
  let child = null;
  try {
    child = spawn(process.execPath, [scriptPath], {
    cwd: serviceCwd,
    windowsHide: true,
    env: {
      ...process.env,
      AIW_PACKAGED: app.isPackaged ? '1' : '0',
      NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1',
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'ignore'
    });
  } catch (error) {
    serviceState[name === 'model-proxy' ? 'modelProxy' : 'api'] = {
      ok: false,
      userMessage: `${name === 'model-proxy' ? '模型代理' : '工作台核心服务'}未就绪：${friendlyError(error)}。`
    };
    logMain(`${name}:spawn-error ${error?.stack || error}`);
    return null;
  }
  child.on('error', (error) => {
    serviceState[name === 'model-proxy' ? 'modelProxy' : 'api'] = {
      ok: false,
      userMessage: `${name === 'model-proxy' ? '模型代理' : '工作台核心服务'}未就绪：${friendlyError(error)}。`
    };
    logMain(`${name}:child-error ${error?.stack || error}`);
  });
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code=${code} signal=${signal || ''}`);
    }
    const index = ownedChildren.indexOf(child);
    if (index !== -1) ownedChildren.splice(index, 1);
    if (!shuttingDown) {
      setTimeout(async () => {
        const endpoint = name === 'model-proxy' ? endpoints.modelProxy : endpoints.api;
        if (!await checkUrl(endpoint)) startNodeScript(name, scriptPath);
      }, 1500);
    }
  });
  ownedChildren.push(child);
  return child;
}

async function ensureInternalServices(waitTimeoutMs = 8000) {
  const appPath = app.getAppPath();
  if (!await checkUrl(endpoints.modelProxy)) {
    startNodeScript('model-proxy', path.join(appPath, 'model-proxy.mjs'));
  }
  if (!await checkApiReady()) {
    startNodeScript('api', path.join(appPath, 'server.mjs'));
  }
  const [modelProxyReady, apiReady] = await Promise.all([
    waitForUrl(endpoints.modelProxy, waitTimeoutMs),
    (async () => {
      const started = Date.now();
      while (Date.now() - started < waitTimeoutMs) {
        if (await checkApiReady(1000)) return true;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return false;
    })()
  ]);
  serviceState.modelProxy = {
    ok: modelProxyReady,
    userMessage: modelProxyReady ? '模型代理已就绪。' : '模型代理未就绪：18800 暂时不可用，聊天会显示中文原因。'
  };
  serviceState.api = {
    ok: apiReady,
    userMessage: apiReady ? '工作台核心服务已就绪。' : '工作台核心服务未就绪：8787 暂时不可用，已切换到本地说明页。'
  };
  return { modelProxyReady, apiReady };
}

function stopOwnedServices() {
  shuttingDown = true;
  for (const child of ownedChildren) {
    if (!child.killed) child.kill();
  }
}

async function createWindow() {
  logMain('createWindow:start');
  Menu.setApplicationMenu(null);
  logMain('browser-window:before-create');
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: windowTitle,
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow = win;
  logMain('browser-window:created');
  win.on('close', () => {
    logMain('window:close');
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
    logMain('window:closed');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logMain(`render-process-gone ${JSON.stringify(details)}`);
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    logMain(`did-fail-load code=${code} description=${description} url=${url}`);
  });
  win.webContents.on('destroyed', () => {
    logMain('webContents:destroyed');
  });

  win.on('page-title-updated', (event) => {
    event.preventDefault();
    win.setTitle(windowTitle);
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (!(input.control || input.meta) || input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    if (key === 'x') {
      win.webContents.cut();
      event.preventDefault();
    } else if (key === 'c') {
      win.webContents.copy();
      event.preventDefault();
    } else if (key === 'v') {
      win.webContents.paste();
      event.preventDefault();
    } else if (key === 'a') {
      win.webContents.selectAll();
      event.preventDefault();
    }
  });
  win.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable) return;
    Menu.buildFromTemplate([
      { label: '剪切', role: 'cut', enabled: params.editFlags.canCut },
      { label: '复制', role: 'copy', enabled: params.editFlags.canCopy },
      { label: '粘贴', role: 'paste', enabled: true },
      { type: 'separator' },
      { label: '全选', role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ]).popup({ window: win });
  });

  const services = await ensureInternalServices();
  logMain(`createWindow:services ${JSON.stringify(services)}`);
  if (!services.apiReady) {
    await loadFallbackPage(win, [
      serviceState.api.userMessage,
      serviceState.modelProxy.userMessage,
      '核心对话入口已保留；等本机服务恢复后重新打开工作台即可继续使用。'
    ]);
    return;
  }
  try {
    logMain(`loadURL:start ${endpoints.app}`);
    await win.loadURL(endpoints.app);
    logMain('createWindow:loaded');
  } catch (error) {
    logMain(`loadURL:error ${error?.stack || error}`);
    await loadFallbackPage(win, [
      `工作台页面暂时打不开：${friendlyError(error)}。`,
      serviceState.modelProxy.userMessage,
      '主程序没有崩溃；请关闭占用端口的程序或稍后重试。'
    ]);
  }
}

async function runSmokeTest() {
  const outputFile = process.env.AIW_SMOKE_TEST_OUTPUT || path.join(app.getPath('userData'), 'logs', 'smoke-test.json');
  const result = {
    task: 'electron-smoke-test',
    version: appVersion,
    startedAt: new Date().toISOString(),
    packaged: app.isPackaged,
    userData: app.getPath('userData'),
    services: {},
    renderer: { ok: false },
    readiness: null,
    errors: []
  };
  try {
    Menu.setApplicationMenu(null);
    writeJsonFile(outputFile, { ...result, checkpoint: 'before-services' });
    const services = await ensureInternalServices(smokeTestMode ? 20000 : 8000);
    result.services = services;
    writeJsonFile(outputFile, { ...result, checkpoint: 'after-services' });
    if (services.apiReady) {
      const htmlResult = await new Promise((resolve) => {
        let body = '';
        const request = http.get(endpoints.app, { timeout: 2500 }, (response) => {
          response.setEncoding('utf8');
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, statusCode: response.statusCode, body }));
        });
        request.on('timeout', () => {
          request.destroy();
          resolve({ ok: false, error: 'timeout', body });
        });
        request.on('error', (error) => resolve({ ok: false, error: friendlyError(error), body }));
      });
      result.renderer = {
        ok: Boolean(htmlResult.ok && /<div id="root">|assets\/index-/i.test(htmlResult.body || '')),
        statusCode: htmlResult.statusCode || 0,
        bodyTextLength: String(htmlResult.body || '').length,
        error: htmlResult.error || ''
      };
      const readiness = await readJsonUrl(endpoints.readiness, 2500);
      result.readiness = readiness.payload || null;
      writeJsonFile(outputFile, { ...result, checkpoint: 'after-renderer' });
    } else {
      result.renderer = { ok: false, reason: 'api_not_ready' };
    }
    result.ok = Boolean(result.services.apiReady && result.renderer.ok);
  } catch (error) {
    result.ok = false;
    result.errors.push(friendlyError(error));
    logMain(`smoke-test:error ${error?.stack || error}`);
  } finally {
    result.finishedAt = new Date().toISOString();
    try {
      writeJsonFile(outputFile, result);
    } catch (error) {
      logMain(`smoke-test:write-error ${error?.stack || error}`);
    }
    stopOwnedServices();
    app.exit(result.ok ? 0 : 1);
  }
}

function friendlyError(error) {
  const message = String(error?.message || error || '').trim();
  if (/EADDRINUSE|address already in use/i.test(message)) return '本机端口已被其他程序占用';
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|connect/i.test(message)) return '本机服务还没启动或端口不可达';
  if (/timeout|timed out/i.test(message)) return '连接超时';
  if (/ENOENT|not found|找不到/i.test(message)) return '启动文件或员工程序不存在';
  return message || '未知错误';
}

async function loadFallbackPage(win, reasons = []) {
  const items = reasons.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(windowTitle)}</title>
  <style>
    html,body{height:100%;margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b;background:#fff}
    .shell{display:flex;min-height:100%;flex-direction:column}
    header{height:64px;border-bottom:1px solid #eee;display:flex;align-items:center;padding:0 24px;font-weight:700}
    main{flex:1;display:flex;align-items:center;justify-content:center;padding:32px}
    .panel{width:min(760px,100%);}
    h1{font-size:24px;margin:0 0 12px}
    p,li{font-size:15px;line-height:1.8;color:#3f3f46}
    ul{padding-left:20px;margin:12px 0 24px}
    textarea{box-sizing:border-box;width:100%;min-height:92px;border:1px solid #d4d4d8;border-radius:18px;padding:14px 16px;font:inherit;resize:vertical;outline:none}
    button{margin-top:10px;border:0;border-radius:999px;background:#18181b;color:#fff;padding:9px 16px;font:inherit}
    .hint{margin-top:12px;color:#71717a;font-size:13px}
  </style>
</head>
<body>
  <div class="shell">
    <header>AI Workbench</header>
    <main>
      <section class="panel">
        <h1>核心对话入口暂时离线，但主程序已正常打开</h1>
        <p>下面这些环境项未就绪，工作台已经降级处理，没有白屏、没有崩溃：</p>
        <ul>${items || '<li>本机服务正在检查中。</li>'}</ul>
        <textarea placeholder="核心对话入口：服务恢复后可在这里继续输入目标。"></textarea>
        <button type="button">等待服务恢复</button>
        <div class="hint">如果一直不可用，请先关闭占用 18800 / 8787 / 5173 的程序，再重新打开工作台。</div>
      </section>
    </main>
  </div>
</body>
</html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  logMain('fallback-page:loaded');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

logMain(`startup argv=${JSON.stringify(process.argv)} packaged=${app.isPackaged}`);
const gotLock = smokeTestMode || app.requestSingleInstanceLock();
if (!gotLock) {
  logMain('single-instance-lock:failed');
  app.quit();
} else {
  logMain('single-instance-lock:ok');
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(smokeTestMode ? runSmokeTest : createWindow).catch((error) => {
    logMain(`createWindow:error ${error?.stack || error}`);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('before-quit', stopOwnedServices);
  app.on('will-quit', () => {
    logMain('app:will-quit');
  });
  app.on('quit', (_event, exitCode) => {
    logMain(`app:quit exitCode=${exitCode}`);
  });
  app.on('window-all-closed', () => {
    logMain('app:window-all-closed');
    if (process.platform !== 'darwin') app.quit();
  });
}
