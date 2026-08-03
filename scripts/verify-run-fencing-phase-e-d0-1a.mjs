import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { ResultVerifier } from '../execution/result-verifier.mjs';
import { LocalGroundedProvider } from '../execution/local-grounded-provider.mjs';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-d0-1a-'));
try{
  const file=join(root,'NEXT_STEP.md');
  await fs.writeFile(file,'RUN-FENCING-001重新实现\n','utf8');
  const provider=new LocalGroundedProvider({readState:async()=>({text:'Runtime status: isolated-online.',source:'isolated-worker-state'})});
  const runtime=new AgentRuntime({providers:{'local-runtime-state':provider,'local-tool-executor':provider},verifier:new ResultVerifier(),models:{},taskInterpreter:{},scheduler:{},activeController:{},sessions:{},tools:{}});
  const identity={taskId:'task-d0',runId:'run-d0',taskRevision:7};
  const statusPlan={assignments:[{capabilityId:'runtime.status',primaryProvider:{providerId:'local-runtime-state'},fallbackProviders:[]}]};
  const status=await runtime.executeCapabilityPlan(statusPlan,{goal:'查询Runtime状态',targets:[],context:{}},identity);
  assert.equal(status[0].capabilityId,'runtime.status');
  assert.equal(status[0].providerId,'local-runtime-state');
  assert.equal(status[0].result.identity.runId,identity.runId);
  assert.match(status[0].result.text,/isolated-online/);
  const readPlan={assignments:[{capabilityId:'file.read',primaryProvider:{providerId:'local-tool-executor'},fallbackProviders:[]}]};
  const read=await runtime.executeCapabilityPlan(readPlan,{goal:'读取NEXT_STEP',targets:[{type:'file',path:file}],context:{}},identity);
  assert.equal(read[0].capabilityId,'file.read');
  assert.equal(read[0].providerId,'local-tool-executor');
  assert.equal(read[0].result.identity.taskRevision,identity.taskRevision);
  assert.equal(read[0].result.evidence.before.sha256,read[0].result.evidence.after.sha256);
  assert.equal(read[0].result.evidence.before.mtimeMs,read[0].result.evidence.after.mtimeMs);
  assert.equal(read[0].result.evidence.before.size,read[0].result.evidence.after.size);
  assert.match(read[0].result.content,/RUN-FENCING-001/);
  console.log(JSON.stringify({ok:true,module:'RUN-FENCING-PHASE-E-D0-1A',scenarios:{runtimeStatusRegistrySchedulerProviderVerifier:true,fileReadRegistrySchedulerProviderVerifier:true,identityBound:true,fileUnchanged:true},results:{runtimeStatus:{toolUsed:'runtime.status',provider:status[0].providerId},fileRead:{toolUsed:'file.read',provider:read[0].providerId,sha256:read[0].result.evidence.sha256,size:read[0].result.evidence.size,mtimeMs:read[0].result.evidence.mtimeMs}}}));
}finally{await fs.rm(root,{recursive:true,force:true});}
