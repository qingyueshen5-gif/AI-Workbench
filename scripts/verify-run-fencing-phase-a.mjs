import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../channels/task-store.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-run-fencing-a-'));
let sequence=0;
const store=new TaskStore({root,newRunId:()=>`run-${++sequence}`,now:(()=>{let value=1000;return()=>++value;})()});
try{
  const created=await store.create({taskId:'task-a',messageId:'message-a',originalMessageId:'message-a',conversationId:'conversation-a'});
  assert.equal(created.taskRevision,0);
  assert.equal(created.activeRunId,null);
  assert.deepEqual(created.runs,[]);

  const competing=await Promise.allSettled([
    store.startRun('task-a',{expectedTaskRevision:0,leaseOwner:'worker-a',providerId:'provider-a'}),
    store.startRun('task-a',{expectedTaskRevision:0,leaseOwner:'worker-b',providerId:'provider-a'})
  ]);
  assert.equal(competing.filter((item)=>item.status==='fulfilled').length,1,'concurrent startRun must have one winner');
  assert.equal(competing.filter((item)=>item.status==='rejected').length,1,'concurrent startRun must reject one contender');
  assert.match(competing.find((item)=>item.status==='rejected').reason.message,/(revision conflict|already has active Run)/);

  const task=await store.load('task-a');
  assert.equal(task.taskRevision,1);
  assert.equal(task.activeRunId,'run-1');
  assert.equal(task.runs.length,1);
  assert.deepEqual(task.runs[0],{
    runId:'run-1',taskId:'task-a',originalMessageId:'message-a',attempt:1,leaseOwner:'worker-a',providerId:'provider-a',taskRevision:1,status:'created',createdAt:1003,startedAt:null,heartbeatAt:1003,finishedAt:null,progress:[],verification:null,finalEvidence:null,failureReason:null,supersededByRunId:null
  });
  await assert.rejects(()=>store.startRun('task-a',{expectedTaskRevision:0,leaseOwner:'worker-c',providerId:'provider-a'}),/Task revision conflict/);
  await assert.rejects(()=>store.startRun('task-a',{expectedTaskRevision:1,leaseOwner:'worker-c',providerId:'provider-a'}),/already has active Run/);

  const restarted=new TaskStore({root});
  const restored=await restarted.load('task-a');
  assert.equal(restored.activeRunId,'run-1');
  assert.equal(restored.runs[0].attempt,1);
  console.log(JSON.stringify({ok:true,module:'RUN-FENCING-PHASE-A',scenarios:{taskSchema:true,revisionCas:true,concurrentStartSingleWinner:true,uniqueActiveRun:true,attemptMonotonicSeed:true,restartPersistence:true}}));
}finally{await fs.rm(root,{recursive:true,force:true});}