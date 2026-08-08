import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const child = spawn(process.execPath, [join(root, 'scripts', 'start-fixed-feishu-gateway.mjs')], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true
});

function stop(code = 0) {
  if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 50);
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
child.once('exit', (code) => process.exit(code || 0));
