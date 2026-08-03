#!/usr/bin/env node
import { resolve } from 'node:path';
import {
  assertExternalArtifact,
  assertScopedEntries,
  findRepoRoot,
  git,
  manifestRepoMatches,
  readManifest,
  sha256File,
  worktreeEntries
} from './checkpoint-protection-core.mjs';

function parseArgs(argv) {
  if (argv[0] !== 'restore') throw new Error('only supported command: git-guard restore --manifest OUTSIDE.json');
  const manifestIndex = argv.indexOf('--manifest');
  if (manifestIndex === -1 || !argv[manifestIndex + 1]) throw new Error('missing --manifest');
  if (argv.length !== 3) throw new Error('unexpected arguments; restore target is fixed to manifest baselineHead');
  return resolve(argv[manifestIndex + 1]);
}

const manifestPath = parseArgs(process.argv.slice(2));
const repo = await findRepoRoot();
const manifest = await readManifest(manifestPath);
if (!manifestRepoMatches(repo, manifest)) throw new Error('manifest repository does not match current repository');
if (manifest.result !== 'PASS' || manifest.saved !== true) throw new Error('guard requires a machine-readable PASS manifest with saved=true');
if (!manifest.checkpointCommit || git(repo, ['rev-parse', 'HEAD']) !== manifest.checkpointCommit) throw new Error('current HEAD is not the saved checkpoint commit');
if (!manifest.repository?.baselineHead) throw new Error('manifest baselineHead is missing');
if (!manifest.archive?.path || !manifest.archive?.sha256) throw new Error('manifest archive metadata is incomplete');
await assertExternalArtifact(repo, manifest.archive.path);
const actualHash = await sha256File(manifest.archive.path);
if (actualHash !== manifest.archive.sha256) throw new Error(`checkpoint archive SHA-256 mismatch: expected ${manifest.archive.sha256}, got ${actualHash}`);
assertScopedEntries(worktreeEntries(repo), manifest.scopeAllowlist || [], { requireClean: true });

// CHECKPOINT_PROTECTION_GUARDED_ENTRY: the repository's sole permitted destructive Git path.
git(repo, ['reset', '--hard', manifest.repository.baselineHead], { stdio: 'inherit' });
git(repo, ['clean', '-fd'], { stdio: 'inherit' });
if (git(repo, ['rev-parse', 'HEAD']) !== manifest.repository.baselineHead) throw new Error('guarded restore did not reach manifest baselineHead');
assertScopedEntries(worktreeEntries(repo), manifest.scopeAllowlist || [], { requireClean: true });
process.stdout.write(`${JSON.stringify({ ok: true, module: 'CHECKPOINT-PROTECTION-001', action: 'guarded_restore', restoredHead: manifest.repository.baselineHead, savedCheckpoint: manifest.checkpointCommit, archiveSha256: actualHash })}\n`);
