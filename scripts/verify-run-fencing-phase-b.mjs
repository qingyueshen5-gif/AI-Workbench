import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../channels/task-store.mjs';
import { AgentRuntime } from '../agents/agent-runtime.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-run-fencing-b-'));
let providerStarts=0;
const store=new TaskStore({root,newRunId:()=>`run-b-${providerStarts+1}`});
const runtime=new AgentRuntime({tasks:store,models:{},taskInterpreter:{},scheduler:{},providers:{},activeController:{},sessions:{},tools:{},verifier:{}});
try{
  const task=await store.create({taskId:'task-b',messageId:'message-b',originalMessageId:'message-b',conversationId:'conversation-b'});
  let persistedBeforeProvider=false;
  const provider=async(context)=>{
    providerStarts+=1;
    const saved=await store.load(context.taskId);
    persistedBeforeProvider=saved.activeRunId===context.runId&&saved.taskRevision===context.taskRevision&&saved.runs.at(-1).status==='starting';
    return {ok:true,identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  };
  const execution=await runtime.executeWithRun(task,{leaseOwner:'worker-b',providerId:'provider-b'},provider);
  assert.equal(persistedBeforeProvider,true,'Provider started before Run was persisted');
  assert.equal(providerStarts,1);
  assert.deepEqual(execution.result.identity,execution.identity);
  const saved=await store.load('task-b');
  assert.equal(saved.runs.length,1);
  assert.equal(saved.activeRunId,execution.identity.runId);
  assert.equal(saved.runs[0].status,'running');
  await assert.rejects(()=>runtime.executeWithRun(saved,{leaseOwner:'worker-b',providerId:'provider-b'},provider),/(already has active Run|revision conflict)/);
  assert.equal(providerStarts,1,'same attempt started Provider twice');
  console.log(JSON.stringify({ok:true,module:'RUN-FENCING-PHASE-B',scenarios:{persistedBeforeProvider:true,providerIdentityRoundTrip:true,sameAttemptSingleRun:true}}));
}finally{await fs.rm(root,{recursive:true,force:true});}
