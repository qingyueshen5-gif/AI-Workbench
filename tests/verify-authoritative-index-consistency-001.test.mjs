import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const validator=resolve(root,'scripts/verify-authoritative-index-consistency-001.mjs');
const verificationRoot=resolve(root,'verification/VERIFIED-SEMANTICS-UNIFICATION-001');
const realIndex=resolve(verificationRoot,'step5-to-step8-authoritative-index.json');
const realContract=resolve(verificationRoot,'step5e-phaseb-contract.json');
const realCheckpointRoot='C:\\Users\\qingy\\AppData\\Roaming\\ai-workbench\\checkpoints';
const step6Checkpoint='STEP6-LEGACY-RUN-API-ARCHIVE-001';
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const run=(args=[])=>spawnSync(process.execPath,[validator,'--json',...args],{cwd:root,encoding:'utf8'});
const jsonOut=(result)=>JSON.parse(result.stdout.trim());

async function fixture(mutator=async()=>{}){
  const dir=await mkdtemp(join(tmpdir(),'aiw-step6-index-')), verification=join(dir,'verification','VERIFIED-SEMANTICS-UNIFICATION-001'), scripts=join(dir,'scripts'), tests=join(dir,'tests'), checkpointRoot=join(dir,'checkpoints');
  await mkdir(verification,{recursive:true});await mkdir(scripts,{recursive:true});await mkdir(tests,{recursive:true});await mkdir(checkpointRoot,{recursive:true});
  for(const name of ['step5-to-step8-authoritative-index.json','step5-to-step8-authoritative-index.md','step5-to-step8-real-remaining-work.md','authoritative-index-consistency-reconciliation-findings.json','step5e-phaseb-contract.json','legacy-run-api-test-audit.json','legacy-run-api-test-audit.md']) await cp(resolve(verificationRoot,name),join(verification,name));
  await mkdir(join(verification,'historical-assertions'),{recursive:true});await cp(resolve(verificationRoot,'historical-assertions','LEGACY-WORKBENCH-RUN-API.md'),join(verification,'historical-assertions','LEGACY-WORKBENCH-RUN-API.md'));
  for(const name of [
    'verify-memories.mjs',
    'verify-verification-layer.mjs',
    'verify-tasks-runs.mjs',
    'verify-legacy-run-api-archive-completeness-001.mjs',
    'verify-mandatory-gates-001.mjs',
    'verify.mjs',
    'verify-run-api-verified-injection-rejection-001.mjs',
    'verify-data-import-verified-injection-rejection-001.mjs',
    'verify-legacy-persisted-verified-claim-fail-closed-001.mjs',
    'verify-isolated-run-verification-not-business-verified-001.mjs',
    'verify-server-owned-run-fact-preservation-001.mjs',
    'verify-ui-writable-dto-001.mjs',
    'verify-run-trust-path-rejection-baseline-001.mjs',
    'verify-trust-field-protocol-path-matching-001.mjs',
    'verify-workbench-context-verified-trust-boundary-001.mjs',
    'verify-agent-context-injection-rejection-001.mjs',
    'verify-ui-run-status-verification-separation-001.mjs',
    'verify-verified-assignment-invariant-001.mjs'
  ]) await cp(resolve(root,'scripts',name),join(scripts,name));
  const indexPath=join(verification,'step5-to-step8-authoritative-index.json'),contractPath=join(verification,'step5e-phaseb-contract.json'),findingsPath=join(verification,'authoritative-index-consistency-reconciliation-findings.json'),auditPath=join(verification,'legacy-run-api-test-audit.json');
  const index=JSON.parse(await readFile(indexPath,'utf8')), findings=JSON.parse(await readFile(findingsPath,'utf8')), audit=JSON.parse(await readFile(auditPath,'utf8'));
  const sourceManifest=JSON.parse(await readFile(join(realCheckpointRoot,step6Checkpoint,'manifest.json'),'utf8')), sourcePatch=await readFile(sourceManifest.patchPath), cpDir=join(checkpointRoot,step6Checkpoint);await mkdir(cpDir,{recursive:true});
  const patchPath=join(cpDir,basename(sourceManifest.patchPath));await writeFile(patchPath,sourcePatch);const manifestPath=join(cpDir,'manifest.json'),manifest={...sourceManifest,patchPath,patchSha256:sha256(sourcePatch)};await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  Object.assign(index.steps.step6.checkpoint,{manifestPath,patchPath,manifestPatchSha256:sha256(sourcePatch),actualPatchSha256:sha256(sourcePatch),patchExists:true,patchHashMatch:true});
  index.branch=spawnSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).stdout.trim();
  await mutator({dir,verification,scripts,checkpointRoot,index,indexPath,findings,findingsPath,audit,auditPath,manifest,manifestPath,patchPath,contractPath});
  await writeFile(indexPath,JSON.stringify(index,null,2)+'\n');await writeFile(findingsPath,JSON.stringify(findings,null,2)+'\n');await writeFile(auditPath,JSON.stringify(audit,null,2)+'\n');
  return {dir,indexPath,contractPath,checkpointRoot};
}
async function expectFailure(mutator,id){const f=await fixture(mutator);try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]),o=jsonOut(r);assert.equal(r.status,1,JSON.stringify(o));assert.ok(o.failures.some(x=>x.id===id),JSON.stringify(o.failures));}finally{await rm(f.dir,{recursive:true,force:true});}}

test('T1 current real index is Step8 PRESENT_AND_VERIFIED at 7/7 without final acceptance',async()=>{const r=run(),o=jsonOut(r),index=JSON.parse(await readFile(realIndex,'utf8'));assert.equal(r.status,0,JSON.stringify(o.failures));assert.equal(o.ok,true);assert.equal(index.steps.step6.machineStatus,'PRESENT_AND_VERIFIED');assert.equal(index.steps.step7.machineStatus,'PRESENT_AND_VERIFIED');assert.equal(index.remainingWork.completionRatio,'7/7');assert.equal(index.remainingWork.step8Eligible,true);assert.equal(index.remainingWork.step8,'PRESENT_AND_VERIFIED');assert.equal(index.statusConstraints.fourthRiskStatus,'RESOLVED');assert.equal(index.statusConstraints.finalAcceptance,false);assert.equal(index.statusConstraints.deployment,'NOT_DEPLOYED');assert.equal(index.statusConstraints.productLandingBlockers,'OPEN');assert.ok(index.remainingWork.presentAndVerified.includes('STEP7'));assert.ok(!index.remainingWork.actuallyMissing.includes('STEP7'));});
test('T2 synchronized Step6 product/checkpoint fixture passes',async()=>{const f=await fixture();try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,0,r.stdout);assert.equal(jsonOut(r).ok,true);}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T3 controlled Step6 5/7 ratio mismatch fails',()=>expectFailure(async({index})=>{index.remainingWork.verifiedFunctionalItems=5;index.remainingWork.completionRatio='5/7';},'COMPLETION_RATIO'));
test('T4 illegal status enum fails',()=>expectFailure(async({index})=>{index.steps.step6.machineStatus='ILLEGAL';},'STEP_STATUS_ENUM:STEP6'));
test('T5 missing Step6 checkpoint field fails',()=>expectFailure(async({index})=>{delete index.steps.step6.checkpoint.patchPath;},'STEP6_CHECKPOINT_FIELDS'));
test('T6 Step6 patch SHA mismatch fails',()=>expectFailure(async({index,manifest,manifestPath})=>{manifest.patchSha256='0'.repeat(64);await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');index.steps.step6.checkpoint.manifestPatchSha256='0'.repeat(64);index.steps.step6.checkpoint.patchHashMatch=false;},'STEP6_PATCH_HASH'));
test('T7 Step6 Product file exists=false fails',()=>expectFailure(async({index})=>{index.steps.step6.requiredFiles[0].exists=false;},'STEP6_PRODUCT_FILES_EXIST'));
test('T8 unknown CLI exits 2',()=>{const r=run(['--unknown']);assert.equal(r.status,2);assert.match(r.stderr,/unknown argument/);});
test('T9 missing or invalid JSON exits 3',async()=>{const dir=await mkdtemp(join(tmpdir(),'aiw-invalid-json-'));try{const p=join(dir,'bad.json');await writeFile(p,'{');const r=run(['--index',p]);assert.equal(r.status,3);assert.equal(jsonOut(r).ok,false);}finally{await rm(dir,{recursive:true,force:true});}});
test('T10 top-level finalAcceptance remains forbidden',()=>expectFailure(async({index})=>{index.steps.step5E.evidence={invented:true};index.finalAcceptance=false;},'INDEX_NO_STEP5E_EVIDENCE'));
test('T10b Step8 verified cannot omit explicit false finalAcceptance',()=>expectFailure(async({index})=>{delete index.statusConstraints.finalAcceptance;},'STATUS_FINAL_ACCEPTANCE_EXPLICIT_FALSE'));
test('T10c Step8 verified cannot promote finalAcceptance',()=>expectFailure(async({index})=>{index.statusConstraints.finalAcceptance=true;},'STEP8_FORMAL_CLOSEOUT'));
test('T11 archive expectedCount != 5 fails',()=>expectFailure(async({audit})=>{audit.summary.expectedCount=4;audit.archiveUniverseExpectedCount=4;},'STEP6_ARCHIVE_UNIVERSE_EXACT'));
test('T12 archive duplicateCount != 0 fails',()=>expectFailure(async({audit})=>{audit.summary.duplicateCount=1;audit.duplicates=['S6-MEM-A001'];},'STEP6_ARCHIVE_DUPLICATE_ZERO'));
test('T13 archive unclassifiedCount != 0 fails',()=>expectFailure(async({audit})=>{audit.summary.unclassifiedCount=1;audit.unknownEntries=['UNKNOWN'];},'STEP6_ARCHIVE_UNCLASSIFIED_ZERO'));
test('T14 old trust-promotion assertion reintroduced fails',()=>expectFailure(async({scripts})=>{const p=join(scripts,'verify-verification-layer.mjs'),text=await readFile(p,'utf8');await writeFile(p,text+'\nassert(success.afterVerify.verified === true, "old promotion");\n');},'STEP6_TRUST_PROMOTION_REMOVED'));
test('T15 Step6 checkpoint commit mismatch fails',()=>expectFailure(async({manifest,manifestPath})=>{manifest.checkpointCommit='0'.repeat(40);await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');},'STEP6_MANIFEST_COMMIT'));
test('T16 client rejection assertion removal fails',()=>expectFailure(async({scripts})=>{const p=join(scripts,'verify-memories.mjs'),text=await readFile(p,'utf8');await writeFile(p,text.replaceAll('CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN','REMOVED_FOR_TEST'));},'STEP6_CLIENT_REJECTION_ACTIVE'));
