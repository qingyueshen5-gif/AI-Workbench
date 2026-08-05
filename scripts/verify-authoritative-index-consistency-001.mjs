import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const indexPath = resolve(root, 'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json');
const failures = [];
const checks = [];

function check(id, condition, detail) {
  checks.push({ id, ok: Boolean(condition), detail });
  if (!condition) failures.push({ id, detail });
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

check('INDEX_EXISTS', existsSync(indexPath), indexPath);
let index;
try {
  index = JSON.parse(readFileSync(indexPath, 'utf8'));
  check('INDEX_JSON_VALID', true, 'valid JSON');
} catch (error) {
  check('INDEX_JSON_VALID', false, error.message);
  process.stderr.write(`${JSON.stringify({ ok: false, failures, checks }, null, 2)}\n`);
  process.exitCode = 1;
  throw error;
}

const head = git(['rev-parse', 'HEAD']);
check('SCHEMA_VERSION', typeof index.schemaVersion === 'string' && index.schemaVersion.length > 0, index.schemaVersion);
check('GENERATED_HEAD_EXISTS', /^[0-9a-f]{40}$/.test(index.generatedFromHead || ''), index.generatedFromHead);
check('GENERATED_REMOTE_EQUALS_GENERATED_HEAD', index.generatedFromRemote === index.generatedFromHead, `${index.generatedFromRemote} / ${index.generatedFromHead}`);
let generatedHeadIsAncestor = false;
try {
  execFileSync('git', ['merge-base', '--is-ancestor', index.generatedFromHead, head], { cwd: root, stdio: 'ignore' });
  generatedHeadIsAncestor = true;
} catch {}
check('GENERATED_HEAD_IS_CURRENT_OR_ANCESTOR', generatedHeadIsAncestor, `${index.generatedFromHead} -> ${head}`);
check('BRANCH', index.branch === git(['branch', '--show-current']), index.branch);

for (const item of index.checkpointInventory || []) {
  const dirExists = existsSync(resolve(item.manifestPath, '..'));
  check(`CHECKPOINT_DIR:${item.directoryName}`, dirExists, item.manifestPath);
  if (!item.manifestReadable) {
    check(`UNREADABLE_MANIFEST_EXPLICIT:${item.directoryName}`, item.checkpointCommit === null && item.patchPath === null, 'explicit legacy/unreadable directory');
    continue;
  }
  check(`MANIFEST_EXISTS:${item.directoryName}`, existsSync(item.manifestPath), item.manifestPath);
  check(`COMMIT_EXISTS:${item.directoryName}`, item.commitExists === true, item.checkpointCommit);
  check(`COMMIT_ANCESTOR:${item.directoryName}`, item.commitIsAncestorOfGeneratedHead === true, item.checkpointCommit);
  check(`PATCH_EXISTS:${item.directoryName}`, item.patchExists === true && existsSync(item.patchPath), item.patchPath);
  const actual = item.patchExists && existsSync(item.patchPath) ? sha256(item.patchPath) : null;
  check(`PATCH_SHA:${item.directoryName}`, actual !== null && actual === item.manifestPatchSha256 && actual === item.actualPatchSha256 && item.patchHashMatch === true, actual);
}

const expectedStatuses = {
  step5A: 'PRESENT_AND_VERIFIED',
  step5B: 'PRESENT_AND_VERIFIED',
  step5C: 'PRESENT_AND_VERIFIED',
  step5D: 'PRESENT_AND_VERIFIED',
  step5E: 'ACTUALLY_MISSING',
  step6: 'ACTUALLY_MISSING',
  step7: 'ACTUALLY_MISSING'
};
for (const [key, expected] of Object.entries(expectedStatuses)) {
  const step = index.steps?.[key];
  check(`STEP_EXISTS:${key}`, Boolean(step), key);
  check(`STEP_STATUS:${key}`, step?.machineStatus === expected, step?.machineStatus);
  if (expected === 'PRESENT_AND_VERIFIED') {
    const checkpoint = step?.checkpoint;
    check(`STEP_CHECKPOINT:${key}`, checkpoint?.patchHashMatch === true && checkpoint?.commitIsAncestorOfGeneratedHead === true && checkpoint?.gateStatus === 'GATE_PASSED', checkpoint?.name);
    for (const file of step?.files || []) check(`STEP_FILE:${key}:${file.path}`, file.exists === true && existsSync(resolve(root, file.path)), file.path);
    for (const script of step?.scripts || []) check(`STEP_SCRIPT:${key}:${script.path}`, script.exists === true && script.nodeCheckExitCode === 0 && existsSync(resolve(root, script.path)), script.path);
    check(`STEP_ELIGIBLE:${key}`, step?.eligibleAsStep8Precondition === true, step?.eligibleAsStep8Precondition);
  } else {
    check(`STEP_NOT_ELIGIBLE:${key}`, step?.eligibleAsStep8Precondition === false, step?.eligibleAsStep8Precondition);
  }
}

const invalidated = index.steps?.step5C?.invalidatedCheckpoint;
check('INVALIDATED_CONTEXT_RETAINED', invalidated?.effectiveGateStatus === 'INVALIDATED_BY_NEW_RISK', invalidated?.effectiveGateStatus);
check('INVALIDATED_CONTEXT_NOT_EFFECTIVE', index.steps?.step5C?.checkpoint?.name !== invalidated?.name, `${index.steps?.step5C?.checkpoint?.name} / ${invalidated?.name}`);
check('CONTEXT_SUPERSEDES', index.steps?.step5C?.supersedesBinding?.confirmed === true, index.steps?.step5C?.supersedesBinding);

const step5E = index.steps?.step5E;
for (const file of step5E?.files || []) check(`STEP5E_MISSING:${file.path}`, file.exists === false && !existsSync(resolve(root, file.path)), file.path);
check('STEP5E_NO_CHECKPOINT', step5E?.checkpoint === null, step5E?.checkpoint);

const legacy = index.steps?.step6?.legacyTests || [];
check('LEGACY_TEST_COUNT', legacy.length === 3, legacy.length);
for (const item of legacy) {
  check(`LEGACY_TEST_EXISTS:${item.path}`, item.exists === true && existsSync(resolve(root, item.path)), item.path);
  check(`LEGACY_TEST_SYNTAX:${item.path}`, item.nodeCheckExitCode === 0, item.nodeCheckExitCode);
}
check('STEP6_OLD_CONTRACT_OBSERVED', legacy.some((item) => item.submitsVerifiedTrue || item.assertsVerifiedTrue), legacy);
check('STEP6_ARCHIVE_SUITE_MISSING', index.steps?.step6?.archiveCompletenessSuite?.exists === false && !existsSync(resolve(root, index.steps.step6.archiveCompletenessSuite.path)), index.steps?.step6?.archiveCompletenessSuite?.path);
for (const file of index.steps?.step6?.requiredFiles || []) check(`STEP6_FILE_MISSING:${file.path}`, file.exists === false && !existsSync(resolve(root, file.path)), file.path);

const specialists = index.steps?.step7?.specialists || [];
check('SPECIALIST_COUNT', specialists.length === 12, specialists.length);
check('SPECIALIST_NAMES_UNIQUE', new Set(specialists.map((item) => item.path)).size === 12, specialists.map((item) => item.path));
for (const item of specialists) {
  check(`SPECIALIST_EXISTS:${item.path}`, item.exists === true && item.nodeCheckExitCode === 0 && existsSync(resolve(root, item.path)), item.path);
}
check('STEP7_NOT_ALL_WIRED', index.steps?.step7?.allTwelveWired === false && specialists.some((item) => item.wiredIntoMandatoryGates === false), specialists.filter((item) => item.wiredIntoMandatoryGates).length);
check('STEP7_LEGACY_TESTS_NOT_WIRED', (index.steps?.step7?.legacyTestsWired || []).every((item) => item.wiredIntoMandatoryGates === false), index.steps?.step7?.legacyTestsWired);
for (const file of index.steps?.step7?.requiredEvidence || []) check(`STEP7_EVIDENCE_MISSING:${file.path}`, file.exists === false && !existsSync(resolve(root, file.path)), file.path);

check('PRESENT_LIST', JSON.stringify(index.presentAndVerified) === JSON.stringify(['STEP5-A', 'STEP5-B', 'STEP5-C', 'STEP5-D']), index.presentAndVerified);
check('NO_PRESENT_WITHOUT_CHECKPOINT', Array.isArray(index.presentNoCheckpoint) && index.presentNoCheckpoint.length === 0, index.presentNoCheckpoint);
check('MISSING_LIST', JSON.stringify(index.actuallyMissing) === JSON.stringify(['STEP5-E', 'STEP6', 'STEP7']), index.actuallyMissing);
check('STEP8_NOT_STARTED', index.statusConstraints?.step8 === 'NOT_STARTED', index.statusConstraints?.step8);
check('RISK_OPEN', index.statusConstraints?.fourthRiskStatus === 'OPEN', index.statusConstraints?.fourthRiskStatus);

const result = { ok: failures.length === 0, module: 'AUTHORITATIVE-INDEX-CONSISTENCY-001', runtimeHead: head, generatedFromHead: index.generatedFromHead, checks: checks.length, failures };
if (result.ok) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
