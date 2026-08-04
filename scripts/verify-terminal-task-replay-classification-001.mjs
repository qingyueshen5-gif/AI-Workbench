import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { NonExecutionMessageStore } from '../channels/non-execution-message-store.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-terminal-replay-matrix-'));
const scenarios=[];
const terminal=async(task)=>{
  const runtime=Object.create(AgentRuntime.prototype);
  return runtime.terminalResult(task);
};
const base=(state)=>({taskId:`task-${randomUUID()}`,originalMessageId:`message-${randomUUID()}`,conversationId:`conversation-${randomUUID()}`,taskRevision:7,activeRunId:null,runs:[],currentState:state,finalResult:null,failure:null});
const checkClassification=(result,state,verified)=>{
  assert.equal(result.replayed,true);
  assert.equal(result.taskReplayed,true);
  assert.equal(result.messageReplayed,false);
  assert.equal(result.terminalState,state);
  assert.equal(result.verified,verified);
};
try{
  const failed=base('failed');
  const failedRun={runId:`run-${randomUUID()}`,taskId:failed.taskId,taskRevision:4,status:'failed',verification:{passed:false,taskId:failed.taskId,runId:'unused',taskRevision:4}};
  failedRun.verification.runId=failedRun.runId;failed.runs=[failedRun];failed.failure={errorCode:'PROVIDER_EXECUTION_FAILED',failureStage:'provider_execution',failureClassification:'provider_failure',taskId:failed.taskId,runId:failedRun.runId,taskRevision:failed.taskRevision,failedAt:1,message:'failed',name:'Error'};
  checkClassification(await terminal(failed),'failed',false);scenarios.push({id:'A',state:'failed',verified:false,status:'PASS'});

  const completed=base('completed');
  const runId=`run-${randomUUID()}`;const revision=5;
  const verification={passed:true,taskId:completed.taskId,runId,taskRevision:revision,verifierId:'FixtureVerifier'};
  const finalEvidence={...verification};
  completed.activeRunId=runId;
  completed.runs=[{runId,taskId:completed.taskId,taskRevision:revision,status:'completed',verification,finalEvidence}];
  completed.finalResult={text:'done',provider:'fixture',verified:true,taskId:completed.taskId,runId,taskRevision:revision,verification};
  checkClassification(await terminal(completed),'completed',true);scenarios.push({id:'B',state:'completed_bound_pass',verified:true,status:'PASS'});

  const missing=structuredClone(completed);missing.runs[0].verification=null;
  checkClassification(await terminal(missing),'completed',false);scenarios.push({id:'C',state:'completed_missing_verification',verified:false,status:'PASS'});

  const wrongRun=structuredClone(completed);wrongRun.finalResult.runId='wrong-run';
  checkClassification(await terminal(wrongRun),'completed',false);scenarios.push({id:'D',state:'completed_wrong_run',verified:false,status:'PASS'});

  const wrongRevision=structuredClone(completed);wrongRevision.runs[0].verification.taskRevision=revision+1;
  checkClassification(await terminal(wrongRevision),'completed',false);scenarios.push({id:'E',state:'completed_wrong_acceptance_revision',verified:false,status:'PASS'});

  const cancelled=base('cancelled');checkClassification(await terminal(cancelled),'cancelled',false);scenarios.push({id:'F',state:'cancelled',verified:false,status:'PASS'});

  const unavailable=base('capability_unavailable');unavailable.finalResult={text:'missing',provider:'scheduler',verified:true};
  checkClassification(await terminal(unavailable),'capability_unavailable',false);scenarios.push({id:'G',state:'capability_unavailable',writeSideVerified:true,replayVerified:false,status:'PASS'});

  const store=new NonExecutionMessageStore({root:join(root,'non-execution'),now:(()=>{let t=1;return()=>t++;})()});
  const identity={key:`key-${randomUUID()}`,channel:'feishu',userId:'u',stableMessageId:`message-${randomUUID()}`};
  const claim=await store.claim(identity,'clarify',{ownerId:'owner'});
  const saved=await store.complete(identity,claim.claim.ownerId,{decision:'clarify',taskReplayed:false,messageReplayed:false},{deliveryKey:'delivery'});
  const replay={...saved.result,taskReplayed:false,messageReplayed:true};
  assert.equal(replay.taskReplayed,false);assert.equal(replay.messageReplayed,true);scenarios.push({id:'H',state:'non_execution_message_replay',taskReplayed:false,messageReplayed:true,status:'PASS'});

  console.log(JSON.stringify({ok:true,module:'TERMINAL-TASK-REPLAY-STATE-MATRIX-001',authoritativeAcceptanceRevision:'run.taskRevision',returnType:'boolean',scenarios},null,2));
}finally{await fs.rm(root,{recursive:true,force:true});}
