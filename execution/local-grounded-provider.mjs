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
    if(!this.toolExecutor)throw new Error('file.read受限读取边界未连接');
    let verification;
    try{verification=await this.toolExecutor.execute(context.taskId||context.runId||'file-read',{type:'read_file',path:context.path});}
    catch(error){const failure=new Error('拒绝读取：解析后的文件位置不在允许的读取范围内，没有执行文件读取。');failure.code='FILE_READ_BOUNDARY_REJECTED';throw failure;}
    const item=(verification?.results||[]).find((entry)=>entry?.type==='read_file')||verification;
    if(!item?.path||typeof item.content!=='string')throw new Error('file.read受限读取未返回文件证据');
    const before={size:item.size,mtimeMs:item.mtimeMs,sha256:item.sha256};
    const after={size:item.currentSize??item.size,mtimeMs:item.currentMtimeMs??item.mtimeMs,sha256:item.currentSha256??item.sha256};
    return {ok:true,content:item.content,evidence:{path:item.path,before,after,size:after.size,mtimeMs:after.mtimeMs,sha256:after.sha256,readAt:Date.now(),evidenceReferences:[`file:${item.path}#sha256:${after.sha256}`]},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  }
}
