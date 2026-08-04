// CQ-003-B': execution-stage failed Task persistence and terminal replay.
// Re-anchored by product decision from the historical TaskInterpreter-specific failed-Task path to the current reachable Provider execution failure boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { CapabilityRegistry } from '../capabilities/capability-registry.mjs';
import { CapabilityScheduler } from '../capabilities/capability-scheduler.mjs';

const stableHash=(value)=>createHash('sha256').update(JSON.stringify(value,Object.keys(value).sort())).digest('hex');
const fixtureId=randomUUID();
const root=await fs.mkdtemp(join(os.tmpdir(),`aiw-cq003b-exec-${fixtureId}-`));
const counts={taskCreates:0,runCreates:0,providerCalls:0,verifierCalls:0,finalWrites:0,progressWrites:0,assistantAppends:0,deliveryAttempts:0,sideEffects:0};
const tasks=new TaskStore({root:join(root,'tasks'),newRunId:()=>`run-${randomUUID()}`});
for(const name of ['create','startRun','finalizeRun']){const original=tasks[name].bind(tasks);tasks[name]=async(...args)=>{if(name==='create')counts.taskCreates++;if(name==='startRun')counts.runCreates++;if(name==='finalizeRun')counts.finalWrites++;return original(...args);};}
const sessions=new SessionStore({root:join(root,'sessions')});
const append=sessions.appendMessage.bind(sessions);sessions.appendMessage=async(state,message)=>{if(message.role==='assistant')counts.assistantAppends++;return append(state,message);};
const provider={async status(){counts.providerCalls++;const error=new Error('isolated provider execution failed');error.code='ISOLATED_PROVIDER_EXECUTION_FAILED';throw error;}};
const verifier={verifyCapabilityResult(){counts.verifierCalls++;throw new Error('verifier must not run after provider failure');}};
const registry=new CapabilityRegistry();
const runtime=new AgentRuntime({tasks,sessions,models:{async understand(){throw new Error('real model forbidden');},async express(){throw new Error('real model forbidden');},async execute(){throw new Error('real model forbidden');}},verifier,capabilityRegistry:registry,scheduler:new CapabilityScheduler({registry}),providers:{'local-runtime-state':provider},activeController:{async handle(){return{intercepted:false,classification:{kind:'new_task'}};}},onProgress:async()=>{counts.progressWrites++;},progressOptions:{firstDelayMs:0,minIntervalMs:0}});
const messageId=`message-${randomUUID()}`;
const conversationId=`conversation-${randomUUID()}`;
const job={messageId,originalMessageId:messageId,conversationId,chatId:conversationId,openId:`user-${randomUUID()}`,leaseOwner:`worker-${randomUUID()}`,text:'检查Runtime状态'};

try{
  let firstError=null;
  try{await runtime.handle(job);}catch(error){firstError=error;}
  assert.ok(firstError);
  const firstTask=await tasks.load(messageId);
  assert.ok(firstTask);
  assert.equal(firstTask.taskId,messageId);
  assert.equal(firstTask.originalMessageId,messageId);
  assert.equal(firstTask.conversationId,conversationId);
  assert.equal(firstTask.currentState,'failed');
  assert.equal(firstTask.runs.length,1);
  const firstRun=firstTask.runs[0];
  assert.equal(firstRun.taskId,firstTask.taskId);
  assert.equal(firstRun.status,'failed');
  assert.equal(counts.taskCreates,1);
  assert.equal(counts.runCreates,1);
  assert.equal(counts.providerCalls,1);
  assert.equal(counts.verifierCalls,0);
  assert.equal(counts.finalWrites,0);
  assert.equal(firstTask.finalResult,null);
  assert.ok(firstTask.stateHistory.some((x)=>x.to==='executing'));
  assert.equal(firstTask.stateHistory.at(-1).to,'failed');
  assert.notEqual(firstTask.finalResult?.verified,true);
  assert.equal(counts.sideEffects,0);

  const failureBefore=structuredClone(firstTask.failure);
  const required=['errorCode','failureStage','failureClassification','taskId','runId','taskRevision','failedAt'];
  const missingFailureFields=required.filter((key)=>failureBefore?.[key]===undefined||failureBefore?.[key]===null||failureBefore?.[key]==='');
  if(missingFailureFields.length)console.error(JSON.stringify({classification:'PRODUCT_OR_SECURITY_FAILURE',code:'FAILED_TASK_FAILURE_FACT_INCOMPLETE',missingFailureFields,observedFailure:failureBefore,task:{taskId:firstTask.taskId,currentState:firstTask.currentState,activeRunId:firstTask.activeRunId,taskRevision:firstTask.taskRevision},run:{runId:firstRun.runId,status:firstRun.status,taskRevision:firstRun.taskRevision,failureReason:firstRun.failureReason,verification:firstRun.verification},counts},null,2));
  assert.deepEqual(missingFailureFields,[]);
  const failureHashBeforeReplay=stableHash(failureBefore);
  const before=structuredClone(counts);

  const replay=await runtime.handle(job);
  const after=structuredClone(counts);
  if(replay.taskReplayed!==true||replay.messageReplayed===true){
    console.error(JSON.stringify({classification:'PRODUCT_OR_SECURITY_FAILURE',code:'TERMINAL_TASK_REPLAY_CLASSIFICATION_MISSING',observed:{replayed:replay.replayed,taskReplayed:replay.taskReplayed,messageReplayed:replay.messageReplayed,verified:replay.verified,terminalState:replay.terminalState},expected:{taskReplayed:true,messageReplayed:'false-or-undefined'},failureBefore,counts:{before,after}},null,2));
  }
  assert.equal(replay.taskReplayed,true);
  assert.equal(replay.messageReplayed,false);
  assert.equal(replay.replayed,true);
  assert.equal(replay.verified,false);
  assert.equal(replay.terminalState,'failed');
  assert.equal(replay.completionStatus,'failed');
  assert.equal(replay.executionStarted,true);
  assert.equal(replay.executionCompleted,false);
  assert.equal(replay.failureCode,failureBefore.errorCode);
  assert.equal(replay.failureStage,failureBefore.failureStage);
  assert.equal(replay.userNotificationRequired,true);
  for(const key of Object.keys(before))assert.equal(after[key]-before[key],0,`replay delta ${key}`);

  const replayTask=await tasks.load(messageId);
  const failureAfter=structuredClone(replayTask.failure);
  const failureHashAfterReplay=stableHash(failureAfter);
  assert.equal(failureHashAfterReplay,failureHashBeforeReplay);
  for(const key of required)assert.deepEqual(failureAfter[key],failureBefore[key],`failure field changed: ${key}`);
  assert.equal(replayTask.activeRunId,firstTask.activeRunId);
  assert.equal(replayTask.runs.length,1);
  assert.equal(replayTask.runs[0].runId,firstRun.runId);

  const replayDeltas=Object.fromEntries(Object.keys(before).map((key)=>[key,after[key]-before[key]]));
  console.log(JSON.stringify({
    ok:true,
    module:'CQ003B-EXECUTION-STAGE-FAILED-TASK-PERSISTENCE-AND-REPLAY',
    fixtureId,
    adapterDecision:'execute',
    identity:{taskId:firstTask.taskId,originalMessageId:firstTask.originalMessageId,conversationId:firstTask.conversationId,runId:firstRun.runId,taskRevision:firstRun.taskRevision},
    first:{error:{name:firstError.name,code:firstError.code||null},counts:before,taskState:firstTask.currentState,runState:firstRun.status,failure:failureBefore,failureHashBeforeReplay},
    replay:{result:replay,deltas:replayDeltas,failureHashAfterReplay,failureImmutable:failureHashAfterReplay===failureHashBeforeReplay},
    supplementalVerifierCase:'SUPPLEMENTAL_VERIFIER_CASE_NOT_IMPLEMENTED_DUE_TO_CURRENT_INJECTION_BOUNDARY',
    manualFailedState:false,
    realModelCalled:false,
    realSideEffects:0
  },null,2));
}finally{
  await fs.rm(root,{recursive:true,force:true});
}
