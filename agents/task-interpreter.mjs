import { stripInterpretationAuthorization } from '../capabilities/authorization-context.mjs';

const taskSchema = {
  required: ['taskType','goal','actions','targets','context','constraints','riskLevel','requiredCapabilities','successCriteria','requiresConfirmation','confidence']
};
const allowedRisk = new Set(['low','medium','high']);
const allowedTaskTypes = new Set(['chat','computer_operation','file_operation','information_research','code_task','media_creation','commerce','system_diagnosis','clarification']);
const interpreterPrompt = `你是通用Task Interpreter，只做结构化任务理解，不选择Provider、不执行任务、不生成完成结果。
输出严格JSON对象，字段：taskType,goal,actions,targets,context,constraints,riskLevel,requiredCapabilities,successCriteria,requiresConfirmation,confidence。
actions/targets/constraints/requiredCapabilities/successCriteria必须为数组；confidence为0到1。
理解用户最终目标、隐含动作、上下文承接和多步骤目标。能力使用抽象ID，例如conversation,file.read,file.write,file.manage,process.list,process.stop,computer.control,commerce.order,commerce.payment,media.video.create,web.research,code.read,code.modify,code.execute,system.diagnose。
低置信度时taskType=clarification，actions为空，successCriteria说明需澄清内容。高风险、付款、不可逆删除、批量系统操作必须requiresConfirmation=true。
不得因为当前可能缺少工具而拒绝，不得输出Provider名，不得声称任务已经完成。`;
function parseJson(text) { return JSON.parse(String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
function correctionPrompt(error, originalText) { return `上一次Task Interpreter输出不符合契约：${error.message}。请只纠正JSON结构；普通问候、闲聊、问答必须使用taskType=chat。原始用户消息：${originalText}`; }
export function validateTaskInterpretation(input) {
  const value=stripInterpretationAuthorization(input);
  for (const key of taskSchema.required) if (!(key in (value||{}))) throw new Error(`Task Interpreter缺少字段 ${key}`);
  if (!allowedTaskTypes.has(value.taskType)) throw new Error('Task Interpreter taskType无效');
  for (const key of ['actions','targets','constraints','requiredCapabilities','successCriteria']) if (!Array.isArray(value[key])) throw new Error(`Task Interpreter ${key}必须为数组`);
  if (!allowedRisk.has(value.riskLevel)) throw new Error('Task Interpreter riskLevel无效');
  if (typeof value.requiresConfirmation!=='boolean') throw new Error('Task Interpreter requiresConfirmation必须为布尔值');
  if (typeof value.confidence!=='number'||value.confidence<0||value.confidence>1) throw new Error('Task Interpreter confidence无效');
  if (typeof value.goal!=='string'||!value.goal.trim()) throw new Error('Task Interpreter goal为空');
  if (typeof value.context!=='object'||Array.isArray(value.context)||!value.context) throw new Error('Task Interpreter context必须为对象');
  if (value.taskType==='clarification') {
    const missingFields=value.context?.missingFields;
    const questions=value.context?.questions;
    if(!Array.isArray(missingFields)||!missingFields.length) throw new Error('澄清缺少missingFields证据');
    if(!Array.isArray(questions)||!questions.length) throw new Error('澄清缺少questions证据');
    if(value.confidence>=0.65) throw new Error('澄清任务置信度必须低于0.65');
  } else if (value.confidence<0.65) throw new Error('低置信度任务必须提供结构化澄清证据');
  if (value.riskLevel==='high'&&!value.requiresConfirmation) throw new Error('高风险任务必须确认');
  return value;
}
export class TaskInterpreter {
  constructor(options={}) { this.model=options.model; if(!this.model?.understand) throw new Error('TaskInterpreter需要结构化理解模型'); }
  async interpret({text,conversationContext=[],environmentContext={}}) {
    const messages=[{role:'system',content:interpreterPrompt},{role:'user',content:JSON.stringify({userMessage:String(text||''),conversationContext,environmentContext})}];
    let firstError;
    try {
      const result=await this.model.understand({messages,responseFormat:{type:'json_object'}});
      return validateTaskInterpretation(parseJson(result.text));
    } catch(error) { firstError=error; }
    try {
      const corrected=await this.model.understand({messages:[...messages,{role:'user',content:correctionPrompt(firstError,String(text||''))}],responseFormat:{type:'json_object'}});
      return validateTaskInterpretation(parseJson(corrected.text));
    } catch(error) {
      const finalError=new Error(`Task Interpreter输出在受限纠正后仍无效：${error.message}`);
      finalError.name='TaskInterpretationError';
      finalError.cause=firstError;
      throw finalError;
    }
  }
}
export { interpreterPrompt };
