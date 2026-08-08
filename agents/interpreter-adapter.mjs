import { validateGroundTruth } from './original-ground-truth-extractor.mjs';
import { makeAdapterResult, sanitizeSemanticCandidate, validateAdapterInput } from './interpreter-adapter-contract.mjs';

const greeting=/^(?:你好|您好|在吗|早上好|上午好|下午好|晚上好|hello|hi|hey|嗨)[！!。.，,\s]*$/iu;
const unresolvedConversationReference=/^(?:请)?帮我分析(?:一下)?(?:这个|那个)问题[！!。.，,\s]*$/iu;
const runtimeStatus=/(?:runtime|运行时|系统).*(?:状态|怎么样|正常|检查|查看|运行状态)|(?:状态|检查|查看|运行状态).*(?:runtime|运行时|系统)/iu;
const readAction=/(?:读取|读取内容|读一下|读下|帮我读|帮我看|只读|查看|查看内容|看一下|看下|看看|打开并读取|打开看|打开看看|瞅一下|瞧一下|\bread\b|\bopen\b)/iu;
const fileObject=/(?:文件|文档|文本|内容|完整路径|[\w.-]+\.[A-Za-z0-9]{1,12})(?:\b|$)/iu;
const actionFragment=/(?:读取|读一下|读下|帮我读|帮我看|查看|看一下|看下|看看|打开|瞅一下|瞧一下|检查|检测|确认|处理|执行|运行|测试|构建|停止|结束|控制|创建|生成|修改|修复|分析|浏览|审阅|核对|inspect|check|read|open|run|test|stop|create|modify)/iu;
const strongCompoundConnector=/(?:然后|接着|并且|以及|同时|顺便|另外|还要|之后再|，\s*之后|，\s*接着|,\s*then|\band\b)/iu;
const explicitSequence=/(?:先[^，。；,;]+?(?:再|然后|后)[^，。；,;]+|做完[^，。；,;]+?再[^，。；,;]+)/iu;
const unsupportedRules=[
  {id:'file.write',pattern:/(?:写入|新建|创建|保存|改写|修改).*(?:文件|文档)|file\.(?:write|manage)/iu,label:'写入或管理文件'},
  {id:'computer.control',pattern:/(?:控制|操作).*(?:电脑|鼠标|键盘|桌面)|computer\.control/iu,label:'控制电脑'},
  {id:'commerce',pattern:/(?:支付|购买|下单|订单|付款|资金|commerce\.)/iu,label:'支付、购买或订单操作'},
  {id:'media.video.create',pattern:/(?:生成|制作|创建).*(?:视频)|media\.video\.create/iu,label:'创建视频'},
  {id:'web.research',pattern:/(?:网页研究|网络调研|上网搜索|web\.research)/iu,label:'执行网络研究'},
  {id:'system.diagnose',pattern:/(?:系统诊断|修复系统|system\.diagnose)/iu,label:'执行系统诊断'},
  {id:'code.read',pattern:/(?:读取|审查|分析).*(?:代码|源码)|code\.read/iu,label:'读取或分析代码'},
  {id:'code.execute',pattern:/(?:执行|运行|测试|构建|调试).*(?:代码|命令|脚本)|code\.execute/iu,label:'执行代码或命令'},
  {id:'code.modify',pattern:/(?:修改|修复|编写|重构).*(?:代码|源码)|code\.modify/iu,label:'修改代码'},
  {id:'process.list',pattern:/(?:列出|查看|查找).*(?:进程)|process\.list/iu,label:'查看进程'},
  {id:'process.stop',pattern:/(?:停止|结束|关闭|杀掉).*(?:进程|程序)|process\.stop/iu,label:'停止进程'},
  {id:'conversation',pattern:/conversation(?:\.respond)?/iu,label:'调用会话执行能力'}
];
const riskRules=[
  ['financial_operation',/(?:支付|购买|下单|订单|付款|资金)/u],
  ['destructive_file_operation',/(?:删除|覆盖|格式化|清空)/u],
  ['external_communication',/(?:对外|发布|发送|群发|公开)/u],
  ['credential_or_permission',/(?:凭据|密码|密钥|账号|账户|权限|授权)/u],
  ['code_execution_or_modification',/(?:执行|运行|修改|修复|编写|重构).*(?:代码|命令|脚本)/u],
  ['process_stop',/(?:停止|结束|关闭|杀掉).*(?:进程|程序)/u],
  ['device_control',/(?:控制|操作).*(?:电脑|设备|鼠标|键盘)/u],
  ['irreversible_operation',/(?:不可逆|永久|彻底删除|无法恢复)/u]
];

function pathFacts(groundTruth){return groundTruth.facts.filter((item)=>item.type==='windows_path'||item.type==='unc_path');}
function filenameFacts(groundTruth){return groundTruth.facts.filter((item)=>item.type==='filename');}
function riskSignals(text){return riskRules.filter(([,pattern])=>pattern.test(text)).map(([id])=>id);}
function sourceValues(items){return items.map((item)=>item.raw);}
function baseTask({taskType,goal,actions,targets,constraints,requiredCapabilities,successCriteria,context={}}){return {taskType,goal,actions,targets,context,constraints,riskLevel:'low',requiredCapabilities,successCriteria,requiresConfirmation:false,confidence:1};}
function conversationGoal(text){return `自然语言回答用户请求：${text.trim()}`;}
function conversationConstraints(groundTruth){return sourceValues(groundTruth.constraints);}
function conversationSuccessCriteria(text,groundTruth){
  const extracted=sourceValues(groundTruth.successCriteria);
  return extracted.length?extracted:[`生成直接回应用户请求的非空自然语言结果：${text.trim()}`];
}
function hasFileReadIntent(text,groundTruth){
  const hasObject=fileObject.test(text)||pathFacts(groundTruth).length>0||filenameFacts(groundTruth).length>0;
  return hasObject&&readAction.test(text);
}
function compoundStructure(text){
  if(explicitSequence.test(text))return true;
  const match=strongCompoundConnector.exec(text);
  if(!match)return false;
  const before=text.slice(0,match.index).trim();
  const after=text.slice(match.index+match[0].length).trim();
  return Boolean(before&&after&&actionFragment.test(before)&&actionFragment.test(after));
}

export class InterpreterAdapter{
  adapt(input){
    const {originalText,groundTruth,semanticCandidate}=validateAdapterInput(input);
    validateGroundTruth(groundTruth);
    const cleaned=sanitizeSemanticCandidate(semanticCandidate);
    const signals=riskSignals(originalText);
    const paths=pathFacts(groundTruth);
    const hasRuntime=runtimeStatus.test(originalText);
    const hasRead=hasFileReadIntent(originalText,groundTruth);
    const independent=[hasRead?'读取文件':'',hasRuntime?'检查Runtime状态':''].filter(Boolean);
    const compound=compoundStructure(originalText);
    if(!originalText.trim())return makeAdapterResult({decision:'clarify',response:{renderer:'deterministic-v1',text:'我还没有收到可处理的内容。请告诉我你希望我回答或处理什么。'},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,missingFields:['userMessage'],questions:['请提供你希望我回答或处理的具体内容。'],recognizedIntents:['invalid_empty_input']});
    if(compound){
      const complete=independent.length>1;
      const detail=complete?`我识别到多个任务：${independent.join('、')}。`:'当前消息可能包含多个任务，我可能没有完整识别另一部分要求。';
      return makeAdapterResult({decision:'clarify',response:{renderer:'deterministic-v1',text:`${detail}当前版本一次只执行一个任务，尚未启动任何操作。请指定先执行哪一个，或拆成两条消息发送。`},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,missingFields:['selectedIntent'],questions:['当前消息可能包含多个任务；请指定先执行哪一个，或拆成两条消息发送。'],recognizedIntents:independent});
    }
    const unsupported=unsupportedRules.find((rule)=>rule.pattern.test(originalText));
    if(unsupported)return makeAdapterResult({decision:'unsupported',response:{renderer:'deterministic-v1',text:`我理解你希望${unsupported.label}，但当前版本还没有开放能够安全执行该目标的能力，因此没有启动任何操作。目前可以检查Runtime状态，或只读读取你明确提供路径的文件。`},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,recognizedIntents:[unsupported.id]});
    if(hasRuntime){
      const taskDraft=baseTask({taskType:'system_diagnosis',goal:'检查Runtime状态',actions:['status'],targets:[{type:'runtime',name:'Runtime'}],context:{source:'interpreter-adapter-v1'},constraints:sourceValues(groundTruth.constraints),requiredCapabilities:['runtime.status'],successCriteria:['返回当前Runtime状态及可验证证据']});
      return makeAdapterResult({decision:'execute',taskDraft,response:null,riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,recognizedIntents:['runtime.status']});
    }
    if(hasRead){
      if(paths.length!==1)return makeAdapterResult({decision:'clarify',response:{renderer:'deterministic-v1',text:paths.length===0?'我可以帮你只读查看文件，但还缺少明确的文件路径。请把完整路径发给我。':'我识别到多个文件路径，不能擅自选择。请明确要先读取哪个完整路径。'},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,missingFields:[paths.length===0?'path':'selectedPath'],questions:[paths.length===0?'请提供要读取文件的完整路径。':'请指定要读取的一个完整路径。'],recognizedIntents:['file.read']});
      const path=paths[0].raw;
      const taskDraft=baseTask({taskType:'file_operation',goal:`只读读取 ${path}`,actions:['read'],targets:[{type:'file',path,sourceSpan:{start:paths[0].start,end:paths[0].end,raw:path}}],context:{source:'interpreter-adapter-v1'},constraints:[...sourceValues(groundTruth.constraints),'read_only'],requiredCapabilities:['file.read'],successCriteria:['返回文件内容及读取证据','文件内容、大小和修改时间保持不变']});
      return makeAdapterResult({decision:'execute',taskDraft,response:null,riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,recognizedIntents:['file.read']});
    }
    if(greeting.test(originalText.trim()))return makeAdapterResult({decision:'respond',response:{renderer:'deterministic-v1',text:'你好，我在。你可以让我检查Runtime状态，或者只读查看你明确提供路径的文件。'},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,recognizedIntents:['greeting']});
    if(groundTruth.unresolved.length||unresolvedConversationReference.test(originalText.trim()))return makeAdapterResult({decision:'clarify',response:{renderer:'deterministic-v1',text:'我还缺少完成回答所需的明确对象或上下文。请补充你希望我分析或处理的具体内容。'},riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,missingFields:['conversationContext'],questions:['请补充需要分析或处理的具体对象或上下文。'],recognizedIntents:['conversation.clarification']});
    const taskDraft=baseTask({taskType:'chat',goal:conversationGoal(originalText),actions:['answer'],targets:[],context:{source:'interpreter-adapter-v1'},constraints:conversationConstraints(groundTruth),requiredCapabilities:['conversation'],successCriteria:conversationSuccessCriteria(originalText,groundTruth)});
    return makeAdapterResult({decision:'execute',taskDraft,response:null,riskSignals:signals,unresolved:groundTruth.unresolved,semanticCandidateVersion:cleaned.version,recognizedIntents:['conversation']});
  }
}
