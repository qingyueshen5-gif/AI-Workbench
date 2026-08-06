import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const root = process.cwd();
const defaults = {
  index: 'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json',
  checkpointRoot: 'C:\\Users\\qingy\\AppData\\Roaming\\ai-workbench\\checkpoints',
  contract: 'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5e-phaseb-contract.json'
};

function parseArgs(argv) {
  const options = { ...defaults, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--json') { options.json = true; continue; }
    if (!['--index', '--checkpoint-root', '--contract'].includes(key)) throw Object.assign(new Error(`unknown argument: ${key}`), { exitCode: 2 });
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw Object.assign(new Error(`missing value for ${key}`), { exitCode: 2 });
    options[key.slice(2).replace('-root', 'Root')] = argv[++i];
  }
  return options;
}
function abs(path) { return isAbsolute(path) ? resolve(path) : resolve(root, path); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function lines(text, regex) { return text.split(/\r?\n/).flatMap((line, index) => regex.test(line) ? [index + 1] : []); }
function scriptsIn(text) { return new Set([...text.matchAll(/scripts\/[A-Za-z0-9._-]+\.mjs/g)].map((match) => match[0])); }
function tableStatus(text, id) {
  const escaped = id.replace('-', '\\-');
  return text.match(new RegExp(`\\|\\s*${escaped}[^\\n]*\\|\\s*\\\`(PRESENT_AND_VERIFIED|PRESENT_NO_CHECKPOINT|NAMING_DRIFT|ACTUALLY_MISSING)\\\``))?.[1] || null;
}

function run(options) {
  const indexPath = abs(options.index);
  const checkpointRoot = abs(options.checkpointRoot);
  const contractPath = abs(options.contract);
  const index = readJson(indexPath);
  const contract = readJson(contractPath);
  const rel = dirname(indexPath);
  const markdownPath = resolve(rel, 'step5-to-step8-authoritative-index.md');
  const remainingPath = resolve(rel, 'step5-to-step8-real-remaining-work.md');
  const findingsPath = resolve(rel, 'authoritative-index-consistency-reconciliation-findings.json');
  const failures = [];
  const checks = [];
  const groups = { semanticConsistencyChecks: [], markdownConsistencyChecks: [], remainingWorkConsistencyChecks: [], step6ContractChecks: [], step7MandatoryGraphChecks: [], invalidatedCheckpointChecks: [] };
  function check(group, id, condition, detail) {
    const item = { id, ok: Boolean(condition), detail };
    checks.push(item); groups[group].push(item); if (!item.ok) failures.push({ group, id, detail });
  }
  const head = git(['rev-parse', 'HEAD']);
  for (const path of [indexPath, markdownPath, remainingPath, findingsPath, contractPath]) check('semanticConsistencyChecks', `FILE_EXISTS:${path}`, existsSync(path), path);
  const findings = readJson(findingsPath);
  const markdown = readFileSync(markdownPath, 'utf8');
  const remaining = readFileSync(remainingPath, 'utf8');
  check('semanticConsistencyChecks', 'SCHEMA_VERSION', Boolean(index.schemaVersion), index.schemaVersion);
  let ancestor = false; try { execFileSync('git', ['merge-base', '--is-ancestor', index.generatedFromHead, head], { cwd: root, stdio: 'ignore' }); ancestor = true; } catch {}
  check('semanticConsistencyChecks', 'GENERATED_HEAD_ANCESTOR', ancestor, `${index.generatedFromHead} -> ${head}`);
  check('semanticConsistencyChecks', 'GENERATED_REMOTE_BOUND', index.generatedFromRemote === index.generatedFromHead, `${index.generatedFromRemote}/${index.generatedFromHead}`);
  check('semanticConsistencyChecks', 'BRANCH', index.branch === git(['branch', '--show-current']), index.branch);
  for (const item of index.checkpointInventory || []) {
    check('semanticConsistencyChecks', `CHECKPOINT_DIR:${item.directoryName}`, existsSync(resolve(item.manifestPath, '..')), item.manifestPath);
    if (!item.manifestReadable) { check('semanticConsistencyChecks', `LEGACY_UNREADABLE_EXPLICIT:${item.directoryName}`, item.checkpointCommit === null && item.patchPath === null, item); continue; }
    check('semanticConsistencyChecks', `MANIFEST:${item.directoryName}`, existsSync(item.manifestPath), item.manifestPath);
    check('semanticConsistencyChecks', `COMMIT:${item.directoryName}`, item.commitExists === true && item.commitIsAncestorOfGeneratedHead === true, item.checkpointCommit);
    const actual = item.patchExists && existsSync(item.patchPath) ? sha256(item.patchPath) : null;
    check('semanticConsistencyChecks', `PATCH:${item.directoryName}`, actual && actual === item.manifestPatchSha256 && actual === item.actualPatchSha256 && item.patchHashMatch === true, actual);
  }
  const statusEnum = ['PRESENT_AND_VERIFIED', 'PRESENT_NO_CHECKPOINT', 'NAMING_DRIFT', 'ACTUALLY_MISSING'];
  const ids = { step5A: 'STEP5-A', step5B: 'STEP5-B', step5C: 'STEP5-C', step5D: 'STEP5-D', step5E: 'STEP5-E', step6: 'STEP6', step7: 'STEP7' };
  const actualStatuses = {};
  for (const [key, id] of Object.entries(ids)) {
    const step = index.steps?.[key]; actualStatuses[id] = step?.machineStatus;
    check('semanticConsistencyChecks', `STEP_STATUS_ENUM:${id}`, statusEnum.includes(step?.machineStatus), step?.machineStatus);
    if (step?.machineStatus === 'PRESENT_AND_VERIFIED') check('semanticConsistencyChecks', `PRESENT_HAS_CHECKPOINT:${id}`, step.checkpoint?.gateStatus === 'GATE_PASSED' && step.checkpoint?.patchHashMatch === true && step.checkpoint?.commitIsAncestorOfGeneratedHead === true, step.checkpoint?.name);
    if (step?.machineStatus === 'ACTUALLY_MISSING') check('semanticConsistencyChecks', `MISSING_HAS_NO_CHECKPOINT:${id}`, step.checkpoint === null, step.checkpoint);
  }
  const step5E = index.steps?.step5E;
  if (step5E?.machineStatus === contract.indexBindings.verifiedStatusEnum) {
    const cp = step5E.checkpoint;
    check('semanticConsistencyChecks', 'STEP5E_CHECKPOINT_OBJECT', cp && typeof cp === 'object' && !Array.isArray(cp), cp);
    if (cp && typeof cp === 'object') {
      check('semanticConsistencyChecks', 'STEP5E_CHECKPOINT_FIELDS', JSON.stringify(Object.keys(cp).sort()) === JSON.stringify([...contract.indexBindings.checkpointObjectFields].sort()), Object.keys(cp));
      check('semanticConsistencyChecks', 'STEP5E_COMMIT_FORMAT', /^[0-9a-f]{40}$/.test(cp.commit || ''), cp.commit);
      check('semanticConsistencyChecks', 'STEP5E_PATCH_SHA_FORMAT', /^[0-9a-f]{64}$/.test(cp.manifestPatchSha256 || '') && /^[0-9a-f]{64}$/.test(cp.actualPatchSha256 || ''), cp);
      const checkpointDir = resolve(checkpointRoot, cp.name || '');
      const manifestPath = resolve(checkpointDir, 'manifest.json');
      check('semanticConsistencyChecks', 'STEP5E_CHECKPOINT_DIRECTORY', existsSync(checkpointDir), checkpointDir);
      check('semanticConsistencyChecks', 'STEP5E_MANIFEST', existsSync(manifestPath), manifestPath);
      if (existsSync(manifestPath)) {
        const manifest = readJson(manifestPath);
        check('semanticConsistencyChecks', 'STEP5E_MANIFEST_COMMIT', manifest.checkpointCommit === cp.commit, manifest.checkpointCommit);
        check('semanticConsistencyChecks', 'STEP5E_MANIFEST_FINAL_ACCEPTANCE', manifest.finalAcceptance === false, manifest.finalAcceptance);
        const patchPath = manifest.patchPath || cp.patchPath;
        check('semanticConsistencyChecks', 'STEP5E_PATCH_EXISTS', Boolean(patchPath) && existsSync(patchPath), patchPath);
        if (patchPath && existsSync(patchPath)) {
          const actual = sha256(patchPath);
          check('semanticConsistencyChecks', 'STEP5E_PATCH_HASH', actual === manifest.patchSha256 && actual === cp.manifestPatchSha256 && actual === cp.actualPatchSha256, actual);
        }
      }
      check('semanticConsistencyChecks', 'STEP5E_FILES_EXIST', Array.isArray(step5E.files) && step5E.files.length > 0 && step5E.files.every((x) => x.exists === true), step5E.files);
    }
  }
  check('semanticConsistencyChecks', 'INDEX_NO_STEP5E_EVIDENCE', !Object.prototype.hasOwnProperty.call(step5E || {}, 'evidence'), step5E);
  check('semanticConsistencyChecks', 'INDEX_NO_FINAL_ACCEPTANCE', !Object.prototype.hasOwnProperty.call(index, 'finalAcceptance') && !Object.prototype.hasOwnProperty.call(index.statusConstraints || {}, 'finalAcceptance'), index.statusConstraints);
  for (const id of ['STEP5-E', 'STEP6', 'STEP7']) {
    check('markdownConsistencyChecks', `MARKDOWN_STATUS:${id}`, tableStatus(markdown, id) === actualStatuses[id], `${tableStatus(markdown, id)} / ${actualStatuses[id]}`);
    const missing = remaining.match(/## ACTUALLY_MISSING([\s\S]*?)(?:\n## |$)/)?.[1] || '';
    const present = remaining.match(/## PRESENT_AND_VERIFIED([\s\S]*?)(?:\n## |$)/)?.[1] || '';
    check('remainingWorkConsistencyChecks', `REMAINING_MISSING:${id}`, missing.includes(id) === (actualStatuses[id] === 'ACTUALLY_MISSING'), missing);
    check('remainingWorkConsistencyChecks', `REMAINING_PRESENT:${id}`, present.includes(id) === (actualStatuses[id] === 'PRESENT_AND_VERIFIED'), present);
    check('semanticConsistencyChecks', `FINDINGS_STATUS:${id}`, findings.machineStatuses?.[id] === actualStatuses[id], `${findings.machineStatuses?.[id]} / ${actualStatuses[id]}`);
  }
  const memory = readFileSync(resolve(root, 'scripts/verify-memories.mjs'), 'utf8');
  const verification = readFileSync(resolve(root, 'scripts/verify-verification-layer.mjs'), 'utf8');
  const tasks = readFileSync(resolve(root, 'scripts/verify-tasks-runs.mjs'), 'utf8');
  const memoryVerifiedTrue = lines(memory, /verified\s*:\s*true/), memoryExpects201 = lines(memory, /runCreated\.response\.status\s*===\s*201/), verificationExpectsTrue = lines(verification, /afterVerify\.verified\s*===\s*true/);
  const forbiddenCount = [memory, verification, tasks].reduce((sum, text) => sum + (text.match(/CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN/g) || []).length, 0);
  check('step6ContractChecks', 'MEMORY_OLD_LEGAL_SAMPLE', memoryVerifiedTrue.length > 0 && memoryExpects201.length > 0, { memoryVerifiedTrue, memoryExpects201 });
  check('step6ContractChecks', 'VERIFICATION_ISOLATED_TRUE', verificationExpectsTrue.length > 0, verificationExpectsTrue);
  check('step6ContractChecks', 'NO_FORBIDDEN_REJECTION_ASSERTION', forbiddenCount === 0, forbiddenCount);
  check('step6ContractChecks', 'STEP6_FINDINGS_COUNTS', findings.functionalItems?.STEP6?.verifiedTrueLegacyContractCount === memoryVerifiedTrue.length + verificationExpectsTrue.length && findings.functionalItems?.STEP6?.verifiedTrueAttackFixtureCount === 0, findings.functionalItems?.STEP6);
  const mandatory = readFileSync(resolve(root, 'scripts/verify-mandatory-gates-001.mjs'), 'utf8'), product = readFileSync(resolve(root, 'scripts/verify.mjs'), 'utf8');
  const directSet = scriptsIn(mandatory), productSet = scriptsIn(product), specialists = index.mandatoryGateSpecialists || [];
  let direct = 0, transitive = 0;
  for (const specialist of specialists) {
    const isDirect = directSet.has(specialist.path), isTransitive = !isDirect && directSet.has('scripts/verify.mjs') && productSet.has(specialist.path); direct += isDirect ? 1 : 0; transitive += isTransitive ? 1 : 0;
    check('step7MandatoryGraphChecks', `SPECIALIST_EXISTS:${specialist.path}`, existsSync(resolve(root, specialist.path)), specialist.path);
    check('step7MandatoryGraphChecks', `SPECIALIST_BINDING:${specialist.path}`, specialist.wiredIntoMandatoryGates === (isDirect || isTransitive), { indexed: specialist.wiredIntoMandatoryGates, isDirect, isTransitive });
  }
  check('step7MandatoryGraphChecks', 'TARGET_COUNT', specialists.length === 12, specialists.length);
  check('step7MandatoryGraphChecks', 'DIRECT_COUNT', findings.functionalItems?.STEP7?.directMandatoryCount === direct, direct);
  check('step7MandatoryGraphChecks', 'TRANSITIVE_COUNT', findings.functionalItems?.STEP7?.transitiveMandatoryCount === transitive, transitive);
  check('step7MandatoryGraphChecks', 'EFFECTIVE_COUNT', findings.functionalItems?.STEP7?.effectiveMandatoryCount === direct + transitive, direct + transitive);
  for (const legacy of ['scripts/verify-memories.mjs', 'scripts/verify-verification-layer.mjs', 'scripts/verify-tasks-runs.mjs']) check('step7MandatoryGraphChecks', `LEGACY_NOT_MANDATORY:${legacy}`, !directSet.has(legacy) && !(directSet.has('scripts/verify.mjs') && productSet.has(legacy)), legacy);
  check('step7MandatoryGraphChecks', 'ANTIFRAUD_ABSENT', findings.functionalItems?.STEP7?.antiFraudEvidencePresent === false, findings.functionalItems?.STEP7?.antiFraudEvidencePresent);
  check('step7MandatoryGraphChecks', 'FULL_GATES_EVIDENCE_ABSENT', findings.functionalItems?.STEP7?.fullGatesEvidencePresent === false, findings.functionalItems?.STEP7?.fullGatesEvidencePresent);
  const invalidated = index.steps?.step5C?.invalidatedCheckpoint;
  check('invalidatedCheckpointChecks', 'INVALIDATED_STATUS', invalidated?.effectiveGateStatus === 'INVALIDATED_BY_NEW_RISK', invalidated?.effectiveGateStatus);
  check('invalidatedCheckpointChecks', 'INVALIDATED_NOT_EFFECTIVE', index.steps?.step5C?.checkpoint?.name !== invalidated?.name, { effective: index.steps?.step5C?.checkpoint?.name, invalidated: invalidated?.name });
  check('invalidatedCheckpointChecks', 'SUPERSEDES_CONFIRMED', index.steps?.step5C?.supersedesBinding?.confirmed === true, index.steps?.step5C?.supersedesBinding);
  const ordered = Object.entries(ids).map(([key, id]) => ({ key, id, status: index.steps?.[key]?.machineStatus }));
  const presentAndVerified = ordered.filter((x) => x.status === contract.indexBindings.verifiedStatusEnum).map((x) => x.id);
  const actuallyMissing = ordered.filter((x) => x.status === 'ACTUALLY_MISSING').map((x) => x.id);
  const verifiedItemCount = presentAndVerified.length, totalItemCount = ordered.length, computedCompletionRatio = `${verifiedItemCount}/${totalItemCount}`, declaredCompletionRatio = index.remainingWork?.completionRatio;
  check('semanticConsistencyChecks', 'PRESENT_LIST', JSON.stringify(index.remainingWork?.presentAndVerified) === JSON.stringify(presentAndVerified), index.remainingWork?.presentAndVerified);
  check('semanticConsistencyChecks', 'MISSING_LIST', JSON.stringify(index.remainingWork?.actuallyMissing) === JSON.stringify(actuallyMissing), index.remainingWork?.actuallyMissing);
  check('semanticConsistencyChecks', 'COMPLETION_RATIO', index.remainingWork?.verifiedFunctionalItems === verifiedItemCount && index.remainingWork?.totalRequiredFunctionalItems === totalItemCount && declaredCompletionRatio === computedCompletionRatio, { declaredCompletionRatio, computedCompletionRatio, verifiedItemCount, totalItemCount });
  check('semanticConsistencyChecks', 'STEP8_NOT_ELIGIBLE', index.remainingWork?.step8Eligible === false && index.statusConstraints?.step8 === 'NOT_STARTED', { remaining: index.remainingWork, status: index.statusConstraints });
  check('semanticConsistencyChecks', 'RISK_OPEN', index.statusConstraints?.fourthRiskStatus === 'OPEN', index.statusConstraints?.fourthRiskStatus);
  check('semanticConsistencyChecks', 'DEPLOYMENT_NOT_DEPLOYED', index.statusConstraints?.deployment === 'NOT_DEPLOYED', index.statusConstraints?.deployment);
  return { ok: failures.length === 0, module: 'AUTHORITATIVE-INDEX-CONSISTENCY-001', indexPath, checkpointRoot, contractPath, runtimeHead: head, generatedFromHead: index.generatedFromHead, checks: checks.length, declaredCompletionRatio, computedCompletionRatio, verifiedItemCount, totalItemCount, failures, ...groups };
}

let options;
try { options = parseArgs(process.argv.slice(2)); }
catch (error) { process.stderr.write(`${error.message}\n`); process.exit(error.exitCode || 2); }
try {
  const result = run(options);
  const text = JSON.stringify(result, null, 2);
  (options.json || result.ok ? process.stdout : process.stderr).write(`${text}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  const failure = { ok: false, errorType: error.name, error: error.message, failures: [{ group: 'runtime', id: 'UNHANDLED', detail: error.message }] };
  if (options?.json) process.stdout.write(`${JSON.stringify(failure)}\n`); else process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 3;
}
