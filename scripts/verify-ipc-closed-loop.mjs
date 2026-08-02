import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ipc=await fs.mkdtemp(join(os.tmpdir(),'aiw-ipc-loop-'));
const runtimeDir=join(ipc,'fixture');await fs.mkdir(join(runtimeDir,'scripts'),{recursive:true});
const runtimeScript=join(runtimeDir,'scripts','workbench-agent-runtime.mjs');
await fs.writeFile(runtimeScript,`import fs from 'node:fs/promises';import{join}from'node:path';const ipc=process.env.AIW_FEISHU_IPC_DIR;if(!ipc)process.exit(10);for(const d of ['jobs','claims','results'])await fs.mkdir(join(ipc,d),{recursive:true});await fs.writeFile(join(ipc,'worker-state.json'),JSON.stringify({pid:process.pid,status:'online',gitCommit:'ipc-fixture',projectRoot:process.cwd(),ipcRoot:ipc}));let stop=false;process.on('SIGTERM',()=>stop=true);while(!stop){for(const n of await fs.readdir(join(ipc,'jobs'))){if(!n.endsWith('.json'))continue;const p=join(ipc,'jobs',n),j=JSON.parse(await fs.readFile(p,'utf8'));const claim=join(ipc,'claims',n);try{await fs.writeFile(claim,JSON.stringify({messageId:j.messageId,pid:process.pid}),{flag:'wx'});}catch{continue;}await fs.writeFile(join(ipc,'results',n),JSON.stringify({messageId:j.messageId,originalMessageId:j.messageId,text:'isolated-result',ok:true,ipcRoot:ipc}));await fs.rm(p);await fs.rm(claim);}await new Promise(r=>setTimeout(r,20));}`);
for(const d of ['jobs','claims','results','delivery-claims'])await fs.mkdir(join(ipc,d),{recursive:true});
const child=spawn(process.execPath,[runtimeScript],{cwd:runtimeDir,env:{...process.env,AIW_FEISHU_IPC_DIR:ipc},stdio:'inherit'});
const wait=async(fn,ms=5000)=>{const end=Date.now()+ms;while(Date.now()<end){try{const x=await fn();if(x)return x;}catch{}await new Promise(r=>setTimeout(r,20));}throw new Error('timeout');};
await wait(async()=>JSON.parse(await fs.readFile(join(ipc,'worker-state.json'),'utf8')).status==='online');
const messageId='isolated-ipc-'+Date.now();await fs.writeFile(join(ipc,'jobs',messageId+'.json'),JSON.stringify({messageId,text:'isolated test',chatId:'isolated'}));
const result=await wait(async()=>JSON.parse(await fs.readFile(join(ipc,'results',messageId+'.json'),'utf8')));
const deliveryClaim=join(ipc,'delivery-claims',messageId+'.json');await fs.writeFile(deliveryClaim,JSON.stringify({messageId,reader:'isolated-reply-sender'}),{flag:'wx'});
assert.equal(result.text,'isolated-result');assert.equal(result.ipcRoot,ipc);assert.equal(JSON.parse(await fs.readFile(deliveryClaim,'utf8')).reader,'isolated-reply-sender');
child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));console.log(JSON.stringify({ok:true,ipcRoot:ipc,messageId,runtimeClaimed:true,resultGenerated:true,replySenderRead:true}));await fs.rm(ipc,{recursive:true,force:true});
