import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const protectedNames = new Set(['node.exe','electron.exe','ai-workbench.exe','git.exe','bash.exe','conhost.exe','explorer.exe','lark.exe','feishu.exe']);
function parseCsv(line) { const values=[]; let value=''; let quoted=false; for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){values.push(value);value='';}else value+=ch;}values.push(value);return values; }
export class LocalProcessProvider {
  constructor(options={}) {
    this.listCommand=options.listCommand||(async()=>{const {stdout}=await run('tasklist.exe',['/FO','CSV','/NH'],{windowsHide:true});return stdout;});
    this.stopCommand=options.stopCommand||(async(pid)=>run('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true}));
    this.currentPid=Number(options.currentPid||process.pid);
    this.protectedPids=new Set((options.protectedPids||[]).map(Number));
  }
  async list() { const output=await this.listCommand(); return String(output).split(/\r?\n/).filter(Boolean).map((line)=>{const row=parseCsv(line);return{name:row[0],pid:Number(row[1]),sessionName:row[2],sessionNumber:Number(row[3]),memory:row[4]};}).filter((item)=>item.name&&Number.isInteger(item.pid)); }
  isProtected(item) { return item.pid===this.currentPid||this.protectedPids.has(item.pid)||protectedNames.has(item.name.toLowerCase()); }
  async resolveTarget({pid,exactName}) {
    const processes=await this.list();
    if(pid){const match=processes.find((item)=>item.pid===Number(pid));return{processes,match:match||null,reason:match?'exact_pid':'target_not_found'};}
    if(!exactName) return{processes,match:null,reason:'exact_target_required'};
    const matches=processes.filter((item)=>item.name.toLowerCase()===String(exactName).toLowerCase());
    if(matches.length===0)return{processes,match:null,reason:'target_not_found'};
    if(matches.length>1)return{processes,match:null,reason:'ambiguous_multiple_exact_matches',matches};
    return{processes,match:matches[0],reason:'unique_exact_name'};
  }
  async stop({pid,exactName}) {
    const resolved=await this.resolveTarget({pid,exactName});
    if(!resolved.match)return{ok:false,...resolved};
    if(this.isProtected(resolved.match))return{ok:false,reason:'protected_process',target:resolved.match};
    await this.stopCommand(resolved.match.pid);
    const after=await this.list();
    const remaining=after.find((item)=>item.pid===resolved.match.pid)||null;
    return{ok:!remaining,reason:remaining?'verification_failed':'stopped_and_verified',target:resolved.match,stopped:remaining?null:resolved.match,remaining,verification:{method:'post_stop_process_list',pidAbsent:!remaining}};
  }
}
