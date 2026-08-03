import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './checkpoint-protection-core.mjs';
import { scanDestructiveGitPaths } from './scan-git-destructive-bypasses.mjs';

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const scripts = {
  checkpoint: join(sourceRoot, 'scripts', 'run-focused-checkpoint.mjs'),
  guard: join(sourceRoot, 'scripts', 'git-guard.mjs')
};
const sandboxRoot = await mkdtemp(join(tmpdir(), 'checkpoint-protection-001-'));
const results = [];

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...(options.env || {}) } });
  if (options.expectSuccess !== false && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`);
  }
  return result;
}

function git(repo, args, options = {}) {
  return run('git', ['-c', `safe.directory=${resolve(repo).replaceAll('\\', '/')}`, ...args], repo, options);
}

async function makeRepo(name) {
  const repo = join(sandboxRoot, name);
  await mkdir(repo, { recursive: true });
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.name', 'Checkpoint Test']);
  git(repo, ['config', 'user.email', 'checkpoint@test.invalid']);
  await writeFile(join(repo, 'tracked.txt'), 'baseline\n');
  git(repo, ['add', 'tracked.txt']);
  git(repo, ['commit', '-q', '-m', 'baseline']);
  return { repo, baseline: git(repo, ['rev-parse', 'HEAD']).stdout.trim() };
}

function checkpoint(repo, manifest, archive, allow, command, options = {}) {
  const args = [scripts.checkpoint, '--ticket', options.ticket || 'TEST-CHECKPOINT', '--manifest', manifest, '--archive-dir', archive];
  for (const item of allow) args.push('--allow', item);
  args.push('--', ...command);
  return run(process.execPath, args, repo, { expectSuccess: options.expectSuccess, env: options.env });
}

async function scenario(name, fn) {
  await fn();
  results.push({ name, ok: true });
}

try {
  await scenario('01_pass_auto_checkpoint_manifest_patch_sha256_saved', async () => {
    const { repo, baseline } = await makeRepo('pass');
    await writeFile(join(repo, 'tracked.txt'), 'candidate\n');
    await writeFile(join(repo, 'new.txt'), 'new\n');
    const manifest = join(sandboxRoot, 'pass-evidence', 'pass.json');
    const archive = join(sandboxRoot, 'pass-evidence', 'archive');
    const result = checkpoint(repo, manifest, archive, ['tracked.txt', 'new.txt'], [process.execPath, '-e', "process.exit(0)"]);
    const saved = JSON.parse(await readFile(manifest, 'utf8'));
    assert.equal(saved.result, 'PASS');
    assert.equal(saved.testResult, 'PASS');
    assert.equal(saved.saved, true);
    assert.equal(saved.taskId, 'TEST-CHECKPOINT');
    assert.equal(saved.repository.baselineHead, baseline);
    assert.equal(saved.baseHead, baseline);
    assert.equal(saved.repoPath, resolve(repo));
    assert.ok(saved.diffHash);
    assert.deepEqual(saved.changedFiles, ['new.txt', 'tracked.txt']);
    assert.deepEqual(saved.untrackedFiles, ['new.txt']);
    assert.deepEqual(saved.testCommands, [[process.execPath, '-e', 'process.exit(0)']]);
    assert.ok(saved.passedAt);
    assert.ok(saved.agent);
    assert.notEqual(saved.checkpointCommit, baseline);
    assert.ok(saved.archive.path.startsWith(resolve(sandboxRoot)));
    assert.equal(await sha256File(saved.archive.path), saved.archive.sha256);
    assert.equal(saved.patchPath, saved.archive.path);
    assert.equal(saved.patchSha256, saved.archive.sha256);
    assert.match(await readFile(saved.archive.path, 'utf8'), /Subject: \[PATCH\]/);
    assert.equal(git(repo, ['status', '--porcelain']).stdout, '');
    assert.match(result.stdout, /"saved":true/);
  });

  await scenario('02_failed_gate_preserves_candidate_and_no_commit', async () => {
    const { repo, baseline } = await makeRepo('failure');
    await writeFile(join(repo, 'tracked.txt'), 'candidate remains\n');
    const manifest = join(sandboxRoot, 'failure-evidence', 'failure.json');
    const result = checkpoint(repo, manifest, join(sandboxRoot, 'failure-evidence', 'archive'), ['tracked.txt'], [process.execPath, '-e', "process.exit(7)"], { expectSuccess: false });
    assert.equal(result.status, 7);
    const failed = JSON.parse(await readFile(manifest, 'utf8'));
    assert.equal(failed.result, 'FIRST_FAILURE');
    assert.equal(failed.saved, false);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), baseline);
    assert.equal(await readFile(join(repo, 'tracked.txt'), 'utf8'), 'candidate remains\n');
    assert.match(git(repo, ['status', '--porcelain']).stdout, /tracked\.txt/);
  });

  await scenario('03_scope_allowlist_blocks_unrelated_changes', async () => {
    const { repo, baseline } = await makeRepo('scope');
    await writeFile(join(repo, 'tracked.txt'), 'allowed\n');
    await writeFile(join(repo, 'unrelated.txt'), 'outside\n');
    const result = checkpoint(repo, join(sandboxRoot, 'scope-evidence', 'scope.json'), join(sandboxRoot, 'scope-evidence', 'archive'), ['tracked.txt'], [process.execPath, '-e', "process.exit(0)"], { expectSuccess: false });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /scope allowlist violation: unrelated\.txt/);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), baseline);
    assert.equal(await readFile(join(repo, 'tracked.txt'), 'utf8'), 'allowed\n');
  });

  await scenario('04_restore_rejects_missing_or_tampered_pass_evidence', async () => {
    const { repo } = await makeRepo('tamper');
    await writeFile(join(repo, 'tracked.txt'), 'candidate\n');
    const manifest = join(sandboxRoot, 'tamper-evidence', 'pass.json');
    const archive = join(sandboxRoot, 'tamper-evidence', 'archive');
    checkpoint(repo, manifest, archive, ['tracked.txt'], [process.execPath, '-e', "process.exit(0)"]);
    const saved = JSON.parse(await readFile(manifest, 'utf8'));
    await writeFile(saved.archive.path, 'tampered\n');
    const result = run(process.execPath, [scripts.guard, 'restore', '--manifest', manifest], repo, { expectSuccess: false });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SHA-256 mismatch/);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), saved.checkpointCommit);
  });

  await scenario('05_restore_rejects_dirty_checkpoint_worktree', async () => {
    const { repo } = await makeRepo('dirty');
    await writeFile(join(repo, 'tracked.txt'), 'candidate\n');
    const manifest = join(sandboxRoot, 'dirty-evidence', 'pass.json');
    checkpoint(repo, manifest, join(sandboxRoot, 'dirty-evidence', 'archive'), ['tracked.txt'], [process.execPath, '-e', "process.exit(0)"]);
    await writeFile(join(repo, 'tracked.txt'), 'post-checkpoint dirty\n');
    const saved = JSON.parse(await readFile(manifest, 'utf8'));
    const result = run(process.execPath, [scripts.guard, 'restore', '--manifest', manifest], repo, { expectSuccess: false });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /clean checkpointed worktree/);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), saved.checkpointCommit);
    assert.equal(await readFile(join(repo, 'tracked.txt'), 'utf8'), 'post-checkpoint dirty\n');
  });

  await scenario('06_guarded_restore_resets_and_cleans_only_after_saved_pass', async () => {
    const { repo, baseline } = await makeRepo('restore');
    await writeFile(join(repo, 'tracked.txt'), 'candidate\n');
    await writeFile(join(repo, 'candidate-only.txt'), 'candidate untracked\n');
    const manifest = join(sandboxRoot, 'restore-evidence', 'pass.json');
    checkpoint(repo, manifest, join(sandboxRoot, 'restore-evidence', 'archive'), ['tracked.txt', 'candidate-only.txt'], [process.execPath, '-e', "process.exit(0)"]);
    const result = run(process.execPath, [scripts.guard, 'restore', '--manifest', manifest], repo);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), baseline);
    assert.equal(git(repo, ['status', '--porcelain']).stdout, '');
    assert.equal((await readFile(join(repo, 'tracked.txt'), 'utf8')).replaceAll('\r\n', '\n'), 'baseline\n');
    await assert.rejects(readFile(join(repo, 'candidate-only.txt'), 'utf8'), /ENOENT/);
    assert.match(result.stdout, /"action":"guarded_restore"/);
  });

  await scenario('07_scanner_blocks_production_bypass_and_allows_marked_fixture', async () => {
    const root = join(sandboxRoot, 'scanner');
    await mkdir(join(root, 'scripts'), { recursive: true });
    await writeFile(join(root, 'scripts', 'bad.mjs'), "const cmd = 'git reset --hard HEAD';\n"); // CHECKPOINT_PROTECTION_FIXTURE
    await writeFile(join(root, 'scripts', 'fixture.mjs'), "const cmd = 'git clean -fd'; // CHECKPOINT_PROTECTION_FIXTURE\n");
    let findings = await scanDestructiveGitPaths(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, 'scripts/bad.mjs');
    await writeFile(join(root, 'scripts', 'bad.mjs'), "const safe = true;\n");
    findings = await scanDestructiveGitPaths(root);
    assert.deepEqual(findings, []);
    const repositoryFindings = await scanDestructiveGitPaths(sourceRoot);
    assert.deepEqual(repositoryFindings, []);
  });

  await scenario('08_commit_failure_blocks_cleanup_and_preserves_candidate', async () => {
    const { repo, baseline } = await makeRepo('commit-failure');
    await writeFile(join(repo, 'tracked.txt'), 'candidate survives commit failure\n');
    const manifest = join(sandboxRoot, 'commit-failure-evidence', 'pass.json');
    const archive = join(sandboxRoot, 'commit-failure-evidence', 'archive');
    const result = checkpoint(repo, manifest, archive, ['tracked.txt'], [process.execPath, '-e', "process.exit(0)"], {
      expectSuccess: false,
      env: {
        GIT_CONFIG_NOSYSTEM: '1',
        HOME: join(sandboxRoot, 'no-git-identity'),
        USERPROFILE: join(sandboxRoot, 'no-git-identity'),
        GIT_AUTHOR_NAME: '',
        GIT_AUTHOR_EMAIL: '',
        GIT_COMMITTER_NAME: '',
        GIT_COMMITTER_EMAIL: ''
      }
    });
    assert.notEqual(result.status, 0);
    const failed = JSON.parse(await readFile(manifest, 'utf8'));
    assert.equal(failed.testResult, 'PASS');
    assert.equal(failed.saved, false);
    assert.ok(failed.diffHash);
    assert.match(failed.commitError, /failed/);
    assert.equal(git(repo, ['rev-parse', 'HEAD']).stdout.trim(), baseline);
    assert.equal(await readFile(join(repo, 'tracked.txt'), 'utf8'), 'candidate survives commit failure\n');
    assert.match(git(repo, ['status', '--porcelain']).stdout, /tracked\.txt/);
  });

  console.log(JSON.stringify({ ok: true, module: 'CHECKPOINT-PROTECTION-001', isolatedTemporaryRepositories: true, destructiveTestsInConstructionRepo: false, scenarios: results }, null, 2));
} finally {
  await rm(sandboxRoot, { recursive: true, force: true });
}
