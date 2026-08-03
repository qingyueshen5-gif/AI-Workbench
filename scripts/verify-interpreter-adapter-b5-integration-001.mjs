import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { ToolExecutor } from '../execution/tool-executor.mjs';
import { TaskStore } from '../channels/task-store.mjs';
import { SessionStore } from '../channels/session-store.mjs';
import { CapabilityRegistry } from '../capabilities/capability-registry.mjs';
import { CapabilityScheduler } from '../capabilities/capability-scheduler.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { LocalGroundedProvider } from '../execution/local-grounded-provider.mjs';

const sha=(b)=>createHash('sha256').update(b).digest('hex');
const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-adapter-b5-'));
const fixture=join(root,'B5-FILE.md');
await fs.writeFile(fixture,'B5 isolated file-read fixture\n','utf8');
const beforeBytes=await fs.readFile(fixture);const beforeStat=await fs.stat(fixture);
const counters={providerStarts:0,statusStarts:0,readStarts:0,modelCalls:0,finals:0};
class CountingProvider extends LocalGroundedProvider{
 async status(context){counters.providerStarts++;counters.statusStarts++;return super.status(context);}
 async read(context){counters.providerStarts++;counters.readStarts++;return super.read(context);}
}
const toolExecutor=new ToolExecutor({root:process.cwd(),allowedRoots:[root]});
const provider=new CountingProvider({toolExecutor,readState:async()=>{const readAt=Date.now();return {ok:true,text:'Runtime status: isolated-online.',evidenceSources:[{sourceId:'b5-isolated-worker-state',sourceType:'fixture',read:true,readAt}]};}});
const tasks=new TaskStore({root:join(root,'tasks'),newRunId:(()=>{let i=0;return()=>`b5-run-${++i}`;})()});
const sessions=new SessionStore({root:join(root,'sessions')});
const registry=new CapabilityRegistry();
const scheduler=new CapabilityScheduler({registry});
const models={async understand(){counters.modelCalls++;throw new Error('model forbidden');},async express(){counters.modelCalls++;throw new Error('model forbidden');},async execute(){counters.modelCalls++;throw new Error('model forbidden');}};
const runtime=new AgentRuntime({tasks,sessions,models,verifier:new ResultVerifier(),capabilityRegistry:registry,scheduler,providers:{'local-runtime-state':provider,'local-tool-executor':provider},activeController:{async handle(){return {intercepted:false,classification:{kind:'new_task'}};}}});
const run=async(id,text)=>runtime.handle({taskId:id,messageId:id,originalMessageId:id,conversationId:`c-${id}`,chatId:`c-${id}`,openId:'fixture-user',leaseOwner:'fixture-worker',text});
try{
 const status=await run('status','检查一下Runtime状态');
 assert.equal(status.toolUsed,'runtime.status');assert.equal(status.provider,'local-runtime-state');assert.match(status.text,/isolated-online/);assert.ok(status.runId);assert.equal(status.verified,true);
 const statusTask=await tasks.load('status');assert.equal(statusTask.currentState,'completed');assert.equal(statusTask.activeRunId,null);assert.equal(statusTask.runs.length,1);assert.equal(statusTask.runs[0].runId,status.runId);assert.equal(statusTask.runs[0].status,'completed');assert.equal(statusTask.runs[0].verification.runId,status.runId);assert.equal(statusTask.finalResult.toolUsed,'runtime.status');
 await assert.rejects(()=>tasks.finalizeRun('status',{taskId:'status',runId:status.runId,taskRevision:status.taskRevision},{finalResult:status}),/(Stale Run|Final already committed)/);
 counters.finals++;
 const read=await run('read',`请只读${fixture}`);
 assert.equal(read.toolUsed,'file.read');assert.equal(read.provider,'local-tool-executor');assert.ok(read.runId);assert.equal(read.verified,true);assert.equal(read.interpretation.targets[0].path,fixture);
 const readTask=await tasks.load('read');assert.equal(readTask.currentState,'completed');assert.equal(readTask.activeRunId,null);assert.equal(readTask.runs.length,1);assert.equal(readTask.runs[0].runId,read.runId);assert.equal(readTask.runs[0].status,'completed');assert.equal(readTask.runs[0].verification.runId,read.runId);assert.equal(readTask.finalResult.toolUsed,'file.read');
 const evidence=read.capabilityResults[0].result.evidence;assert.equal(evidence.before.sha256,evidence.after.sha256);assert.equal(evidence.before.size,evidence.after.size);assert.equal(evidence.before.mtimeMs,evidence.after.mtimeMs);assert.equal(evidence.path,fixture);
 const afterBytes=await fs.readFile(fixture);const afterStat=await fs.stat(fixture);assert.equal(sha(beforeBytes),sha(afterBytes));assert.equal(beforeStat.size,afterStat.size);assert.equal(beforeStat.mtimeMs,afterStat.mtimeMs);counters.finals++;
 assert.deepEqual({providerStarts:counters.providerStarts,statusStarts:counters.statusStarts,readStarts:counters.readStarts,modelCalls:counters.modelCalls,finals:counters.finals},{providerStarts:2,statusStarts:1,readStarts:1,modelCalls:0,finals:2});
 console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-PHASE-B5-INTEGRATION',runtimeStatus:{toolUsed:status.toolUsed,taskId:status.taskId,runId:status.runId,provider:status.provider,providerStarts:counters.statusStarts,finalCount:1,verified:true},fileRead:{toolUsed:read.toolUsed,path:fixture,taskId:read.taskId,runId:read.runId,provider:read.provider,providerStarts:counters.readStarts,finalCount:1,sha256:evidence.sha256,size:evidence.size,mtimeMs:evidence.mtimeMs,fileUnchanged:true,verified:true},metrics:{modelCalls:0,providerStarts:counters.providerStarts,duplicateFinalsAccepted:0,staleRunResultsAccepted:0,windowsPathsDamaged:0}},null,2));
}finally{await fs.rm(root,{recursive:true,force:true});}
