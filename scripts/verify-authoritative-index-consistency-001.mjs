import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const rel = 'verification/VERIFIED-SEMANTICS-UNIFICATION-001';
const indexPath = resolve(root, rel, 'step5-to-step8-authoritative-index.json');
const markdownPath = resolve(root, rel, 'step5-to-step8-authoritative-index.md');
const remainingPath = resolve(root, rel, 'step5-to-step8-real-remaining-work.md');
const findingsPath = resolve(root, rel, 'authoritative-index-consistency-reconciliation-findings.json');
const failures = [];
const checks = [];
const groups = {
  semanticConsistencyChecks: [],
  markdownConsistencyChecks: [],
  remainingWorkConsistencyChecks: [],
  step6ContractChecks: [],
  step7MandatoryGraphChecks: [],
  invalidatedCheckpointChecks: []
};

function check(group, id, condition, detail) {
  const item = { id, ok: Boolean(condition), detail };
  checks.push(item);
  groups[group].push(item);
  if (!item.ok) failures.push({ group, id, detail });
}
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function lines(text, regex) { return text.split(/\r?\n/).flatMap((line, index) => regex.test(line) ? [index + 1] : []); }
function scriptsIn(text) { return new Set([...text.matchAll(/scripts\/[A-Za-z0-9._-]+\.mjs/g)].map((match) => match[0])); }

for (const path of [indexPath, markdownPath, remainingPath, findingsPath]) check('semanticConsistencyChecks', `FILE_EXISTS:${path}`, existsSync(path), path);
const index = readJson(indexPath);
const findings = readJson(findingsPath);
const markdown = readFileSync(markdownPath, 'utf8');
const remaining = readFileSync(remainingPath, 'utf8');
const head = git(['rev-parse', 'HEAD']);

check('semanticConsistencyChecks', 'SCHEMA_VERSION', Boolean(index.schemaVersion), index.schemaVersion);
let generatedHeadIsAncestor = false;
try { execFileSync('git', ['merge-base', '--is-ancestor', index.generatedFromHead, head], { cwd: root, stdio: 'ignore' }); generatedHeadIsAncestor = true; } catch {}
check('semanticConsistencyChecks', 'GENERATED_HEAD_ANCESTOR', generatedHeadIsAncestor, `${index.generatedFromHead} -> ${head}`);
check('semanticConsistencyChecks', 'GENERATED_REMOTE_BOUND', index.generatedFromRemote === index.generatedFromHead, `${index.generatedFromRemote}/${index.generatedFromHead}`);
check('semanticConsistencyChecks', 'BRANCH', index.branch === git(['branch', '--show-current']), index.branch);

for (const item of index.checkpointInventory || []) {
  check('semanticConsistencyChecks', `CHECKPOINT_DIR:${item.directoryName}`, existsSync(resolve(item.manifestPath, '..')), item.manifestPath);
  if (!item.manifestReadable) {
    check('semanticConsistencyChecks', `LEGACY_UNREADABLE_EXPLICIT:${item.directoryName}`, item.checkpointCommit === null && item.patchPath === null, item);
    continue;
  }
  check('semanticConsistencyChecks', `MANIFEST:${item.directoryName}`, existsSync(item.manifestPath), item.manifestPath);
  check('semanticConsistencyChecks', `COMMIT:${item.directoryName}`, item.commitExists === true && item.commitIsAncestorOfGeneratedHead === true, item.checkpointCommit);
  const actual = item.patchExists && existsSync(item.patchPath) ? sha256(item.patchPath) : null;
  check('semanticConsistencyChecks', `PATCH:${item.directoryName}`, actual && actual === item.manifestPatchSha256 && actual === item.actualPatchSha256 && item.patchHashMatch === true, actual);
}

const actualStatuses = {};
const ids = { step5A: 'STEP5-A', step5B: 'STEP5-B', step5C: 'STEP5-C', step5D: 'STEP5-D', step5E: 'STEP5-E', step6: 'STEP6', step7: 'STEP7' };
for (const [key, id] of Object.entries(ids)) {
  const step = index.steps?.[key];
  actualStatuses[id] = step?.machineStatus;
  check('semanticConsistencyChecks', `STEP_STATUS_ENUM:${id}`, ['PRESENT_AND_VERIFIED', 'PRESENT_NO_CHECKPOINT', 'NAMING_DRIFT', 'ACTUALLY_MISSING'].includes(step?.machineStatus), step?.machineStatus);
  if (step?.machineStatus === 'PRESENT_AND_VERIFIED') {
    check('semanticConsistencyChecks', `PRESENT_HAS_CHECKPOINT:${id}`, step.checkpoint?.gateStatus === 'GATE_PASSED' && step.checkpoint?.patchHashMatch === true && step.checkpoint?.commitIsAncestorOfGeneratedHead === true, step.checkpoint?.name);
  }
  if (step?.machineStatus === 'ACTUALLY_MISSING') check('semanticConsistencyChecks', `MISSING_HAS_NO_CHECKPOINT:${id}`, step.checkpoint === null, step.checkpoint);
}

function tableStatus(text, id) {
  const escaped = id.replace('-', '\\-');
  const match = text.match(new RegExp(`\\|\\s*${escaped}[^\\n]*\\|\\s*\\\`(PRESENT_AND_VERIFIED|PRESENT_NO_CHECKPOINT|NAMING_DRIFT|ACTUALLY_MISSING)\\\``));
  return match?.[1] || null;
}
for (const id of ['STEP5-E', 'STEP6', 'STEP7']) {
  check('markdownConsistencyChecks', `MARKDOWN_STATUS:${id}`, tableStatus(markdown, id) === actualStatuses[id], `${tableStatus(markdown, id)} / ${actualStatuses[id]}`);
  const missingSection = remaining.match(/## ACTUALLY_MISSING([\s\S]*?)(?:\n## |$)/)?.[1] || '';
  const presentSection = remaining.match(/## PRESENT_AND_VERIFIED([\s\S]*?)(?:\n## |$)/)?.[1] || '';
  const expectedInMissing = actualStatuses[id] === 'ACTUALLY_MISSING';
  check('remainingWorkConsistencyChecks', `REMAINING_MISSING:${id}`, missingSection.includes(id) === expectedInMissing, missingSection);
  check('remainingWorkConsistencyChecks', `REMAINING_PRESENT:${id}`, presentSection.includes(id) === (actualStatuses[id] === 'PRESENT_AND_VERIFIED'), presentSection);
  check('semanticConsistencyChecks', `FINDINGS_STATUS:${id}`, findings.machineStatuses?.[id] === actualStatuses[id], `${findings.machineStatuses?.[id]} / ${actualStatuses[id]}`);
}

const memoryPath = resolve(root, 'scripts/verify-memories.mjs');
const verificationPath = resolve(root, 'scripts/verify-verification-layer.mjs');
const tasksPath = resolve(root, 'scripts/verify-tasks-runs.mjs');
const memory = readFileSync(memoryPath, 'utf8');
const verification = readFileSync(verificationPath, 'utf8');
const tasks = readFileSync(tasksPath, 'utf8');
const memoryVerifiedTrue = lines(memory, /verified\s*:\s*true/);
const memoryExpects201 = lines(memory, /runCreated\.response\.status\s*===\s*201/);
const verificationExpectsTrue = lines(verification, /afterVerify\.verified\s*===\s*true/);
const forbiddenCount = [memory, verification, tasks].reduce((sum, text) => sum + (text.match(/CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN/g) || []).length, 0);
const step6MissingByContract = memoryVerifiedTrue.length > 0 && memoryExpects201.length > 0 && verificationExpectsTrue.length > 0 && forbiddenCount === 0;
check('step6ContractChecks', 'MEMORY_OLD_LEGAL_SAMPLE', memoryVerifiedTrue.length > 0 && memoryExpects201.length > 0, { memoryVerifiedTrue, memoryExpects201 });
check('step6ContractChecks', 'VERIFICATION_ISOLATED_TRUE', verificationExpectsTrue.length > 0, verificationExpectsTrue);
check('step6ContractChecks', 'NO_FORBIDDEN_REJECTION_ASSERTION', forbiddenCount === 0, forbiddenCount);
check('step6ContractChecks', 'STEP6_STATUS_FROM_CONTRACT', actualStatuses.STEP6 === (step6MissingByContract ? 'ACTUALLY_MISSING' : actualStatuses.STEP6), actualStatuses.STEP6);
check('step6ContractChecks', 'STEP6_FINDINGS_COUNTS', findings.functionalItems?.STEP6?.verifiedTrueLegacyContractCount === memoryVerifiedTrue.length + verificationExpectsTrue.length && findings.functionalItems?.STEP6?.verifiedTrueAttackFixtureCount === 0, findings.functionalItems?.STEP6);

const mandatory = readFileSync(resolve(root, 'scripts/verify-mandatory-gates-001.mjs'), 'utf8');
const product = readFileSync(resolve(root, 'scripts/verify.mjs'), 'utf8');
const directSet = scriptsIn(mandatory);
const productSet = scriptsIn(product);
const specialists = index.mandatoryGateSpecialists || [];
let direct = 0; let transitive = 0;
for (const specialist of specialists) {
  const isDirect = directSet.has(specialist.path);
  const isTransitive = !isDirect && directSet.has('scripts/verify.mjs') && productSet.has(specialist.path);
  direct += isDirect ? 1 : 0;
  transitive += isTransitive ? 1 : 0;
  check('step7MandatoryGraphChecks', `SPECIALIST_EXISTS:${specialist.path}`, existsSync(resolve(root, specialist.path)), specialist.path);
  check('step7MandatoryGraphChecks', `SPECIALIST_BINDING:${specialist.path}`, specialist.wiredIntoMandatoryGates === (isDirect || isTransitive), { indexed: specialist.wiredIntoMandatoryGates, isDirect, isTransitive });
}
const effective = direct + transitive;
check('step7MandatoryGraphChecks', 'TARGET_COUNT', specialists.length === 12, specialists.length);
check('step7MandatoryGraphChecks', 'DIRECT_COUNT', findings.functionalItems?.STEP7?.directMandatoryCount === direct, direct);
check('step7MandatoryGraphChecks', 'TRANSITIVE_COUNT', findings.functionalItems?.STEP7?.transitiveMandatoryCount === transitive, transitive);
check('step7MandatoryGraphChecks', 'EFFECTIVE_COUNT', findings.functionalItems?.STEP7?.effectiveMandatoryCount === effective, effective);
check('step7MandatoryGraphChecks', 'STEP7_STATUS_FROM_GRAPH', actualStatuses.STEP7 === (effective === 12 ? actualStatuses.STEP7 : 'ACTUALLY_MISSING'), actualStatuses.STEP7);
for (const legacy of ['scripts/verify-memories.mjs', 'scripts/verify-verification-layer.mjs', 'scripts/verify-tasks-runs.mjs']) {
  const directLegacy = directSet.has(legacy);
  const transitiveLegacy = !directLegacy && directSet.has('scripts/verify.mjs') && productSet.has(legacy);
  check('step7MandatoryGraphChecks', `LEGACY_NOT_MANDATORY:${legacy}`, !directLegacy && !transitiveLegacy, { directLegacy, transitiveLegacy });
}
check('step7MandatoryGraphChecks', 'ANTIFRAUD_ABSENT', findings.functionalItems?.STEP7?.antiFraudEvidencePresent === false, findings.functionalItems?.STEP7?.antiFraudEvidencePresent);
check('step7MandatoryGraphChecks', 'FULL_GATES_EVIDENCE_ABSENT', findings.functionalItems?.STEP7?.fullGatesEvidencePresent === false, findings.functionalItems?.STEP7?.fullGatesEvidencePresent);

const invalidated = index.steps?.step5C?.invalidatedCheckpoint;
check('invalidatedCheckpointChecks', 'INVALIDATED_STATUS', invalidated?.effectiveGateStatus === 'INVALIDATED_BY_NEW_RISK', invalidated?.effectiveGateStatus);
check('invalidatedCheckpointChecks', 'INVALIDATED_NOT_EFFECTIVE', index.steps?.step5C?.checkpoint?.name !== invalidated?.name, { effective: index.steps?.step5C?.checkpoint?.name, invalidated: invalidated?.name });
check('invalidatedCheckpointChecks', 'SUPERSEDES_CONFIRMED', index.steps?.step5C?.supersedesBinding?.confirmed === true, index.steps?.step5C?.supersedesBinding);

check('semanticConsistencyChecks', 'PRESENT_LIST', JSON.stringify(index.remainingWork?.presentAndVerified) === JSON.stringify(['STEP5-A', 'STEP5-B', 'STEP5-C', 'STEP5-D']), index.remainingWork?.presentAndVerified);
check('semanticConsistencyChecks', 'MISSING_LIST', JSON.stringify(index.remainingWork?.actuallyMissing) === JSON.stringify(['STEP5-E', 'STEP6', 'STEP7']), index.remainingWork?.actuallyMissing);
check('semanticConsistencyChecks', 'COMPLETION_RATIO', index.remainingWork?.verifiedFunctionalItems === 4 && index.remainingWork?.totalRequiredFunctionalItems === 7 && index.remainingWork?.completionRatio === '4/7', index.remainingWork);
check('semanticConsistencyChecks', 'STEP8_NOT_ELIGIBLE', index.remainingWork?.step8Eligible === false && index.statusConstraints?.step8 === 'NOT_STARTED', { remaining: index.remainingWork, status: index.statusConstraints });
check('semanticConsistencyChecks', 'RISK_OPEN', index.statusConstraints?.fourthRiskStatus === 'OPEN', index.statusConstraints?.fourthRiskStatus);

const result = {
  ok: failures.length === 0,
  module: 'AUTHORITATIVE-INDEX-CONSISTENCY-001',
  runtimeHead: head,
  generatedFromHead: index.generatedFromHead,
  checks: checks.length,
  failures,
  semanticConsistencyChecks: groups.semanticConsistencyChecks,
  markdownConsistencyChecks: groups.markdownConsistencyChecks,
  remainingWorkConsistencyChecks: groups.remainingWorkConsistencyChecks,
  step6ContractChecks: groups.step6ContractChecks,
  step7MandatoryGraphChecks: groups.step7MandatoryGraphChecks,
  invalidatedCheckpointChecks: groups.invalidatedCheckpointChecks
};
(process[result.ok ? 'stdout' : 'stderr']).write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
