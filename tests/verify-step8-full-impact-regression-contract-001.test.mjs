import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),validator=resolve(root,'scripts/verify-step8-full-impact-regression-contract-001.mjs'),contractRel='verification/VERIFIED-SEMANTICS-UNIFICATION-001/step8-full-impact-regression-contract.json';
const copy=['package.json',contractRel,'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step8-full-impact-regression-contract.schema.json','verification/VERIFIED-SEMANTICS-UNIFICATION-001/step8-execution-report.schema.json','verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json','verification/VERIFIED-SEMANTICS-UNIFICATION-001/fourth-risk-late-audit.md','verification/VERIFIED-SEMANTICS-UNIFICATION-001/audit-correction.json','CURRENT_STATUS.md','AI_WORKBENCH_TASK_HANDOFF.md','scripts/verify-mandatory-gates-001.mjs'];
function contract(){return JSON.parse(requireRead(resolve(root,contractRel)))}function requireRead(p){return spawnSync(process.execPath,['-e',`process.stdout.write(require('fs').readFileSync(${JSON.stringify(p)},'utf8'))`],{encoding:'utf8'}).stdout}
async function fixture(){const d=await mkdtemp(join(tmpdir(),'s8-contract-'));for(const p of copy){await mkdir(dirname(join(d,p)),{recursive:true});await cp(join(root,p),join(d,p))}const c=contract();for(const p of [...c.step8RequiredAttackMatrix.map(x=>x.script),...c.step8RequiredRegression.map(x=>x.script).filter(Boolean)]){await mkdir(dirname(join(d,p)),{recursive:true});await cp(join(root,p),join(d,p))}return d}
function run(d=null,cwd=root){const r=spawnSync(process.execPath,[validator,...(d?['--root',d]:[])],{cwd,encoding:'utf8',shell:false});return{...r,json:JSON.parse(r.stdout)}}async function mutate(d,fn){const p=join(d,contractRel),o=JSON.parse(await readFile(p,'utf8'));fn(o);await writeFile(p,JSON.stringify(o,null,2)+'\n')}function codes(r){return r.json.failures.map(x=>x.code)}async function negative(name,code,fn){test(name,async()=>{const d=await fixture();try{await mutate(d,fn);const r=run(d);assert.notEqual(r.status,0);assert.ok(codes(r).includes(code),JSON.stringify(r.json))}finally{await rm(d,{recursive:true,force:true})}})}
test('T1 real Step8 contract passes',()=>{const r=run();assert.equal(r.status,0,JSON.stringify(r.json));assert.equal(r.json.ok,true);assert.equal(r.json.requiredGateCount,35);assert.equal(r.json.requiredAttackCount,14)});
await negative('T2 baseline drift fails','BASELINE_HEAD',o=>o.baselineHead='0'.repeat(40));
await negative('T3 invented CLOSED enum fails schema','CONTRACT_SCHEMA_VALID',o=>o.fourthRiskClosedState='CLOSED');
await negative('T4 Step8 cannot imply final acceptance','STEP8_NOT_FINAL_ACCEPTANCE',o=>o.finalAcceptanceRelationship.step8PassDoesNotImplyFinalAcceptance=false);
await negative('T5 final acceptance cannot become true','STEP8_NOT_FINAL_ACCEPTANCE',o=>o.successState.finalAcceptance=true);
await negative('T6 deployment cannot occur','STEP8_NOT_DEPLOYMENT',o=>o.successState.deployment='DEPLOYED');
await negative('T7 production E2E blocker cannot be resolved','PRODUCT_BLOCKER:PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING',o=>o.productLandingBlockers.find(x=>x.id==='PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING').status='RESOLVED');
await negative('T8 human acceptance blocker cannot be resolved','PRODUCT_BLOCKER:HUMAN_ACCEPTANCE_MISSING',o=>o.productLandingBlockers.find(x=>x.id==='HUMAN_ACCEPTANCE_MISSING').status='RESOLVED');
await negative('T9 dual runtime blocker cannot be resolved','PRODUCT_BLOCKER:DUAL_RUNTIME_AUTHORITY_UNRESOLVED',o=>o.productLandingBlockers.find(x=>x.id==='DUAL_RUNTIME_AUTHORITY_UNRESOLVED').status='RESOLVED');
await negative('T10 UUID collision stays open','PRODUCT_BLOCKER:PROGRESS_AND_FINAL_SHARE_FEISHU_UUID_NAMESPACE',o=>o.productLandingBlockers.find(x=>x.id==='PROGRESS_AND_FINAL_SHARE_FEISHU_UUID_NAMESPACE').status='RESOLVED');
await negative('T11 accepted orphan stays open','PRODUCT_BLOCKER:STALE_ACCEPTED_ORPHAN_HAS_NO_TERMINAL_FAIL_CLOSED_STATE',o=>o.productLandingBlockers.find(x=>x.id==='STALE_ACCEPTED_ORPHAN_HAS_NO_TERMINAL_FAIL_CLOSED_STATE').status='RESOLVED');
await negative('T12 deployment binding stays open','PRODUCT_BLOCKER:GATEWAY_RUNTIME_COMMIT_BOUNDING_NOT_VERIFIED',o=>o.productLandingBlockers.find(x=>x.id==='GATEWAY_RUNTIME_COMMIT_BOUNDING_NOT_VERIFIED').status='RESOLVED');
await negative('T13 attack matrix cannot omit a case','ATTACK_MATRIX_EXACT_14',o=>o.step8RequiredAttackMatrix.pop());
await negative('T14 risk P0 cannot enter fourth-risk scope silently','RISK_SCOPE_EXCLUDES_PRODUCT_P0',o=>o.fourthRiskScope.outOfScopeProductLandingBlockers=[]);
await negative('T14b risk P0 exact set cannot omit one','RISK_SCOPE_EXCLUDES_PRODUCT_P0',o=>o.fourthRiskScope.outOfScopeProductLandingBlockers.pop());
await negative('T14c risk P0 exact set cannot contain unknown item','RISK_SCOPE_EXCLUDES_PRODUCT_P0',o=>o.fourthRiskScope.outOfScopeProductLandingBlockers[6]='UNKNOWN_PRODUCT_BLOCKER');
await negative('T14d risk P0 exact set cannot contain duplicates','RISK_SCOPE_EXCLUDES_PRODUCT_P0',o=>o.fourthRiskScope.outOfScopeProductLandingBlockers[6]=o.fourthRiskScope.outOfScopeProductLandingBlockers[5]);
const indexRel='verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json';
async function mutateIndex(d,fn){const p=join(d,indexRel),o=JSON.parse(await readFile(p,'utf8'));fn(o);await writeFile(p,JSON.stringify(o,null,2)+'\n')}
async function indexCase(name,expectedStatus,expectedCode,fn){test(name,async()=>{const d=await fixture();try{await mutateIndex(d,fn);const r=run(d);assert.equal(r.status,expectedStatus,JSON.stringify(r.json));if(expectedCode)assert.ok(codes(r).includes(expectedCode),JSON.stringify(r.json));}finally{await rm(d,{recursive:true,force:true})}})}
await indexCase('S1 ENTRY_NOT_STARTED_OPEN passes',0,null,o=>{o.statusConstraints.step8='NOT_STARTED';o.remainingWork.step8='NOT_STARTED';o.statusConstraints.fourthRiskStatus='OPEN';o.statusConstraints.finalAcceptance=false;o.statusConstraints.deployment='NOT_DEPLOYED'});
await indexCase('S2 CLOSEOUT_PRESENT_RESOLVED passes',0,null,o=>{});
await indexCase('S3 CLOSEOUT_WITH_OPEN_RISK fails',1,'INDEX_CLOSEOUT_RISK_RESOLVED',o=>o.statusConstraints.fourthRiskStatus='OPEN');
await indexCase('S4 CLOSEOUT_WITH_FINAL_ACCEPTANCE fails',1,'INDEX_CLOSEOUT_FINAL_ACCEPTANCE_FALSE',o=>o.statusConstraints.finalAcceptance=true);
await indexCase('S5 CLOSEOUT_WITH_DEPLOYMENT fails',1,'INDEX_CLOSEOUT_NOT_DEPLOYED',o=>o.statusConstraints.deployment='DEPLOYED');
await indexCase('S6 CLOSEOUT_WITH_MISSING_PRODUCT_BLOCKER fails',1,'INDEX_CLOSEOUT_PRODUCT_BLOCKERS_OPEN',o=>o.statusConstraints.productLandingBlockers='MISSING');
await indexCase('S7 ILLEGAL_STEP8_STATE fails',1,'INDEX_STEP8_LEGAL_STATE',o=>{o.statusConstraints.step8='ILLEGAL';o.remainingWork.step8='ILLEGAL'});
await indexCase('S8 entry and closeout fields cannot mix',1,'INDEX_ENTRY_STATE_EXACT',o=>{o.statusConstraints.step8='NOT_STARTED';o.remainingWork.step8='NOT_STARTED';o.statusConstraints.fourthRiskStatus='RESOLVED'});
test('T15 explicit root and external cwd',async()=>{const d=await fixture();try{const r=run(d,tmpdir());assert.equal(r.status,0,JSON.stringify(r.json));assert.equal(r.json.rootResolutionMode,'EXPLICIT_ROOT')}finally{await rm(d,{recursive:true,force:true})}});
test('T16 validator is read only',async()=>{const d=await fixture();try{const p=join(d,contractRel),before=await readFile(p);const r=run(d);const after=await readFile(p);assert.equal(r.status,0);assert.deepEqual(after,before)}finally{await rm(d,{recursive:true,force:true})}});
