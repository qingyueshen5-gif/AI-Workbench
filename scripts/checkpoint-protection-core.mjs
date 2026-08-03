import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const MANIFEST_SCHEMA = 'ai-workbench.checkpoint-pass/v1';
export const SAVE_STATUSES = new Set(['UNSAVED', 'SAVED']);
export const GATE_STATUSES = new Set(['NOT_RUN', 'WIP_NOT_GATED', 'GATE_PASSED', 'BLOCKED']);

export function checkpointState(input = {}) {
  const state = {
    saveStatus: input.saveStatus ?? 'UNSAVED',
    gateStatus: input.gateStatus ?? 'NOT_RUN',
    finalAcceptance: input.finalAcceptance ?? false,
    saved: input.saved ?? false
  };
  if (!SAVE_STATUSES.has(state.saveStatus)) throw new Error(`invalid saveStatus: ${state.saveStatus}`);
  if (!GATE_STATUSES.has(state.gateStatus)) throw new Error(`invalid gateStatus: ${state.gateStatus}`);
  if (typeof state.finalAcceptance !== 'boolean' || typeof state.saved !== 'boolean') throw new Error('finalAcceptance and saved must be boolean');
  if (state.saved && state.saveStatus !== 'SAVED') throw new Error('saved=true requires saveStatus=SAVED');
  if (state.saveStatus === 'SAVED' && !state.saved) throw new Error('saveStatus=SAVED requires saved=true');
  if (state.finalAcceptance && !(state.saveStatus === 'SAVED' && state.saved && state.gateStatus === 'GATE_PASSED')) {
    throw new Error('finalAcceptance=true requires SAVED, saved=true, and GATE_PASSED');
  }
  if (state.gateStatus !== 'GATE_PASSED' && state.finalAcceptance) throw new Error(`${state.gateStatus} requires finalAcceptance=false`);
  return state;
}

function normalizePath(value) {
  return resolve(value).replaceAll('\\', '/').toLowerCase();
}

export function isInside(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function git(repo, args, options = {}) {
  const safeRepo = resolve(repo).replaceAll('\\', '/');
  const result = spawnSync('git', ['-c', `safe.directory=${safeRepo}`, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || 'pipe'
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`);
  }
  const stdout = String(result.stdout || '');
  return options.raw ? stdout : stdout.trim();
}

export async function findRepoRoot(cwd = process.cwd()) {
  return git(cwd, ['rev-parse', '--show-toplevel']);
}

export function parsePorcelainZ(raw) {
  const entries = [];
  const parts = String(raw).split('\0');
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    const status = part.slice(0, 2);
    const path = part.slice(3);
    entries.push({ status, path });
    if (status.includes('R') || status.includes('C')) {
      const target = parts[index + 1];
      if (target) entries.push({ status, path: target });
      index += 1;
    }
  }
  return entries;
}

export function worktreeEntries(repo) {
  return parsePorcelainZ(git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { raw: true }));
}

export function normalizeAllowlist(paths) {
  const cleaned = [...new Set(paths.map((item) => String(item).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')))]
    .filter(Boolean)
    .sort();
  if (!cleaned.length) throw new Error('scope allowlist must contain at least one repository-relative path');
  for (const item of cleaned) {
    if (item === '.git' || item.startsWith('.git/') || item === '..' || item.startsWith('../') || isAbsolute(item)) {
      throw new Error(`invalid scope allowlist path: ${item}`);
    }
  }
  return cleaned;
}

export function pathAllowed(path, allowlist) {
  const normalized = String(path).replaceAll('\\', '/');
  return allowlist.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}/`));
}

export function assertScopedEntries(entries, allowlist, { requireChanges = false, requireClean = false } = {}) {
  if (requireClean && entries.length) throw new Error(`guard requires a clean checkpointed worktree; found: ${entries.map((item) => item.path).join(', ')}`);
  const outside = entries.filter((entry) => !pathAllowed(entry.path, allowlist));
  if (outside.length) throw new Error(`scope allowlist violation: ${outside.map((entry) => entry.path).join(', ')}`);
  if (requireChanges && !entries.length) throw new Error('focused gate passed but no scoped changes exist to checkpoint');
}

export async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Text(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

export async function readManifest(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (parsed.schema !== MANIFEST_SCHEMA) throw new Error(`unsupported manifest schema: ${parsed.schema || 'missing'}`);
  return parsed;
}

export async function assertExternalArtifact(repo, artifactPath) {
  const repoRoot = resolve(repo);
  const artifact = resolve(artifactPath);
  if (isInside(repoRoot, artifact)) throw new Error(`checkpoint artifact must be outside repository: ${artifact}`);
  const info = await stat(artifact);
  if (!info.isFile() || info.size === 0) throw new Error(`checkpoint artifact is missing or empty: ${artifact}`);
}

export async function assertExternalRecoveryArtifact(repo, artifactPath, expectedSha256 = '') {
  await assertExternalArtifact(repo, artifactPath);
  const artifact = resolve(artifactPath);
  if (!/^c:[\\/]/i.test(artifact)) throw new Error(`checkpoint recovery artifact must be on approved C drive: ${artifact}`);
  if (isInside(repo, artifact)) throw new Error(`checkpoint recovery artifact must be outside worktree: ${artifact}`);
  const actualSha256 = await sha256File(artifact);
  if (expectedSha256 && actualSha256 !== expectedSha256) throw new Error(`checkpoint recovery artifact SHA-256 mismatch: ${artifact}`);
  return { path: artifact, sha256: actualSha256 };
}

export async function assertWorktreeVolumeAvailable(repo, { requireWrite = false } = {}) {
  const root = resolve(repo);
  try { await access(root, constants.R_OK | (requireWrite ? constants.W_OK : 0)); }
  catch { throw new Error(`WORKTREE_VOLUME_UNAVAILABLE: ${root}`); }
  const head = git(root, ['rev-parse', 'HEAD']);
  git(root, ['status', '--porcelain=v1']);
  return { repoPath: root, worktreePath: root, volume: root.slice(0, 2), readable: true, writable: requireWrite ? true : null, head, gitStatusReadable: true };
}

export function repoIdentity(repo) {
  return {
    repoRoot: resolve(repo),
    branch: git(repo, ['branch', '--show-current']),
    head: git(repo, ['rev-parse', 'HEAD'])
  };
}

export function manifestRepoMatches(repo, manifest) {
  return normalizePath(repo) === normalizePath(manifest.repository?.root || '');
}
