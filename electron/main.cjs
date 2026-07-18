const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const packageInfo = require('../package.json');

const appVersion = packageInfo.version;
const windowTitle = `AI Workbench v${appVersion}`;
const endpoints = {
  modelProxy: 'http://127.0.0.1:18800/health',
  api: 'http://127.0.0.1:8787/api/data',
  app: 'http://127.0.0.1:8787/'
};
const ownedChildren = [];
let shuttingDown = false;

function checkUrl(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
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
  await waitForUrl(endpoints.modelProxy);
  await waitForUrl(endpoints.api);
}

function stopOwnedServices() {
  shuttingDown = true;
  for (const child of ownedChildren) {
    if (!child.killed) child.kill();
  }
}

async function createWindow() {
  await ensureInternalServices();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: windowTitle,
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.on('page-title-updated', (event) => {
    event.preventDefault();
    win.setTitle(windowTitle);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  await win.loadURL(endpoints.app);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('before-quit', stopOwnedServices);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
