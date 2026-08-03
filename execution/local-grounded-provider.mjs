import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function snapshot(path){const [content,stat]=await Promise.all([fs.readFile(path),fs.stat(path)]);return {size:stat.size,mtimeMs:stat.mtimeMs,sha256:createHash('sha256').update(content).digest('hex'),content};}

export class LocalGroundedProvider {
  constructor(options={}){this.readState=options.readState||null;}
  async status(context={}){
    const live=await this.readState?.(context);
    const text=String(live?.text||live?.status||'No live status evidence is available.');
    return {ok:true,text,evidence:{readAt:Date.now(),source:live?.source||'live-runtime-state'},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  }
  async read(context={}){
    const before=await snapshot(context.path);
    const content=before.content.toString('utf8');
    const after=await snapshot(context.path);
    return {ok:true,content,evidence:{path:context.path,before:{size:before.size,mtimeMs:before.mtimeMs,sha256:before.sha256},after:{size:after.size,mtimeMs:after.mtimeMs,sha256:after.sha256},size:after.size,mtimeMs:after.mtimeMs,sha256:after.sha256,readAt:Date.now()},identity:{taskId:context.taskId,runId:context.runId,taskRevision:context.taskRevision}};
  }
}
