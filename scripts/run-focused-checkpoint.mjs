#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import {
  MANIFEST_SCHEMA,
  assertExternalRecoveryArtifact,
  checkpointState,
  assertScopedEntries,
  assertWorktreeVolumeAvailable,
  findRepoRoot,
  git,
  isInside,
  normalizeAllowlist,
  repoIdentity,
  sha256File,
  sha256Text,
  worktreeEntries,
  writeJsonAtomic
} from './checkpoint-protection-core.mjs';

function parseArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator === -1 || separator === argv.length - 1) throw new Error('usage: run-focused-checkpoint --ticket ID --manifest OUTSIDE.json --archive-dir OUTSIDE_DIR --allow PATH [--allow PATH] -- command [args...]');
  const options = { allow: [], command: argv.slice(separator + 1), gateStatus: 'NOT_RUN', finalAcceptance: false };
  for (let index = 0; index < separator; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--allow') options.allow.push(value);
    else if (key === '--ticket' || key === '--manifest' || key === '--archive-dir' || key === '--message') options[key.slice(2)] = value;
    else if (key === '--save-status') options.saveStatus = value;
    else if (key === '--gate-status') options.gateStatus = value;
    else if (key === '--final-acceptance') {
      if (!['true', 'false'].includes(value)) throw new Error('--final-acceptance must be true or false');
      options.finalAcceptance = value === 'true';
    }
    else throw new Error(`unknown option: ${key}`);
    index += 1;
  }
  for (const required of ['ticket', 'manifest', 'archive-dir']) if (!options[required]) throw new Error(`missing --${required}`);
  return options;
}

function runGate(repo, command) {
  const result = spawnSync(command[0], command.slice(1), { cwd: repo, encoding: 'utf8', env: process.env, shell: false });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { exitCode: result.status, signal: result.signal || null, error: result.error?.message || null };
}

const options = parseArgs(process.argv.slice(2));
const repo = await findRepoRoot();
await assertWorktreeVolumeAvailable(repo, { requireWrite: true });
const allowlist = normalizeAllowlist(options.allow);
const baseline = repoIdentity(repo);
const manifestPath = resolve(options.manifest);
const archiveDir = resolve(options['archive-dir']);
if (options.saveStatus && options.saveStatus !== 'SAVED') throw new Error('successful checkpoint output requires --save-status SAVED');
const requestedSavedState = checkpointState({ saveStatus: 'SAVED', saved: true, gateStatus: options.gateStatus, finalAcceptance: options.finalAcceptance });
if (isInside(repo, manifestPath)) throw new Error('PASS manifest must be outside repository');
if (isInside(repo, archiveDir)) throw new Error('archive directory must be outside repository');

const gate = runGate(repo, options.command);
const passedAt = gate.exitCode === 0 ? new Date().toISOString() : null;
const agent = process.env.AIW_CHECKPOINT_AGENT || process.env.HERMES_AGENT_ID || 'checkpoint-protection-runner';
const baseManifest = {
  schema: MANIFEST_SCHEMA,
  taskId: options.ticket,
  ticket: options.ticket,
  result: gate.exitCode === 0 ? 'PASS_PENDING_SAVE' : 'FIRST_FAILURE',
  saveStatus: 'UNSAVED',
  gateStatus: gate.exitCode === 0 ? 'NOT_RUN' : 'BLOCKED',
  finalAcceptance: false,
  failureClassification: gate.exitCode === 0 ? null : 'UNKNOWN_FAILURE',
  testResult: gate.exitCode === 0 ? 'PASS' : 'FAIL',
  repository: { root: baseline.repoRoot, branch: baseline.branch, baselineHead: baseline.head },
  repoPath: baseline.repoRoot,
  branch: baseline.branch,
  baseHead: baseline.head,
  scopeAllowlist: allowlist,
  focusedGate: { command: options.command, ...gate },
  testCommands: [options.command],
  passedAt,
  agent,
  diffHash: null,
  changedFiles: [],
  untrackedFiles: [],
  checkpointCommit: null,
  patchPath: null,
  patchSha256: null,
  archive: null,
  saved: false,
  updatedAt: new Date().toISOString()
};

if (gate.exitCode !== 0) {
  await writeJsonAtomic(manifestPath, baseManifest);
  process.stderr.write(`${JSON.stringify(baseManifest)}\n`);
  process.exit(gate.exitCode || 1);
}

const passedEntries = worktreeEntries(repo);
assertScopedEntries(passedEntries, allowlist, { requireChanges: true });
const untrackedFiles = passedEntries.filter((entry) => entry.status === '??').map((entry) => entry.path).sort();
const changedFiles = [...new Set(passedEntries.map((entry) => entry.path))].sort();
git(repo, ['add', '--', ...allowlist]);
const staged = git(repo, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
assertScopedEntries(staged.map((path) => ({ status: 'S ', path })), allowlist, { requireChanges: true });
const remaining = worktreeEntries(repo).filter((entry) => !staged.includes(entry.path));
assertScopedEntries(remaining, allowlist);
const diffHash = sha256Text(git(repo, ['diff', '--cached', '--binary'], { raw: true }));
const pendingManifest = {
  ...baseManifest,
  diffHash,
  changedFiles,
  untrackedFiles,
  updatedAt: new Date().toISOString()
};
await writeJsonAtomic(manifestPath, pendingManifest);
try {
  git(repo, ['commit', '-m', options.message || `checkpoint: ${options.ticket} focused PASS`]);
} catch (error) {
  await writeJsonAtomic(manifestPath, {
    ...pendingManifest,
    commitError: error.message,
    saveStatus: 'UNSAVED',
    finalAcceptance: false,
    saved: false,
    updatedAt: new Date().toISOString()
  });
  throw error;
}
const checkpointCommit = git(repo, ['rev-parse', 'HEAD']);
assertScopedEntries(worktreeEntries(repo), allowlist, { requireClean: true });

const patchName = `${options.ticket}-${checkpointCommit.slice(0, 12)}.patch`;
const patchPath = join(archiveDir, patchName);
const patch = git(repo, ['format-patch', '-1', checkpointCommit, '--stdout']);
await writeJsonAtomic(manifestPath, { ...pendingManifest, result: 'PASS_PENDING_SAVE', checkpointCommit, updatedAt: new Date().toISOString() });
const { mkdir, writeFile } = await import('node:fs/promises');
await mkdir(archiveDir, { recursive: true });
await writeFile(patchPath, patch, 'utf8');
const sha256 = await sha256File(patchPath);
await assertExternalRecoveryArtifact(repo, patchPath, sha256);
const commitProbe = git(repo, ['cat-file', '-e', `${checkpointCommit}^{commit}`], { allowFailure: true });
if (commitProbe.status !== 0) throw new Error(`checkpoint commit does not exist: ${checkpointCommit}`);
const passed = {
  ...pendingManifest,
  result: 'PASS',
  ...requestedSavedState,
  failureClassification: null,
  checkpointCommit,
  archive: { path: resolve(patchPath), file: basename(patchPath), sha256, format: 'git-format-patch' },
  patchPath: resolve(patchPath),
  patchSha256: sha256,

  savedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
await writeJsonAtomic(manifestPath, passed);
process.stdout.write(`${JSON.stringify(passed)}\n`);
