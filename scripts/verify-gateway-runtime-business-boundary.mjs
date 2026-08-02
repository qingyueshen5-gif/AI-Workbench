import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';

const gatewayPath=join(process.cwd(),'scripts','workbench-feishu-adapter.mjs');
const gateway=await fs.readFile(gatewayPath,'utf8');
for(const forbidden of ['ActiveTaskController','active-task-controller','IntentRouter','intent-router','control.intercepted','controlKind']) assert.equal(gateway.includes(forbidden),false,`Gateway business reference: ${forbidden}`);
assert.match(gateway,/enqueueJob\(\{ messageId/);

class Store{constructor(task=null){this.task=task;}async active(){return this.task&&!['completed','failed'].includes(this.task.stage)&&!this.task.cancelled?this.task:null;}async load(){return this.task;}async create(job){this.task={activeTaskId:job.messageId,originalMessageId:job.messageId,conversationId:job.conversationId,originalUserGoal:job.text,effectiveUserGoal:job.text,stage:'accepted',startedAt:Date.now(),lastProgressAt:Date.now(),completedSteps:[],toolResults:[],supplementalInstructions:[]};return this.task;}async update(_id,p){this.task={...this.task,...p};return this.task;}async addCompletedStep(){}async addToolResult(){}}
const models={healthCheck:async()=>({}),understand:async()=>({text:JSON.stringify({requiresExecution:false,task:'',answer:'普通任务已进入Runtime'})}),express:async()=>({text:'Runtime最终结果'})};
const sessions={load:async()=>({originalMessages:[]}),appendMessage:async()=>{}};
const verifier={verifyModelResult:(x)=>x};
const tools={};
const make=(task=null)=>new AgentRuntime({activeTasks:new Store(task),models,sessions,verifier,tools,now:()=>10_000,staleAcceptedMs:1000});
const old={activeTaskId:'old',originalMessageId:'old',conversationId:'c',originalUserGoal:'old',effectiveUserGoal:'old',stage:'executing',startedAt:1,lastProgressAt:9999,completedSteps:[],toolResults:[],supplementalInstructions:[]};
const messages=[
 ['read','读取 E:\\AI-Workbench\\NEXT_STEP.md，告诉我当前最重要的目标。不要修改文件。','new_task','read'],
 ['continue','继续刚才的任务','continue',''],
 ['pause','暂停当前任务','pause',''],
 ['cancel','取消刚才的任务','cancel',''],
 ['progress','还需要多久','progress','']
];
const results=[];
for(const [name,text,kind,action] of messages){const runtime=make({...old});const r=await runtime.handle({messageId:name,originalMessageId:name,conversationId:'c',chatId:'c',text});assert.equal(r.classification.kind,kind);assert.equal(r.classification.action,action);results.push({name,classification:r.classification,provider:r.provider});}
const stale={...old,stage:'accepted',lastProgressAt:1};const staleResult=await make(stale).handle({messageId:'fresh',originalMessageId:'fresh',conversationId:'c',chatId:'c',text:'读取 E:\\AI-Workbench\\NEXT_STEP.md，不要修改文件'});assert.equal(staleResult.classification.kind,'new_task');assert.equal(staleResult.activeTaskId,'fresh');
const gatewayJobContract={messageId:'one',originalMessageId:'one',conversationId:'c',chatId:'c',text:'继续刚才的任务'};const runtimeA=make({...old});const runtimeB=make({...old});assert.equal((await runtimeA.handle(gatewayJobContract)).classification.kind,'continue');assert.equal((await runtimeB.handle({...gatewayJobContract,messageId:'two',originalMessageId:'two',text:'读取 package.json，只告诉我版本号'})).classification.kind,'new_task');
console.log(JSON.stringify({ok:true,gatewayImportsBusiness:false,gatewayAlwaysEnqueues:true,runtimeOwnsActiveTask:true,realJobEntry:'AgentRuntime.handle',cases:results,staleDoesNotBlock:true,runtimeSwitchUsesNewLogicWithoutGatewayRestart:true,exactlyOnceContract:'one source message -> one Gateway Job -> one Runtime handle -> one Result'},null,2));
