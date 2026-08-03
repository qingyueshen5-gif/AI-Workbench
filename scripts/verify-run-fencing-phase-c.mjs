import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../channels/task-store.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-run-fencing-c-'));
let sequence=0;
const store=new TaskStore({root,newRunId:()=>`run-c-${++sequence}`});
try{
  let task=await store.create({taskId:'task-c',messageId:'message-c',originalMessageId:'message-c',conversationId:'conversation-c'});
  for(const to of['interpreting','scheduling','ready','executing'])task=await store.transitionTask(task.taskId,task.currentState,to,`to_${to}`,'test',{to});
  task=await store.startRun(task.taskId,{expectedTaskRevision:task.taskRevision,leaseOwner:'worker-c',providerId:'provider-c'});
  const identity={taskId:task.taskId,runId:task.activeRunId,taskRevision:task.taskRevision};
  await store.transitionRun(task.taskId,{...identity,from:'created',to:'starting'});
  await store.transitionRun(task.taskId,{...identity,from:'starting',to:'running'});
  await store.appendRunProgress(task.taskId,identity,{stage:'executing',text:'working'});
  await store.bindRunVerification(task.taskId,identity,{verified:true,providerId:'verifier-c',...identity});
  task=await store.load(task.taskId);
  task=await store.transitionTask(task.taskId,task.currentState,'verifying','verification_started','test',identity);
  const finalResult={text:'done',provider:'provider-c',verified:true,...identity};
  const completed=await store.finalizeRun(task.taskId,identity,{finalResult,finalEvidence:{resultHash:'hash-c',...identity}});
  assert.equal(completed.activeRunId,null);
  assert.equal(completed.currentState,'completed');
  assert.equal(completed.runs[0].status,'completed');
  assert.deepEqual(completed.finalResult,finalResult);
  await assert.rejects(()=>store.appendRunProgress(task.taskId,identity,{stage:'late'}),/Stale Run/);
  await assert.rejects(()=>store.bindRunVerification(task.taskId,identity,{verified:true}),/Stale Run/);
  await assert.rejects(()=>store.finalizeRun(task.taskId,identity,{finalResult}),/Stale Run/);

  let other=await store.create({taskId:'task-other',messageId:'message-other',originalMessageId:'message-other',conversationId:'conversation-c'});
  other=await store.startRun(other.taskId,{expectedTaskRevision:other.taskRevision,leaseOwner:'worker-other',providerId:'provider-other'});
  const otherIdentity={taskId:other.taskId,runId:other.activeRunId,taskRevision:other.taskRevision};
  await assert.rejects(()=>store.appendRunProgress(other.taskId,identity,{stage:'cross-task'}),/Stale Run/);
  assert.equal((await store.load('task-other')).activeRunId,otherIdentity.runId);
  console.log(JSON.stringify({ok:true,module:'RUN-FENCING-PHASE-C',scenarios:{progressIdentity:true,verificationIdentity:true,finalAtomic:true,staleProgressRejected:true,staleVerificationRejected:true,staleFinalRejected:true,singleFinal:true,crossTaskIsolation:true}}));
}finally{await fs.rm(root,{recursive:true,force:true});}
