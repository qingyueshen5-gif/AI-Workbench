import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts/verify-authoritative-index-consistency-001.mjs');
const realIndex = resolve(root, 'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5-to-step8-authoritative-index.json');
const realContract = resolve(root, 'verification/VERIFIED-SEMANTICS-UNIFICATION-001/step5e-phaseb-contract.json');
const startHead = '518b51723cb5afe2f4a6a2fc24de6677a583ad72';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = (args) => spawnSync(process.execPath, [validator, '--json', ...args], { cwd: root, encoding: 'utf8' });
const jsonOut = (result) => JSON.parse(result.stdout.trim());

async function fixture(mutator = async () => {}, { legacy4Of7 = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'aiw-index-validator-'));
  const verification = join(dir, 'verification', 'VERIFIED-SEMANTICS-UNIFICATION-001');
  const scripts = join(dir, 'scripts');
  const checkpointRoot = join(dir, 'checkpoints');
  await mkdir(verification, { recursive: true }); await mkdir(scripts, { recursive: true }); await mkdir(checkpointRoot, { recursive: true });
  const synchronizedFiles = ['step5-to-step8-authoritative-index.json','step5-to-step8-authoritative-index.md','step5-to-step8-real-remaining-work.md','authoritative-index-consistency-reconciliation-findings.json'];
  for (const name of synchronizedFiles) {
    const target = join(verification, name);
    if (legacy4Of7) await writeFile(target, execFileSync('git', ['show', `HEAD:verification/VERIFIED-SEMANTICS-UNIFICATION-001/${name}`], { cwd: root }));
    else await cp(resolve(root, 'verification/VERIFIED-SEMANTICS-UNIFICATION-001', name), target);
  }
  await cp(realContract, join(verification, 'step5e-phaseb-contract.json'));
  for (const name of ['verify-memories.mjs','verify-verification-layer.mjs','verify-tasks-runs.mjs','verify-mandatory-gates-001.mjs','verify.mjs']) await cp(resolve(root, 'scripts', name), join(scripts, name));
  const indexPath = join(verification, 'step5-to-step8-authoritative-index.json');
  const contractPath = join(verification, 'step5e-phaseb-contract.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')); const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  index.branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (legacy4Of7) {
    index.steps.step5E.machineStatus = contract.indexBindings.verifiedStatusEnum;
    index.steps.step5E.files = index.steps.step5E.files.map((x) => ({ ...x, exists:true }));
    index.remainingWork.presentAndVerified = ['STEP5-A','STEP5-B','STEP5-C','STEP5-D','STEP5-E'];
    index.remainingWork.actuallyMissing = ['STEP6','STEP7'];
    index.remainingWork.verifiedFunctionalItems = 5; index.remainingWork.totalRequiredFunctionalItems = 7; index.remainingWork.completionRatio = '5/7';
  } else await copyCurrentFormalCheckpoint({ index, contract, checkpointRoot });
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  const baseline = run(['--index',indexPath,'--checkpoint-root',checkpointRoot,'--contract',contractPath]);
  const baselineClassification = baseline.status === 0 ? 'BASELINE_ALREADY_VALID' : 'LEGACY_4_7_FIXTURE_REQUIRES_PROMOTION';
  await mutator({ dir, verification, checkpointRoot, index, indexPath, contract, contractPath, baseline, baselineClassification });
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  return { dir, indexPath, contractPath, checkpointRoot, baselineClassification };
}

async function copyCurrentFormalCheckpoint({ index, contract, checkpointRoot }) {
  const name = contract.checkpoints.formalCheckpointName;
  const sourceManifest = JSON.parse(await readFile(index.steps.step5E.checkpoint.manifestPath, 'utf8'));
  const checkpointDir = join(checkpointRoot, name); await mkdir(checkpointDir, { recursive: true });
  const patch = await readFile(sourceManifest.patchPath);
  const patchPath = join(checkpointDir, `${name}-${sourceManifest.checkpointCommit.slice(0,12)}.patch`); await writeFile(patchPath, patch);
  const manifestPath = join(checkpointDir, 'manifest.json');
  const manifest = { ...sourceManifest, patchPath }; await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  Object.assign(index.steps.step5E.checkpoint, { manifestPath, patchPath, manifestPatchSha256:sha256(patch), actualPatchSha256:sha256(patch), patchExists:true, patchHashMatch:true });
}

async function makeVerified({ index, indexPath, contract, contractPath, checkpointRoot, baseline, baselineClassification, mismatch = false, missingField = null, fileFalse = false }) {
  const cpFields = contract.indexBindings.checkpointObjectFields;
  const name = contract.checkpoints.formalCheckpointName;
  if (baseline.status === 0) {
    assert.equal(baselineClassification, 'BASELINE_ALREADY_VALID');
  } else {
    const initial = jsonOut(baseline);
    const allowedLegacyFailures = new Set(['MARKDOWN_STATUS:STEP5-E','REMAINING_MISSING:STEP5-E','REMAINING_PRESENT:STEP5-E','FINDINGS_STATUS:STEP5-E','PRESENT_HAS_CHECKPOINT:STEP5-E']);
    assert.ok(initial.failures.length > 0);
    assert.ok(initial.failures.every((x) => allowedLegacyFailures.has(x.id) || x.id.startsWith('STEP5E_')));
    const checkpointDir = join(checkpointRoot, name); await mkdir(checkpointDir, { recursive: true });
    const patch = execFileSync('git', ['format-patch', '-1', startHead, '--stdout'], { cwd: root });
    const patchPath = join(checkpointDir, `${name}-${startHead.slice(0,12)}.patch`); await writeFile(patchPath, patch);
    const actualSha = sha256(patch); const manifestPath = join(checkpointDir, 'manifest.json');
    const manifest = { schema:'ai-workbench.checkpoint-pass/v1', taskId:name, ticket:name, result:'PASS', saveStatus:'SAVED', gateStatus:'GATE_PASSED', finalAcceptance:false, checkpointCommit:startHead, patchPath, patchSha256:actualSha, saved:true };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const values = { name, manifestPath, commit:startHead, commitExists:true, commitIsAncestorOfGeneratedHead:true, saveStatus:'SAVED', gateStatus:'GATE_PASSED', effectiveGateStatus:'GATE_PASSED', patchPath, manifestPatchSha256:actualSha, actualPatchSha256:actualSha, patchExists:true, patchHashMatch:true, supersedes:null };
    index.steps.step5E.machineStatus = contract.indexBindings.verifiedStatusEnum;
    index.steps.step5E.checkpoint = Object.fromEntries(cpFields.map((f) => [f, values[f]]));
    index.steps.step5E.files = index.steps.step5E.files.map((x) => ({ ...x, exists:true }));
    index.remainingWork.presentAndVerified = ['STEP5-A','STEP5-B','STEP5-C','STEP5-D','STEP5-E'];
    index.remainingWork.actuallyMissing = ['STEP6','STEP7'];
    index.remainingWork.verifiedFunctionalItems = 5; index.remainingWork.totalRequiredFunctionalItems = 7; index.remainingWork.completionRatio = '5/7';
    const md = join(resolve(manifestPath, '..', '..', '..'), 'verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'step5-to-step8-authoritative-index.md');
    const rem = join(resolve(manifestPath, '..', '..', '..'), 'verification', 'VERIFIED-SEMANTICS-UNIFICATION-001', 'step5-to-step8-real-remaining-work.md');
    let m = await readFile(md, 'utf8'); m = m.replace('| STEP5-E · Gateway / Delivery传播边界 | `ACTUALLY_MISSING` | `NONE` | `NONE` |', `| STEP5-E · Gateway / Delivery传播边界 | \`PRESENT_AND_VERIFIED\` | \`${name}\` | \`${startHead}\` |`).replace('verifiedFunctionalItems=4','verifiedFunctionalItems=5').replace('completionRatio=4/7','completionRatio=5/7'); await writeFile(md,m);
    let r = await readFile(rem, 'utf8'); const newline = r.includes('\r\n') ? '\r\n' : '\n';
    r = r.replace(/^- STEP5-E：必须真实补做传播边界专项、审计、矩阵、报告和正式Checkpoint。\r?\n/m, '').replace(/^- STEP5-D\r?\n/m, `- STEP5-D${newline}- STEP5-E${newline}`).replace('verifiedFunctionalItems=4','verifiedFunctionalItems=5').replace('completionRatio=4/7','completionRatio=5/7'); await writeFile(rem,r);
    const findingsPath=join(resolve(manifestPath,'..','..','..'),'verification','VERIFIED-SEMANTICS-UNIFICATION-001','authoritative-index-consistency-reconciliation-findings.json'); const f=JSON.parse(await readFile(findingsPath,'utf8')); f.machineStatuses['STEP5-E']='PRESENT_AND_VERIFIED'; await writeFile(findingsPath,JSON.stringify(f,null,2)+'\n');
    await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
    const promoted = run(['--index',indexPath,'--checkpoint-root',checkpointRoot,'--contract',contractPath]);
    assert.equal(promoted.status, 0, promoted.stdout);
    assert.deepEqual(jsonOut(promoted).failures, []);
  }
  const manifestPath = index.steps.step5E.checkpoint.manifestPath;
  if (mismatch) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')); manifest.patchSha256 = '0'.repeat(64); await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    index.steps.step5E.checkpoint.manifestPatchSha256 = '0'.repeat(64); index.steps.step5E.checkpoint.patchHashMatch = false;
  }
  if (missingField) delete index.steps.step5E.checkpoint[missingField];
  if (fileFalse) index.steps.step5E.files = index.steps.step5E.files.map((x, i) => ({ ...x, exists:i === 0 ? false : x.exists }));
}

test('T1 current real index dynamically matches its declared and computed status', async () => { const r=run([]); const o=jsonOut(r); const index=JSON.parse(await readFile(realIndex,'utf8')); const statuses=Object.values(index.steps).map((x)=>x.machineStatus); const verified=statuses.filter((x)=>x==='PRESENT_AND_VERIFIED').length; const total=statuses.length; const expected=`${verified}/${total}`; assert.equal(r.status,0); assert.equal(o.ok,true); assert.equal(index.remainingWork.completionRatio,expected); assert.equal(o.declaredCompletionRatio,expected); assert.equal(o.computedCompletionRatio,expected); assert.equal(o.verifiedItemCount,verified); assert.equal(o.totalItemCount,total); });
test('T2 legal current synchronized fixture passes without promotion', async () => { const f=await fixture(async x=>makeVerified(x)); try { assert.equal(f.baselineClassification,'BASELINE_ALREADY_VALID'); const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]); const o=jsonOut(r); assert.equal(r.status,0,JSON.stringify(o.failures)); assert.equal(o.ok,true); assert.equal(o.declaredCompletionRatio,o.computedCompletionRatio); } finally { await rm(f.dir,{recursive:true,force:true}); } });
test('T3 status/ratio mismatch fails after controlled legacy 4/7 promotion', async()=>{const f=await fixture(async x=>{assert.equal(x.baselineClassification,'LEGACY_4_7_FIXTURE_REQUIRES_PROMOTION');await makeVerified(x);x.index.remainingWork.completionRatio='4/7';},{legacy4Of7:true});try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);assert.ok(jsonOut(r).failures.some(x=>x.id==='COMPLETION_RATIO'));}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T4 illegal status enum fails',async()=>{const f=await fixture(async({index})=>{index.steps.step6.machineStatus='ILLEGAL';});try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);assert.ok(jsonOut(r).failures.some(x=>x.id.includes('STEP_STATUS_ENUM')));}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T5 missing precedent field fails',async()=>{const f=await fixture(async x=>makeVerified({...x,missingField:'patchPath'}));try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);assert.ok(jsonOut(r).failures.length);}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T6 patch hash mismatch fails',async()=>{const f=await fixture(async x=>makeVerified({...x,mismatch:true}));try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);assert.ok(jsonOut(r).failures.some(x=>x.id.includes('PATCH')));}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T7 verified with false evidence file fails',async()=>{const f=await fixture(async x=>makeVerified({...x,fileFalse:true}));try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);assert.ok(jsonOut(r).failures.some(x=>x.id==='STEP5E_FILES_EXIST'));}finally{await rm(f.dir,{recursive:true,force:true});}});
test('T8 unknown CLI exits 2',()=>{const r=run(['--unknown']);assert.equal(r.status,2);assert.match(r.stderr,/unknown argument/);});
test('T9 missing or invalid JSON exits 3',async()=>{const dir=await mkdtemp(join(tmpdir(),'aiw-invalid-json-'));try{const p=join(dir,'bad.json');await writeFile(p,'{');const r=run(['--index',p]);assert.equal(r.status,3);assert.equal(jsonOut(r).ok,false);}finally{await rm(dir,{recursive:true,force:true});}});
test('T10 added evidence/finalAcceptance fields do not produce PASS',async()=>{const f=await fixture(async({index})=>{index.steps.step5E.evidence={invented:true};index.finalAcceptance=false;});try{const r=run(['--index',f.indexPath,'--checkpoint-root',f.checkpointRoot,'--contract',f.contractPath]);assert.equal(r.status,1);const o=jsonOut(r);assert.ok(o.failures.some(x=>x.id==='INDEX_NO_STEP5E_EVIDENCE'));assert.ok(o.failures.some(x=>x.id==='INDEX_NO_FINAL_ACCEPTANCE'));}finally{await rm(f.dir,{recursive:true,force:true});}});
