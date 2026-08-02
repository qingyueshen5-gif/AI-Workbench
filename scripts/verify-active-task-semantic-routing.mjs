import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { ActiveTaskController, analyzeActiveTaskMessage } from '../agents/active-task-controller.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { shouldStopJobForActiveTask } from './workbench-agent-runtime.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-task-routing-'));
const store=new TaskStore({root});
const transitionPath={
 completed:['interpreting','scheduling','ready','executing','verifying','completed'],
 failed:['failed'],
 cancelled:['cancelled'],
 waiting_for_clarification:['interpreting','waiting_for_clarification'],
 waiting_for_confirmation:['interpreting','scheduling','waiting_for_confirmation'],
 capability_unavailable:['interpreting','scheduling','capability_unavailable'],
 executing:['interpreting','scheduling','ready','executing']
};
const make=async(id,state='accepted',cancelledByUser=false)=>{
 let task=await store.create({taskId:id,messageId:id,originalMessageId:id,conversationId:'conversation',chatId:'conversation',text:id});
 for(const to of transitionPath[state]||[]) task=await store.transitionTask(id,task.currentState,to,to==='cancelled'?'user_cancelled':`test_${to}`,'test',{taskId:id,to});
 if(cancelledByUser) task=await store.patch(id,{cancelledByUser:true});
 return task;
};

for(const state of ['failed','completed','cancelled']){
 const old=await make(`old-${state}`,state,state==='cancelled');
 const next=await store.create({taskId:`new-${state}`,messageId:`new-${state}`,originalMessageId:`new-${state}`,conversationId:'conversation',chatId:'conversation',text:'新任务'});
 assert.equal(next.currentState,'accepted');
 assert.notEqual(next.taskId,old.taskId);
 assert.equal(shouldStopJobForActiveTask({taskId:next.taskId,messageId:next.originalMessageId,originalMessageId:next.originalMessageId},old).blocked,false,`${state} polluted new task`);
}

const same=await make('same-cancelled','cancelled',true);
const sameGate=shouldStopJobForActiveTask({taskId:same.taskId,messageId:same.originalMessageId,originalMessageId:same.originalMessageId},same);
assert.equal(sameGate.sameTask,true);
assert.equal(sameGate.cancelled,true);
assert.equal(sameGate.blocked,true);
const otherGate=shouldStopJobForActiveTask({taskId:'other',messageId:'other',originalMessageId:'other'},same);
assert.equal(otherGate.blocked,false);

const running=await make('running');
const controller=new ActiveTaskController({store});
const progress=await controller.handle({taskId:'progress-query',messageId:'progress-query',originalMessageId:'progress-query',conversationId:'conversation',chatId:'conversation',parentTaskId:running.taskId,text:'当前任务进度怎么样了'});
assert.equal(progress.intercepted,true);
assert.equal(progress.targetTaskId,running.taskId);
assert.match(progress.text,new RegExp(running.taskId));
const independent=await controller.handle({taskId:'independent',messageId:'independent',originalMessageId:'independent',conversationId:'conversation',chatId:'conversation',text:'你好'});
assert.equal(independent.intercepted,false);
assert.equal(independent.classification.kind,'new_task');

for(const [text,kind] of [['继续刚才的任务','continue'],['暂停当前任务','pause'],['取消刚才的任务','cancel'],['还需要多久','progress'],['你好','new_task']]) assert.equal(analyzeActiveTaskMessage(text,true).kind,kind,text);

await fs.rm(root,{recursive:true,force:true});
console.log(JSON.stringify({ok:true,contract:'taskId lifecycle',terminalIsolation:['failed','cancelled','completed'],sameTaskCancellationEvidence:true,conversationSnapshot:false,legacyStaleAcceptedContract:false},null,2));
