import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, relative, resolve } from 'node:path';

function inside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('\\'));
}
function allowed(path, roots) {
  const target = resolve(path);
  if (!roots.some((root) => inside(root, target))) throw new Error('请求位置不在批准目录内');
  if (/(?:^|[\\/])(\.git|node_modules|\.env(?:\.|$)|credentials?|secrets?|tokens?|auth|cookies?)(?:[\\/]|$)/i.test(target)) throw new Error('请求位置属于受保护内容');
  return target;
}
async function sha256(path) {
  return createHash('sha256').update(await fs.readFile(path)).digest('hex');
}

export async function executeMinimalPlan(plan, options = {}) {
  const roots = options.allowedRoots || [process.cwd()];
  const results = [];
  for (const action of plan.actions || []) {
    if (action.type === 'read_file') {
      const path = allowed(action.path, roots);
      const content = await fs.readFile(path, 'utf8');
      results.push({ type: action.type, path, content, size: Buffer.byteLength(content), sha256: await sha256(path) });
    } else if (action.type === 'write_file') {
      const path = allowed(action.path, roots);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, String(action.content ?? ''), 'utf8');
      results.push({ type: action.type, path, size: Buffer.byteLength(String(action.content ?? '')), sha256: await sha256(path) });
    } else {
      throw new Error(`不支持的本地操作：${action.type}`);
    }
  }
  return { ok: true, results };
}

export async function verifyMinimalResult(plan, execution) {
  const results = [];
  for (const item of execution.results || []) {
    const stats = await fs.stat(item.path);
    if (!stats.isFile()) throw new Error('本地文件验证失败');
    results.push({ ...item, verified: false, executionStarted: true, executionCompleted: true, postconditionObserved: true, extension: extname(item.path), currentSha256: await sha256(item.path) });
  }
  return { ok: true, actions: plan.actions?.length || 0, results };
}
