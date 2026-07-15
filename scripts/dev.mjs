import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const viteBin = process.platform === 'win32'
  ? join(root, 'node_modules', '.bin', 'vite.cmd')
  : join(root, 'node_modules', '.bin', 'vite');

const processes = [
  spawn(process.execPath, ['server.mjs'], { cwd: root, stdio: 'inherit' }),
  spawn(viteBin, ['--host', '127.0.0.1'], { cwd: root, stdio: 'inherit', shell: false })
];

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}
