import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

const root=await fs.mkdtemp(join(os.tmpdir(),'aiw-gateway-switch-'));
const bridge=join(root,'bridge');const ipc=join(bridge,'ipc');await fs.mkdir(join(ipc,'jobs'),{recursive:true});
const selectionPath=join(bridge,'runtime-selection.json'),deploymentPath=join(bridge,'deployment-state.json'),workerStatePath=join(ipc,'worker-state.json');
process.env.AIW_FEISHU_IPC_DIR=ipc;process.env.AIW_RUNTIME_SELECTION_FILE=selectionPath;process.env.AIW_DEPLOYMENT_STATE_FILE=deploymentPath;process.env.AIW_TEST_DISABLE_IPC_BINDING_PERSIST='1';
let supervisor=null;
try{
const{RuntimeSupervisor}=await import(`./runtime-supervisor.mjs?switch=${Date.now()}`);
const makeRuntime=async(name,commit,fail=false)=>{const dir=join(root,name);await fs.mkdir(join(dir,'scripts'),{recursive:true});await fs.writeFile(join(dir,'scripts','workbench-agent-runtime.mjs'),`import fs from 'node:fs/promises';import {join}from'node:path';const ipc=process.env.AIW_FEISHU_IPC_DIR;${fail?'process.exit(2);':''}await fs.mkdir(ipc,{recursive:true});const p=join(ipc,'worker-state.json');await fs.writeFile(p,JSON.stringify({status:'online',pid:process.pid,gitCommit:process.env.AIW_RUNTIME_GIT_COMMIT,projectRoot:process.cwd()}));process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`);return {root:dir,commit,tag:name,skipGitValidation:true};};
const rc1=await makeRuntime('rc1','rc1-commit');const rc2=await makeRuntime('rc2','rc2-commit');const bad=await makeRuntime('bad','bad-commit',true);
supervisor=new RuntimeSupervisor({selectionPath,deploymentPath,workerStatePath,pollMs:50,startTimeoutMs:3000});
const gatewayPid=process.pid;
await supervisor.apply({selected:rc1,fallback:rc1});const pid1=supervisor.child.pid;assert.equal(supervisor.current.commit,'rc1-commit');assert.equal(process.pid,gatewayPid);
await supervisor.apply({selected:rc2,fallback:rc1});const pid2=supervisor.child.pid;assert.notEqual(pid2,pid1);assert.equal(supervisor.current.commit,'rc2-commit');assert.equal(process.pid,gatewayPid);
await supervisor.apply({selected:bad,fallback:rc1});assert.equal(supervisor.current.commit,'rc1-commit');assert.equal(process.pid,gatewayPid);
const deployment=JSON.parse(await fs.readFile(deploymentPath,'utf8'));assert.equal(deployment.lastRollback.completed,true);assert.equal(deployment.active.commit,'rc1-commit');
await supervisor.stopCurrent('test_complete');supervisor=null;
const result={ok:true,gatewayPidUnchanged:gatewayPid,runtimePids:[pid1,pid2],switchWithoutGatewayRestart:true,failedCandidateRolledBack:true,fixtureRoot:root,fixtureRootInOsTmp:root.startsWith(os.tmpdir()),fixtureRootExistsBeforeCleanup:true,deployment,isolatedIpc:true,dynamicImportAfterEnv:true};
const evidencePath=join(root,'gateway-runtime-switch.json');await fs.writeFile(evidencePath,JSON.stringify(result,null,2));assert.equal((await fs.stat(evidencePath)).isFile(),true);console.log(JSON.stringify({...result,evidencePath,evidenceIsolated:evidencePath.startsWith(root)}));
}finally{if(supervisor)await supervisor.stopCurrent('test_cleanup').catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
