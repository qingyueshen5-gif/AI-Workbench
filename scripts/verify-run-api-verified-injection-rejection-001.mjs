#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));const port=19931;const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',c=>output+=c);server.stderr.on('data',c=>output+=c);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
let cookie='';async function req(path,method='GET',payload){const headers={'Content-Type':'application/json'};if(cookie)headers.Cookie=cookie;const response=await fetch(base+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];return {response,body:await response.json()};}
async function ready(){for(let i=0;i<60;i++){try{const r=await fetch(base+'/');cookie=String(r.headers.get('set-cookie')||'').split(';')[0];await r.text();if(cookie)return;}catch{}await wait(100);}throw new Error(output);}
try{
 await ready();const before=await req('/api/data');const runCount=before.body.runs.length;
 const values=[true,'true',1,{}];
 for(const value of values){const x=await req('/api/runs','POST',{taskId:'external',verified:value});assert.equal(x.response.status,422);assert.equal(x.body.errorCode,'CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN');assert.equal(x.body.accepted,false);assert.equal(x.body.serverOwnedField,true);assert.equal(x.body.retryable,false);assert.ok(x.body.offendingPaths.includes('verified'));}
 for(const payload of [{finalResult:{verified:true}},{verification:{passed:true}},{verificationPassed:true},{finalEvidence:{}},{verifierId:'client'},{verifiedAt:1},{verificationResult:{ok:true}}]){const x=await req('/api/runs','POST',payload);assert.equal(x.response.status,422);assert.equal(x.body.errorCode,'CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN');}
 const after=await req('/api/data');assert.equal(after.body.runs.length,runCount);
 console.log(JSON.stringify({ok:true,module:'RUN-API-VERIFIED-INJECTION-REJECTION-001',httpStatus:422,errorCode:'CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN',runCreates:0}));
}finally{server.kill();}
