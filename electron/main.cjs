const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const packageInfo = require('../package.json');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

function logMain(message) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'electron-main.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

const appVersion = packageInfo.version;
const windowTitle = `AI Workbench v${appVersion}`;
const remoteDebugArg = process.argv.find((arg) => arg.startsWith('--remote-debugging-port='));
if (remoteDebugArg) {
  const [, port] = remoteDebugArg.split('=');
  if (port) app.commandLine.appendSwitch('remote-debugging-port', port);
}
const endpoints = {
  modelProxy: 'http://127.0.0.1:18800/health',
  api: 'http://127.0.0.1:8787/api/data',
  app: 'http://127.0.0.1:8787/'
};
const ownedChildren = [];
let shuttingDown = false;
let mainWindow = null;

process.on('uncaughtException', (error) => {
  logMain(`uncaughtException ${error?.stack || error}`);
  throw error;
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

async function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkUrl(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startNodeScript(name, scriptPath) {
  const serviceCwd = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  const child = spawn(process.execPath, [scriptPath], {
    cwd: serviceCwd,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'ignore'
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
}

async function ensureInternalServices() {
  const appPath = app.getAppPath();
  if (!await checkUrl(endpoints.modelProxy)) {
    startNodeScript('model-proxy', path.join(appPath, 'model-proxy.mjs'));
  }
  if (!await checkUrl(endpoints.api)) {
    startNodeScript('api', path.join(appPath, 'server.mjs'));
  }
  await Promise.all([
    waitForUrl(endpoints.modelProxy),
    waitForUrl(endpoints.api)
  ]);
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

  await ensureInternalServices();
  logMain('createWindow:services-ready');
  logMain(`loadURL:start ${endpoints.app}`);
  await win.loadURL(endpoints.app);
  logMain('createWindow:loaded');
}

logMain(`startup argv=${JSON.stringify(process.argv)} packaged=${app.isPackaged}`);
const gotLock = app.requestSingleInstanceLock();
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

  app.whenReady().then(createWindow).catch((error) => {
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
