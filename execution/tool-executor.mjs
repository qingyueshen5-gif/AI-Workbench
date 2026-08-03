import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';

function inside(root,target){const rel=relative(root,target);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));}
export async function resolveAllowedReadPath(path,allowedRoots,{realpath=fs.realpath}={}){
  const roots=await Promise.all(allowedRoots.map(async(root)=>realpath(resolve(root))));
  const target=await realpath(resolve(path));
  if(!roots.some((root)=>inside(root,target))){const error=new Error('拒绝读取：解析后的文件位置不在允许的读取范围内，没有执行文件读取。');error.publicMessage=error.message;error.code='FILE_READ_BOUNDARY_REJECTED';throw error;}
  return target;
}

export class ToolExecutor {
  constructor(options = {}) { this.root = options.root || process.cwd(); this.allowedRoots = options.allowedRoots || [this.root]; }
  async execute(messageId, call) {
    const boundedCall = call.type === 'read_file' ? { ...call, path: await resolveAllowedReadPath(call.path, this.allowedRoots) } : call;
    const payload = JSON.stringify({ messageId, call: boundedCall, allowedRoots: this.allowedRoots.map((item) => resolve(item)) });
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
