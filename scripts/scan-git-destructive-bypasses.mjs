#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.yml', '.yaml', '.sh', '.ps1', '.bat', '.cmd']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const GUARDED_ENTRY = 'scripts/git-guard.mjs';
const FIXTURE_MARKER = 'CHECKPOINT_PROTECTION_FIXTURE';
const destructivePatterns = [
  new RegExp(['git', '\\s+', 'reset', '\\s+', '--hard'].join(''), 'i'),
  new RegExp(['git', '\\s+', 'clean', '\\s+', '-[^\\s]*f[^\\s]*d'].join(''), 'i'),
  new RegExp(['git', '\\s+', 'clean', '\\s+', '-[^\\s]*d[^\\s]*f'].join(''), 'i'),
  new RegExp(['reset', 'Hard'].join(''), 'i'),
  new RegExp("['\"]reset['\"]\\s*,\\s*['\"]--hard['\"]", 'i'),
  new RegExp("['\"]clean['\"]\\s*,\\s*['\"]-(?:fd|df)['\"]", 'i')
];

async function filesUnder(root) {
  const output = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) output.push(path);
    }
  }
  await visit(root);
  return output;
}

export async function scanDestructiveGitPaths(root) {
  const resolvedRoot = resolve(root);
  const findings = [];
  for (const path of await filesUnder(resolvedRoot)) {
    const repoPath = relative(resolvedRoot, path).replaceAll('\\', '/');
    const source = await readFile(path, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!destructivePatterns.some((pattern) => pattern.test(line))) return;
      if (repoPath === GUARDED_ENTRY) return;
      if (line.includes(FIXTURE_MARKER)) return;
      findings.push({ path: repoPath, line: index + 1, excerpt: line.trim().slice(0, 240) });
    });
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const root = resolve(process.argv[2] || process.cwd());
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error(`scan root is not a directory: ${root}`);
  const findings = await scanDestructiveGitPaths(root);
  const result = { ok: findings.length === 0, module: 'CHECKPOINT-PROTECTION-001', scanner: 'destructive-git-bypass', guardedEntry: GUARDED_ENTRY, fixtureMarker: FIXTURE_MARKER, findings };
  (findings.length ? process.stderr : process.stdout).write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length) process.exit(1);
}
