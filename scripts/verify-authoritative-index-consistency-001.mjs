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
const checkpointFields = ['name','manifestPath','commit','commitExists','commitIsAncestorOfGeneratedHead','saveStatus','gateStatus','effectiveGateStatus','patchPath','manifestPatchSha256','actualPatchSha256','patchExists','patchHashMatch','supersedes'];

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
function scriptsIn(text) { return new Set([...text.matchAll(/scripts\/[A-Za-z0-9._-]+\.mjs/g)].map((match) => match[0])); }
function tableStatus(text, id) { const escaped=id.replace('-','\\-'); return text.match(new RegExp(`\\|\\s*${escaped}[^\\n]*\\|\\s*\\\`(PRESENT_AND_VERIFIED|PRESENT_NO_CHECKPOINT|NAMING_DRIFT|ACTUALLY_MISSING)\\\``))?.[1] || null; }
function fixtureRoot(indexPath) { return resolve(dirname(indexPath), '..', '..'); }

function run(options) {
  const indexPath=abs(options.index), checkpointRoot=abs(options.checkpointRoot), contractPath=abs(options.contract);
  const index=readJson(indexPath), contract=readJson(contractPath), dataRoot=fixtureRoot(indexPath), rel=dirname(indexPath);
  const markdownPath=resolve(rel,'step5-to-step8-authoritative-index.md'), remainingPath=resolve(rel,'step5-to-step8-real-remaining-work.md'), findingsPath=resolve(rel,'authoritative-index-consistency-reconciliation-findings.json');
  const failures=[], checks=[], groups={ semanticConsistencyChecks:[], markdownConsistencyChecks:[], remainingWorkConsistencyChecks:[], step6ContractChecks:[], step7MandatoryGraphChecks:[], invalidatedCheckpointChecks:[] };
  const check=(group,id,condition,detail)=>{const item={id,ok:Boolean(condition),detail};checks.push(item);groups[group].push(item);if(!item.ok)failures.push({group,id,detail});};
  const head=git(['rev-parse','HEAD']);
  for(const path of [indexPath,markdownPath,remainingPath,findingsPath,contractPath]) check('semanticConsistencyChecks',`FILE_EXISTS:${path}`,existsSync(path),path);
  const findings=readJson(findingsPath), markdown=readFileSync(markdownPath,'utf8'), remaining=readFileSync(remainingPath,'utf8');
  check('semanticConsistencyChecks','SCHEMA_VERSION',Boolean(index.schemaVersion),index.schemaVersion);
  let ancestor=false;try{execFileSync('git',['merge-base','--is-ancestor',index.generatedFromHead,head],{cwd:root,stdio:'ignore'});ancestor=true;}catch{}
  check('semanticConsistencyChecks','GENERATED_HEAD_ANCESTOR',ancestor,`${index.generatedFromHead} -> ${head}`);
  check('semanticConsistencyChecks','GENERATED_REMOTE_BOUND',/^[0-9a-f]{40}$/.test(index.generatedFromRemote||''),index.generatedFromRemote);
  check('semanticConsistencyChecks','BRANCH',index.branch===git(['branch','--show-current']),index.branch);
  for(const item of index.checkpointInventory||[]){
    check('semanticConsistencyChecks',`CHECKPOINT_DIR:${item.directoryName}`,existsSync(resolve(item.manifestPath,'..')),item.manifestPath);
    if(!item.manifestReadable){check('semanticConsistencyChecks',`LEGACY_UNREADABLE_EXPLICIT:${item.directoryName}`,item.checkpointCommit===null&&item.patchPath===null,item);continue;}
    check('semanticConsistencyChecks',`MANIFEST:${item.directoryName}`,existsSync(item.manifestPath),item.manifestPath);
    check('semanticConsistencyChecks',`COMMIT:${item.directoryName}`,item.commitExists===true&&item.commitIsAncestorOfGeneratedHead===true,item.checkpointCommit);
    const actual=item.patchExists&&existsSync(item.patchPath)?sha256(item.patchPath):null;
    check('semanticConsistencyChecks',`PATCH:${item.directoryName}`,actual&&actual===item.manifestPatchSha256&&actual===item.actualPatchSha256&&item.patchHashMatch===true,actual);
  }
  const statusEnum=['PRESENT_AND_VERIFIED','PRESENT_NO_CHECKPOINT','NAMING_DRIFT','ACTUALLY_MISSING'];
  const ids={step5A:'STEP5-A',step5B:'STEP5-B',step5C:'STEP5-C',step5D:'STEP5-D',step5E:'STEP5-E',step6:'STEP6',step7:'STEP7'}, actualStatuses={};
  for(const [key,id] of Object.entries(ids)){
    const step=index.steps?.[key];actualStatuses[id]=step?.machineStatus;
    check('semanticConsistencyChecks',`STEP_STATUS_ENUM:${id}`,statusEnum.includes(step?.machineStatus),step?.machineStatus);
    if(step?.machineStatus==='PRESENT_AND_VERIFIED')check('semanticConsistencyChecks',`PRESENT_HAS_CHECKPOINT:${id}`,step.checkpoint?.gateStatus==='GATE_PASSED'&&step.checkpoint?.patchHashMatch===true&&step.checkpoint?.commitIsAncestorOfGeneratedHead===true,step.checkpoint?.name);
    if(step?.machineStatus==='ACTUALLY_MISSING')check('semanticConsistencyChecks',`MISSING_HAS_NO_CHECKPOINT:${id}`,step.checkpoint===null,step.checkpoint);
  }
  const step5E=index.steps?.step5E;
  if(step5E?.machineStatus===contract.indexBindings.verifiedStatusEnum){
    const cp=step5E.checkpoint;
    check('semanticConsistencyChecks','STEP5E_CHECKPOINT_OBJECT',cp&&typeof cp==='object'&&!Array.isArray(cp),cp);
    check('semanticConsistencyChecks','STEP5E_CHECKPOINT_FIELDS',cp&&JSON.stringify(Object.keys(cp).sort())===JSON.stringify([...contract.indexBindings.checkpointObjectFields].sort()),cp&&Object.keys(cp));
    check('semanticConsistencyChecks','STEP5E_FILES_EXIST',Array.isArray(step5E.files)&&step5E.files.length>0&&step5E.files.every(x=>x.exists===true),step5E.files);
  }
  check('semanticConsistencyChecks','INDEX_NO_STEP5E_EVIDENCE',!Object.prototype.hasOwnProperty.call(step5E||{},'evidence'),step5E);
  check('semanticConsistencyChecks','INDEX_NO_FINAL_ACCEPTANCE',!Object.prototype.hasOwnProperty.call(index,'finalAcceptance')&&!Object.prototype.hasOwnProperty.call(index.statusConstraints||{},'finalAcceptance'),index.statusConstraints);
  for(const id of ['STEP5-E','STEP6','STEP7']){
    check('markdownConsistencyChecks',`MARKDOWN_STATUS:${id}`,tableStatus(markdown,id)===actualStatuses[id],`${tableStatus(markdown,id)} / ${actualStatuses[id]}`);
    const missing=remaining.match(/## ACTUALLY_MISSING([\s\S]*?)(?:\n## |$)/)?.[1]||'',present=remaining.match(/## PRESENT_AND_VERIFIED([\s\S]*?)(?:\n## |$)/)?.[1]||'';
    check('remainingWorkConsistencyChecks',`REMAINING_MISSING:${id}`,missing.includes(id)===(actualStatuses[id]==='ACTUALLY_MISSING'),missing);
    check('remainingWorkConsistencyChecks',`REMAINING_PRESENT:${id}`,present.includes(id)===(actualStatuses[id]==='PRESENT_AND_VERIFIED'),present);
    check('semanticConsistencyChecks',`FINDINGS_STATUS:${id}`,findings.machineStatuses?.[id]===actualStatuses[id],`${findings.machineStatuses?.[id]} / ${actualStatuses[id]}`);
  }
  const step6=index.steps?.step6, cp=step6?.checkpoint;
  check('step6ContractChecks','STEP6_CHECKPOINT_OBJECT',cp&&typeof cp==='object'&&!Array.isArray(cp),cp);
  check('step6ContractChecks','STEP6_CHECKPOINT_FIELDS',cp&&JSON.stringify(Object.keys(cp).sort())===JSON.stringify([...checkpointFields].sort()),cp&&Object.keys(cp));
  check('step6ContractChecks','STEP6_COMMIT_FORMAT',/^[0-9a-f]{40}$/.test(cp?.commit||''),cp?.commit);
  const checkpointDir=resolve(checkpointRoot,cp?.name||''), manifestPath=resolve(checkpointDir,'manifest.json');
  check('step6ContractChecks','STEP6_CHECKPOINT_DIRECTORY',existsSync(checkpointDir),checkpointDir);
  check('step6ContractChecks','STEP6_MANIFEST',existsSync(manifestPath),manifestPath);
  if(existsSync(manifestPath)){
    const manifest=readJson(manifestPath);
    check('step6ContractChecks','STEP6_MANIFEST_COMMIT',manifest.checkpointCommit===cp?.commit,manifest.checkpointCommit);
    check('step6ContractChecks','STEP6_MANIFEST_FINAL_ACCEPTANCE',manifest.finalAcceptance===false,manifest.finalAcceptance);
    const pp=manifest.patchPath||cp?.patchPath;
    check('step6ContractChecks','STEP6_PATCH_EXISTS',Boolean(pp)&&existsSync(pp),pp);
    if(pp&&existsSync(pp)){const actual=sha256(pp);check('step6ContractChecks','STEP6_PATCH_HASH',actual===manifest.patchSha256&&actual===cp?.manifestPatchSha256&&actual===cp?.actualPatchSha256&&cp?.patchHashMatch===true,actual);}
  }
  const productFiles=[...(step6?.requiredFiles||[]),step6?.archiveCompletenessSuite].filter(Boolean);
  check('step6ContractChecks','STEP6_PRODUCT_FILES_EXIST',productFiles.length===4&&productFiles.every(x=>x.exists===true&&existsSync(resolve(dataRoot,x.path))),productFiles);
  const auditPath=resolve(dataRoot,'verification/VERIFIED-SEMANTICS-UNIFICATION-001/legacy-run-api-test-audit.json'), audit=existsSync(auditPath)?readJson(auditPath):{};
  check('step6ContractChecks','STEP6_ARCHIVE_UNIVERSE_EXACT',audit.summary?.expectedCount===5&&audit.archiveUniverseExpectedCount===5&&audit.archiveUniversePresentCount===5,audit.summary);
  check('step6ContractChecks','STEP6_ARCHIVE_DUPLICATE_ZERO',audit.summary?.duplicateCount===0&&Array.isArray(audit.duplicates)&&audit.duplicates.length===0,audit.duplicates);
  check('step6ContractChecks','STEP6_ARCHIVE_UNCLASSIFIED_ZERO',audit.summary?.unclassifiedCount===0&&Array.isArray(audit.unknownEntries)&&audit.unknownEntries.length===0,audit.unknownEntries);
  const memory=readFileSync(resolve(dataRoot,'scripts/verify-memories.mjs'),'utf8'), verification=readFileSync(resolve(dataRoot,'scripts/verify-verification-layer.mjs'),'utf8'), tasks=readFileSync(resolve(dataRoot,'scripts/verify-tasks-runs.mjs'),'utf8'), archive=readFileSync(resolve(dataRoot,'scripts/verify-legacy-run-api-archive-completeness-001.mjs'),'utf8');
  check('step6ContractChecks','STEP6_CLIENT_REJECTION_ACTIVE',memory.includes('CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN')&&memory.includes('clientClaimCanPromoteBusinessVerified')&&memory.includes('false'),null);
  check('step6ContractChecks','STEP6_ISOLATED_NO_PROMOTION',verification.includes('isolatedVerificationCanPromoteBusinessVerified')&&verification.includes('false'),null);
  check('step6ContractChecks','STEP6_SHAPE_LINKAGE_NO_PROMOTION',tasks.includes('shapeOrLinkageCanPromoteBusinessVerified')&&tasks.includes('false'),null);
  check('step6ContractChecks','STEP6_TRUST_PROMOTION_REMOVED',!verification.includes('assert(success.afterVerify.verified === true')&&archive.includes('NO_OLD_ISOLATED_PROMOTION_ASSERTION')&&audit.summary?.trustPromotionAllowed===false,null);
  check('step6ContractChecks','STEP6_FINDINGS_COUNTS',findings.functionalItems?.STEP6?.machineStatus==='PRESENT_AND_VERIFIED'&&findings.functionalItems?.STEP6?.archiveUniverseExpectedCount===5&&findings.functionalItems?.STEP6?.archiveUniverseDuplicateCount===0&&findings.functionalItems?.STEP6?.archiveUniverseUnclassifiedCount===0&&findings.functionalItems?.STEP6?.clientSuppliedTrustFieldForbiddenOccurrences>0&&findings.functionalItems?.STEP6?.assertsBusinessVerifiedTrue===false&&findings.functionalItems?.STEP6?.assertsBusinessVerifiedFalse===true,findings.functionalItems?.STEP6);
  const mandatory=readFileSync(resolve(dataRoot,'scripts/verify-mandatory-gates-001.mjs'),'utf8'), product=readFileSync(resolve(dataRoot,'scripts/verify.mjs'),'utf8'),directSet=scriptsIn(mandatory),productSet=scriptsIn(product),specialists=index.mandatoryGateSpecialists||[];
  let direct=0,transitive=0;for(const specialist of specialists){const d=directSet.has(specialist.path),t=!d&&directSet.has('scripts/verify.mjs')&&productSet.has(specialist.path);direct+=d?1:0;transitive+=t?1:0;check('step7MandatoryGraphChecks',`SPECIALIST_EXISTS:${specialist.path}`,existsSync(resolve(dataRoot,specialist.path)),specialist.path);check('step7MandatoryGraphChecks',`SPECIALIST_BINDING:${specialist.path}`,specialist.wiredIntoMandatoryGates===(d||t),{indexed:specialist.wiredIntoMandatoryGates,isDirect:d,isTransitive:t});}
  check('step7MandatoryGraphChecks','TARGET_COUNT',specialists.length===12,specialists.length);
  check('step7MandatoryGraphChecks','DIRECT_COUNT',findings.functionalItems?.STEP7?.directMandatoryCount===direct,direct);
  check('step7MandatoryGraphChecks','TRANSITIVE_COUNT',findings.functionalItems?.STEP7?.transitiveMandatoryCount===transitive,transitive);
  check('step7MandatoryGraphChecks','EFFECTIVE_COUNT',findings.functionalItems?.STEP7?.effectiveMandatoryCount===direct+transitive,direct+transitive);
  const invalidated=index.steps?.step5C?.invalidatedCheckpoint;
  check('invalidatedCheckpointChecks','INVALIDATED_STATUS',invalidated?.effectiveGateStatus==='INVALIDATED_BY_NEW_RISK',invalidated?.effectiveGateStatus);
  check('invalidatedCheckpointChecks','INVALIDATED_NOT_EFFECTIVE',index.steps?.step5C?.checkpoint?.name!==invalidated?.name,{effective:index.steps?.step5C?.checkpoint?.name,invalidated:invalidated?.name});
  check('invalidatedCheckpointChecks','SUPERSEDES_CONFIRMED',index.steps?.step5C?.supersedesBinding?.confirmed===true,index.steps?.step5C?.supersedesBinding);
  const ordered=Object.entries(ids).map(([key,id])=>({key,id,status:index.steps?.[key]?.machineStatus})),presentAndVerified=ordered.filter(x=>x.status===contract.indexBindings.verifiedStatusEnum).map(x=>x.id),actuallyMissing=ordered.filter(x=>x.status==='ACTUALLY_MISSING').map(x=>x.id),verifiedItemCount=presentAndVerified.length,totalItemCount=ordered.length,computedCompletionRatio=`${verifiedItemCount}/${totalItemCount}`,declaredCompletionRatio=index.remainingWork?.completionRatio;
  check('semanticConsistencyChecks','PRESENT_LIST',JSON.stringify(index.remainingWork?.presentAndVerified)===JSON.stringify(presentAndVerified),index.remainingWork?.presentAndVerified);
  check('semanticConsistencyChecks','MISSING_LIST',JSON.stringify(index.remainingWork?.actuallyMissing)===JSON.stringify(actuallyMissing),index.remainingWork?.actuallyMissing);
  check('semanticConsistencyChecks','COMPLETION_RATIO',index.remainingWork?.verifiedFunctionalItems===verifiedItemCount&&index.remainingWork?.totalRequiredFunctionalItems===totalItemCount&&declaredCompletionRatio===computedCompletionRatio,{declaredCompletionRatio,computedCompletionRatio,verifiedItemCount,totalItemCount});
  check('semanticConsistencyChecks','STEP8_ELIGIBILITY_MATCHES_COMPLETION',index.remainingWork?.step8Eligible===(verifiedItemCount===totalItemCount)&&index.statusConstraints?.step8==='NOT_STARTED',{remaining:index.remainingWork,status:index.statusConstraints});
  check('semanticConsistencyChecks','RISK_OPEN',index.statusConstraints?.fourthRiskStatus==='OPEN',index.statusConstraints?.fourthRiskStatus);
  check('semanticConsistencyChecks','DEPLOYMENT_NOT_DEPLOYED',index.statusConstraints?.deployment==='NOT_DEPLOYED',index.statusConstraints?.deployment);
  return {ok:failures.length===0,module:'AUTHORITATIVE-INDEX-CONSISTENCY-001',indexPath,checkpointRoot,contractPath,runtimeHead:head,generatedFromHead:index.generatedFromHead,checks:checks.length,declaredCompletionRatio,computedCompletionRatio,verifiedItemCount,totalItemCount,failures,...groups};
}

let options;
try{options=parseArgs(process.argv.slice(2));}catch(error){process.stderr.write(`${error.message}\n`);process.exit(error.exitCode||2);}
try{const result=run(options),text=JSON.stringify(result,null,2);(options.json||result.ok?process.stdout:process.stderr).write(`${text}\n`);process.exitCode=result.ok?0:1;}catch(error){const failure={ok:false,errorType:error.name,error:error.message,failures:[{group:'runtime',id:'UNHANDLED',detail:error.message}]};if(options?.json)process.stdout.write(`${JSON.stringify(failure)}\n`);else process.stderr.write(`${error.stack||error.message}\n`);process.exitCode=3;}
