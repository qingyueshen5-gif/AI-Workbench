import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { runtimeRoot } from '../runtime-paths.mjs';

const defaultRoot = process.env.AIW_TASK_STORE_DIR || join(runtimeRoot, 'feishu-workbench-bridge', 'tasks');
const key = (id) => createHash('sha256').update(String(id || 'unknown')).digest('hex').slice(0, 40);
const locks = new Map();
async function exclusive(id, operation) {
  const previous = locks.get(id) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  locks.set(id, current);
  await previous;
  try { return await operation(); }
  finally { release(); if (locks.get(id) === current) locks.delete(id); }
}
export const TASK_STATES = Object.freeze(['accepted','interpreting','scheduling','ready','executing','verifying','paused','completed','waiting_for_clarification','waiting_for_confirmation','capability_unavailable','failed','cancelled']);
export const TERMINAL_TASK_STATES = new Set(['completed','capability_unavailable','failed','cancelled']);
export const RUN_STATES = Object.freeze(['created','starting','running','verifying','completed','failed','cancelled','superseded']);
export const TERMINAL_RUN_STATES = new Set(['completed','failed','cancelled','superseded']);
const allowed = new Map([
  ['accepted',new Set(['interpreting','paused','cancelled','failed'])],
  ['interpreting',new Set(['scheduling','waiting_for_clarification','paused','failed','cancelled'])],
  ['waiting_for_clarification',new Set(['interpreting','paused','cancelled','failed'])],
  ['scheduling',new Set(['ready','waiting_for_confirmation','capability_unavailable','paused','failed','cancelled'])],
  ['waiting_for_confirmation',new Set(['ready','paused','cancelled','failed'])],
  ['ready',new Set(['executing','verifying','completed','paused','failed','cancelled'])],
  ['executing',new Set(['verifying','paused','failed','cancelled'])],
  ['verifying',new Set(['completed','paused','failed','cancelled'])],
  ['paused',new Set(['interpreting','scheduling','ready','executing','verifying','cancelled','failed'])],
  ['completed',new Set()],['capability_unavailable',new Set()],['failed',new Set()],['cancelled',new Set()]
]);
function now() { return Date.now(); }
function required(value,name){const text=String(value||'').trim();if(!text)throw new Error(`${name} is required`);return text;}
function taskRevision(task){return Number.isInteger(task?.taskRevision)&&task.taskRevision>=0?task.taskRevision:0;}
function normalizeTask(task){return task?{...task,taskRevision:taskRevision(task),activeRunId:task.activeRunId||null,runs:Array.isArray(task.runs)?task.runs:[]}:task;}
export class TaskStore {
  constructor(options={}){this.root=options.root||defaultRoot;this.now=options.now||now;this.newRunId=options.newRunId||(()=>randomUUID());}
  path(taskId){return join(this.root,`${key(required(taskId,'taskId'))}.json`);}
  async load(taskId){try{return normalizeTask(JSON.parse(await fs.readFile(this.path(taskId),'utf8')));}catch{return null;}}
  async findByOriginalMessageId(originalMessageId){const wanted=required(originalMessageId,'originalMessageId');return (await this.list()).find((task)=>task.originalMessageId===wanted)||null;}
  async save(task){required(task?.taskId,'taskId');const path=this.path(task.taskId);await fs.mkdir(dirname(path),{recursive:true});const tmp=`${path}.${process.pid}.${this.now()}.tmp`;await fs.writeFile(tmp,`${JSON.stringify(task,null,2)}\n`,'utf8');await fs.rename(tmp,path);return task;}
  async create(job){const taskId=required(job.taskId||job.messageId,'taskId');const originalMessageId=required(job.originalMessageId||job.messageId,'originalMessageId');const existing=await this.load(taskId);if(existing){if(existing.originalMessageId!==originalMessageId)throw new Error(`Task ${taskId} already belongs to originalMessageId ${existing.originalMessageId}`);return existing;}const byOriginal=await this.findByOriginalMessageId(originalMessageId);if(byOriginal&&byOriginal.taskId!==taskId)throw new Error(`originalMessageId ${originalMessageId} already belongs to task ${byOriginal.taskId}`);const at=this.now();const task={taskId,originalMessageId,conversationId:required(job.conversationId||job.chatId,'conversationId'),parentTaskId:String(job.parentTaskId||''),taskRevision:0,activeRunId:null,runs:[],interpretation:null,schedulerAssignment:null,providerExecution:null,verification:null,finalResult:null,failure:null,currentState:'accepted',stateReason:'message_accepted',waitingFor:null,cancelledByUser:false,evidence:[{type:'accepted',messageId:originalMessageId,at}],createdAt:at,updatedAt:at,terminalAt:null,stateHistory:[{from:null,to:'accepted',reason:'message_accepted',actor:'gateway',evidence:{messageId:originalMessageId},timestamp:at}]};return this.save(task);}
  async patch(taskId,patch){return exclusive(`${this.root}:${taskId}`,async()=>{const task=await this.load(taskId);if(!task)throw new Error(`Task not found: ${taskId}`);for(const forbidden of ['currentState','stateReason','terminalAt','stateHistory','taskRevision','activeRunId','runs'])if(Object.hasOwn(patch,forbidden))throw new Error(`Task protected field requires dedicated operation: ${forbidden}`);if(Object.hasOwn(patch,'originalMessageId')&&patch.originalMessageId!==task.originalMessageId)throw new Error('originalMessageId is immutable');return this.save({...task,...patch,taskId,originalMessageId:task.originalMessageId,taskRevision:task.taskRevision+1,updatedAt:this.now()});});}
  async startRun(taskId,{expectedTaskRevision,leaseOwner,providerId}={}){return exclusive(`${this.root}:${taskId}`,async()=>{const task=await this.load(taskId);if(!task)throw new Error(`Task not found: ${taskId}`);if(TERMINAL_TASK_STATES.has(task.currentState))throw new Error(`Cannot start Run for terminal Task: ${task.currentState}`);if(!Number.isInteger(expectedTaskRevision)||expectedTaskRevision<0)throw new Error('expectedTaskRevision is required');if(task.taskRevision!==expectedTaskRevision)throw new Error(`Task revision conflict: expected ${expectedTaskRevision}, actual ${task.taskRevision}`);const active=task.activeRunId?task.runs.find((run)=>run.runId===task.activeRunId):null;if(active&&!TERMINAL_RUN_STATES.has(active.status))throw new Error(`Task already has active Run: ${active.runId}`);const at=this.now();const nextRevision=task.taskRevision+1;const runId=required(this.newRunId(),'runId');const attempt=Math.max(0,...task.runs.map((run)=>Number(run.attempt)||0))+1;const run={runId,taskId:task.taskId,originalMessageId:task.originalMessageId,attempt,leaseOwner:required(leaseOwner,'leaseOwner'),providerId:required(providerId,'providerId'),taskRevision:nextRevision,status:'created',createdAt:at,startedAt:null,heartbeatAt:at,finishedAt:null,progress:[],verification:null,finalEvidence:null,failureReason:null,supersededByRunId:null};const next={...task,taskRevision:nextRevision,activeRunId:runId,runs:[...task.runs,run],updatedAt:at,evidence:[...(task.evidence||[]),{type:'run_started',runId,attempt,taskRevision:nextRevision,leaseOwner:run.leaseOwner,providerId:run.providerId,at}]};return this.save(next);});}
  async transitionTask(taskId,from,to,reason,actor,evidence){return exclusive(`${this.root}:${taskId}`,async()=>{const task=await this.load(taskId);if(!task)throw new Error(`Task not found: ${taskId}`);if(task.currentState!==from)throw new Error(`Task state conflict: expected ${from}, actual ${task.currentState}`);if(!TASK_STATES.includes(to)||!allowed.get(from)?.has(to))throw new Error(`Illegal task transition: ${from} -> ${to}`);required(reason,'reason');required(actor,'actor');if(evidence===undefined||evidence===null)throw new Error('transition evidence is required');const at=this.now();const next={...task,taskRevision:task.taskRevision+1,currentState:to,stateReason:reason,updatedAt:at,terminalAt:TERMINAL_TASK_STATES.has(to)?at:null,stateHistory:[...(task.stateHistory||[]),{from,to,reason,actor,evidence,timestamp:at}],evidence:[...(task.evidence||[]),{type:'state_transition',from,to,reason,actor,evidence,at}]};return this.save(next);});}
  async list(){await fs.mkdir(this.root,{recursive:true});const out=[];for(const name of(await fs.readdir(this.root)).filter(x=>x.endsWith('.json'))){try{out.push(normalizeTask(JSON.parse(await fs.readFile(join(this.root,name),'utf8'))));}catch{}}return out;}
  async listConversation(conversationId){return (await this.list()).filter(x=>x.conversationId===conversationId).sort((a,b)=>a.createdAt-b.createdAt);}
  async latestNonTerminal(conversationId){const items=(await this.listConversation(conversationId)).filter(x=>!TERMINAL_TASK_STATES.has(x.currentState));return items.at(-1)||null;}
}
export async function transitionTask(store,taskId,from,to,reason,actor,evidence){return store.transitionTask(taskId,from,to,reason,actor,evidence);}
