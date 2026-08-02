import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const reports=[
  ['Code Review','docs/CODE_GOVERNANCE_REPORT_V1.md'],
  ['Security','docs/SECURITY_REPORT_V1.md'],
  ['Architecture','docs/ARCHITECTURE_V1.md'],
  ['QA','docs/QA_REPORT_V1.md'],
];
const blockers=[];
for(const [gate,relative] of reports){const text=fs.readFileSync(path.join(root,relative),'utf8');if(/Gate[^\n]*FAIL|阻断部署|阻止“Architecture Gate=PASS”|Production release：BLOCKED/i.test(text))blockers.push({gate,report:relative});}
if(blockers.length){process.stderr.write(`${JSON.stringify({ok:false,freeze:'stable-single-agent-v1',deployment:'blocked',blockers},null,2)}\n`);process.exitCode=1;}else console.log(JSON.stringify({ok:true,freeze:'stable-single-agent-v1',deployment:'ready'},null,2));
