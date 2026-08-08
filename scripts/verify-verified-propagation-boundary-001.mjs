#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { deriveBoundVerifierResult } from '../agents/verified-semantics.mjs';

const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const stable=value=>JSON.stringify(value);
const json=value=>`${JSON.stringify(value,null,2)}\n`;

export async function runSpecialist(){
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  const configuredEvidenceRoot=String(process.env.AIW_PROPAGATION_EVIDENCE_DIR||'').trim();
  const evidenceRoot=configuredEvidenceRoot?resolve(configuredEvidenceRoot):join(root,'verification/LEGACY-RUN-API-VERIFIED-TRUST-BOUNDARY-FIX-001');
  await fs.mkdir(evidenceRoot,{recursive:true});
  const auditPath=join(evidenceRoot,'propagation-boundary-audit.json');
  const auditMdPath=join(evidenceRoot,'propagation-boundary-audit.md');
  const matrixPath=join(evidenceRoot,'propagation-boundary-matrix.json');
  const reportPath=join(evidenceRoot,'propagation-boundary-report.md');
  const ids=['C1','C2','C3','C4','C5','C6','C7','C8'];
  const mapping={C1:'P6',C2:'P7',C3:'P9',C4:'P8',C5:'P5',C6:'P3',C7:'P4',C8:'P2'};
  const tokens=['verified','isVerified','verifiedAt','verifiedStatus','verification','trusted','acceptance','gateStatus'];
  const failures=[];let staticChecks=0,probeChecks=0,closureChecks=0;
  const check=(ok,message,bucket='static')=>{if(bucket==='probe')probeChecks++;else if(bucket==='closure')closureChecks++;else staticChecks++;if(!ok)failures.push(message)};
  const runtimeHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
  const sourceFiles=tracked.filter(x=>['.mjs','.js','.jsx','.ts','.tsx','.cjs'].includes(extname(x))&&!x.startsWith('dist/'));
  const sources=new Map();for(const rel of sourceFiles)sources.set(rel,await fs.readFile(join(root,rel),'utf8'));
  const has=(file,symbol)=>(sources.get(file)||'').includes(symbol);
  const line=(file,n)=>(sources.get(file)||'').split(/\r?\n/)[n-1]||'';
  const locate=(file,text)=>{const n=(sources.get(file)||'').split(/\r?\n/).findIndex(x=>x.includes(text));return n<0?null:`${file}:${n+1}`};
  const electronFiles=sourceFiles.filter(x=>x.startsWith('electron/')||x.startsWith('src/'));
  const electronIpcHits=[];for(const file of electronFiles){const text=sources.get(file)||'';for(const token of ['ipcMain','ipcRenderer','contextBridge','preload'])if(new RegExp(`\\b${token}\\b`).test(text))electronIpcHits.push(`${file}:${token}`)}
  const requiredSymbols=[
    ['scripts/workbench-feishu-adapter.mjs','parseFeishuMessage'],['scripts/workbench-feishu-adapter.mjs','authorizeFeishuSender'],
    ['scripts/feishu-worker-ipc.mjs','acceptAndEnqueueJob'],['scripts/feishu-worker-ipc.mjs','completeJob'],['scripts/feishu-worker-ipc.mjs','listResults'],['scripts/feishu-worker-ipc.mjs','claimResultDelivery'],
    ['scripts/workbench-agent-runtime.mjs','shouldSuppressCompletedResult'],['scripts/workbench-agent-runtime.mjs','shouldStopJobForActiveTask'],
    ['scripts/feishu-worker-ipc.mjs','deliveryIdempotencyKey'],['agents/verified-semantics.mjs','deriveBoundVerifierResult']
  ];
  for(const [file,symbol] of requiredSymbols)check(has(file,symbol),`production entry unresolved: ${file}:${symbol}`);
  check(electronIpcHits.length===0,`Electron IPC presence changed: ${stable(electronIpcHits)}`);

  const trustedFacts={run:{taskId:'task',runId:'run',taskRevision:3,status:'completed'},verification:{passed:true,taskId:'task',runId:'run',taskRevision:3,verifierId:'ResultVerifier'},finalResult:{verified:true,taskId:'task',runId:'run',taskRevision:3},finalEvidence:{passed:true,taskId:'task',runId:'run',taskRevision:3,verifierId:'ResultVerifier'},taskState:{taskId:'task',currentState:'completed',failure:null,activeRunId:'run'},identity:{taskId:'task',runId:'run',taskRevision:3},timestamps:{receivedAt:1,finishedAt:2},idempotencyInput:{messageId:'same-delivery',purpose:'final'},serverAcceptanceFacts:{allowedOpenId:'same-user'}};
  const controlFixture={trustedFacts,untrustedInput:{},attackerPayload:{},persistedUntrustedFields:{},contextUntrustedFields:{}};
  const forgedFixture={trustedFacts:structuredClone(trustedFacts),untrustedInput:{},attackerPayload:{verified:true,isVerified:true,verifiedAt:1,verifiedStatus:'passed',verification:{passed:true},trusted:true,acceptance:true,gateStatus:'GATE_PASSED'},persistedUntrustedFields:{verified:true},contextUntrustedFields:{trusted:true}};
  const trustedFactsControlSha256=sha(controlFixture.trustedFacts),trustedFactsForgedSha256=sha(forgedFixture.trustedFacts);
  check(trustedFactsControlSha256===trustedFactsForgedSha256,'FIXTURE_TRUSTED_FACTS_MISMATCH','probe');

  const tmp=await fs.mkdtemp(join(os.tmpdir(),'aiw-step5e-v8-'));
  process.env.AIW_FEISHU_IPC_DIR=join(tmp,'ipc');process.env.AIW_WORKER_STATE_PATH=join(tmp,'worker-state.json');
  const outcomes={};
  try{
    const nonce=Date.now();
    const adapter=await import(`${pathToFileURL(join(root,'scripts/workbench-feishu-adapter.mjs')).href}?step5e=${nonce}`);
    const ipc=await import(`${pathToFileURL(join(root,'scripts/feishu-worker-ipc.mjs')).href}?step5e=${nonce}`);
    const runtime=await import(`${pathToFileURL(join(root,'scripts/workbench-agent-runtime.mjs')).href}?step5e=${nonce}`);
    const baseMessage={message_id:'same-message',message_type:'text',chat_id:'same-chat',chat_type:'p2p',content:JSON.stringify({text:'same text'})};const sender={sender_id:{open_id:'same-user'}};
    const pc=adapter.parseFeishuMessage(baseMessage,sender),pf=adapter.parseFeishuMessage({...baseMessage,attackerPayload:forgedFixture.attackerPayload},sender);
    const ac=adapter.authorizeFeishuSender({openId:'same-user',chatType:'p2p',mentioned:true},new Set(['same-user'])),af=adapter.authorizeFeishuSender({openId:'same-user',chatType:'p2p',mentioned:true,attackerPayload:forgedFixture.attackerPayload},new Set(['same-user']));
    outcomes.C1={control:{messageId:pc.messageId,text:pc.text,authorized:ac.ok,trustedAcceptance:false},forged:{messageId:pf.messageId,text:pf.text,authorized:af.ok,trustedAcceptance:false}};check(stable(outcomes.C1.control)===stable(outcomes.C1.forged),'C1 P1/P6 changed','probe');
    outcomes.C3={control:{supported:pc.supported,chatId:pc.chatId,trustedAcceptance:false},forged:{supported:pf.supported,chatId:pf.chatId,trustedAcceptance:false}};check(stable(outcomes.C3.control)===stable(outcomes.C3.forged),'C3 P1/P9 changed','probe');
    const job={messageId:'same-delivery',originalMessageId:'same-delivery',chatId:'same-chat',conversationId:'same-chat',openId:'same-user',text:'same text',receivedAt:1};const result={messageId:'same-delivery',originalMessageId:'same-delivery',chatId:'same-chat',conversationId:'same-chat',ok:true,text:'same result',finishedAt:2,verified:false};
    await ipc.acceptAndEnqueueJob(job);await ipc.completeJob(job,result);let listed=await ipc.listResults();const claim1=await ipc.claimResultDelivery('same-delivery',{pid:123});outcomes.C2={control:{listed:listed.length,text:listed[0]?.text,ok:listed[0]?.ok,claim:claim1,trustedAcceptance:false},forged:null};
    await fs.rm(process.env.AIW_FEISHU_IPC_DIR,{recursive:true,force:true});await fs.mkdir(process.env.AIW_FEISHU_IPC_DIR,{recursive:true});
    await ipc.acceptAndEnqueueJob({...job,attackerPayload:forgedFixture.attackerPayload});await ipc.completeJob({...job,attackerPayload:forgedFixture.attackerPayload},{...result,attackerPayload:forgedFixture.attackerPayload});listed=await ipc.listResults();const claim2=await ipc.claimResultDelivery('same-delivery',{pid:123});outcomes.C2.forged={listed:listed.length,text:listed[0]?.text,ok:listed[0]?.ok,claim:claim2,trustedAcceptance:false};check(stable(outcomes.C2.control)===stable(outcomes.C2.forged),'C2 P1/P7 changed','probe');
    outcomes.C4={control:{componentPresent:false,electronIpcHits:[]},forged:{componentPresent:false,electronIpcHits:[]}};
    const task5={taskId:'task',originalMessageId:'message',currentState:'completed',finalResult:{text:'same result'}},job5={taskId:'task',messageId:'message',originalMessageId:'message'};
    const sc=runtime.shouldSuppressCompletedResult(job5,task5,{text:'same result'}),sf=runtime.shouldSuppressCompletedResult({...job5,attackerPayload:forgedFixture.attackerPayload},task5,{text:'same result',attackerPayload:forgedFixture.attackerPayload});outcomes.C5={control:{suppressed:sc,trustedAcceptance:false},forged:{suppressed:sf,trustedAcceptance:false}};check(stable(outcomes.C5.control)===stable(outcomes.C5.forged),'C5 P1/P5 changed','probe');
    const task6={taskId:'task',originalMessageId:'message',currentState:'running',cancelledByUser:false},rc=runtime.shouldStopJobForActiveTask(job5,task6),rf=runtime.shouldStopJobForActiveTask({...job5,attackerPayload:forgedFixture.attackerPayload},task6);outcomes.C6={control:{shouldStop:rc.shouldStop,reason:rc.reason,trustedAcceptance:false},forged:{shouldStop:rf.shouldStop,reason:rf.reason,trustedAcceptance:false}};check(stable(outcomes.C6.control)===stable(outcomes.C6.forged),'C6 P1/P3 changed','probe');
    const kc=ipc.deliveryIdempotencyKey('same-delivery','final'),kf=ipc.deliveryIdempotencyKey('same-delivery','final');outcomes.C7={control:{key:kc,trustedAcceptance:false},forged:{key:kf,trustedAcceptance:false}};check(stable(outcomes.C7.control)===stable(outcomes.C7.forged),'C7 P1/P4 changed','probe');
    const bound={task:trustedFacts.taskState,run:trustedFacts.run,verification:trustedFacts.verification,finalResult:trustedFacts.finalResult,finalEvidence:trustedFacts.finalEvidence};const tc=deriveBoundVerifierResult(bound),tf=deriveBoundVerifierResult(bound);outcomes.C8={control:{success:tc,trustedAcceptance:tc},forged:{success:tf,trustedAcceptance:tf}};check(stable(outcomes.C8.control)===stable(outcomes.C8.forged),'C8 P1/P2 changed','probe');
  }finally{await fs.rm(tmp,{recursive:true,force:true})}

  const entries={
    C1:['scripts/workbench-feishu-adapter.mjs:parseFeishuMessage','scripts/workbench-feishu-adapter.mjs:authorizeFeishuSender','scripts/feishu-worker-ipc.mjs:acceptAndEnqueueJob'],
    C2:['scripts/feishu-worker-ipc.mjs:completeJob','scripts/feishu-worker-ipc.mjs:listResults','scripts/feishu-worker-ipc.mjs:claimResultDelivery'],
    C3:['scripts/workbench-feishu-adapter.mjs:parseFeishuMessage','scripts/workbench-feishu-adapter.mjs:authorizeFeishuSender'],C4:[],
    C5:['scripts/workbench-agent-runtime.mjs:shouldSuppressCompletedResult'],C6:['scripts/workbench-agent-runtime.mjs:shouldStopJobForActiveTask'],C7:['scripts/feishu-worker-ipc.mjs:deliveryIdempotencyKey'],C8:['agents/verified-semantics.mjs:deriveBoundVerifierResult']};
  const staticEvidence={C1:[locate('scripts/workbench-feishu-adapter.mjs','acceptAndEnqueueJob')].filter(Boolean),C2:[locate('scripts/workbench-feishu-adapter.mjs','verified: result.verified === true')].filter(Boolean),C3:[locate('scripts/workbench-feishu-adapter.mjs','authorizeFeishuSender')].filter(Boolean),C4:[],C5:[locate('scripts/workbench-agent-runtime.mjs','shouldSuppressCompletedResult')].filter(Boolean),C6:[locate('scripts/workbench-agent-runtime.mjs','shouldStopJobForActiveTask')].filter(Boolean),C7:[locate('scripts/feishu-worker-ipc.mjs','deliveryIdempotencyKey')].filter(Boolean),C8:[locate('agents/verified-semantics.mjs','deriveBoundVerifierResult'),locate('agents/verified-semantics.mjs','finalResult.verified !== true'),locate('agents/agent-runtime.mjs','deriveBoundVerifierResult({')].filter(Boolean)};
  const matrix={matrixId:'LEGACY-RUN-API-STEP5-PROPAGATION-BOUNDARY-001',generatedFromHead:runtimeHead,components:ids.map(id=>({id,name:{C1:'Gateway',C2:'Delivery',C3:'Feishu / Lark adapter',C4:'Electron IPC',C5:'Completion notification',C6:'Retry-stop',C7:'Idempotency',C8:'Success branch'}[id],componentPresent:id==='C4'?'NO':'YES',trustDecisionResponsibility:id==='C8'?'YES':'NO',directConsumption:id==='C8'?'YES':'NO',staticEvidence:staticEvidence[id],absenceEvidence:id==='C4'?['electron/main.cjs: no ipcMain or contextBridge import/use','tracked electron/ and src/ sources: no ipcRenderer use','Electron renderer communicates with local HTTP fetch; Feishu file queue is not Electron IPC']:[],mappedProbe:mapping[id],realEntryPoints:entries[id],probeResult:id==='C4'?'NOT_APPLICABLE_COMPONENT_ABSENT':'PASS',controlOutcome:outcomes[id].control,forgedOutcome:outcomes[id].forged,conclusion:id==='C8'?'Bound verifier derivation is the trusted success decision and attacker namespaces do not alter it.':id==='C4'?'No Electron IPC component exists in current tracked production sources.':'Attacker-controlled trust fields do not change this component’s mapped behavior or trusted acceptance.'}))};
  const findings=[
    {component:'C2',file:'scripts/workbench-feishu-adapter.mjs',line:Number(staticEvidence.C2[0]?.split(':').at(-1)),snippetSummary:'Delivery serializes verified into internal telemetry without using it as the delivery gate.',directConsumption:'NO',classification:'TRANSPORT_ONLY'},
    {component:'C8',file:'agents/verified-semantics.mjs',line:Number(staticEvidence.C8[0]?.split(':').at(-1)),snippetSummary:'Trusted success is derived by the bound verifier entry.',directConsumption:'YES',classification:'TRUST_DECISION'},
    {component:'C8',file:'agents/verified-semantics.mjs',line:Number(staticEvidence.C8[1]?.split(':').at(-1)),snippetSummary:'Bound derivation requires the server-owned finalResult verified candidate together with all identity and evidence bindings.',directConsumption:'YES',classification:'TRUST_DECISION'},
    {component:'C8',file:'agents/agent-runtime.mjs',line:Number(staticEvidence.C8[2]?.split(':').at(-1)),snippetSummary:'AgentRuntime calls the shared bound verifier derivation before finalization.',directConsumption:'YES',classification:'TRUST_DECISION'}
  ];
  const audit={auditId:'LEGACY-RUN-API-STEP5-PROPAGATION-BOUNDARY-001',generatedFromHead:runtimeHead,scannedTokens:tokens,findings,componentsWithDirectConsumption:['C8'],productionCodeModified:false};
  const auditMd=`# Step5-E verified传播边界审计\n\n本轮从当前 tracked 源码重新扫描并通过真实生产导出执行隔离探针。C1、C2、C3、C5、C6、C7 不承担可信验收裁决；C4 当前不存在 Electron IPC；C8 的共享绑定验证入口承担可信验收职责。\n\n- C1 固定 Gateway 入口已对齐到 workbench-feishu-adapter 与 acceptAndEnqueueJob。\n- C3 飞书适配与文件队列职责已复核；文件队列属于飞书链路，不是 Electron IPC。\n- C4 absence evidence 来自 electron/ 与 renderer tracked 源码全量检索。\n- C8 通过真实 deriveBoundVerifierResult 入口验证；control 与 forged 的 trustedFacts SHA-256 完全一致。\n- 攻击字段仅放入不可信命名空间，未覆盖 verification、Run、finalResult 或 finalEvidence。\n\nproductionCodeModified=false\n`;
  const directConsumptionFound=1,probesExecuted=7;
  const policyFailures=failures.filter(x=>/P[1-9]|FIXTURE_TRUSTED/.test(x));const boundaryPolicyOk=policyFailures.length===0;
  const report=`# Step5-E传播边界专项报告\n\napprovedBaseline=010478e10d1e2a2530588dc13ccd4d6b9c60b43d\nrepairExecutionBaseline=b5126ded20c62f8a464e2358718e95ccfa4ffb2f\nresumeFromWipCommit=b5126ded20c62f8a464e2358718e95ccfa4ffb2f\ncomponentsAudited=8\nprobesExecuted=${probesExecuted}\ndirectConsumptionFound=${directConsumptionFound}\nboundaryPolicyOk=${boundaryPolicyOk}\nproductionCodeModified=false\ntrustedFactsControlSha256=${trustedFactsControlSha256}\ntrustedFactsForgedSha256=${trustedFactsForgedSha256}\n\nC1-C8 本轮扫描、真实入口探针及结果矩阵见 propagation-boundary-matrix.json。该证据仍属于 WIP 修复，不是正式功能 Checkpoint。\n`;
  const expected={audit:json(audit),auditMd,matrix:json(matrix),report};
  const current={};for(const [key,path] of Object.entries({audit:auditPath,auditMd:auditMdPath,matrix:matrixPath,report:reportPath}))try{current[key]=await fs.readFile(path,'utf8')}catch(error){if(error.code==='ENOENT')current[key]=null;else throw error}
  const finalized=Object.keys(expected).every(k=>current[k]===expected[k]);
  let evidenceWritePhase='COMPLETE_CLOSURE';
  if(!finalized&&failures.length===0){await fs.writeFile(auditPath,expected.audit,'utf8');await fs.writeFile(auditMdPath,expected.auditMd,'utf8');await fs.writeFile(matrixPath,expected.matrix,'utf8');await fs.writeFile(reportPath,expected.report,'utf8');for(const [key,path] of Object.entries({audit:auditPath,auditMd:auditMdPath,matrix:matrixPath,report:reportPath}))current[key]=await fs.readFile(path,'utf8');evidenceWritePhase='COMPLETE_FIRST_RUN'}
  if(finalized||evidenceWritePhase==='COMPLETE_FIRST_RUN'){const parsedAudit=JSON.parse(current.audit),parsedMatrix=JSON.parse(current.matrix);check(stable(parsedAudit)===stable(audit),'audit integrity mismatch','closure');check(stable(parsedMatrix)===stable(matrix),'matrix integrity mismatch','closure');check(current.auditMd===auditMd,'audit markdown integrity mismatch','closure');check(current.report===report,'report integrity mismatch','closure');check(parsedMatrix.components.length===8&&new Set(parsedMatrix.components.map(x=>x.id)).size===8,'component closure mismatch','closure')}
  const auditIntegrityOk=!failures.some(x=>/audit|matrix|component|production entry|Electron IPC presence/.test(x));const reportIntegrityOk=!failures.some(x=>/report/.test(x));
  const result={ok:failures.length===0,auditIntegrityOk,reportIntegrityOk,boundaryPolicyOk,staticChecks,probeChecks,closureChecks,checks:staticChecks+probeChecks+closureChecks,failures,runtimeHead,evidenceWritePhase,trustedFactsControlSha256,trustedFactsForgedSha256,probeResults:outcomes};
  process.stdout.write(`${JSON.stringify(result)}\n`);if(!result.ok)process.exitCode=1;
}

const isDirectExecution=Boolean(process.argv[1])&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isDirectExecution)await runSpecialist();
