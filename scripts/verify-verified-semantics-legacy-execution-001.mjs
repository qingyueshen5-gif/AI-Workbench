#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { executeMinimalPlan, verifyMinimalResult } from '../execution/minimal-desktop-executor.mjs';

const terminalTask=(finalResult)=>({taskId:'task',currentState:'completed',failure:null,activeRunId:null,runs:[],finalResult});
const runtime=Object.create(AgentRuntime.prototype);
for(const result of [
  {toolUsed:'process.stop',verified:false,executionStarted:true,executionCompleted:true,postconditionObserved:true},
  {toolUsed:'codex',verified:false,executionStarted:true,executionCompleted:true,postconditionObserved:false},
  {provider:'deepseek',verified:false,handled:true,rendered:true,executionStarted:false,executionCompleted:false}
]){
  const replay=await runtime.terminalResult(terminalTask(result));
  assert.equal(replay.verified,false);
  assert.equal(typeof replay.verified,'boolean');
}
const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-legacy-verified-'));
try{
  const file=join(root,'fixture.txt');await fs.writeFile(file,'fixture','utf8');
  const plan={actions:[{type:'read_file',path:file}]};
  const execution=await executeMinimalPlan(plan,{allowedRoots:[root]});
  const checked=await verifyMinimalResult(plan,execution);
  assert.equal(checked.ok,true);
  assert.equal(checked.results[0].verified,false);
  assert.equal(checked.results[0].executionStarted,true);
  assert.equal(checked.results[0].executionCompleted,true);
  assert.equal(checked.results[0].postconditionObserved,true);
  console.log(JSON.stringify({ok:true,module:'VERIFIED-SEMANTICS-LEGACY-EXECUTION-MIGRATION-001',scenarios:['process.stop_without_bound_verifier','code_execution_without_bound_verifier','conversation_answer','minimal_desktop_postcondition']}));
}finally{await fs.rm(root,{recursive:true,force:true});}
