import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { LocalGroundedProvider } from '../execution/local-grounded-provider.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-b5-s1-'));
try{
  const missingGateway=join(root,'missing-gateway.json');
  const missingRuntime=join(root,'missing-runtime.json');
  const readAt=Date.now();
  const readState=async()=>({ok:false,text:'',evidenceSources:[],failures:[
    {sourceId:'gateway-health',sourceType:'file',path:missingGateway,read:false,readAt,failure:'ENOENT'},
    {sourceId:'runtime-worker-state',sourceType:'file',path:missingRuntime,read:false,readAt,failure:'ENOENT'}
  ]});
  const provider=new LocalGroundedProvider({readState});
  const result=await provider.status({taskId:'s1-task',runId:'s1-run',taskRevision:1});
  assert.equal(result.ok,false);
  assert.equal(result.text,'');
  assert.equal(result.evidence.evidenceSources.length,0);
  assert.match(result.reason,/未能读取可验证的Runtime状态来源/);
  assert.match(result.reason,/无法确认当前运行状态/);
  assert.match(result.reason,/没有把推测内容当成真实结果/);
  assert.doesNotMatch(JSON.stringify(result),/No live status evidence is available/);
  let verifierFailure='';
  try{new ResultVerifier().verifyCapabilityResult('runtime.status',result);}catch(error){verifierFailure=error.message;}
  assert.match(verifierFailure,/未执行成功|真实可验证/);
  const runVerification={passed:false,failureReason:verifierFailure,verifiedAt:Date.now(),verifierId:'ResultVerifier',verificationMethod:'grounded-source-evidence',evidenceReferences:[]};
  const final={verified:false,text:result.reason};
  assert.equal(runVerification.passed,false);
  assert.equal(final.verified,false);
  console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-B5-S1-GROUNDED-EVIDENCE',sources:[
    {sourceId:'gateway-health',sourceType:'file',entry:'AgentRuntime.groundedStatus/fs.readFile',readAtProducedAt:'immediately before read attempt',failureExpression:'ENOENT',evidenceReference:'file:gateway-health@<readAt>'},
    {sourceId:'runtime-worker-state',sourceType:'file',entry:'AgentRuntime.groundedStatus/fs.readFile',readAtProducedAt:'immediately before read attempt',failureExpression:'ENOENT',evidenceReference:'file:runtime-worker-state@<readAt>'},
    {sourceId:'task:<taskId>',sourceType:'task-store',entry:'TaskStore.load/latestNonTerminal',readAtProducedAt:'after successful task read',failureExpression:'source omitted',evidenceReference:'task-store:task:<taskId>@<readAt>'}
  ],providerResult:result,verifierFailure,runVerification,final,modelCalls:0},null,2));
}finally{await fs.rm(root,{recursive:true,force:true});}
