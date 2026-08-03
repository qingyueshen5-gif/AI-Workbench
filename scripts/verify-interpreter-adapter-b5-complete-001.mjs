import { spawnSync } from 'node:child_process';
const commands=[
 ['node',['scripts/verify-interpreter-adapter-b5-integration-001.mjs']],
 ['node',['scripts/verify-interpreter-adapter-bypass-001.mjs']],
 ['node',['scripts/verify-interpreter-adapter-authorization-001.mjs']]
];
for(const [command,args] of commands){const r=spawnSync(command,args,{cwd:process.cwd(),encoding:'utf8',stdio:'inherit',env:{...process.env,NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost',SKILL_SELF_MODIFICATION_ALLOWED:'false'}});if(r.status!==0)process.exit(r.status??1);}
console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-PHASE-B5-INTEGRATION-001',b5Complete:true}));
