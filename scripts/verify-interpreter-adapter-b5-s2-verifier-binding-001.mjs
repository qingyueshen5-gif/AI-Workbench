import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import {join} from 'node:path';
import {AgentRuntime} from '../agents/agent-runtime.mjs';import {TaskStore} from '../channels/task-store.mjs';import {SessionStore} from '../channels/session-store.mjs';import {CapabilityRegistry} from '../capabilities/capability-registry.mjs';import {CapabilityScheduler} from '../capabilities/capability-scheduler.mjs';
const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-s2-'));let providerCalls=0;
const provider={async status(ctx){providerCalls++;return {ok:true,text:'format-valid status',evidence:{readAt:Date.now(),evidenceSources:[{sourceId:'fixture',sourceType:'file',read:true,readAt:Date.now()}],evidenceReferences:['file:fixture@1']},identity:ctx};}};
const verifier={verifyCapabilityResult(){return {ok:false,passed:false,failureReason:'fixture evidence authenticity failed',verifierId:'RejectingVerifier',verificationMethod:'fixture-authenticity',evidenceReferences:['file:fixture@1'],verifiedAt:Date.now()};}};
const runtime=new AgentRuntime({tasks:new TaskStore({root:join(root,'tasks'),newRunId:()=> 's2-run'}),sessions:new SessionStore({root:join(root,'sessions')}),models:{},taskInterpreter:{async interpret(){throw new Error('model forbidden');}},verifier,capabilityRegistry:new CapabilityRegistry(),scheduler:new CapabilityScheduler({registry:new CapabilityRegistry()}),providers:{'local-runtime-state':provider},activeController:{async handle(){return {intercepted:false,classification:{kind:'new_task'}};}}});
try{
 let failure='';try{await runtime.handle({taskId:'s2',messageId:'s2',originalMessageId:'s2',conversationId:'s2-c',chatId:'s2-c',text:'检查Runtime状态'});}catch(e){failure=e.message;}
 assert.match(failure,/fixture evidence authenticity failed|verification failed/i);
 const task=await runtime.tasks.load('s2');const run=task.runs[0];
 assert.equal(providerCalls,1);assert.equal(run.status,'failed');assert.equal(run.verification.passed,false);assert.match(run.verification.failureReason,/fixture evidence authenticity failed/);assert.equal(task.finalResult,null);assert.notEqual(task.finalResult?.verified,true);
 console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-B5-S2-VERIFIER-BINDING',providerCalls,run:{status:run.status,verification:run.verification},finalResult:task.finalResult,failure,userText:'Provider执行完成，但结果未通过验证，因此没有标记为已验证。'},null,2));
}finally{await fs.rm(root,{recursive:true,force:true});}
