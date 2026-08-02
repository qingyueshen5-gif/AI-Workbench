import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { ContractSessionStore, ContractActiveTaskStore, ContractToolExecutor, ContractModelRouter, ContractVerifier, ContractProgressWriter, verifyAgentRuntimeDependencyContracts } from './runtime-dependency-contract-fixtures.mjs';
const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-contract-'));const path=join(root,'fixture.md');await fs.writeFile(path,'fixture');
const progressWriter=new ContractProgressWriter();
const deps={
 sessions:new ContractSessionStore(),activeTasks:new ContractActiveTaskStore(),
 tools:new ContractToolExecutor(async(_id,call)=>{const content=await fs.readFile(call.path,'utf8');return{ok:true,results:[{type:'read_file',path:call.path,content,size:Buffer.byteLength(content),sha256:'hash',currentSha256:'hash',verified:true}]}}),
 models:new ContractModelRouter({understand:async()=>({text:'{"requiresExecution":false,"task":"","answer":"ok"}'}),express:async()=>({text:'ok'}),execute:async()=>({text:'executed',sessionId:'s'})}),
 verifier:new ContractVerifier(),progressWriter
};
const result=await verifyAgentRuntimeDependencyContracts(deps,{path});assert.equal(result.ok,true);await fs.rm(root,{recursive:true,force:true});console.log(JSON.stringify(result,null,2));
