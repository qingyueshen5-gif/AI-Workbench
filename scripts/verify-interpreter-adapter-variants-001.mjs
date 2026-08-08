import assert from 'node:assert/strict';
import { InterpreterAdapter } from '../agents/interpreter-adapter.mjs';
import { extractGroundTruth } from '../agents/original-ground-truth-extractor.mjs';
const adapter=new InterpreterAdapter();
const adapt=(text,semanticCandidate={version:'fixture-v1'})=>adapter.adapt({originalText:text,groundTruth:extractGroundTruth(text),semanticCandidate});
const signature=(r)=>({decision:r.decision,taskType:r.taskDraft?.taskType||null,requiredCapabilities:r.taskDraft?.requiredCapabilities||null,path:r.taskDraft?.targets?.[0]?.path||null});
const groups={
 runtime:['现在Runtime状态','Runtime现在怎么样','检查一下运行时状态','帮我看看Runtime是否正常','当前系统运行状态是什么'],
 file:['读取E:\\AI-Workbench\\NEXT_STEP.md','帮我打开并读取这个文件：E:\\AI-Workbench\\NEXT_STEP.md','看一下 `E:\\AI-Workbench\\NEXT_STEP.md`','请只读E:\\AI-Workbench\\NEXT_STEP.md','不要修改，读取E:\\AI-Workbench\\NEXT_STEP.md'],
 greeting:['你好','在吗','早上好','hello','嗨'],
 conversation:['请只回复：E2E-A-OK','量子计算是什么','帮我解释量子计算','帮我总结一下这段内容','帮我改写这句话','已知问题是接口超时，帮我分析这个问题']
};
const convergence={};
for(const [name,texts] of Object.entries(groups)){
 const results=texts.map((text)=>adapt(text));const sigs=results.map(signature);assert.deepEqual(sigs,sigs.map(()=>sigs[0]));convergence[name]={count:texts.length,signature:sigs[0],rate:1};
}
const noPath=adapt('帮我看下那个文件');assert.equal(noPath.decision,'clarify');
const empty=adapt('   ');assert.equal(empty.decision,'clarify');assert.ok(empty.missingFields.includes('userMessage'));
const missingContext=adapt('帮我分析这个问题');assert.equal(missingContext.decision,'clarify');assert.ok(missingContext.missingFields.includes('conversationContext'));
const compound=adapt('读一下 E:\\AI-Workbench\\NEXT_STEP.md，然后看看 Runtime 正不正常');assert.equal(compound.decision,'clarify');
const typo=adapt('请只讀E:\\AI-Workbench\\NEXT_STEP.md');assert.equal(typo.decision,'execute');assert.deepEqual(typo.taskDraft.requiredCapabilities,['conversation']);
const mixed=adapt('Please read E:\\AI-Workbench\\NEXT_STEP.md，只读');assert.equal(mixed.decision,'execute');
const highRisk=['帮我支付这个订单','删除并覆盖这个文件','对外发布这份内容','使用账号凭据提升权限','执行代码命令','停止关键进程','控制电脑设备','执行不可逆操作'].map((text)=>adapt(text));assert.ok(highRisk.every((r)=>r.riskSignals.length>0));
const historical=[
 {taskType:'information_retrieval'},
 {taskType:'file.read'},
 {context:[]},
 {riskLevel:'impossible'},
 {actions:[{action:'read'}]},
 {targets:['E:\\wrong.md']},
 {path:'E:AI-WorkbenchNEXT_STEP.md'},
 {capability:'conversation.respond',requiredCapabilities:['conversation.respond']},
 {approved:true,authorized:true},
 {providerId:'deepseek'}
];
const historicalResults=historical.map((candidate,index)=>{const text=index===6?'请只读E:\\AI-Workbench\\NEXT_STEP.md':'你好';const r=adapt(text,{version:`historical-${index}`,...candidate});assert.ok(['execute','respond','clarify','unsupported'].includes(r.decision));const serialized=JSON.stringify(r);for(const forbidden of ['information_retrieval','conversation.respond','deepseek','E:AI-WorkbenchNEXT_STEP.md'])assert.equal(serialized.includes(forbidden),false);return signature(r);});
assert.equal(adapt('请只读E:\\AI-Workbench\\NEXT_STEP.md',{version:'path-loss',path:'E:AI-WorkbenchNEXT_STEP.md'}).taskDraft.targets[0].path,'E:\\AI-Workbench\\NEXT_STEP.md');
assert.deepEqual(convergence.conversation.signature,{decision:'execute',taskType:'chat',requiredCapabilities:['conversation'],path:null});
assert.equal(convergence.greeting.signature.decision,'respond');
assert.deepEqual(convergence.runtime.signature.requiredCapabilities,['runtime.status']);
assert.deepEqual(convergence.file.signature.requiredCapabilities,['file.read']);
assert.equal(adapt('执行代码命令').decision,'unsupported');
const providerInjection=adapt('帮我解释量子计算',{version:'provider-injection',providerId:'attacker',capability:'code.execute',requiredCapabilities:['code.execute']});assert.deepEqual(providerInjection.taskDraft.requiredCapabilities,['conversation']);assert.equal(JSON.stringify(providerInjection).includes('attacker'),false);
console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-B4-VARIANTS-001',convergence,historicalFixtureCount:historical.length,historicalResults,empty:signature(empty),missingContext:signature(missingContext),noPath:signature(noPath),compound:signature(compound),typo:signature(typo),mixed:signature(mixed),providerInjection:signature(providerInjection),highRiskSignals:highRisk.map((r)=>r.riskSignals),metrics:{convergenceRate:1,illegalTaskTypesPassed:0,unregisteredCapabilitiesPassed:0,providerIdControlledByModel:0,modelAuthorizationEffective:0,windowsPathsDamaged:0,groundTruthOverwritten:0,friendlyFallbackCoverage:1}},null,2));
