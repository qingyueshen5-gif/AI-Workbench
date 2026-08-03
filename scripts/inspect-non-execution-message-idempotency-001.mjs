import assert from 'node:assert/strict';
import { AgentRuntime } from '../agents/agent-runtime.mjs';
import { ContractSessionStore } from './runtime-dependency-contract-fixtures.mjs';

const cases=[
  {name:'respond',text:'你好',decision:'respond'},
  {name:'clarify',text:'读取文件',decision:'clarify'},
  {name:'unsupported',text:'创建视频',decision:'unsupported'}
];
const observations=[];
for(const scenario of cases){
  const sessions=new ContractSessionStore();
  const runtime=new AgentRuntime({sessions,tasks:{async load(){return null;}},models:{async understand(){throw new Error('model forbidden')},async express(){throw new Error('model forbidden')},async execute(){throw new Error('model forbidden')}},activeController:{async handle(){return {intercepted:false,classification:{kind:'new_task'}};}}});
  const job={messageId:`non-exec-${scenario.name}`,originalMessageId:`non-exec-${scenario.name}`,conversationId:`c-${scenario.name}`,chatId:`c-${scenario.name}`,text:scenario.text};
  const first=await runtime.handle(job);const second=await runtime.handle(job);const history=await sessions.history(job.conversationId);
  const assistantReplies=history.filter((item)=>item.role==='assistant').length;
  observations.push({name:scenario.name,expectedDecision:scenario.decision,firstDecision:first.adapterResult?.decision,secondDecision:second.adapterResult?.decision,assistantReplies,duplicateAssistantReplies:Math.max(0,assistantReplies-1),firstReplayed:first.replayed??null,secondReplayed:second.replayed??null,taskCreates:first.metrics?.taskCreates??0,runCreates:first.metrics?.runCreates??0,providerCalls:first.metrics?.providerCalls??0,modelCalls:first.metrics?.modelCalls??0});
  assert.equal(first.adapterResult?.decision,scenario.decision);
  assert.equal(second.adapterResult?.decision,scenario.decision);
}
const defect=observations.some((item)=>item.duplicateAssistantReplies>0);
console.log(JSON.stringify({ok:true,module:'NON-EXECUTION-MESSAGE-IDEMPOTENCY-READONLY',classification:defect?'NON_EXECUTION_MESSAGE_IDEMPOTENCY_DEFECT':'CURRENTLY_IDEMPOTENT',case:defect?2:1,observations},null,2));
