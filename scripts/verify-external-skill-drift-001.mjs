import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo=dirname(dirname(fileURLToPath(import.meta.url)));
const registryPath=resolve(process.argv[2]||join(repo,'verification','external-skill-registry.json'));
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
function readConfig(){const py=`import yaml,json; x=yaml.safe_load(open(r'''${process.env.HERMES_HOME}\\config.yaml''',encoding='utf8')) or {}; print(json.dumps({'approval':x.get('skills',{}).get('write_approval'),'curator':x.get('curator',{}).get('enabled')}))`;const r=spawnSync(process.env.HERMES_PYTHON||'python',['-c',py],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return JSON.parse(r.stdout);}
export async function verifyExternalSkillRegistry(path=registryPath){const registry=JSON.parse(await readFile(path,'utf8'));const cfg=readConfig();if(cfg.approval!==true||cfg.curator!==false)throw new Error('EXTERNAL_SKILL_DRIFT_DETECTED: approval/curator control changed');const observations=[];for(const item of registry.files){const actual=sha(await readFile(item.filePath));observations.push({filePath:item.filePath,expected:item.approvedBaselineSha256,actual,status:actual===item.approvedBaselineSha256?'IN_SYNC':'DRIFT'});if(actual!==item.approvedBaselineSha256)throw new Error(`EXTERNAL_SKILL_DRIFT_DETECTED: ${item.filePath}`);}return {ok:true,writeApprovalEnabled:true,curatorEnabled:false,observations};}
if(process.argv.includes('--self-test')){const root=await mkdtemp(join(tmpdir(),'external-skill-drift-'));try{const skill=join(root,'SKILL.md');const cfg=join(root,'config.yaml');await writeFile(skill,'stable\n');await writeFile(cfg,'skills:\n  write_approval: true\ncurator:\n  enabled: false\n');const reg=join(root,'registry.json');await writeFile(reg,JSON.stringify({files:[{filePath:skill,approvedBaselineSha256:sha(Buffer.from('stable\n'))}]}));const oldHome=process.env.HERMES_HOME;process.env.HERMES_HOME=root;assert.equal((await verifyExternalSkillRegistry(reg)).ok,true);await writeFile(skill,'drift\n');await assert.rejects(verifyExternalSkillRegistry(reg),/EXTERNAL_SKILL_DRIFT_DETECTED/);if(oldHome)process.env.HERMES_HOME=oldHome;else delete process.env.HERMES_HOME;console.log(JSON.stringify({ok:true,module:'EXTERNAL-SKILL-DRIFT-GATE-001',temporaryCopiesOnly:true,realSkillsUntouched:true}));}finally{await rm(root,{recursive:true,force:true});}}
else console.log(JSON.stringify(await verifyExternalSkillRegistry(),null,2));
