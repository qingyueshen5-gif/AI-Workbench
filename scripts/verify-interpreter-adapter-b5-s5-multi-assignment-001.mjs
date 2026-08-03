import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { CapabilityRegistry } from '../capabilities/capability-registry.mjs';
import { CapabilityScheduler } from '../capabilities/capability-scheduler.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { LocalGroundedProvider } from '../execution/local-grounded-provider.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-s5-'));const fixture=join(root,'S5.md');await fs.writeFile(fixture,'S5 fixture\n');
const counters={providerStarts:0,modelCalls:0};class Provider extends LocalGroundedProvider{async status(c){counters.providerStarts++;return super.status(c)}async read(c){counters.providerStarts++;return super.read(c)}}
const toolExecutor=new ToolExecutor({root:process.cwd(),allowedRoots:[root]});const provider=new Provider({toolExecutor,readState:async()=>{const readAt=Date.now();return {ok:true,text:'Runtime status: S5 fixture.',evidenceSources:[{sourceId:'s5',sourceType:'fixture',read:true,readAt}]}}});
const make=({taskDraft,scheduler}={})=>{const tasks=new TaskStore({root:join(root,`tasks-${Math.random()}`)});const sessions=new SessionStore({root:join(root,`sessions-${Math.random()}`)});const registry=new CapabilityRegistry();const realScheduler=new CapabilityScheduler({registry});const runtime=new AgentRuntime({tasks,sessions,models:{async understand(){counters.modelCalls++;throw new Error('model forbidden')},async express(){counters.modelCalls++;throw new Error('model forbidden')},async execute(){counters.modelCalls++;throw new Error('model forbidden')}},verifier:new ResultVerifier(),capabilityRegistry:registry,scheduler:scheduler||realScheduler,providers:{'local-runtime-state':provider,'local-tool-executor':provider},interpreterAdapter:{adapt(){return {decision:'execute',taskDraft}}},groundTruthExtractor:()=>({}),activeController:{async handle(){return {intercepted:false,classification:{kind:'new_task'}};}}});return {runtime,tasks};};
const draft=(caps)=>({taskType:'operation',goal:'S5 fixture',requiredCapabilities:caps,targets:caps.includes('file.read')?[{type:'file',path:fixture}]:[],constraints:[],successCriteria:[],context:{},riskLevel:'low',requiresConfirmation:false,confidence:1});
try{
 const zero=make({taskDraft:draft(['runtime.status']),scheduler:{plan(){return {status:'ready',assignments:[],missingCapabilities:[]}}}});await assert.rejects(()=>zero.runtime.handle({taskId:'zero',messageId:'zero',conversationId:'zero',openId:'u',text:'status'}),/assignment missing/);assert.equal(counters.providerStarts,0);assert.equal((await zero.tasks.load('zero')).runs.length,0);
 const status=make({taskDraft:draft(['runtime.status'])});const sr=await status.runtime.handle({taskId:'one-status',messageId:'one-status',conversationId:'one-status',openId:'u',text:'status'});assert.equal(sr.verified,true);assert.equal(counters.providerStarts,1);
 const read=make({taskDraft:draft(['file.read'])});const rr=await read.runtime.handle({taskId:'one-read',messageId:'one-read',conversationId:'one-read',openId:'u',text:'read'});assert.equal(rr.verified,true);assert.equal(counters.providerStarts,2);
 for(const count of [2,3]){const caps=['runtime.status','file.read',...(count===3?['runtime.status']:[])];const item=make({taskDraft:draft(caps)});const result=await item.runtime.handle({taskId:`multi-${count}`,messageId:`multi-${count}`,conversationId:`multi-${count}`,openId:'u',text:'multi'});const task=await item.tasks.load(`multi-${count}`);assert.equal(result.verified,false);assert.equal(result.rejection.assignmentCount,count);assert.equal(counters.providerStarts,2);assert.equal(task.runs.length,0);assert.equal(task.activeRunId,null);assert.equal(task.currentState,'failed');assert.equal(task.finalResult,null);assert.match(result.text,/多个可执行任务/);assert.match(result.text,/一次只执行一个/);assert.match(result.text,/没有启动任何操作/);assert.match(result.text,/先执行哪一个/);}
 console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-B5-S5-MULTI-ASSIGNMENT-FAIL-CLOSED',zero:{providerStarts:0,successFinals:0,runs:0},single:{runtimeStatus:'PASS',fileRead:'PASS',providerStarts:2,finals:2},multi:{counts:[2,3],providerStarts:0,tasks:2,runs:0,effectiveExecutionRuns:0,successFinals:0,verifiedTrue:0,userText:'我识别到多个可执行任务：检查Runtime状态、读取文件。当前版本一次只执行一个任务，因此没有启动任何操作。请告诉我先执行哪一个。'},modelCalls:counters.modelCalls},null,2));
}finally{await fs.rm(root,{recursive:true,force:true})}
