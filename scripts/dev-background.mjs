import { createWriteStream, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { migrateLegacyRuntimeData, runtimeStartupErrorLogFile, runtimeStartupLogFile } from '../runtime-paths.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const viteCli = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
migrateLegacyRuntimeData(root);
const log = createWriteStream(runtimeStartupLogFile, { flags: 'a' });
const errorLog = createWriteStream(runtimeStartupErrorLogFile, { flags: 'a' });
const logFd = openSync(runtimeStartupLogFile, 'a');
const errorLogFd = openSync(runtimeStartupErrorLogFile, 'a');

function stamp(message) {
  log.write(`[${new Date().toISOString()}] ${message}\n`);
}

const processes = [
  spawn(process.execPath, ['model-proxy.mjs'], {
    cwd: root,
    stdio: ['ignore', logFd, errorLogFd],
    windowsHide: true
  }),
  spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    stdio: ['ignore', logFd, errorLogFd],
    windowsHide: true
  }),
  spawn(process.execPath, [viteCli, '--host', '127.0.0.1'], {
    cwd: root,
    stdio: ['ignore', logFd, errorLogFd],
    windowsHide: true
  })
];

stamp('AI Workbench background dev server starting.');

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

for (const child of processes) {
  child.on('exit', (code, signal) => {
    stamp(`Child process exited: pid=${child.pid} code=${code ?? ''} signal=${signal ?? ''}`);
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

setInterval(() => {
  stamp('AI Workbench background dev server heartbeat.');
}, 30 * 60 * 1000);
