#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { toNonExecutionRuntimeResult } from '../agents/interpreter-adapter-contract.mjs';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskStore } from '../channels/task-store.mjs';

function adapterResult(decision){
  return {decision,response:{text:`${decision} text`,renderer:'deterministic-v1'},missingFields:decision==='clarify'?['target']:[],questions:decision==='clarify'?['Which target?']:[],recognizedIntents:[],riskSignals:[]};
}
for(const decision of ['respond','clarify','unsupported']){
  const result=toNonExecutionRuntimeResult(adapterResult(decision),{originalMessageId:`m-${decision}`});
  assert.equal(result.verified,false);assert.equal(result.handled,true);assert.equal(result.rendered,true);assert.equal(result.executionStarted,false);assert.equal(result.executionCompleted,false);
  if(decision==='clarify')assert.equal(result.requiresUserInput,true);
  if(decision==='unsupported')assert.equal(result.capabilityAvailable,false);
}

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-verified-nonexec-'));
try{
  const tasks=new TaskStore({root:join(root,'tasks')});
  const baseOptions={tasks,activeTasks:tasks,taskOptions:{root:join(root,'tasks')},sessionOptions:{root:join(root,'sessions')},nonExecutionMessageOptions:{root:join(root,'nonexec')},onStage:async()=>{},onProgress:async()=>{}};
  const controlRuntime=new AgentRuntime({...baseOptions,activeController:{handle:async()=>({intercepted:true,kind:'cancel',text:'cancelled',activeTaskId:'t',classification:{kind:'control'}})}});
  const control=await controlRuntime.handle({messageId:'control-1',conversationId:'c',chatId:'c',text:'cancel'});
  assert.equal(control.verified,false);assert.equal(control.handled,true);assert.equal(control.policyApplied,true);assert.equal(control.rendered,true);

  const nonExecRuntime=new AgentRuntime({...baseOptions,activeController:{handle:async()=>({intercepted:false,classification:{kind:'new_task'}})},groundTruthExtractor:(text)=>({version:'d0-1b-v1',originalText:text,facts:[],actions:[],constraints:[],successCriteria:[],authorizationClaims:[],unresolved:[]}),interpreterAdapter:{adapt:()=>adapterResult('clarify')}});
  const first=await nonExecRuntime.handle({messageId:'nonexec-1',originalMessageId:'nonexec-1',conversationId:'c2',chatId:'c2',channel:'feishu',openId:'u',text:'ambiguous'});
  assert.equal(first.verified,false);assert.equal(first.handled,true);assert.equal(first.rendered,true);assert.equal(first.requiresUserInput,true);assert.equal(first.messageReplayed,false);
  const replay=await nonExecRuntime.handle({messageId:'nonexec-1',originalMessageId:'nonexec-1',conversationId:'c2',chatId:'c2',channel:'feishu',openId:'u',text:'ambiguous'});
  assert.equal(replay.verified,false);assert.equal(replay.handled,true);assert.equal(replay.rendered,true);assert.equal(replay.messageReplayed,true);assert.equal(replay.taskReplayed,false);

  const unavailableRuntime=new AgentRuntime({...baseOptions,activeController:{handle:async()=>({intercepted:false,classification:{kind:'new_task'}})},groundTruthExtractor:(text)=>({version:'d0-1b-v1',originalText:text,facts:[],actions:[],constraints:[],successCriteria:[],authorizationClaims:[],unresolved:[]}),interpreterAdapter:{adapt:()=>({decision:'execute',taskDraft:{version:'task-interpreter-v1',taskType:'execution',goal:'unsupported',actions:[],targets:[],constraints:[],context:{conversationId:'c3',missingFields:[],questions:[]},successCriteria:[],riskLevel:'low',requiresConfirmation:false,requiredCapabilities:['missing.capability'],confidence:1},response:null})},scheduler:{plan:()=>({status:'capability_unavailable',missingCapabilities:['missing.capability'],assignments:[]})}});
  const unavailable=await unavailableRuntime.handle({messageId:'unavailable-1',conversationId:'c3',chatId:'c3',openId:'u',text:'unsupported execute'});
  assert.equal(unavailable.verified,false);assert.equal(unavailable.handled,true);assert.equal(unavailable.rendered,true);assert.equal(unavailable.capabilityAvailable,false);

  console.log(JSON.stringify({ok:true,module:'VERIFIED-SEMANTICS-NON-EXECUTION-MIGRATION-001',scenarios:['respond','clarify','unsupported','control_interception','capability_unavailable','non_execution_renderer','message_replay']}));
}finally{await fs.rm(root,{recursive:true,force:true});}
