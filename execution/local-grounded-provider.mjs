import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function snapshot(path){const [content,stat]=await Promise.all([fs.readFile(path),fs.stat(path)]);return {size:stat.size,mtimeMs:stat.mtimeMs,sha256:createHash('sha256').update(content).digest('hex'),content};}

export class LocalGroundedProvider {
  constructor(options={}){this.readState=options.readState||null;this.toolExecutor=options.toolExecutor||null;}
  async status(context={}){
    const live=await this.readState?.(context);
    const sources=Array.isArray(live?.evidenceSources)?live.evidenceSources.filter((item)=>item?.read===true&&item?.readAt):[];
    if(live?.ok!==true||!String(live?.text||'').trim()||sources.length===0){
      return {ok:false,reason:'未能读取可验证的Runtime状态来源，因此无法确认当前运行状态。没有把推测内容当成真实结果。',text:'',evidence:{evidenceSources:sources},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
    }
    const readAt=Math.max(...sources.map((item)=>Number(item.readAt)||0));
    return {ok:true,text:String(live.text),evidence:{readAt,evidenceSources:sources,evidenceReferences:sources.map((item)=>`${item.sourceType}:${item.sourceId}@${item.readAt}`)},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  }
  async read(context={}){
    const before=await snapshot(context.path);
    const content=before.content.toString('utf8');
    const after=await snapshot(context.path);
    return {ok:true,content,evidence:{path:context.path,before:{size:before.size,mtimeMs:before.mtimeMs,sha256:before.sha256},after:{size:after.size,mtimeMs:after.mtimeMs,sha256:after.sha256},size:after.size,mtimeMs:after.mtimeMs,sha256:after.sha256,readAt:Date.now()},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  }
}
