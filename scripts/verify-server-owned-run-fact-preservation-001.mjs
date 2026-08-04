#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = await fs.mkdtemp(join(os.tmpdir(), 'aiw-server-fact-preservation-'));
const dataFile = join(temp, 'workbench.json');
const port = 19935;
const base = `http://127.0.0.1:${port}`;
const ids = { task: `task-${randomUUID()}`, run: `run-${randomUUID()}`, revision: 7 };
const empty = { conversations: [], messages: [], tasks: [], runs: [], memories: [], agents: [], preferences: {}, modelConnection: {}, systemErrors: [] };
const trustedTask = { taskId: ids.task, id: ids.task, currentState: 'completed', status: 'completed', activeRunId: null };
const trustedRun = {
  id: ids.run, taskId: ids.task, taskRevision: ids.revision, agentId: 'hermes', status: 'completed', input: {}, output: { summary: 'before' }, evidence: {},
  trustedTask,
  verification: { passed: true, taskId: ids.task, runId: ids.run, taskRevision: ids.revision, verifierId: 'ResultVerifier' },
  finalEvidence: { passed: true, taskId: ids.task, runId: ids.run, taskRevision: ids.revision, verifierId: 'ResultVerifier' },
  finalResult: { verified: true, taskId: ids.task, runId: ids.run, taskRevision: ids.revision },
  verifierId: 'ResultVerifier', verifiedAt: new Date().toISOString(), runEvidenceValidated: true, verified: true
};
const writeFixture = async (runs) => fs.writeFile(dataFile, JSON.stringify({ ...empty, tasks: [{ id: ids.task, taskId: ids.task, status: 'completed', currentState: 'completed' }], runs }, null, 2));
await writeFixture([trustedRun]);
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), AIW_DATA_FILE: dataFile, AI_WORKBENCH_RUNTIME_DIR: temp }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', cookie = '';
server.stdout.on('data', c => output += c); server.stderr.on('data', c => output += c);
const wait = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i=0;i<60;i++){ try { const r=await fetch(base+'/'); cookie=String(r.headers.get('set-cookie')||'').split(';')[0]; await r.text(); if(cookie)return; } catch {} await wait(100); } throw new Error(output); }
async function req(path, method='GET', payload){ const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:payload===undefined?undefined:JSON.stringify(payload)}); return { response, body: await response.json() }; }
const hashFile = async () => createHash('sha256').update(await fs.readFile(dataFile)).digest('hex');
const writable = run => ({ id: run.id, taskId: run.taskId, taskRevision: run.taskRevision, agentId: run.agentId, status: run.status, input: run.input, output: run.output, evidence: run.evidence, errorRaw: null, errorUserMessage: '', retryCount: 0, costEstimate: {}, startedAt: run.startedAt || '', finishedAt: run.finishedAt || '', handled: false, rendered: false, policyApplied: false, executionStarted: true, executionCompleted: true, postconditionObserved: false, memorySuggestions: [] });
const put = runs => req('/api/data','PUT',{...empty,tasks:[{id:ids.task,taskId:ids.task,status:'completed',currentState:'completed'}],runs});
const results = {};
try {
  await ready();
  const same = writable(trustedRun); same.output={summary:'after'};
  let r=await put([same]); assert.equal(r.response.status,200); let stored=r.body.runs.find(x=>x.id===ids.run); assert.equal(stored.output.summary,'after'); assert.equal(stored.verified,true); assert.equal(stored.verification.passed,true); assert.equal(stored.finalEvidence.passed,true); assert.equal(stored.finalResult.verified,true); assert.equal(r.body.runs.length,1); results.A='PASS';

  const beforeB=await hashFile(); r=await put([{...same,verified:true}]); assert.equal(r.response.status,422); assert.equal(r.body.errorCode,'CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN'); assert.equal(await hashFile(),beforeB); results.B='PASS';

  const newId=`run-${randomUUID()}`; r=await put([same,{...same,id:newId,output:{summary:'new'}}]); assert.equal(r.response.status,200); const created=r.body.runs.find(x=>x.id===newId); assert.equal(created.verified,false); assert.equal(created.verification,undefined); assert.equal(created.finalResult,undefined); results.C='PASS';

  const legacyId=`run-${randomUUID()}`; await writeFixture([{id:legacyId,taskId:ids.task,taskRevision:ids.revision,agentId:'hermes',status:'completed',verified:true,output:{summary:'legacy'}}]); r=await put([{...writable({id:legacyId,taskId:ids.task,taskRevision:ids.revision,agentId:'hermes',status:'completed',input:{},output:{summary:'legacy-updated'},evidence:{}})}]); assert.equal(r.response.status,200); stored=r.body.runs.find(x=>x.id===legacyId); assert.equal(stored.verified,false); assert.equal(stored.legacyVerifiedClaimObserved,true); assert.equal(stored.verification,undefined); results.D='PASS';

  await writeFixture([trustedRun]); const beforeE=await hashFile(); r=await put([{...same,taskId:`task-${randomUUID()}`}]); assert.equal(r.response.status,409); assert.equal(r.body.errorCode,'RUN_IDENTITY_CONFLICT'); assert.ok(r.body.conflictingFields.includes('taskId')); assert.equal(await hashFile(),beforeE); results.E='PASS';

  const beforeF=await hashFile(); r=await put([{...same,taskRevision:ids.revision+1}]); assert.equal(r.response.status,409); assert.ok(r.body.conflictingFields.includes('taskRevision')); assert.equal(await hashFile(),beforeF); results.F='PASS';

  r=await put([same,{...same,id:`run-${randomUUID()}`}]); assert.equal(r.response.status,200); const newest=r.body.runs[1]; assert.equal(newest.verified,false); assert.equal(newest.verification,undefined); assert.equal(newest.finalEvidence,undefined); results.G='PASS';

  r=await put([same,{taskId:ids.task,taskRevision:ids.revision,agentId:'hermes',status:'completed',output:{summary:'missing-id'}}]); assert.equal(r.response.status,200); const missing=r.body.runs.find(x=>x.output?.summary==='missing-id'); assert.ok(missing.id); assert.equal(missing.verified,false); results.H='PASS';

  r=await put([]); assert.equal(r.response.status,200); assert.equal(r.body.runs.some(x=>x.id===ids.run),false); results.I='PASS';

  await writeFixture([trustedRun,{...trustedRun,id:`run-${randomUUID()}`,verification:{...trustedRun.verification,runId:'unused'},finalEvidence:{...trustedRun.finalEvidence,runId:'unused'},finalResult:{...trustedRun.finalResult,runId:'unused'}}]); const beforeJ=await hashFile(); r=await put([same,{...same,id:trustedRun.id,taskId:`task-${randomUUID()}`}]); assert.equal(r.response.status,409); const afterJ=await hashFile(); assert.equal(afterJ,beforeJ); results.J={result:'PASS',beforeHash:beforeJ,afterHash:afterJ};

  console.log(JSON.stringify({ok:true,module:'SERVER-OWNED-RUN-FACT-PRESERVATION-001',identityFields:['id','taskId','taskRevision','agentId'],directBareVerifiedCopy:false,verifiedRecomputed:true,scenarios:results},null,2));
} finally { server.kill(); await fs.rm(temp,{recursive:true,force:true}); }
