#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toWritableDataDto, toWritableRunDto } from '../src/lib/writable-data-dto.js';
import { ALL_SERVER_OWNED_RUN_PATHS } from '../src/lib/server-owned-run-paths.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const authorityDir=join(root,'verification','LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001');
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const trust=await readJson(join(authorityDir,'server-owned-trust-fields.json'));
const map=await readJson(join(authorityDir,'server-fact-preservation-map.json'));
const expected=[...new Set([
  ...trust.fields.filter(x=>x.externalWritable===false).map(x=>x.path),
  ...map.fields.filter(x=>x.serverOwned===true && x.classification!=='CLIENT_WRITABLE_BUSINESS_FIELD' && x.path!=='finalResult').map(x=>x.path)
])].sort();
const actual=[...ALL_SERVER_OWNED_RUN_PATHS].sort();
assert.deepEqual(actual,expected);
const results={E:{result:'PASS',missing:[],extra:[],classificationErrors:[]}};

const id=`run-${randomUUID()}`;
const opaque={importedRecord:{verified:'ordinary-domain-value',verification:'ordinary-domain-value',finalResult:{verified:'ordinary-domain-value'}}};
const run={id,taskId:`task-${randomUUID()}`,taskRevision:3,agentId:'hermes',status:'completed',input:{...opaque},output:{...opaque},evidence:{...opaque},errorRaw:{...opaque},errorUserMessage:'',retryCount:0,costEstimate:{currency:'USD',amount:0},startedAt:'',finishedAt:'',handled:false,rendered:false,policyApplied:false,executionStarted:true,executionCompleted:true,postconditionObserved:false,memorySuggestions:[opaque],verified:true,verification:{passed:true},verificationPassed:true,verificationResult:{ok:true},finalEvidence:{passed:true},finalResult:{verified:true,summary:'keep-me'},verifierId:'v',verifiedAt:'now',runEvidenceValidated:true,legacyVerifiedClaimObserved:true,trustedTask:{taskId:'x'}};
const before=structuredClone(run);const dto=toWritableRunDto(run);
for(const key of ['verified','verification','verificationPassed','verificationResult','finalEvidence','verifierId','verifiedAt','runEvidenceValidated','legacyVerifiedClaimObserved','trustedTask']) assert.equal(Object.hasOwn(dto,key),false);
assert.equal(Object.hasOwn(dto.finalResult,'verified'),false);assert.equal(dto.finalResult.summary,'keep-me');results.A='PASS';
for(const key of ['status','input','output','evidence','errorRaw','errorUserMessage','retryCount','costEstimate','startedAt','finishedAt','handled','rendered','policyApplied','executionStarted','executionCompleted','postconditionObserved','memorySuggestions']) assert.deepEqual(dto[key],run[key]);results.B='PASS';
const runs=[run,{...run,id:`run-${randomUUID()}`,verified:undefined,verification:undefined},{...run,id:`run-${randomUUID()}`,verified:true},{...run,id:`run-${randomUUID()}`,finalResult:{verified:true,summary:'four'}},{...run,id:`run-${randomUUID()}`,verification:{passed:false}}];const multi=toWritableDataDto({runs});assert.equal(multi.runs.length,runs.length);assert.deepEqual(multi.runs.map(x=>x.id),runs.map(x=>x.id));assert.equal(new Set(multi.runs.map(x=>x.output.importedRecord.verified)).size,1);results.C='PASS';
assert.equal(toWritableDataDto(null),null);assert.equal(toWritableDataDto(undefined),undefined);assert.deepEqual(toWritableDataDto({}),{});assert.deepEqual(toWritableDataDto([]),[]);assert.deepEqual(toWritableDataDto({runs:null}),{runs:null});assert.deepEqual(toWritableDataDto({runs:[]}),{runs:[]});const primitives=toWritableDataDto({runs:[{id:'p',handled:false,retryCount:0,errorUserMessage:'',output:null}]});assert.deepEqual(primitives.runs[0],{id:'p',handled:false,retryCount:0,errorUserMessage:'',output:null});results.D='PASS';
assert.deepEqual(run,before);assert.notEqual(dto,run);assert.notEqual(dto.output,run.output);const data={runs:[run],other:{x:1}};const dataBefore=structuredClone(data);const transformed=toWritableDataDto(data);assert.deepEqual(data,dataBefore);assert.notEqual(transformed,data);assert.notEqual(transformed.runs,data.runs);assert.notEqual(transformed.runs[0],data.runs[0]);results.H='PASS';
assert.deepEqual(toWritableDataDto(transformed),transformed);results.I='PASS';
for(const key of ['input','output','evidence','errorRaw','memorySuggestions']) assert.deepEqual(dto[key],run[key]);results.J='PASS';

const temp=await fs.mkdtemp(join(os.tmpdir(),'aiw-ui-dto-'));const dataFile=join(temp,'workbench.json');const port=19936,base=`http://127.0.0.1:${port}`;const taskId=`task-${randomUUID()}`,runId=`run-${randomUUID()}`,rev=5;const empty={conversations:[],messages:[],tasks:[],runs:[],memories:[],agents:[],preferences:{},modelConnection:{},systemErrors:[]};const trusted={id:runId,taskId,taskRevision:rev,agentId:'hermes',status:'completed',output:{summary:'before'},trustedTask:{taskId,id:taskId,currentState:'completed',status:'completed'},verification:{passed:true,taskId,runId,taskRevision:rev,verifierId:'v'},finalEvidence:{passed:true,taskId,runId,taskRevision:rev,verifierId:'v'},finalResult:{verified:true,taskId,runId,taskRevision:rev},verified:true};await fs.writeFile(dataFile,JSON.stringify({...empty,tasks:[{id:taskId,taskId,status:'completed',currentState:'completed'}],runs:[trusted]},null,2));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),AIW_DATA_FILE:dataFile,AI_WORKBENCH_RUNTIME_DIR:temp},stdio:['ignore','pipe','pipe']});let log='',cookie='';child.stdout.on('data',c=>log+=c);child.stderr.on('data',c=>log+=c);const wait=ms=>new Promise(r=>setTimeout(r,ms));async function ready(){for(let i=0;i<60;i++){try{const r=await fetch(base+'/');cookie=String(r.headers.get('set-cookie')||'').split(';')[0];await r.text();if(cookie)return}catch{}await wait(100)}throw new Error(log)}async function put(payload){const response=await fetch(base+'/api/data',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(payload)});return{response,body:await response.json()}}const hash=async()=>createHash('sha256').update(await fs.readFile(dataFile)).digest('hex');
try{await ready();const beforeF=await hash();let r=await put({...empty,runs:[{...trusted,verified:true}]});assert.equal(r.response.status,422);assert.equal(r.body.errorCode,'CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN');assert.equal(await hash(),beforeF);results.F={result:'PASS',httpStatus:422,writeCount:0};const uiState={...empty,tasks:[{id:taskId,taskId,status:'completed',currentState:'completed'}],runs:[{...trusted,output:{summary:'after'}}]};const requestDto=toWritableDataDto(uiState);assert.equal(Object.hasOwn(requestDto.runs[0],'verified'),false);r=await put(requestDto);assert.equal(r.response.status,200);const saved=r.body.runs.find(x=>x.id===runId);assert.equal(saved.output.summary,'after');assert.equal(saved.verified,true);assert.equal(saved.verification.passed,true);results.G='PASS'}finally{child.kill();await fs.rm(temp,{recursive:true,force:true})}
console.log(JSON.stringify({ok:true,module:'UI-WRITABLE-DTO-001',productionImport:'src/lib/writable-data-dto.js',globalFieldNameDeletion:false,scenarios:results},null,2));
