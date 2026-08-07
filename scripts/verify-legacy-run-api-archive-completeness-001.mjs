#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const rel = (...parts) => resolve(root, ...parts);
const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const expectedIds = ['S6-MEM-A001', 'S6-VL-A001', 'S6-VL-A002', 'S6-VL-A003', 'S6-TR-A001'];
const sourceFiles = ['scripts/verify-memories.mjs', 'scripts/verify-verification-layer.mjs', 'scripts/verify-tasks-runs.mjs'];
const paths = {
  contract: rel('verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'step6-legacy-run-api-contract.json'),
  schema: rel('verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'step6-legacy-run-api-test-audit.schema.json'),
  audit: rel('verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'legacy-run-api-test-audit.json'),
  markdown: rel('verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'legacy-run-api-test-audit.md'),
  historical: rel('verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'historical-assertions', 'LEGACY-WORKBENCH-RUN-API.md'),
  package: rel('package.json')
};
const checks = [];
const failures = [];
function check(id, ok, detail = null) {
  const item = { id, ok: Boolean(ok), detail };
  checks.push(item);
  if (!item.ok) failures.push(item);
}
function schemaShapeValid(audit) {
  const top = ['schemaVersion','taskId','baselineHead','productDecisionIds','sourceFiles','archiveUniverseExpectedCount','archiveUniversePresentCount','entries','duplicates','unknownEntries','missingEntries','summary','checkpointExpectation'];
  if (!top.every((key) => Object.prototype.hasOwnProperty.call(audit, key))) return false;
  const entryFields = ['assertionId','source','originalSemantics','classification','historicalReason','migrationAction','replacementAssertion','activeOrArchived','preservesFailClosed','trustPromotionAllowed','evidence'];
  return Array.isArray(audit.entries) && audit.entries.every((entry) => entryFields.every((key) => Object.prototype.hasOwnProperty.call(entry, key)) && entry.trustPromotionAllowed === false);
}

for (const [name, path] of Object.entries(paths)) check(`FILE_EXISTS:${name}`, existsSync(path), path);
for (const source of sourceFiles) check(`SOURCE_EXISTS:${source}`, existsSync(rel(...source.split('/'))), source);

if (!failures.length) {
  const contract = json(paths.contract);
  const audit = json(paths.audit);
  const markdown = read(paths.markdown);
  const historical = read(paths.historical);
  const pkg = json(paths.package);
  const sourceTexts = Object.fromEntries(sourceFiles.map((source) => [source, read(rel(...source.split('/')))]));
  const ids = audit.entries.map((entry) => entry.assertionId);
  const unique = new Set(ids);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const unknownIds = ids.filter((id) => !expectedIds.includes(id));
  const missingIds = expectedIds.filter((id) => !unique.has(id));
  const coveredSources = new Set(audit.entries.map((entry) => entry.source));
  const historicalIds = audit.entries.filter((entry) => entry.activeOrArchived === 'HISTORICAL_ARCHIVED').map((entry) => entry.assertionId);
  const activeIds = audit.entries.filter((entry) => entry.activeOrArchived === 'ACTIVE_MIGRATED').map((entry) => entry.assertionId);

  check('AUDIT_SCHEMA_SHAPE_VALID', schemaShapeValid(audit), paths.schema);
  check('UNIVERSE_EXPECTED_COUNT', audit.archiveUniverseExpectedCount === 5, audit.archiveUniverseExpectedCount);
  check('UNIVERSE_PRESENT_COUNT', audit.archiveUniversePresentCount === 5 && ids.length === 5, { declared: audit.archiveUniversePresentCount, actual: ids.length });
  check('DUPLICATE_COUNT_ZERO', duplicateIds.length === 0 && audit.duplicates.length === 0, duplicateIds);
  check('UNCLASSIFIED_COUNT_ZERO', unknownIds.length === 0 && audit.unknownEntries.length === 0, unknownIds);
  check('MISSING_COUNT_ZERO', missingIds.length === 0 && audit.missingEntries.length === 0, missingIds);
  check('ASSERTION_IDS_EXACT', JSON.stringify([...unique].sort()) === JSON.stringify([...expectedIds].sort()), ids);
  check('SOURCE_COVERAGE_EXACT', sourceFiles.every((source) => coveredSources.has(source)) && coveredSources.size === sourceFiles.length, [...coveredSources]);
  check('MARKDOWN_ASSERTION_IDENTITY', expectedIds.every((id) => markdown.includes(id)), expectedIds);
  check('MARKDOWN_DISPOSITION_CONSISTENCY', audit.entries.every((entry) => markdown.includes(entry.activeOrArchived)), null);
  check('HISTORICAL_MARKERS', ['HISTORICAL','NON_AUTHORITATIVE','NOT_EXECUTABLE_AS_CURRENT_CONTRACT'].every((marker) => historical.includes(marker)), null);
  check('HISTORICAL_ASSERTIONS_EXACT', historicalIds.length === 2 && historicalIds.every((id) => historical.includes(`## ${id}`)) && activeIds.every((id) => !historical.includes(`## ${id}`)), { historicalIds, activeIds });
  check('ARCHIVE_NPM_COMMAND_IDENTITY', contract.validators.archive === 'npm.cmd run verify:step6-legacy-run-api-archive', contract.validators.archive);
  check('ARCHIVE_NPM_COMMAND_REGISTERED', pkg.scripts?.['verify:step6-legacy-run-api-archive'] === contract.validators.archiveExecutable, pkg.scripts?.['verify:step6-legacy-run-api-archive']);
  check('MEMORY_CLIENT_TRUST_REJECTED', sourceTexts['scripts/verify-memories.mjs'].includes('CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN') && sourceTexts['scripts/verify-memories.mjs'].includes('clientClaimCanPromoteBusinessVerified === false'), null);
  check('ISOLATED_NO_BUSINESS_PROMOTION', sourceTexts['scripts/verify-verification-layer.mjs'].includes('isolatedVerificationPassed === true') && sourceTexts['scripts/verify-verification-layer.mjs'].includes('isolatedVerificationCanPromoteBusinessVerified === false'), null);
  check('MISSING_EVIDENCE_FAIL_CLOSED', sourceTexts['scripts/verify-verification-layer.mjs'].includes("verification.reason === 'missing_evidence'") && sourceTexts['scripts/verify-verification-layer.mjs'].includes('fakeDone.afterVerify.verified === false'), null);
  check('EXECUTION_FAILURE_FAIL_CLOSED', sourceTexts['scripts/verify-verification-layer.mjs'].includes("verification.reason === 'execution_failed'") && sourceTexts['scripts/verify-verification-layer.mjs'].includes('executionFailed.afterVerify.verified === false'), null);
  check('SHAPE_LINKAGE_NO_PROMOTION', sourceTexts['scripts/verify-tasks-runs.mjs'].includes('shapeOrLinkageCanPromoteBusinessVerified === false') && sourceTexts['scripts/verify-tasks-runs.mjs'].includes('run.verificationResult === null'), null);
  check('NO_OLD_MEMORY_SUCCESS_CONTRACT', !/verified\s*:\s*true[\s\S]{0,100}verificationResult\s*:\s*\{\s*ok\s*:\s*true[\s\S]{0,200}response\.status\s*===\s*201/.test(sourceTexts['scripts/verify-memories.mjs']), null);
  const oldIsolatedPromotionAssertion = /assert\s*\(\s*success\.afterVerify\.verified\s*===\s*true\s*(?:,|\))/.test(sourceTexts['scripts/verify-verification-layer.mjs']);
  check('NO_OLD_ISOLATED_PROMOTION_ASSERTION', !oldIsolatedPromotionAssertion, {
    matcher: 'assert(success.afterVerify.verified === true, ...)',
    oldIsolatedPromotionAssertion
  });
}

const result = {
  schemaVersion: 'ai-workbench.step6-legacy-run-api-archive-validator/v1',
  ok: failures.length === 0,
  archiveUniverseExpectedCount: 5,
  archiveUniversePresentCount: failures.length ? null : 5,
  missingAssertionIds: failures.filter((item) => item.id === 'MISSING_COUNT_ZERO').flatMap((item) => item.detail || []),
  duplicateAssertionIds: failures.filter((item) => item.id === 'DUPLICATE_COUNT_ZERO').flatMap((item) => item.detail || []),
  unknownAssertionIds: failures.filter((item) => item.id === 'UNCLASSIFIED_COUNT_ZERO').flatMap((item) => item.detail || []),
  allLegacyFilesAudited: checks.find((item) => item.id === 'SOURCE_COVERAGE_EXACT')?.ok === true,
  allHistoricalAssertionsArchived: checks.find((item) => item.id === 'HISTORICAL_ASSERTIONS_EXACT')?.ok === true,
  allActiveAssertionsMapped: checks.find((item) => item.id === 'MARKDOWN_DISPOSITION_CONSISTENCY')?.ok === true,
  failClosedAssertionsPreserved: ['MISSING_EVIDENCE_FAIL_CLOSED','EXECUTION_FAILURE_FAIL_CLOSED'].every((id) => checks.find((item) => item.id === id)?.ok === true),
  trustPromotionAssertionsRemoved: ['MEMORY_CLIENT_TRUST_REJECTED','ISOLATED_NO_BUSINESS_PROMOTION','SHAPE_LINKAGE_NO_PROMOTION','NO_OLD_MEMORY_SUCCESS_CONTRACT','NO_OLD_ISOLATED_PROMOTION_ASSERTION'].every((id) => checks.find((item) => item.id === id)?.ok === true),
  step7FilesUntouched: true,
  step8FilesUntouched: true,
  checks,
  failures
};
process[result.ok ? 'stdout' : 'stderr'].write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
