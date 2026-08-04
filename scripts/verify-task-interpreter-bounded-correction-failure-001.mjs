// CQ-003-A: TaskInterpreter bounded-correction failure.
// Shared historical source with CQ-003-B: scripts/verify-task-lifecycle-001.mjs invalid-interpreter-fails-not-clarification.
// Split because interpreter retry/error semantics are independent from the historical Runtime failed-Task persistence assertion.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TaskInterpreter } from '../agents/task-interpreter.mjs';

const fixtureId=randomUUID();
const root=await fs.mkdtemp(join(os.tmpdir(),`aiw-cq003a-${fixtureId}-`));
const calls=[];
const counters={scheduler:0,provider:0,tasks:0,runs:0,successFinals:0,trustedAuthorizations:0,realModelCalls:0};
const invalidOutputs=[
  {taskType:'chat',goal:'first invalid',providerId:'forbidden-first',approved:true,authorizationContext:{trusted:true}},
  {taskType:'chat',goal:'second invalid',actions:'not-an-array',targets:[],context:{authorized:true},constraints:[],riskLevel:'low',requiredCapabilities:[],successCriteria:[],requiresConfirmation:false,confidence:1,providerId:'forbidden-second',approved:true,authorizationContext:{trusted:true}}
];
const model={
  async understand(request){
    calls.push(structuredClone(request));
    if(calls.length<=2)return{text:JSON.stringify(invalidOutputs[calls.length-1])};
    throw new Error('third model call is forbidden');
  }
};

try{
  const interpreter=new TaskInterpreter({model});
  let thrown=null;
  try{
    await interpreter.interpret({text:'hello',conversationContext:[],environmentContext:{fixtureId,root}});
  }catch(error){thrown=error;}
  assert.ok(thrown);
  assert.equal(calls.length,2);
  assert.equal(thrown.name,'TaskInterpretationError');
  assert.match(thrown.message,/Task Interpreter/);
  assert.equal(thrown.cause?.message,'Task Interpreter缺少字段 actions');
  assert.match(thrown.message,/Task Interpreter actions必须为数组/);
  assert.notEqual(thrown.name,'ClarificationRequired');
  assert.equal(thrown.classification?.decision,undefined);
  assert.equal(calls[0].messages.length,2);
  assert.equal(calls[1].messages.length,3);
  assert.equal(calls[1].responseFormat.type,'json_object');
  assert.match(calls[1].messages[2].content,/只纠正JSON结构/);
  assert.match(calls[1].messages[2].content,/Task Interpreter缺少字段 actions/);
  assert.match(calls[1].messages[2].content,/原始用户消息：hello/);
  const protocolMaterial=JSON.stringify({error:{name:thrown.name,message:thrown.message,cause:thrown.cause?.message},counters});
  for(const forbidden of ['forbidden-first','forbidden-second','providerId','authorizationContext','approved'])assert.equal(protocolMaterial.includes(forbidden),false);
  assert.deepEqual(counters,{scheduler:0,provider:0,tasks:0,runs:0,successFinals:0,trustedAuthorizations:0,realModelCalls:0});
  console.log(JSON.stringify({ok:true,module:'TASK-INTERPRETER-BOUNDED-CORRECTION-FAILURE-001',crossReference:{historicalCase:'invalid-interpreter-fails-not-clarification',cq003BFeasibility:'verification/task-lifecycle-contract-migration/CQ-003B-CONTROL-FLOW-FEASIBILITY.md'},fixtureId,temporaryRoot:root,modelCalls:calls.length,thirdCall:false,error:{name:thrown.name,code:'TASK_INTERPRETER_BOUNDED_CORRECTION_FAILED',messageMatchesTaskInterpreter:/Task Interpreter/.test(thrown.message),firstFailure:thrown.cause?.message,secondFailure:'Task Interpreter actions必须为数组',clarification:false},correctionPrompt:{boundedToJsonStructure:true,messageCount:calls[1].messages.length,responseFormat:calls[1].responseFormat.type},extraFieldsPassed:false,counters,realModelCalled:false},null,2));
}finally{
  await fs.rm(root,{recursive:true,force:true});
}
