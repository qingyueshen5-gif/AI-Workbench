import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const requiredDocs=['ARCHITECTURE_V1.md','GOVERNANCE_AGENTS_V1.md','CAPABILITY_INVENTORY_V1.md','CODE_GOVERNANCE_REPORT_V1.md','SECURITY_REPORT_V1.md','QA_REPORT_V1.md','DEPLOYMENT_CHECKLIST_V1.md','PROBLEM_GOVERNANCE_INDEX_V1.md','VERSION_FREEZE_V1.md'];
const fail=(message)=>{throw new Error(message)};
for(const name of requiredDocs){const p=path.join(root,'docs',name);if(!fs.existsSync(p))fail(`缺少v1治理文档：docs/${name}`);if(!fs.readFileSync(p,'utf8').trim())fail(`v1治理文档为空：docs/${name}`);}
const sourceRoots=['agents','capabilities','execution','scripts'];
const sourceFiles=[];
const legacyProtocolTestFiles=new Set(['scripts/task-interpreter-contract-fixtures.mjs','scripts/verify-task-interpreter-fixture-contracts.mjs','scripts/verify-v1-governance.mjs']);
for(const dir of sourceRoots){const walk=(p)=>{for(const entry of fs.readdirSync(p,{withFileTypes:true})){const full=path.join(p,entry.name);if(entry.isDirectory())walk(full);else if(/\.mjs$/i.test(entry.name))sourceFiles.push(full);}};walk(path.join(root,dir));}
const forbidden=[/requiresExecution/,/parseDecision/,/DecisionParser/,/DecisionSchema/];
for(const file of sourceFiles){const relative=path.relative(root,file).replaceAll('\\','/');if(legacyProtocolTestFiles.has(relative))continue;const text=fs.readFileSync(file,'utf8');for(const rule of forbidden)if(rule.test(text))fail(`发现旧Decision协议：${relative} 命中 ${rule}`);}
const gateway=fs.readFileSync(path.join(root,'scripts','workbench-feishu-adapter.mjs'),'utf8');
for(const token of ['TaskInterpreter','CapabilityScheduler','CapabilityRegistry','LocalProcessProvider'])if(gateway.includes(token))fail(`Gateway跨层引用：${token}`);
const architecture=fs.readFileSync(path.join(root,'docs','ARCHITECTURE_V1.md'),'utf8');
for(const layer of ['Task Interpreter','Scheduler','Capability Registry','Provider','Verifier','Result'])if(!architecture.includes(layer))fail(`架构文档缺少层：${layer}`);
const governance=fs.readFileSync(path.join(root,'docs','GOVERNANCE_AGENTS_V1.md'),'utf8');
for(const role of ['Runtime Agent','Code Review Agent','Security Agent','Architecture Agent','QA Agent','Product Agent'])if(!governance.includes(role))fail(`治理职责缺少：${role}`);
const checklist=fs.readFileSync(path.join(root,'docs','DEPLOYMENT_CHECKLIST_V1.md'),'utf8');
const order=['Code Review Gate','Security Gate','Architecture Gate','QA Gate','Deployment Gate'].map((x)=>checklist.indexOf(x));
if(order.some((x)=>x<0)||order.some((x,i)=>i&&x<=order[i-1]))fail('部署门禁顺序不正确');
const registry=fs.readFileSync(path.join(root,'capabilities','capability-registry.mjs'),'utf8');
const inventory=fs.readFileSync(path.join(root,'docs','CAPABILITY_INVENTORY_V1.md'),'utf8');
for(const id of [...registry.matchAll(/capabilityId:\s*'([^']+)'/g)].map((m)=>m[1]))if(!inventory.includes(`| ${id} |`))fail(`Capability Inventory缺少：${id}`);
console.log(JSON.stringify({ok:true,freeze:'stable-single-agent-v1',documents:requiredDocs.length,sourceFilesScanned:sourceFiles.length,legacyDecisionProtocol:false,gatewayBusinessImports:false,deploymentGateOrder:['Code Review','Security','Architecture','QA','Deployment']},null,2));
