#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const schemaVersion = 'ai-workbench.exec-guard/v1';
const mode = process.argv[2];
const argv = process.argv.slice(3);

function parseArgs(args) {
  const out = { allow: [], allowDirty: [] };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (key === '--') continue;
    if (!key.startsWith('--')) throw new Error(`UNKNOWN_ARGUMENT:${key}`);
    const name = key.slice(2);
    if (name === 'require-node-modules') { out.require_node_modules = 'true'; continue; }
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`MISSING_VALUE:${key}`);
    if (name === 'allow') out.allow.push(value);
    else if (name === 'allow-dirty') out.allowDirty.push(value);
    else out[name.replaceAll('-', '_')] = value;
  }
  return out;
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell: false });
  return { exitCode: result.status ?? 1, stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), error: result.error?.message || null };
}
function git(cwd, args, env = process.env) { return run('git', args, cwd, env); }
function trim(result) { return result.stdout.trim(); }
function sha256File(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function normalize(path) { return String(path).replaceAll('\\', '/').replace(/^\.\//, ''); }
function validateRepoRelative(path) {
  const raw = String(path);
  const normalized = normalize(raw);
  if (!normalized || isAbsolute(raw) || isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) throw new Error(`INVALID_REPO_RELATIVE_PATH:${raw}`);
  return normalized;
}
function unique(paths) { return [...new Set(paths.map(validateRepoRelative).filter(Boolean))].sort(); }
function parseStatus(raw) {
  return raw.split('\0').filter(Boolean).map((entry) => {
    if (entry.startsWith('? ')) return { code: '??', path: normalize(entry.slice(2)) };
    if (entry.startsWith('! ')) return { code: '!!', path: normalize(entry.slice(2)) };
    const parts = entry.split(' ');
    const code = parts[1] || '';
    const path = normalize(parts.slice(code.startsWith('2') ? 9 : 8).join(' ').replace(/^.*\t/, ''));
    return { code, path };
  });
}
function repoRoot(cwd) {
  const result = git(cwd, ['rev-parse', '--show-toplevel']);
  if (result.exitCode !== 0) throw new Error(`REPO_ROOT_FAILED:${result.stderr.trim()}`);
  return resolve(trim(result));
}
function branchName(repo) { return trim(git(repo, ['branch', '--show-current'])); }
function head(repo) { return trim(git(repo, ['rev-parse', 'HEAD'])); }
function remoteHead(repo, branch) {
  const result = git(repo, ['ls-remote', 'origin', `refs/heads/${branch}`]);
  if (result.exitCode !== 0) return { value: null, failure: `REMOTE_UNREACHABLE:${result.stderr.trim()}`, result };
  const value = result.stdout.trim().split(/\s+/)[0] || null;
  return value ? { value, failure: null, result } : { value: null, failure: 'REMOTE_REF_MISSING', result };
}
function aheadBehind(repo, branch) {
  const result = git(repo, ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`]);
  if (result.exitCode !== 0) return { ahead: null, behind: null, failure: `AHEAD_BEHIND_FAILED:${result.stderr.trim()}` };
  const [behind, ahead] = trim(result).split(/\s+/).map(Number);
  return { ahead, behind, failure: null };
}
function status(repo) {
  const result = git(repo, ['status', '--porcelain=v2', '-z', '--untracked-files=all']);
  return { raw: result.stdout, entries: parseStatus(result.stdout), exitCode: result.exitCode };
}
function exactSet(actual, expected) {
  const a = unique(actual); const e = unique(expected);
  return a.length === e.length && a.every((value, index) => value === e[index]);
}
function expectedNumber(value, fallback) { return value === undefined ? fallback : Number(value); }
function checkIdentity(repo, options, failures) {
  const branch = branchName(repo); const currentHead = head(repo); const remote = remoteHead(repo, branch); const counts = aheadBehind(repo, branch);
  if (options.expected_head && currentHead !== options.expected_head) failures.push(`HEAD_MISMATCH:${currentHead}`);
  if (options.expected_branch && branch !== options.expected_branch) failures.push(`BRANCH_MISMATCH:${branch}`);
  if (remote.failure) failures.push(remote.failure); else if (options.expected_remote && remote.value !== options.expected_remote) failures.push(`REMOTE_MISMATCH:${remote.value}`);
  if (options.expected_ahead !== undefined && counts.ahead !== expectedNumber(options.expected_ahead)) failures.push(`AHEAD_MISMATCH:${counts.ahead}`);
  if (options.expected_behind !== undefined && counts.behind !== expectedNumber(options.expected_behind)) failures.push(`BEHIND_MISMATCH:${counts.behind}`);
  return { branch, head: currentHead, remote: remote.value, ahead: counts.ahead, behind: counts.behind };
}
function baseFacts(repo) {
  const s = status(repo); const cached = git(repo, ['diff', '--cached', '--quiet', 'HEAD', '--']); const diffFiles = git(repo, ['diff-files', '--quiet']);
  const untracked = s.entries.filter((x) => x.code === '??').map((x) => x.path);
  return { status: s, cached, diffFiles, untracked, gitIndexFile: process.env.GIT_INDEX_FILE || 'NOT_SET', indexLockExists: existsSync(resolve(repo, '.git', 'index.lock')), gitUserNamePresent: Boolean(trim(git(repo, ['config', 'user.name']))), gitUserEmailPresent: Boolean(trim(git(repo, ['config', 'user.email']))), nodeModulesPresent: existsSync(resolve(repo, 'node_modules')) };
}
function emit(value, exitCode = value.ok ? 0 : 1) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); process.exit(exitCode); }

async function preflight(options) {
  const repo = repoRoot(process.cwd()); const failures = []; const identity = checkIdentity(repo, options, failures); const facts = baseFacts(repo);
  const trackedDirty = facts.status.entries.filter((x) => x.code !== '??');
  const untracked = facts.status.entries.filter((x) => x.code === '??');
  const allowedDirty = unique(options.allowDirty);
  const allowlistedTrackedDirty = trackedDirty.filter((x) => allowedDirty.includes(x.path)).map((x) => x.path).sort();
  const allowlistedUntracked = untracked.filter((x) => allowedDirty.includes(x.path)).map((x) => x.path).sort();
  const unauthorizedTrackedDirty = trackedDirty.filter((x) => !allowedDirty.includes(x.path)).map((x) => x.path).sort();
  const unauthorizedUntracked = untracked.filter((x) => !allowedDirty.includes(x.path)).map((x) => x.path).sort();
  const actualAuthorized = [...allowlistedTrackedDirty, ...allowlistedUntracked];
  const missingAllowedDirty = allowedDirty.filter((path) => !actualAuthorized.includes(path));
  if (unauthorizedTrackedDirty.length) failures.push(`WORKTREE_DIRTY:${unauthorizedTrackedDirty.join(',')}`);
  if (missingAllowedDirty.length) failures.push(`ALLOW_DIRTY_NOT_DIRTY:${missingAllowedDirty.join(',')}`);
  if (facts.cached.exitCode !== 0) failures.push('STAGING_NOT_CLEAN');
  if (unauthorizedUntracked.length) failures.push(`NONIGNORED_UNTRACKED:${unauthorizedUntracked.join(',')}`);
  if (facts.gitIndexFile !== 'NOT_SET') failures.push('GIT_INDEX_FILE_SET');
  if (facts.indexLockExists) failures.push('INDEX_LOCK_EXISTS');
  if (!facts.gitUserNamePresent) failures.push('GIT_USER_NAME_MISSING');
  if (!facts.gitUserEmailPresent) failures.push('GIT_USER_EMAIL_MISSING');
  if (options.require_node_modules === 'true' && !facts.nodeModulesPresent) failures.push('NODE_MODULES_MISSING');
  emit({ schemaVersion, mode: 'preflight', ok: failures.length === 0, repoRoot: repo, ...identity, worktreeClean: trackedDirty.length === 0 && untracked.length === 0, stagingClean: facts.cached.exitCode === 0, nonIgnoredUntrackedCount: untracked.length, gitIndexFile: facts.gitIndexFile, indexLockExists: facts.indexLockExists, gitUserNamePresent: facts.gitUserNamePresent, gitUserEmailPresent: facts.gitUserEmailPresent, nodeModulesPresent: facts.nodeModulesPresent, allowedDirty, allowlistedTrackedDirty, allowlistedUntracked, unauthorizedTrackedDirty, unauthorizedUntracked, failures });
}

async function postcommit(options) {
  const repo = repoRoot(process.cwd()); const failures = []; const identity = checkIdentity(repo, options, failures); const facts = baseFacts(repo); const allow = unique(options.allow);
  if (!allow.length) failures.push('ALLOWLIST_EMPTY');
  if (facts.gitIndexFile !== 'NOT_SET') failures.push('GIT_INDEX_FILE_SET');
  if (facts.indexLockExists) failures.push('INDEX_LOCK_EXISTS');
  if (facts.cached.exitCode !== 0) failures.push('STAGING_NOT_CLEAN');
  if (facts.untracked.length) failures.push(`NONIGNORED_UNTRACKED:${facts.untracked.join(',')}`);
  const parent = trim(git(repo, ['rev-parse', 'HEAD^']));
  if (options.expected_parent && parent !== options.expected_parent) failures.push(`PARENT_MISMATCH:${parent}`);
  const changed = trim(git(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])).split(/\r?\n/).filter(Boolean).map(normalize);
  if (!exactSet(changed, allow)) failures.push(`COMMIT_ALLOWLIST_MISMATCH:${changed.join(',')}`);
  for (const path of allow) { const rel = relative(repo, resolve(repo, path)); if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(resolve(repo, path))) failures.push(`INVALID_ALLOW_PATH:${path}`); }
  const indexPath = resolve(repo, '.git', 'index'); const realIndexSha256Before = sha256File(indexPath); const before = Object.fromEntries(allow.filter((p) => existsSync(resolve(repo,p))).map((p) => [p, sha256File(resolve(repo,p))]));
  if (failures.length) emit({ schemaVersion, mode:'postcommit', ok:false, repoRoot:repo, ...identity, parent, changedFiles:changed, allow, realIndexSha256Before, allowlistedFileSha256Before:before, failures });
  const readTree = git(repo, ['read-tree', 'HEAD']);
  const refresh = readTree.exitCode === 0 ? git(repo, ['update-index', '--refresh']) : { exitCode: 1 };
  const cached = git(repo, ['diff', '--cached', '--quiet', 'HEAD', '--']); const diffFiles = git(repo, ['diff-files', '--quiet']); const finalStatus = status(repo);
  const after = Object.fromEntries(allow.map((p) => [p, sha256File(resolve(repo,p))])); const bytesUnchanged = JSON.stringify(before) === JSON.stringify(after);
  const finalUntracked = finalStatus.entries.filter((x)=>x.code==='??');
  if (readTree.exitCode) failures.push('READ_TREE_FAILED'); if (refresh.exitCode) failures.push('UPDATE_INDEX_REFRESH_FAILED'); if (cached.exitCode) failures.push('CACHED_DIFF_NOT_CLEAN'); if (diffFiles.exitCode) failures.push('DIFF_FILES_NOT_CLEAN'); if (finalStatus.entries.length) failures.push('STATUS_NOT_CLEAN'); if (!bytesUnchanged) failures.push('WORKTREE_BYTES_CHANGED'); if (process.env.GIT_INDEX_FILE) failures.push('GIT_INDEX_FILE_LEAK');
  emit({ schemaVersion, mode:'postcommit', ok:failures.length===0, repoRoot:repo, ...identity, parent, changedFiles:changed, allow, readTreeExitCode:readTree.exitCode, updateIndexRefreshExitCode:refresh.exitCode, cachedDiffExitCode:cached.exitCode, diffFilesExitCode:diffFiles.exitCode, statusPorcelainEmpty:finalStatus.entries.length===0, nonIgnoredUntrackedCount:finalUntracked.length, worktreeBytesUnchanged:bytesUnchanged, realIndexSynchronized:cached.exitCode===0 && diffFiles.exitCode===0 && finalStatus.entries.length===0, realIndexSha256Before, realIndexSha256After:sha256File(indexPath), allowlistedFileSha256Before:before, allowlistedFileSha256After:after, gitIndexFile:process.env.GIT_INDEX_FILE||'NOT_SET', failures });
}

async function report(options) {
  const repo=repoRoot(process.cwd()); const branch=branchName(repo); const currentHead=head(repo); const remote=remoteHead(repo,branch); const counts=aheadBehind(repo,branch); const facts=baseFacts(repo); const parent=trim(git(repo,['rev-parse','HEAD^'])); const headTree=trim(git(repo,['rev-parse','HEAD^{tree}']));
  let checkpoint={ name:'NOT_PROVIDED', commit:'NOT_PROVIDED', manifestPath:'NOT_PROVIDED', manifestSha256:'NOT_PROVIDED', patchPath:'NOT_PROVIDED', patchSha256:'NOT_PROVIDED' };
  if (options.checkpoint_name || options.manifest_path) {
    const manifestPath=options.manifest_path ? resolve(options.manifest_path) : null;
    if (manifestPath && existsSync(manifestPath)) { const manifest=JSON.parse(readFileSync(manifestPath,'utf8')); const patchPath=manifest.patchPath || manifest.archive?.path; checkpoint={ name:options.checkpoint_name||manifest.ticket||'NOT_PROVIDED', commit:manifest.checkpointCommit||'NOT_PROVIDED', manifestPath, manifestSha256:sha256File(manifestPath), patchPath:patchPath||'NOT_PROVIDED', patchSha256:patchPath&&existsSync(patchPath)?sha256File(patchPath):'NOT_PROVIDED' }; }
  }
  const worktree=facts.diffFiles.exitCode===0?'clean':'dirty'; const staging=facts.cached.exitCode===0?'clean':'dirty'; const untracked=facts.untracked.length?facts.untracked:'none';
  const handoffHeader={ finalHEAD:currentHead, gitLsRemote:remote.value||'UNRESOLVED', checkpointName:checkpoint.name, checkpointCommit:checkpoint.commit, manifestPath:checkpoint.manifestPath, manifestSha256:checkpoint.manifestSha256, patchPath:checkpoint.patchPath, patchSha256:checkpoint.patchSha256, worktree, staging, nonIgnoredUntracked:untracked, unsavedWip:'none' };
  emit({ schemaVersion, mode:'report', ok:!remote.failure, generatedAtUtc:new Date().toISOString(), repoRoot:repo, branch, head:currentHead, headTree, parent, remote:remote.value, ahead:counts.ahead, behind:counts.behind, worktree, staging, nonIgnoredUntracked:untracked, gitIndexFile:facts.gitIndexFile, indexLockExists:facts.indexLockExists, realIndexSha256:sha256File(resolve(repo,'.git','index')), gitUserNamePresent:facts.gitUserNamePresent, gitUserEmailPresent:facts.gitUserEmailPresent, nodeModulesPresent:facts.nodeModulesPresent, handoffHeader, failures:remote.failure?[remote.failure]:[] });
}

try {
  const options=parseArgs(argv);
  if (mode==='preflight') await preflight(options);
  else if (mode==='postcommit') await postcommit(options);
  else if (mode==='report') await report(options);
  else throw new Error(`UNKNOWN_MODE:${mode}`);
} catch (error) {
  emit({ schemaVersion, mode:mode||'unknown', ok:false, failures:[error.message] }, 2);
}
