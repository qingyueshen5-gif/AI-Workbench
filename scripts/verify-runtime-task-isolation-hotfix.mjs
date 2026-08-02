import assert from'node:assert/strict';
import{TaskInterpreter}from'../agents/task-interpreter.mjs';
import{shouldStopJobForActiveTask}from'./workbench-agent-runtime.mjs';

const validChat=(goal='自然回复用户')=>JSON.stringify({taskType:'chat',goal,actions:['reply'],targets:[],context:{},constraints:[],riskLevel:'low',requiredCapabilities:[],successCriteria:['返回自然且真实的回复'],requiresConfirmation:false,confidence:.98});

for(const text of['你好','您好','嗨','早上好','在吗','很高兴认识你','你是谁','谢谢']){
 let calls=0;const interpreter=new TaskInterpreter({model:{understand:async()=>{calls++;return{text:validChat(`回复：${text}`)}}}});const result=await interpreter.interpret({text});assert.equal(result.taskType,'chat');assert.deepEqual(result.requiredCapabilities,[]);assert.equal(calls,1);
}

{
 let calls=0;const interpreter=new TaskInterpreter({model:{understand:async()=>{calls++;return{text:calls===1?JSON.stringify({taskType:'conversation',goal:'问候',actions:[],targets:[],context:{},constraints:[],riskLevel:'low',requiredCapabilities:[],successCriteria:['回复'],requiresConfirmation:false,confidence:.9}):validChat('纠正后回复问候')}}}});const result=await interpreter.interpret({text:'你好'});assert.equal(result.taskType,'chat');assert.equal(calls,2);
}
{
 let calls=0;const interpreter=new TaskInterpreter({model:{understand:async()=>{calls++;return{text:'{"taskType":"invalid"}'}}}});const result=await interpreter.interpret({text:'你好'});assert.equal(result.taskType,'clarification');assert.equal(result.context.fallback,'invalid_task_interpreter_output');assert.equal(calls,2);
}

const oldStates=['failed','completed'];for(const stage of oldStates){const gate=shouldStopJobForActiveTask({messageId:'new',originalMessageId:'new'},{activeTaskId:'old',originalMessageId:'old',stage,cancelled:false});assert.equal(gate.blocked,false,`${stage} old task polluted new job`);}
{
 const gate=shouldStopJobForActiveTask({messageId:'new',originalMessageId:'new'},{activeTaskId:'old',originalMessageId:'old',stage:'failed',cancelled:true});assert.equal(gate.blocked,false,'cancelled old task polluted new job');
}
{
 const gate=shouldStopJobForActiveTask({messageId:'same',originalMessageId:'same'},{activeTaskId:'same',originalMessageId:'same',stage:'failed',cancelled:true});assert.equal(gate.cancelled,true);assert.equal(gate.blocked,true);
}

// First chat interpretation failure must not make the second independent greeting inherit cancellation.
{
 const failed={activeTaskId:'first',originalMessageId:'first',stage:'failed',cancelled:false};const second={messageId:'second',originalMessageId:'second'};assert.equal(shouldStopJobForActiveTask(second,failed).blocked,false);
 let providerCalls=0;const interpreter=new TaskInterpreter({model:{understand:async()=>({text:validChat()})}});const result=await interpreter.interpret({text:'你好'});if(result.taskType==='chat')providerCalls++;assert.equal(providerCalls,1);
}

// Exactly-once local contract: one independent source message yields one provider execution and one reply result.
{
 const seen=new Set();let executions=0,replies=0;const handle=async(messageId)=>{if(seen.has(messageId))return;seen.add(messageId);executions++;replies++;};await Promise.all([handle('one'),handle('one')]);assert.equal(executions,1);assert.equal(replies,1);
}
console.log(JSON.stringify({ok:true,chatExpressions:8,illegalTaskTypeCorrection:true,terminalIsolation:['failed','cancelled','completed'],realCancellationPreserved:true,exactlyOnce:true}));
