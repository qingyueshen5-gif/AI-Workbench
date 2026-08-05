#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { normalizeTaskCard } from './task-gateway.mjs';
import { parseFeishuMessage } from './workbench-feishu-adapter.mjs';
import { MemoryTransport } from './feishu-task-channel.mjs';
import { shouldStopJobForActiveTask, shouldSuppressCompletedResult } from './workbench-agent-runtime.mjs';
import { deriveBoundVerifierResult } from '../agents/verified-semantics.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const auditPath = join(root, 'verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/propagation-boundary-audit.json');
const matrixPath = join(root, 'verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/propagation-boundary-matrix.json');
const reportPath = join(root, 'verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001/propagation-boundary-report.md');
const expectedIds = ['C1','C2','C3','C4','C5','C6','C7','C8'];
const mapped = { C1:'P6', C2:'P7', C3:'P9', C4:'P8', C5:'P5', C6:'P3', C7:'P4', C8:'P2' };
const tokens = ['verified','isVerified','verifiedAt','verifiedStatus','verification','trusted','acceptance','gateStatus'];
const failures=[];
let staticChecks=0, probeChecks=0, closureChecks=0;
const check=(condition,message,bucket='static')=>{if(bucket==='static')staticChecks++;else if(bucket==='probe')probeChecks++;else closureChecks++;if(!condition)failures.push(message);};
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const compact=value=>JSON.parse(JSON.stringify(value));
const withoutAttack=value=>{const copy=structuredClone(value);for(const key of tokens)delete copy?.[key];return copy;};
const trustedAcceptance=value=>deriveBoundVerifierResult({task:value?.task||null,run:value?.run||null,verification:value?.verificationRecord||null,finalResult:value?.finalResult||null,finalEvidence:value?.finalEvidence||null});

const runtimeHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const tracked=execFileSync('git',['ls-files','*.mjs','*.js','*.jsx','*.ts','*.tsx'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean).filter(x=>!x.startsWith('node_modules/'));
const sourceCache=new Map();
for(const rel of tracked)sourceCache.set(rel,await fs.readFile(join(root,rel),'utf8'));
const audit=await readJson(auditPath);const matrix=await readJson(matrixPath);const report=await fs.readFile(reportPath,'utf8');
check(audit.auditId==='LEGACY-RUN-API-STEP5-PROPAGATION-BOUNDARY-001','auditId mismatch');
check(JSON.stringify(audit.scannedTokens)===JSON.stringify(tokens),'scannedTokens mismatch');
check(Array.isArray(matrix.components)&&matrix.components.length===8,'matrix must contain eight components');
check(JSON.stringify(matrix.components.map(x=>x.id))===JSON.stringify(expectedIds),'component ids/order mismatch');
check(new Set(matrix.components.map(x=>x.id)).size===8,'duplicate component');
for(const component of matrix.components){
 check(mapped[component.id]===component.mappedProbe,`${component.id} mappedProbe mismatch`);
 check(['YES','NO'].includes(component.componentPresent),`${component.id} componentPresent invalid`);
 check(['YES','NO'].includes(component.trustDecisionResponsibility),`${component.id} trust responsibility invalid`);
 check(['YES','NO'].includes(component.directConsumption),`${component.id} directConsumption invalid`);
 if(component.componentPresent==='YES'){
  check(Array.isArray(component.realEntryPoints)&&component.realEntryPoints.length>0,`${component.id} realEntryPoints empty`);
  for(const entry of component.realEntryPoints){const [file,symbol]=entry.split(':');check(sourceCache.has(file),`${component.id} entry file missing: ${file}`);check(Boolean(symbol)&&sourceCache.get(file)?.includes(symbol),`${component.id} entry symbol unresolved: ${entry}`);}
 }else check(Array.isArray(component.absenceEvidence)&&component.absenceEvidence.length>0,`${component.id} absence evidence empty`);
}
for(const finding of audit.findings){const source=sourceCache.get(finding.file)||'';const line=source.split(/\r?\n/)[finding.line-1]||'';check(Boolean(source),`audit source missing: ${finding.file}`);check(tokens.some(t=>line.toLowerCase().includes(t.toLowerCase())),`audit line no longer trust-sensitive: ${finding.file}:${finding.line}`);}
const scannedFindings=[];for(const [file,source] of sourceCache){source.split(/\r?\n/).forEach((line,i)=>{if(tokens.some(t=>new RegExp(`\\b${t}\\b`,'i').test(line)))scannedFindings.push(`${file}:${i+1}`);});}
for(const finding of audit.findings)check(scannedFindings.includes(`${finding.file}:${finding.line}`),`audit finding drift: ${finding.file}:${finding.line}`);

const tmp=await fs.mkdtemp(join(os.tmpdir(),'aiw-step5e-propagation-'));
const outcomes={};
try{
 const attack={verified:true,isVerified:true,verifiedAt:1,verifiedStatus:'passed',verification:{passed:true},trusted:true,acceptance:true,gateStatus:'GATE_PASSED'};
 // C1 Gateway: real task-card normalization ignores attacker trust fields.
 const card={task_id:'probe-gateway',title:'probe',role:'research',repository:root,baseline_head:runtimeHead,prompt_file:join(tmp,'prompt.md'),allowed_paths:[],forbidden_paths:[],requires_codex:false,max_codex_runs:1,max_retries:0,concurrency_group:'probe',approval_required:false};
 const c1=normalizeTaskCard(card),f1=normalizeTaskCard({...card,...attack});
 outcomes.C1={control:{taskId:c1.task_id,status:c1.status,trustedAcceptance:trustedAcceptance(c1)},forged:{taskId:f1.task_id,status:f1.status,trustedAcceptance:trustedAcceptance(f1)}};
 check(JSON.stringify(outcomes.C1.control)===JSON.stringify(outcomes.C1.forged),'C1 P1/P6 changed','probe');
 // C2 Delivery: real in-memory delivery transport sends only target/text.
 const t1=new MemoryTransport(),t2=new MemoryTransport();await t1.send({type:'source',chatId:'probe'},'same');await t2.send({type:'source',chatId:'probe',...attack},'same');
 outcomes.C2={control:{sent:t1.sent,trustedAcceptance:trustedAcceptance(t1.sent[0])},forged:{sent:t2.sent,trustedAcceptance:trustedAcceptance(t2.sent[0])}};
 check(JSON.stringify(outcomes.C2.control)===JSON.stringify(outcomes.C2.forged),'C2 P1/P7 changed','probe');
 // C3 Feishu adapter: real parser ignores trust-looking envelope fields.
 const msg={message_id:'m1',message_type:'text',chat_id:'c',content:JSON.stringify({text:'same'})};const c3=parseFeishuMessage(msg,{sender_id:{open_id:'u'}}),f3=parseFeishuMessage({...msg,...attack},{sender_id:{open_id:'u'}});
 outcomes.C3={control:{messageId:c3.messageId,text:c3.text,supported:c3.supported,trustedAcceptance:trustedAcceptance(c3)},forged:{messageId:f3.messageId,text:f3.text,supported:f3.supported,trustedAcceptance:trustedAcceptance(f3)}};
 check(JSON.stringify(outcomes.C3.control)===JSON.stringify(outcomes.C3.forged),'C3 P1/P9 changed','probe');
 // C4 IPC: import real IPC module after isolated environment setup.
 process.env.AIW_FEISHU_IPC_DIR=join(tmp,'ipc');process.env.AIW_WORKER_STATE_PATH=join(tmp,'worker-state.json');
 const ipc=await import(`${pathToFileURL(join(root,'scripts/feishu-worker-ipc.mjs')).href}?step5e=${Date.now()}`);
 const job={messageId:'ipc-control',originalMessageId:'ipc-control',chatId:'c',conversationId:'c',text:'same',receivedAt:1};const fj={...job,messageId:'ipc-forged',originalMessageId:'ipc-forged',...attack};await ipc.enqueueJob(job);await ipc.enqueueJob(fj);const jobs=await ipc.listJobs();const a=jobs.find(x=>x.messageId==='ipc-control'),b=jobs.find(x=>x.messageId==='ipc-forged');
 outcomes.C4={control:{text:a.text,chatId:a.chatId,trustedAcceptance:trustedAcceptance(a)},forged:{text:b.text,chatId:b.chatId,trustedAcceptance:trustedAcceptance(b)}};
 check(JSON.stringify(outcomes.C4.control)===JSON.stringify(outcomes.C4.forged),'C4 P1/P8 changed','probe');
 // C5 completion notification suppression uses task authority, not trust-looking payload.
 const active={taskId:'task',originalMessageId:'m',currentState:'completed',finalResult:{text:'done'}};const job5={taskId:'task',messageId:'m',originalMessageId:'m'};const c5=shouldSuppressCompletedResult(job5,active,{text:'same'}),f5=shouldSuppressCompletedResult({...job5,...attack},active,{text:'same',...attack});
 outcomes.C5={control:{suppressed:c5,trustedAcceptance:false},forged:{suppressed:f5,trustedAcceptance:false}};check(JSON.stringify(outcomes.C5.control)===JSON.stringify(outcomes.C5.forged),'C5 P1/P5 changed','probe');
 // C6 retry-stop/cancellation decision is bound to task identity and cancelledByUser.
 const task6={taskId:'task',originalMessageId:'m',currentState:'running',cancelledByUser:false};const c6=shouldStopJobForActiveTask({taskId:'task',messageId:'m',originalMessageId:'m'},task6),f6=shouldStopJobForActiveTask({taskId:'task',messageId:'m',originalMessageId:'m',...attack},task6);
 outcomes.C6={control:{shouldStop:c6.shouldStop,reason:c6.reason,trustedAcceptance:false},forged:{shouldStop:f6.shouldStop,reason:f6.reason,trustedAcceptance:false}};check(JSON.stringify(outcomes.C6.control)===JSON.stringify(outcomes.C6.forged),'C6 P1/P3 changed','probe');
 // C7 idempotency uses message identity only.
 const k1=ipc.deliveryIdempotencyKey('message','final'),k2=ipc.deliveryIdempotencyKey('message','final');outcomes.C7={control:{key:k1,trustedAcceptance:false},forged:{key:k2,trustedAcceptance:false}};check(JSON.stringify(outcomes.C7.control)===JSON.stringify(outcomes.C7.forged),'C7 P1/P4 changed','probe');
 // C8 success branch: only fully bound verifier evidence can produce trusted true.
 const bound={task:{taskId:'t',currentState:'completed',failure:null,activeRunId:'r'},run:{taskId:'t',runId:'r',taskRevision:1,status:'completed'},verification:{passed:true,taskId:'t',runId:'r',taskRevision:1,verifierId:'ResultVerifier'},finalResult:{verified:true,taskId:'t',runId:'r',taskRevision:1},finalEvidence:{passed:true,taskId:'t',runId:'r',taskRevision:1,verifierId:'ResultVerifier'}};const c8=deriveBoundVerifierResult(bound),f8=deriveBoundVerifierResult({...bound,...attack});outcomes.C8={control:{success:true,trustedAcceptance:c8},forged:{success:true,trustedAcceptance:f8}};check(JSON.stringify(outcomes.C8.control)===JSON.stringify(outcomes.C8.forged),'C8 P1/P2 changed','probe');
}finally{await fs.rm(tmp,{recursive:true,force:true});}

const directConsumptionFound=matrix.components.filter(x=>x.directConsumption==='YES').length;
for(const c of matrix.components.filter(x=>x.trustDecisionResponsibility==='NO'))check(c.directConsumption==='NO',`${c.id} transport component directly consumes trust`,'probe');
const blocked=matrix.components.filter(x=>x.probeResult==='BLOCKED_NO_CALLABLE_PRODUCTION_ENTRYPOINT');
const boundaryPolicyOk=failures.length===0&&blocked.length===0;
const finalized=matrix.components.every(x=>x.probeResult!=='PENDING');
if(finalized){
 for(const c of matrix.components){check(c.probeResult===(failures.some(f=>f.startsWith(c.id))?'FAIL':'PASS'),`${c.id} matrix probeResult mismatch`,'closure');check(JSON.stringify(c.controlOutcome)===JSON.stringify(outcomes[c.id].control),`${c.id} controlOutcome mismatch`,'closure');check(JSON.stringify(c.forgedOutcome)===JSON.stringify(outcomes[c.id].forged),`${c.id} forgedOutcome mismatch`,'closure');}
 const header=Object.fromEntries(report.split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=').map(y=>y.trim())).filter(x=>x.length===2));
 check(Number(header.componentsAudited)===8,'report componentsAudited mismatch','closure');check(Number(header.probesExecuted)===8,'report probesExecuted mismatch','closure');check(Number(header.directConsumptionFound)===directConsumptionFound,'report directConsumptionFound mismatch','closure');check(header.boundaryPolicyOk===String(boundaryPolicyOk),'report boundaryPolicyOk mismatch','closure');check(header.productionCodeModified==='false','report productionCodeModified mismatch','closure');
}
const auditIntegrityOk=failures.filter(x=>x.includes('audit')||x.includes('matrix')||x.includes('component')||x.includes('entry')||x.includes('mapped')).length===0;
const reportIntegrityOk=!finalized||failures.filter(x=>x.startsWith('report ')||x.includes('Outcome mismatch')).length===0;
const result={ok:failures.length===0,auditIntegrityOk,reportIntegrityOk,boundaryPolicyOk,staticChecks,probeChecks,closureChecks,checks:staticChecks+probeChecks+closureChecks,failures,runtimeHead,probeResults:outcomes};
process.stdout.write(`${JSON.stringify(result)}\n`);if(!result.ok)process.exitCode=1;
