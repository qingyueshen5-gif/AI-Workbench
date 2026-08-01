import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { runtimeRoot } from '../runtime-paths.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ipcRoot = join(runtimeRoot, 'feishu-workbench-bridge', 'ipc');
const conversationRoot = join(runtimeRoot, 'feishu-workbench-bridge', 'conversations');
const env = {
  ...process.env,
  AIW_FEISHU_IPC_DIR: ipcRoot,
  AIW_CONVERSATION_DIR: conversationRoot,
  AIW_ASSISTANT_ALLOWED_ROOTS: [root, join(runtimeRoot, 'feishu-workbench-bridge', 'acceptance')].join(';'),
  AIW_RUNTIME_GIT_COMMIT: process.env.AIW_RUNTIME_GIT_COMMIT || ''
};
const children = [
  spawn(process.execPath, ['scripts/workbench-agent-runtime.mjs'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/workbench-feishu-adapter.mjs'], { cwd: root, env, stdio: 'inherit' })
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 50);
}
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
for (const child of children) child.once('exit', (code) => { if (!stopping && code) stop(code); });
