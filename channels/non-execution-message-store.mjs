import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { runtimeRoot } from '../runtime-paths.mjs';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const nowIso=()=>new Date().toISOString();
async function readJson(path){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function writeAtomic(path,value){await fs.mkdir(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;await fs.writeFile(temp,`${JSON.stringify(value,null,2)}\n`,'utf8');await fs.rename(temp,path);}

export function nonExecutionIdentity(job={}){
  const stableMessageId=String(job.originalMessageId||job.messageId||'').trim();
  if(!stableMessageId)throw new Error('stable message id is required');
  const channel=String(job.channel||job.platform||'feishu');
  const userId=String(job.openId||job.userId||'anonymous');
  const key=createHash('sha256').update(`${channel}\0${userId}\0${stableMessageId}`).digest('hex');
  return {key,channel,userId,messageId:String(job.messageId||stableMessageId),originalMessageId:String(job.originalMessageId||''),stableMessageId};
}

export class NonExecutionMessageStore{
  constructor(options={}){this.root=options.root||join(runtimeRoot,'non-execution-idempotency');this.claimTtlMs=Number(options.claimTtlMs??30000);this.waitMs=Number(options.waitMs??10000);this.pollMs=Number(options.pollMs??10);this.now=options.now||(()=>Date.now());}
  paths(key){return {claim:join(this.root,'claims',`${key}.json`),result:join(this.root,'results',`${key}.json`),failed:join(this.root,'failed',`${key}.json`),archive:join(this.root,'archive',`${key}`)};}
  async result(key){return readJson(this.paths(key).result);}
  async state(key){const result=await this.result(key);if(result)return {status:'COMPLETED',result};const failed=await readJson(this.paths(key).failed);if(failed)return {status:'FAILED',failure:failed};const claim=await readJson(this.paths(key).claim);return claim?{status:'CLAIMED',claim}:{status:'NOT_FOUND'};}
  async claim(identity,decision,metadata={}){
    const paths=this.paths(identity.key);await fs.mkdir(dirname(paths.claim),{recursive:true});
    const existingResult=await this.result(identity.key);if(existingResult)return {acquired:false,status:'COMPLETED',result:existingResult};
    const failed=await readJson(paths.failed);if(failed)return {acquired:false,status:'FAILED',failure:failed};
    const ownerId=metadata.ownerId||randomUUID();const now=this.now();const record={status:'CLAIMED',...identity,ownerId,decision,claimedAt:now,renewedAt:now,expiresAt:now+this.claimTtlMs,createdAt:nowIso()};
    try{const handle=await fs.open(paths.claim,'wx');try{await handle.writeFile(`${JSON.stringify(record,null,2)}\n`,'utf8');await handle.sync();}finally{await handle.close();}return {acquired:true,status:'CLAIMED',claim:record};}
    catch(error){if(error.code!=='EEXIST')throw error;}
    const current=await readJson(paths.claim);if(current&&Number(current.expiresAt||0)>this.now())return {acquired:false,status:'CLAIMED',claim:current};
    if(current){await fs.mkdir(paths.archive,{recursive:true});try{await fs.rename(paths.claim,join(paths.archive,`${current.ownerId||'unknown'}.${this.now()}.expired.json`));}catch(error){if(error.code!=='ENOENT')throw error;}}
    return this.claim(identity,decision,metadata);
  }
  async waitForResult(key){const deadline=this.now()+this.waitMs;while(this.now()<=deadline){const state=await this.state(key);if(state.status!=='CLAIMED')return state;await sleep(this.pollMs);}return this.state(key);}
  async complete(identity,ownerId,result,metadata={}){const paths=this.paths(identity.key);const claim=await readJson(paths.claim);if(!claim||claim.ownerId!==ownerId)throw new Error('non-execution claim owner mismatch');const record={status:'COMPLETED',...identity,decision:claim.decision,result,deliveryKey:metadata.deliveryKey||'',completedAt:this.now(),createdAt:claim.createdAt};await writeAtomic(paths.result,record);await fs.rm(paths.claim,{force:true});return record;}
  async fail(identity,ownerId,error){const paths=this.paths(identity.key);const claim=await readJson(paths.claim);if(claim&&claim.ownerId!==ownerId)throw new Error('non-execution claim owner mismatch');const record={status:'FAILED',...identity,decision:claim?.decision||'',failureReason:error?.message||String(error),failedAt:this.now()};await writeAtomic(paths.failed,record);await fs.rm(paths.claim,{force:true});return record;}
}
