import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

export class ToolExecutor {
  constructor(options = {}) { this.root = options.root || process.cwd(); this.allowedRoots = options.allowedRoots || [this.root]; }
  async execute(messageId, call) {
    const payload = JSON.stringify({ messageId, call, allowedRoots: this.allowedRoots.map((item) => resolve(item)) });
    return new Promise((resolveRun, rejectRun) => {
      const child = spawn(process.execPath, [join(this.root, 'scripts', 'unified-tool-worker.mjs')], { cwd: this.root, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += String(chunk); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });
      child.once('error', rejectRun);
      child.once('exit', (code) => {
        if (code !== 0) return rejectRun(new Error(stderr || stdout || '工具执行失败'));
        const parsed = JSON.parse(stdout);
        if (!parsed.ok) return rejectRun(new Error(parsed.message || '工具执行失败'));
        resolveRun(parsed.verification);
      });
      child.stdin.end(payload);
    });
  }
}
