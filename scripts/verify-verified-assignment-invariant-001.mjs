#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join, relative } from 'node:path';

const root=process.cwd();
const production=[];
for(const top of ['agents','channels','execution','capabilities']){
  const walk=async(dir)=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(/\.mjs$/.test(entry.name))production.push(path);}};await walk(join(root,top));
}
production.push(join(root,'server.mjs'));
const violations=[];const assignments=[];
for(const file of production){
 const lines=(await fs.readFile(file,'utf8')).split(/\r?\n/);const rel=relative(root,file).replaceAll('\\','/');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/\bverified\s*:\s*true\b/.test(line))assignments.push({file:rel,line:i+1,text:line.trim()});
  if(/verified\s*!==\s*false|finalResult\?\.verified\s*!==\s*false/.test(line))violations.push({file:rel,line:i+1,rule:'fail_open',text:line.trim()});
 }
}
const permitted=assignments.filter((x)=>x.file==='agents/agent-runtime.mjs'&&x.text.includes('candidateFinalResult'));
const forbidden=assignments.filter((x)=>!permitted.includes(x));
assert.deepEqual(forbidden,[],'unconditional production verified:true outside trusted candidate boundary');
assert.deepEqual(violations,[],'fail-open verified consumer');
const trusted=await fs.readFile(join(root,'agents/verified-semantics.mjs'),'utf8');
for(const required of ['verification.passed !== true','finalResult.verified !== true','finalEvidence.passed !== true','verification.taskId !== task.taskId','verification.runId !== run.runId','verification.taskRevision !== authoritativeRevision','finalResult.taskId !== task.taskId','finalResult.runId !== run.runId','finalResult.taskRevision !== authoritativeRevision'])assert.ok(trusted.includes(required),required);
const runtime=await fs.readFile(join(root,'agents/agent-runtime.mjs'),'utf8');assert.ok(runtime.includes('deriveBoundVerifierResult'));assert.ok(runtime.includes('deriveTaskTerminalVerification'));
console.log(JSON.stringify({ok:true,module:'VERIFIED-ASSIGNMENT-INVARIANT-001',productionFiles:production.length,verifiedTrueAssignments:assignments,permittedTrustedCandidateAssignments:permitted.length,forbiddenAssignments:forbidden.length,failOpenConsumers:violations.length}));
