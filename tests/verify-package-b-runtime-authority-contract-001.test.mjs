import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const validator=resolve(root,'scripts/verify-package-b-runtime-authority-contract-001.mjs');
const rel={contract:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-runtime-authority-contract.json',schema:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-runtime-authority-contract.schema.json',report:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-execution-report.schema.json'};
const copied=Object.values(rel);
let positiveTestCount=0,negativeTestCount=0;
function readJson(path){return JSON.parse(spawnSync(process.execPath,['-e',`process.stdout.write(require('fs').readFileSync(${JSON.stringify(path)},'utf8'))`],{encoding:'utf8'}).stdout);}
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'package-b-contract-'));for(const path of copied){await mkdir(dirname(join(dir,path)),{recursive:true});await cp(join(root,path),join(dir,path));}return dir;}
function run(dir=root){const result=spawnSync(process.execPath,[validator,'--root',dir],{cwd:tmpdir(),encoding:'utf8',shell:false});let json;try{json=JSON.parse(result.stdout);}catch{json={ok:false,failures:[{code:'NON_JSON',detail:result.stdout||result.stderr}]};}return{...result,json};}
async function mutate(dir,fn){const path=join(dir,rel.contract),value=JSON.parse(await readFile(path,'utf8'));fn(value);await writeFile(path,JSON.stringify(value,null,2)+'\n');}
async function mutateRaw(dir,path,fn){const target=join(dir,path),value=JSON.parse(await readFile(target,'utf8'));fn(value);await writeFile(target,JSON.stringify(value,null,2)+'\n');}
function positive(name,fn){positiveTestCount+=1;test(name,fn);}
function negative(name,fn){negativeTestCount+=1;test(name,async()=>{const dir=await fixture();try{await mutate(dir,fn);const result=run(dir);assert.notEqual(result.status,0,JSON.stringify(result.json));assert.equal(result.json.ok,false);assert.ok(result.json.failures.length>0);}finally{await rm(dir,{recursive:true,force:true});}});}

positive('P1 complete Entry State Contract passes',()=>{const result=run();assert.equal(result.status,0,JSON.stringify(result.json));assert.equal(result.json.ok,true);assert.equal(result.json.currentRuntimeAuthorityCount,3);});
positive('P2 complete Target State Contract passes',()=>{const result=run();assert.equal(result.json.targetRuntimeAuthorityCount,1);assert.equal(result.json.targetDuplicateBusinessAuthorityCount,0);});
positive('P3 seven blockers and two sub-gates pass',()=>{const contract=readJson(join(root,rel.contract));assert.equal(contract.topLevelProductLandingBlockers.length,7);assert.equal(contract.subGates.length,2);assert.equal(run().status,0);});
positive('P4 Package B completion and deferred boundary pass',()=>{const contract=readJson(join(root,rel.contract));assert.equal(contract.completionBoundary.finalAcceptance,false);assert.equal(contract.completionBoundary.deployment,'NOT_DEPLOYED');assert.deepEqual(contract.blockerDisposition.deferredAfterPackageB,['PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING','HUMAN_ACCEPTANCE_MISSING']);});
positive('P5 Future Execution Report Schema passes fail-closed identity checks',()=>{const schema=readJson(join(root,rel.report));assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.contractId.const,'PACKAGE-B-RUNTIME-AUTHORITY-UNIFICATION-CONTRACT-001');assert.equal(schema.properties.contractVersion.const,1);assert.equal(run().json.executionReportSchemaValid,true);});

negative('N1 entry runtimeAuthorityCount=2 rejects',o=>o.authorityTopology.entryState.runtimeAuthorityCount=2);
negative('N2 entry runtimeAuthorityCount=4 rejects',o=>o.authorityTopology.entryState.runtimeAuthorityCount=4);
negative('N3 target runtimeAuthorityCount=2 rejects',o=>o.authorityTopology.targetState.runtimeAuthorityCount=2);
negative('N4 target duplicateBusinessAuthorityCount=1 rejects',o=>o.authorityTopology.targetState.duplicateBusinessAuthorityCount=1);
negative('N5 canonicalRuntime=server.mjs rejects',o=>o.productDecisions.canonicalRuntime='server.mjs');
negative('N6 removing Authority C with count 3 rejects',o=>o.authorityTopology.entryState.authorities.pop());
negative('N7 legacy Feishu canonical true in Entry rejects',o=>o.authorityTopology.entryState.legacyFeishuChannelUsesCanonicalAgentRuntime=true);
negative('N8 legacy Feishu production start true in Target rejects',o=>o.authorityTopology.targetState.legacyFeishuTaskChannelProductionStartEntry=true);
negative('N9 legacy task gateway reachable in Target rejects',o=>o.authorityTopology.targetState.legacyTaskGatewayProductReachable=true);
negative('N10 supervisor bypass target=1 rejects',o=>o.authorityTopology.targetState.supervisorBypassEntryCount=1);
negative('N11 allProviderPathsUseRun=false rejects',o=>o.runCompleteness.targetState.allProviderPathsUseRun=false);
negative('N12 processProviderHasRun=false rejects',o=>o.runCompleteness.targetState.processProviderHasRun=false);
negative('N13 codeProviderHasRun=false rejects',o=>o.runCompleteness.targetState.codeProviderHasRun=false);
negative('N14 conversationProviderHasRun=false rejects',o=>o.runCompleteness.targetState.conversationProviderHasRun=false);
negative('N15 groundedProviderHasRun=false rejects',o=>o.runCompleteness.targetState.groundedProviderHasRun=false);
negative('N16 allVerificationBoundToRun=false rejects',o=>o.runCompleteness.targetState.allVerificationBoundToRun=false);
negative('N17 allProgressBoundToRun=false rejects',o=>o.runCompleteness.targetState.allProgressBoundToRun=false);
negative('N18 allFinalResultsBoundToRun=false rejects',o=>o.runCompleteness.targetState.allFinalResultsBoundToRun=false);
negative('N19 ipcClaimBoundToBusinessRun=false rejects',o=>o.leaseRunFencing.targetState.ipcClaimBoundToBusinessRun=false);
negative('N20 ipcWorkerIdEqualsRunLeaseOwner=false rejects',o=>o.leaseRunFencing.targetState.ipcWorkerIdEqualsRunLeaseOwner=false);
negative('N21 staleWorkerCannotWriteResult=false rejects',o=>o.leaseRunFencing.targetState.staleWorkerCannotWriteResult=false);
negative('N22 staleWorkerCannotDeleteCurrentClaim=false rejects',o=>o.leaseRunFencing.targetState.staleWorkerCannotDeleteCurrentClaim=false);
negative('N23 replacementWorkerCreatesNewRunAttempt=false rejects',o=>o.leaseRunFencing.targetState.replacementWorkerCreatesNewRunAttempt=false);
negative('N24 oldProgressRejected=false rejects',o=>o.leaseRunFencing.targetState.oldProgressRejected=false);
negative('N25 oldVerificationRejected=false rejects',o=>o.leaseRunFencing.targetState.oldVerificationRejected=false);
negative('N26 oldFinalRejected=false rejects',o=>o.leaseRunFencing.targetState.oldFinalRejected=false);
negative('N27 taskRunTerminalCommitAtomic=false rejects',o=>o.runCompleteness.targetState.taskRunTerminalCommitAtomic=false);
negative('N28 staleAcceptedTerminalFailClosed=false rejects',o=>o.staleLifecycle.targetState.staleAcceptedTerminalFailClosed=false);
negative('N29 expiredAcceptedProducesTerminalResult=false rejects',o=>o.staleLifecycle.targetState.expiredAcceptedProducesTerminalResult=false);
negative('N30 progressUuidNotEqualFinalUuid=false rejects',o=>o.progressResultDeliveryIdentity.targetState.progressUuidNotEqualFinalUuid=false);
negative('N31 progress1UuidNotEqualProgress2Uuid=false rejects',o=>o.progressResultDeliveryIdentity.targetState.progress1UuidNotEqualProgress2Uuid=false);
negative('N32 progressUuidIncludesProgressEventId=false rejects',o=>o.progressResultDeliveryIdentity.targetState.progressUuidIncludesProgressEventId=false);
negative('N33 top-level blocker count=9 rejects',o=>{o.topLevelProductLandingBlockers.push('UNKNOWN_8','UNKNOWN_9');o.productDecisions.topLevelProductLandingBlockerCount=9;});
negative('N34 REAL_FEISHU_SMOKE in top-level rejects',o=>o.topLevelProductLandingBlockers[0]='REAL_FEISHU_SMOKE_MISSING');
negative('N35 MOBILE real-device acceptance in top-level rejects',o=>o.topLevelProductLandingBlockers[0]='MOBILE_REAL_DEVICE_ACCEPTANCE_MISSING');
negative('N36 Production E2E closed by Package B rejects',o=>{o.blockerDisposition.deferredAfterPackageB.shift();o.blockerDisposition.closableByPackageB.push('PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING');});
negative('N37 Human Acceptance closed by Package B rejects',o=>{o.blockerDisposition.deferredAfterPackageB.pop();o.blockerDisposition.closableByPackageB.push('HUMAN_ACCEPTANCE_MISSING');});
negative('N38 currentProductionBindingProven=true rejects',o=>o.runtimeReleaseBinding.completionBoundary.currentProductionBindingProven=true);
negative('N39 finalAcceptance=true rejects',o=>o.completionBoundary.finalAcceptance=true);
negative('N40 deployment=DEPLOYED rejects',o=>o.completionBoundary.deployment='DEPLOYED');
negative('N41 unknown Authority rejects',o=>o.authorityTopology.entryState.authorities.push({type:'UNKNOWN',path:'unknown.mjs'}));
negative('N42 unknown top-level blocker rejects',o=>o.topLevelProductLandingBlockers[0]='UNKNOWN_PRODUCT_BLOCKER');
negative('N43 unknown core field rejects',o=>o.unknownCriticalField=true);
negative('N44 Production E2E construction phase rejects',o=>o.constructionPlan.phases[0].id='PRODUCTION_EQUIVALENT_FEISHU_E2E');
negative('N45 Human Acceptance construction phase rejects',o=>o.constructionPlan.phases[0].id='HUMAN_ACCEPTANCE');
negative('N46 Deployment construction phase rejects',o=>o.constructionPlan.phases[0].id='DEPLOYMENT');
negative('N47 arbitrary nonempty contractId rejects',o=>o.contractId='PACKAGE-B-RUNTIME-AUTHORITY-UNIFICATION-001');
negative('N48 contractVersion=2 rejects',o=>o.contractVersion=2);

positive('P6 test inventory reports actual required counts',()=>{assert.equal(positiveTestCount,6);assert.equal(negativeTestCount,48);assert.equal(positiveTestCount+negativeTestCount,54);});
