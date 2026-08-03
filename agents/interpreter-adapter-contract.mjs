import { validateTaskInterpretation } from './task-interpreter.mjs';

export const INTERPRETER_ADAPTER_VERSION='interpreter-adapter-v1';
export const GROUND_TRUTH_VERSION='d0-1b-v1';
export const ADAPTER_DECISIONS=Object.freeze(['execute','respond','clarify','unsupported']);
export const EXECUTION_ALLOWLIST=Object.freeze(['runtime.status','file.read']);
export const STRIPPED_SEMANTIC_FIELDS=Object.freeze(['taskType','capability','requiredCapabilities','providerId','approved','authorized','authorizationContext','riskLevel','path']);

function array(value){return Array.isArray(value)?value:[];}
function text(value){return typeof value==='string'?value:'';}

export function sanitizeSemanticCandidate(candidate={}){
  const source=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate:{};
  return {
    intentFamilyCandidate:text(source.intentFamilyCandidate),
    goalSummary:text(source.goalSummary),
    actionHints:array(source.actionHints).filter((item)=>typeof item==='string'),
    semanticEntities:array(source.semanticEntities).filter((item)=>item&&typeof item==='object'&&!Array.isArray(item)),
    uncertainty:source.uncertainty??null,
    clarificationNeeded:source.clarificationNeeded===true,
    version:text(source.version||source.semanticCandidateVersion)||'none'
  };
}

export function validateAdapterInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('adapter input must be an object');
  if(typeof input.originalText!=='string')throw new TypeError('originalText must be a string');
  if(input.groundTruth?.version!==GROUND_TRUTH_VERSION||input.groundTruth.originalText!==input.originalText)throw new Error('groundTruth must match originalText');
  for(const list of ['facts','actions','constraints','successCriteria','authorizationClaims','unresolved']){
    if(!Array.isArray(input.groundTruth[list]))throw new Error(`groundTruth.${list} must be an array`);
    for(const item of input.groundTruth[list])if(input.originalText.slice(item.start,item.end)!==item.raw)throw new Error(`groundTruth source span mismatch: ${item.id||list}`);
  }
  return {originalText:input.originalText,groundTruth:input.groundTruth,semanticCandidate:sanitizeSemanticCandidate(input.semanticCandidate)};
}

export function validateAdapterResult(result){
  if(result?.version!==INTERPRETER_ADAPTER_VERSION||!ADAPTER_DECISIONS.includes(result.decision))throw new Error('invalid adapter result');
  if(!Array.isArray(result.riskSignals)||!Array.isArray(result.unresolved))throw new Error('adapter arrays missing');
  if(result.source?.groundTruthVersion!==GROUND_TRUTH_VERSION)throw new Error('invalid groundTruth source version');
  if(result.decision==='execute'){
    if(!result.taskDraft)throw new Error('execute requires taskDraft');
    validateTaskInterpretation(result.taskDraft);
    if(result.taskDraft.requiredCapabilities.some((id)=>!EXECUTION_ALLOWLIST.includes(id)))throw new Error('execute capability outside adapter allowlist');
    if(result.response!==null)throw new Error('execute response must be null');
  }else{
    if(result.taskDraft!==null)throw new Error('non-execute taskDraft must be null');
    if(result.response?.renderer!=='deterministic-v1'||typeof result.response.text!=='string'||!result.response.text)throw new Error('non-execute deterministic response required');
  }
  if(result.decision==='clarify'){
    if(!Array.isArray(result.missingFields)||!result.missingFields.length)throw new Error('clarify missingFields required');
    if(!Array.isArray(result.questions)||!result.questions.length)throw new Error('clarify questions required');
  }
  return result;
}

export function makeAdapterResult({decision,taskDraft=null,response=null,riskSignals=[],unresolved=[],semanticCandidateVersion='none',missingFields=[],questions=[],recognizedIntents=[]}){
  return validateAdapterResult({version:INTERPRETER_ADAPTER_VERSION,decision,taskDraft,response,riskSignals:[...new Set(riskSignals)],unresolved,source:{groundTruthVersion:GROUND_TRUTH_VERSION,semanticCandidateVersion},missingFields,questions,recognizedIntents});
}

export function toNonExecutionRuntimeResult(adapterResult,{originalMessageId,createdAt=new Date().toISOString()}={}){
  if(adapterResult.decision==='execute')throw new Error('execute cannot become a non-execution result');
  return {
    version:'non-execution-result-v1',
    text:adapterResult.response.text,
    provider:'deterministic-response-renderer',
    providerSessionId:'',
    toolUsed:'',
    verified:true,
    classification:{kind:'non_execution',decision:adapterResult.decision,originalMessageId:String(originalMessageId||''),renderer:adapterResult.response.renderer,missingFields:adapterResult.missingFields||[],questions:adapterResult.questions||[],recognizedIntents:adapterResult.recognizedIntents||[],riskSignals:adapterResult.riskSignals,executionStarted:false,createdAt},
    metrics:{readFileCalls:0,codexCalls:0,modelCalls:0,schedulerCalls:0,providerCalls:0,taskCreates:0,runCreates:0}
  };
}
