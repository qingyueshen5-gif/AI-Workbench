import fs from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';

const root=resolve(process.argv[2]||process.cwd());
const allowedExt=new Set(['.mjs','.js','.cjs','.json','.md','.ps1','.cmd','.bat','.yaml','.yml','.toml']);
const patterns=[/[A-Z]:\\\\[^\s'"`<>|,;，。；)]*/gi,/[A-Z]:\\(?![sSbBdDwW])[^\s'"`<>|,;，。；)]*/gi,/[A-Z]:\/(?!\/)[^\s'"`<>|,;，。；)]*/gi];
const items=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules','dist'].includes(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else if(allowedExt.has(extname(entry.name).toLowerCase())){const rel=relative(root,path).replaceAll('\\','/');const lines=(await fs.readFile(path,'utf8')).split(/\r?\n/);for(let index=0;index<lines.length;index++){for(const pattern of patterns){pattern.lastIndex=0;for(const match of lines[index].matchAll(pattern)){const rawValue=match[0];let classification='UNKNOWN',action='KEEP',reason='用途无法由静态规则唯一确定';if(rel==='scripts/verify-gateway-runtime-switch.mjs'&&/aiw-gateway-switch-fixed/i.test(rawValue)){classification='TEMP_FIXTURE_PATH';action='REPLACE_WITH_OS_TMPDIR';reason='Runtime Switch测试运行时临时目录';}else if(rel.startsWith('verification/')||rel.startsWith('test-evidence/')||rel.endsWith('.md')){classification='DOCUMENTATION_OR_EVIDENCE';reason='文档或历史证据';}else if(rel.startsWith('scripts/')||rel.startsWith('tests/')||rel.includes('/tests/')){classification='INTENTIONAL_TEST_INPUT';reason='测试输入或Fixture路径样例';}else{classification='PRODUCTION_PATH';action='DO_NOT_MODIFY';reason='生产代码、配置或运行契约中的绝对路径';}items.push({file:rel,line:index+1,rawValue,classification,action,reason});}}}}}}
await walk(root);
const summary=Object.fromEntries(['TEMP_FIXTURE_PATH','INTENTIONAL_TEST_INPUT','PRODUCTION_PATH','DOCUMENTATION_OR_EVIDENCE','UNKNOWN'].map((key)=>[key,items.filter((item)=>item.classification===key).length]));
console.log(JSON.stringify({schema:'ai-workbench.drive-path-inventory/v1',repository:root,generatedAt:new Date().toISOString(),summary,items},null,2));
