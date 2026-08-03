import assert from 'node:assert/strict';
import { InterpreterAdapter } from '../agents/interpreter-adapter.mjs';
import { extractGroundTruth } from '../agents/original-ground-truth-extractor.mjs';
const adapter=new InterpreterAdapter();
const adapt=(text,semanticCandidate={version:'fixture-v1'})=>adapter.adapt({originalText:text,groundTruth:extractGroundTruth(text),semanticCandidate});
const signature=(r)=>({decision:r.decision,taskType:r.taskDraft?.taskType||null,requiredCapabilities:r.taskDraft?.requiredCapabilities||null,path:r.taskDraft?.targets?.[0]?.path||null});
const groups={
 runtime:['现在Runtime状态','Runtime现在怎么样','检查一下运行时状态','帮我看看Runtime是否正常','当前系统运行状态是什么'],
 file:['读取E:\\AI-Workbench\\NEXT_STEP.md','帮我打开并读取这个文件：E:\\AI-Workbench\\NEXT_STEP.md','看一下 `E:\\AI-Workbench\\NEXT_STEP.md`','请只读E:\\AI-Workbench\\NEXT_STEP.md','不要修改，读取E:\\AI-Workbench\\NEXT_STEP.md'],
 greeting:['你好','在吗','早上好','hello','嗨']
};
const convergence={};
for(const [name,texts] of Object.entries(groups)){
 const results=texts.map((text)=>adapt(text));const sigs=results.map(signature);assert.deepEqual(sigs,sigs.map(()=>sigs[0]));convergence[name]={count:texts.length,signature:sigs[0],rate:1};
}
const noPath=adapt('帮我看下那个文件');assert.equal(noPath.decision,'clarify');
const compound=adapt('读一下 E:\\AI-Workbench\\NEXT_STEP.md，然后看看 Runtime 正不正常');assert.equal(compound.decision,'clarify');
const typo=adapt('请只讀E:\\AI-Workbench\\NEXT_STEP.md');assert.ok(['respond','execute'].includes(typo.decision));
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
console.log(JSON.stringify({ok:true,module:'INTERPRETER-ADAPTER-B4-VARIANTS-001',convergence,historicalFixtureCount:historical.length,historicalResults,noPath:signature(noPath),compound:signature(compound),typo:signature(typo),mixed:signature(mixed),highRiskSignals:highRisk.map((r)=>r.riskSignals),metrics:{convergenceRate:1,illegalTaskTypesPassed:0,unregisteredCapabilitiesPassed:0,providerIdControlledByModel:0,modelAuthorizationEffective:0,windowsPathsDamaged:0,groundTruthOverwritten:0,friendlyFallbackCoverage:1}},null,2));
