import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../channels/task-store.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-run-fencing-d-'));
let sequence=0;
const store=new TaskStore({root,newRunId:()=>`run-d-${++sequence}`});
try{
  let task=await store.create({taskId:'takeover',messageId:'takeover',originalMessageId:'takeover',conversationId:'c'});
  task=await store.startRun(task.taskId,{expectedTaskRevision:task.taskRevision,leaseOwner:'worker-old',providerId:'provider'});
  const oldIdentity={taskId:task.taskId,runId:task.activeRunId,taskRevision:task.taskRevision};
  await store.transitionRun(task.taskId,{...oldIdentity,from:'created',to:'starting'});
  await store.transitionRun(task.taskId,{...oldIdentity,from:'starting',to:'running'});
  task=await store.supersedeAndStartRun(task.taskId,{expectedTaskRevision:task.taskRevision,leaseOwner:'worker-new',providerId:'provider'});
  const newIdentity={taskId:task.taskId,runId:task.activeRunId,taskRevision:task.taskRevision};
  assert.equal(task.runs[0].status,'superseded');
  assert.equal(task.runs[0].supersededByRunId,newIdentity.runId);
  assert.equal(task.runs[1].attempt,2);
  await assert.rejects(()=>store.appendRunProgress(task.taskId,oldIdentity,{stage:'late'}),/(Stale Run|revision conflict)/);
  await assert.rejects(()=>store.bindRunVerification(task.taskId,oldIdentity,{verified:true}),/(Stale Run|revision conflict)/);
  await assert.rejects(()=>store.finalizeRun(task.taskId,oldIdentity,{finalResult:{text:'late'}}),/(Stale Run|revision conflict)/);
  const restarted=new TaskStore({root});
  const restored=await restarted.load(task.taskId);
  assert.equal(restored.activeRunId,newIdentity.runId);
  assert.equal(restored.runs[1].attempt,2);

  let cancelled=await store.create({taskId:'cancel-race',messageId:'cancel-race',originalMessageId:'cancel-race',conversationId:'c'});
  for(const to of['interpreting','scheduling','ready','executing'])cancelled=await store.transitionTask(cancelled.taskId,cancelled.currentState,to,`to_${to}`,'test',{to});
  cancelled=await store.startRun(cancelled.taskId,{expectedTaskRevision:cancelled.taskRevision,leaseOwner:'worker-cancel',providerId:'provider'});
  const cancelIdentity={taskId:cancelled.taskId,runId:cancelled.activeRunId,taskRevision:cancelled.taskRevision};
  await store.transitionRun(cancelled.taskId,{...cancelIdentity,from:'created',to:'starting'});
  await store.transitionRun(cancelled.taskId,{...cancelIdentity,from:'starting',to:'running'});
  const race=await Promise.allSettled([
    store.cancelTaskWithRun(cancelled.taskId,{evidence:{controlMessageId:'cancel'}}),
    store.finalizeRun(cancelled.taskId,cancelIdentity,{finalResult:{text:'late-success'},finalEvidence:{ok:true}})
  ]);
  assert.equal(race.filter((item)=>item.status==='fulfilled').length,1);
  const afterRace=await store.load(cancelled.taskId);
  assert.ok(['cancelled','completed'].includes(afterRace.currentState));
  if(afterRace.currentState==='cancelled')assert.notEqual(afterRace.finalResult?.text,'late-success');
  assert.equal(afterRace.activeRunId,null);
  console.log(JSON.stringify({ok:true,module:'RUN-FENCING-PHASE-D',scenarios:{leaseTakeover:true,newAttempt:true,oldRunSuperseded:true,oldWritesRejected:true,restartRecovery:true,cancelFinishRaceSingleWinner:true,cancelInvalidatesActiveRun:true}}));
}finally{await fs.rm(root,{recursive:true,force:true});}
