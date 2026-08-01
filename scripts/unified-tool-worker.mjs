import fs from 'node:fs/promises';
import process from 'node:process';
import { createRequire } from 'node:module';
import { basename, extname, join, relative, resolve } from 'node:path';
import { executeMinimalPlan, verifyMinimalResult } from '../execution/minimal-desktop-executor.mjs';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');
const schema = {
  type: 'object', additionalProperties: false,
  required: ['messageId', 'call', 'allowedRoots'],
  properties: {
    messageId: { type: 'string', minLength: 1 },
    allowedRoots: { type: 'array', minItems: 1, items: { type: 'string', minLength: 3 } },
    call: {
      oneOf: [
        { type: 'object', additionalProperties: false, required: ['type', 'path'], properties: { type: { const: 'read_file' }, path: { type: 'string', minLength: 3 } } },
        { type: 'object', additionalProperties: false, required: ['type', 'path', 'content'], properties: { type: { const: 'write_file' }, path: { type: 'string', minLength: 3 }, content: { type: 'string' } } },
        { type: 'object', additionalProperties: false, required: ['type', 'url', 'query'], properties: { type: { const: 'web_extract' }, url: { type: 'string', pattern: '^https?://' }, query: { type: 'string', minLength: 1 } } },
        { type: 'object', additionalProperties: false, required: ['type', 'path'], properties: { type: { const: 'list_directory' }, path: { type: 'string', minLength: 3 } } },
        { type: 'object', additionalProperties: false, required: ['type', 'root', 'query'], properties: { type: { const: 'search_files' }, root: { type: 'string', minLength: 3 }, query: { type: 'string', minLength: 1, maxLength: 200 } } }
      ]
    }
  }
};
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
const sensitive = /(?:^|[\\/])(\.git|node_modules|\.env(?:\.|$)|credentials?|secrets?|tokens?|auth|cookies?)(?:[\\/]|$)/i;
const textExts = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv']);
function normalizePath(value) { return resolve(String(value || '')); }
function inside(root, target) { const rel = relative(root, target); return rel === '' || (!rel.startsWith('..') && !resolve(rel).startsWith('\\')); }
function assertAllowed(target, roots) {
  const resolved = normalizePath(target);
  if (!roots.some((root) => inside(root, resolved))) throw new Error('请求位置不在批准目录内');
  if (sensitive.test(resolved)) throw new Error('请求位置属于受保护内容');
  return resolved;
}
async function listDirectory(path, roots) {
  const target = assertAllowed(path, roots);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return { ok: true, type: 'list_directory', path: target, entries: entries.filter((item) => !sensitive.test(join(target, item.name))).slice(0, 200).map((item) => ({ name: item.name, path: join(target, item.name), kind: item.isDirectory() ? 'directory' : 'file' })) };
}
async function searchFiles(root, query, roots) {
  const target = assertAllowed(root, roots);
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const results = []; const queue = [{ path: target, depth: 0 }]; const maxDepth = 6; const maxFiles = 1500; const maxResults = 40; let scanned = 0;
  while (queue.length && scanned < maxFiles) {
    const current = queue.shift(); let entries;
    try { entries = await fs.readdir(current.path, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (scanned >= maxFiles) break;
      const path = join(current.path, entry.name); if (sensitive.test(path)) continue;
      if (entry.isDirectory()) { if (current.depth < maxDepth) queue.push({ path, depth: current.depth + 1 }); continue; }
      scanned += 1; const lowerName = entry.name.toLowerCase(); let score = terms.filter((term) => lowerName.includes(term)).length * 3; let matchedText = '';
      if (score === 0 && textExts.has(extname(entry.name).toLowerCase())) {
        try { const text = (await fs.readFile(path, 'utf8')).slice(0, 120000).toLowerCase(); const hits = terms.filter((term) => text.includes(term)); score += hits.length; matchedText = hits.slice(0, 4).join(', '); } catch {}
      }
      if (score > 0) {
        results.push({ path, name: basename(path), score, matchedText });
        results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
        if (results.length > maxResults) results.length = maxResults;
      }
    }
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { ok: true, type: 'search_files', root: target, query, scanned, limited: scanned >= maxFiles || results.length >= maxResults, matches: results.slice(0, maxResults) };
}

async function main() {
  let raw = ''; for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw); if (!validate(input)) throw new Error('工具请求校验失败');
  const roots = input.allowedRoots.map(normalizePath);
  if (input.call.type === 'list_directory') return process.stdout.write(JSON.stringify({ ok: true, verification: await listDirectory(input.call.path, roots) }));
  if (input.call.type === 'search_files') return process.stdout.write(JSON.stringify({ ok: true, verification: await searchFiles(input.call.root, input.call.query, roots) }));
  const normalizedCall = { ...input.call }; if (normalizedCall.path) normalizedCall.path = assertAllowed(normalizedCall.path, roots);
  const plan = { version: 1, goal: 'Execute approved local tool call', actions: [normalizedCall], doneWhen: ['Independent verification succeeds'] };
  const execution = await executeMinimalPlan(plan, { allowedRoots: roots });
  const verification = await verifyMinimalResult(plan, execution, { allowedRoots: roots });
  process.stdout.write(JSON.stringify({ ok: true, verification }));
}
main().catch((error) => { if (process.env.AIW_TOOL_DEBUG === '1') process.stderr.write(`${error?.stack || error}\n`); process.stdout.write(JSON.stringify({ ok: false, message: error?.publicMessage || '工具执行失败。' })); process.exitCode = 1; });
