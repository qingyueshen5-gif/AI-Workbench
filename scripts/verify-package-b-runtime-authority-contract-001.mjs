#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_ID='PACKAGE-B-RUNTIME-AUTHORITY-UNIFICATION-CONTRACT-001';
const CONTRACT_VERSION=1;
const BASELINE='688b8b032678d489eb2496af11279f676bf89ca2';
const BRANCH='candidate/interpreter-adapter-v1-work';
const CANONICAL='agents/agent-runtime.mjs::AgentRuntime';
const BLOCKERS=['PROGRESS_AND_FINAL_SHARE_FEISHU_UUID_NAMESPACE','STALE_ACCEPTED_ORPHAN_HAS_NO_TERMINAL_FAIL_CLOSED_STATE','GATEWAY_RUNTIME_COMMIT_BOUNDING_NOT_VERIFIED','DUAL_RUNTIME_AUTHORITY_UNRESOLVED','DESKTOP_CANONICAL_RUNTIME_BINDING_MISSING','PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING','HUMAN_ACCEPTANCE_MISSING'];
const CLOSABLE=[BLOCKERS[0],BLOCKERS[1],BLOCKERS[3],BLOCKERS[4]];
const CONDITIONAL=[BLOCKERS[2]];
const DEFERRED=[BLOCKERS[5],BLOCKERS[6]];
const ALLOWLIST=['server.mjs','src/main.jsx','agents/agent-runtime.mjs','channels/task-store.mjs','channels/session-store.mjs','scripts/workbench-agent-runtime.mjs','scripts/feishu-worker-ipc.mjs','scripts/workbench-feishu-adapter.mjs','scripts/runtime-supervisor.mjs','scripts/start-fixed-feishu-gateway.mjs','scripts/start-feishu-workbench-bridge.mjs','scripts/feishu-task-channel.mjs','scripts/task-gateway.mjs','package.json'];
const scriptPath=fileURLToPath(import.meta.url),defaultRoot=resolve(dirname(scriptPath),'..'),ri=process.argv.indexOf('--root'),root=ri>=0?resolve(process.argv[ri+1]):defaultRoot;
const paths={contract:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-runtime-authority-contract.json',schema:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-runtime-authority-contract.schema.json',reportSchema:'verification/VERIFIED-SEMANTICS-UNIFICATION-001/package-b-execution-report.schema.json'};
const failures=[],checks=[];
function check(code,ok,detail=null){checks.push({code,ok,detail});if(!ok)failures.push({code,detail});}
function read(rel){return readFileSync(resolve(root,rel),'utf8');}
function parse(rel){return JSON.parse(read(rel));}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validate(schema,value,path='$'){
 const errors=[];
 if(schema.const!==undefined&&!same(value,schema.const))errors.push(`${path}:CONST`);
 if(schema.enum&&!schema.enum.some(x=>same(x,value)))errors.push(`${path}:ENUM`);
 if(schema.oneOf){const matches=schema.oneOf.filter(x=>validate(x,value,path).length===0).length;if(matches!==1)errors.push(`${path}:ONE_OF`);}
 if(schema.type==='null'&&value!==null)errors.push(`${path}:NULL`);
 if(schema.type==='object'&&(value===null||typeof value!=='object'||Array.isArray(value)))return[...errors,`${path}:OBJECT`];
 if(schema.type==='array'&&!Array.isArray(value))return[...errors,`${path}:ARRAY`];
 if(schema.type==='string'&&typeof value!=='string')return[...errors,`${path}:STRING`];
 if(schema.type==='integer'&&!Number.isInteger(value))return[...errors,`${path}:INTEGER`];
 if(schema.type==='boolean'&&typeof value!=='boolean')return[...errors,`${path}:BOOLEAN`];
 if(schema.minLength!==undefined&&typeof value==='string'&&value.length<schema.minLength)errors.push(`${path}:MIN_LENGTH`);
 if(schema.minimum!==undefined&&typeof value==='number'&&value<schema.minimum)errors.push(`${path}:MINIMUM`);
 if(schema.minItems!==undefined&&Array.isArray(value)&&value.length<schema.minItems)errors.push(`${path}:MIN_ITEMS`);
 if(schema.maxItems!==undefined&&Array.isArray(value)&&value.length>schema.maxItems)errors.push(`${path}:MAX_ITEMS`);
 if(schema.uniqueItems&&Array.isArray(value)&&new Set(value.map(JSON.stringify)).size!==value.length)errors.push(`${path}:UNIQUE`);
 if(schema.required&&value&&typeof value==='object')for(const key of schema.required)if(!Object.hasOwn(value,key))errors.push(`${path}:REQUIRED:${key}`);
 if(schema.additionalProperties===false&&value&&typeof value==='object'&&!Array.isArray(value))for(const key of Object.keys(value))if(!Object.hasOwn(schema.properties||{},key))errors.push(`${path}:ADDITIONAL:${key}`);
 if(schema.properties&&value&&typeof value==='object'&&!Array.isArray(value))for(const [key,sub] of Object.entries(schema.properties))if(Object.hasOwn(value,key))errors.push(...validate(sub,value[key],`${path}.${key}`));
 if(schema.items&&Array.isArray(value))value.forEach((item,index)=>errors.push(...validate(schema.items,item,`${path}[${index}]`)));
 if(schema.allOf)for(const sub of schema.allOf){
  if(sub.if&&sub.then){if(validate(sub.if,value,path).length===0)errors.push(...validate(sub.then,value,path));}
  else errors.push(...validate(sub,value,path));
 }
 return errors;
}
function validateSchemaDocument(schema,name){
 check(`${name}:OBJECT`,schema&&typeof schema==='object'&&!Array.isArray(schema));
 check(`${name}:DRAFT`,schema.$schema==='https://json-schema.org/draft/2020-12/schema',schema.$schema);
 check(`${name}:ROOT_FAIL_CLOSED`,schema.type==='object'&&schema.additionalProperties===false);
 check(`${name}:REQUIRED`,Array.isArray(schema.required)&&schema.required.length>0);
}
try{
 for(const rel of Object.values(paths))check(`FILE:${rel}`,existsSync(resolve(root,rel)),rel);
 if(failures.length)throw new Error('required file missing');
 const c=parse(paths.contract),s=parse(paths.schema),rs=parse(paths.reportSchema);
 validateSchemaDocument(s,'CONTRACT_SCHEMA');validateSchemaDocument(rs,'EXECUTION_REPORT_SCHEMA');
 const schemaErrors=validate(s,c);check('V03_CONTRACT_SCHEMA_VALID',schemaErrors.length===0,schemaErrors);
 check('V04_EXECUTION_REPORT_SCHEMA_VALID',validate(rs,{}).length>0&&rs.properties?.contractId?.const===CONTRACT_ID&&rs.properties?.contractVersion?.const===1);
 check('V01_CONTRACT_ID',c.contractId===CONTRACT_ID,c.contractId);check('V02_CONTRACT_VERSION',c.contractVersion===1,c.contractVersion);
 check('V05_BASELINE_COMMIT',c.baseline?.baselineCommit===BASELINE);check('V06_BASELINE_BRANCH',c.baseline?.baselineBranch===BRANCH);check('BASELINE_SEMANTICS',c.baseline?.semantics==='PACKAGE_B_CONTRACT_SOURCE_BASELINE');
 const a=c.packageAInvariants||{};check('V07_PACKAGE_A_INVARIANTS',a.packageAStatus==='PRESENT_AND_VERIFIED'&&a.packageACompletionRatio==='7/7'&&a.fourthRiskStatus==='RESOLVED'&&a.finalAcceptance===false&&a.deployment==='NOT_DEPLOYED'&&a.packageBConstructionStatus==='NOT_STARTED',a);
 check('V08_CANONICAL_RUNTIME',c.productDecisions?.canonicalRuntime===CANONICAL);const entry=c.authorityTopology?.entryState||{},target=c.authorityTopology?.targetState||{};
 check('V09_ENTRY_AUTHORITY_COUNT',entry.runtimeAuthorityCount===3);check('V10_ENTRY_DUPLICATE_COUNT',entry.duplicateBusinessAuthorityCount===2);check('V11_TARGET_AUTHORITY_COUNT',target.runtimeAuthorityCount===1);check('V12_TARGET_DUPLICATE_COUNT',target.duplicateBusinessAuthorityCount===0);
 const inventory=[{type:'CANONICAL_RUNTIME_CANDIDATE',path:'agents/agent-runtime.mjs',symbol:'AgentRuntime'},{type:'LEGACY_PARALLEL_AUTHORITY',path:'server.mjs'},{type:'LEGACY_PARALLEL_AUTHORITY',path:'scripts/feishu-task-channel.mjs',downstream:'scripts/task-gateway.mjs'}];check('V13_AUTHORITY_INVENTORY',same(entry.authorities,inventory),entry.authorities);
 check('V14_DESKTOP_ENTRY_FALSE',entry.desktopUsesCanonicalAgentRuntime===false);check('V15_DESKTOP_TARGET_TRUE',target.desktopUsesCanonicalAgentRuntime===true);check('V16_FIXED_GATEWAY_TRUE',entry.fixedGatewayUsesCanonicalAgentRuntime===true&&target.fixedGatewayUsesCanonicalAgentRuntime===true);check('V17_LEGACY_FEISHU_ENTRY_FALSE',entry.legacyFeishuChannelUsesCanonicalAgentRuntime===false);check('V18_LEGACY_FEISHU_TARGET_FALSE',target.legacyFeishuBusinessAuthority===false);check('V19_DISPOSITION',c.productDecisions?.legacyFeishuAuthorityDisposition==='REMOVE_PRODUCTION_START_ENTRY');check('V20_LEGACY_START_TARGET_FALSE',target.legacyFeishuTaskChannelProductionStartEntry===false);check('V21_TASK_GATEWAY_TARGET_FALSE',target.legacyTaskGatewayProductReachable===false);check('V22_GATEWAY_TRANSPORT_ONLY',entry.gatewayTransportOnly===true&&target.gatewayTransportOnly===true);check('V23_CONTROL_PLANE_BYPASS',same(entry.controlPlaneBypasses,[{path:'scripts/start-feishu-workbench-bridge.mjs',currentClassification:'CONTROL_PLANE_BYPASS'}]));check('V24_BYPASS_TARGET_ZERO',target.supervisorBypassEntryCount===0);
 const run=c.runCompleteness?.targetState||{};for(const [code,key] of [['V25','allProviderPathsUseRun'],['V26','groundedProviderHasRun'],['V27','processProviderHasRun'],['V28','codeProviderHasRun'],['V29','conversationProviderHasRun'],['V30','allProviderAttemptsHaveRunId'],['V31','allVerificationBoundToRun'],['V32','allProgressBoundToRun'],['V33','allFinalResultsBoundToRun'],['V34','taskRunTerminalCommitAtomic']])check(`${code}_${key}`,run[key]===true);
 const fence=c.leaseRunFencing?.targetState||{};for(const [number,key] of [[35,'ipcClaimBoundToBusinessRun'],[36,'ipcWorkerIdEqualsRunLeaseOwner'],[37,'staleWorkerCannotWriteResult'],[38,'staleWorkerCannotDeleteCurrentClaim'],[39,'replacementWorkerCreatesNewRunAttempt'],[40,'oldProgressRejected'],[41,'oldVerificationRejected'],[42,'oldFinalRejected']])check(`V${number}_${key}`,fence[key]===true);
 const stale=c.staleLifecycle?.targetState||{};for(const [number,key] of [[43,'staleAcceptedTerminalFailClosed'],[44,'expiredAcceptedProducesTerminalResult'],[45,'expiredAcceptedResultExactlyOnce'],[46,'orphanJobArchivedWithTerminalState'],[47,'orphanTaskFailedWhenTaskExists']])check(`V${number}_${key}`,stale[key]===true);
 const delivery=c.progressResultDeliveryIdentity?.targetState||{};for(const [number,key] of [[48,'ackUuidNamespaceDistinct'],[49,'progress1UuidNotEqualProgress2Uuid'],[50,'progressUuidIncludesProgressEventId'],[51,'progressUuidNotEqualFinalUuid'],[52,'finalUuidBoundToTaskOrRevision'],[53,'progressExactlyOnce'],[54,'finalExactlyOnce'],[55,'progressFailureDoesNotBlockFinal']])check(`V${number}_${key}`,delivery[key]===true);
 check('V56_BLOCKERS_EXACT',same(c.topLevelProductLandingBlockers,BLOCKERS),c.topLevelProductLandingBlockers);check('V57_BLOCKER_COUNT',c.productDecisions?.topLevelProductLandingBlockerCount===7&&c.topLevelProductLandingBlockers?.length===7);
 const sub=new Map((c.subGates||[]).map(x=>[x.id,x]));check('V58_REAL_FEISHU_SUBGATE',sub.get('REAL_FEISHU_SMOKE_MISSING')?.classification==='SUB_GATE_OF_PRODUCTION_EQUIVALENT_FEISHU_E2E_MISSING'&&sub.get('REAL_FEISHU_SMOKE_MISSING')?.parent===BLOCKERS[5]&&!c.topLevelProductLandingBlockers.includes('REAL_FEISHU_SMOKE_MISSING'));check('V59_MOBILE_SUBGATE',sub.get('MOBILE_REAL_DEVICE_ACCEPTANCE_MISSING')?.classification==='SUB_GATE_OF_HUMAN_ACCEPTANCE_MISSING'&&sub.get('MOBILE_REAL_DEVICE_ACCEPTANCE_MISSING')?.parent===BLOCKERS[6]&&!c.topLevelProductLandingBlockers.includes('MOBILE_REAL_DEVICE_ACCEPTANCE_MISSING'));
 check('V60_CLOSABLE',same(c.blockerDisposition?.closableByPackageB,CLOSABLE));check('V61_CONDITIONAL',same(c.blockerDisposition?.conditionallyClosableByPackageB,CONDITIONAL));check('V62_DEFERRED',same(c.blockerDisposition?.deferredAfterPackageB,DEFERRED));
 const exclusions=c.prohibitedScope?.packageBCompletionExcludes||[];check('V63_E2E_EXCLUDED',exclusions.includes('PRODUCTION_EQUIVALENT_FEISHU_E2E')&&exclusions.includes('REAL_FEISHU_SMOKE'));check('V64_HUMAN_EXCLUDED',exclusions.includes('HUMAN_ACCEPTANCE')&&exclusions.includes('MOBILE_REAL_DEVICE_ACCEPTANCE'));check('V65_DEPLOYMENT_EXCLUDED',exclusions.includes('DEPLOYMENT')&&exclusions.includes('PRODUCTION_RELEASE_APPROVAL'));check('V66_PRODUCTION_BINDING_DEFERRED',c.runtimeReleaseBinding?.completionBoundary?.currentProductionBindingProven===false&&c.runtimeReleaseBinding?.completionBoundary?.currentProductionBindingStatus==='DEFERRED_TO_CONTROLLED_E2E');check('V67_STRATEGY',c.constructionPlan?.strategy==='LIGHTWEIGHT_CONTRACT_FIRST_THEN_SINGLE_CONSTRUCTION_PACKAGE'&&c.productDecisions?.recommendedPackageBStrategy===c.constructionPlan?.strategy);check('V68_ALLOWLIST',same(c.constructionAllowlist?.packageBMinimumProductionFileSet,ALLOWLIST));check('V69_FINAL_ACCEPTANCE_FALSE',c.completionBoundary?.finalAcceptance===false);check('V70_NOT_DEPLOYED',c.completionBoundary?.deployment==='NOT_DEPLOYED');check('V71_REPORT_IDENTITY',rs.properties?.contractId?.const===CONTRACT_ID&&rs.properties?.contractVersion?.const===1&&rs.properties?.finalAcceptance?.const===false&&rs.properties?.deployment?.const==='NOT_DEPLOYED');
 check('ENTRY_RUN_INCOMPLETE',c.runCompleteness?.entryState?.canonicalRuntimeAllProviderRunCoverage===false&&c.runCompleteness?.entryState?.allProviderPathsUseRun===false&&c.runCompleteness?.entryState?.allProviderAttemptsHaveRunId===false);check('ENTRY_FENCING_INCOMPLETE',Object.values(c.leaseRunFencing?.entryState||{}).every(x=>x===false));check('REPORT_CURRENT_BINDING_NOT_TRUE',same(rs.properties?.currentProductionBindingProven?.oneOf,[{type:'boolean',const:false},{type:'string',const:'DEFERRED_TO_CONTROLLED_E2E'}]));check('REPORT_FAIL_CLOSED',rs.additionalProperties===false&&rs.properties?.finalStatus?.enum?.includes('FIRST_FAILURE')&&rs.properties?.finalStatus?.enum?.includes('SUCCESS'));
 const result={schemaVersion:'ai-workbench.package-b-contract-validator/v1',ok:failures.length===0,contractId:c.contractId,contractVersion:c.contractVersion,schemaValid:schemaErrors.length===0,executionReportSchemaValid:checks.find(x=>x.code==='V04_EXECUTION_REPORT_SCHEMA_VALID')?.ok===true,crossFieldValid:failures.length===0,currentRuntimeAuthorityCount:entry.runtimeAuthorityCount,targetRuntimeAuthorityCount:target.runtimeAuthorityCount,entryDuplicateBusinessAuthorityCount:entry.duplicateBusinessAuthorityCount,targetDuplicateBusinessAuthorityCount:target.duplicateBusinessAuthorityCount,topLevelProductLandingBlockerCount:c.topLevelProductLandingBlockers?.length,contractSha256:createHash('sha256').update(read(paths.contract)).digest('hex'),checks,failures};console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
}catch(error){console.log(JSON.stringify({schemaVersion:'ai-workbench.package-b-contract-validator/v1',ok:false,contractId:null,contractVersion:null,schemaValid:false,executionReportSchemaValid:false,crossFieldValid:false,checks,failures:[...failures,{code:'VALIDATOR_RUNTIME',detail:error.message}]},null,2));process.exitCode=failures.length?1:3;}
