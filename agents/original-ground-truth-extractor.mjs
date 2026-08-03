const trimEndPunctuation=/[，。；、！？!?）)】\]》〉]+$/u;
const windowsPathPattern=/[A-Za-z]:\\(?:[^\s<>:"|?*`，。；、！？!?（）()【】\[\]《》]+(?:[ ]+[^\s<>:"|?*`，。；、！？!?（）()【】\[\]《》]+)*)/gu;
const uncPathPattern=/\\\\[^\\\s，。；、！？!?]+\\[^\s，。；、！？!?]+(?:\\[^\s，。；、！？!?]+)*/gu;
const urlPattern=/https?:\/\/[^\s<>"'，。；、！？）)】\]]+/giu;
const filenamePattern=/(?<![\\/\w.-])[\p{L}\p{N}_-]+\.[A-Za-z0-9]{1,12}(?![\w])/gu;
const numberPattern=/(?<![\p{L}\p{N}])(?:v?\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.-]+)?|\d+(?:\.\d+)?(?:%|％|ms|s|秒|分钟|小时|天|个|次|项|端口|MB|GB|KB|bytes?|字节)?|端口\s*\d+)(?![\p{L}\p{N}])/giu;
const inlineQuotePattern=/`[^`\r\n]+`|“[^”\r\n]+”|"[^"\r\n]+"|'[^'\r\n]+'|‘[^’\r\n]+’/gu;
const fencedPattern=/```[\s\S]*?```/gu;
const actionPattern=/(?:请|帮我|执行|创建|修改|读取|检查|验证)[^\n。；!?！？]*/gu;
const constraintPattern=/(?:不要|不得|禁止|只读|只处理|仅处理|不调用|只|仅)[^\n。；!?！？]*/gu;
const successPattern=/(?:必须|要求|完成标准|成功条件|最终需要)[^\n。；!?！？]*/gu;
const authorizationPattern=/(?:我已经批准|已经批准|不用再确认|无需确认|之前授权过)[^\n。；!?！？]*/gu;

function assertOriginalText(value){if(typeof value!=='string')throw new TypeError('originalText must be a string');return value;}
function item(type,raw,start,extra={}){return {id:'',type,raw,start,end:start+raw.length,...extra};}
function collect(text,pattern,type,extra={}){const out=[];pattern.lastIndex=0;for(const match of text.matchAll(pattern)){let raw=match[0];if(type!=='quoted_literal')raw=raw.replace(trimEndPunctuation,'');if(raw)out.push(item(type,raw,match.index,extra));}return out;}
function overlaps(a,b){return a.start<b.end&&b.start<a.end;}
function stable(items){return items.sort((a,b)=>a.start-b.start||b.end-a.end||a.type.localeCompare(b.type)).filter((candidate,index,array)=>!array.slice(0,index).some((prior)=>prior.type===candidate.type&&prior.start===candidate.start&&prior.end===candidate.end)).map((entry,index)=>({...entry,id:`f${String(index+1).padStart(4,'0')}`}));}
function outside(items,blocked){return items.filter((candidate)=>!blocked.some((entry)=>overlaps(candidate,entry)));}
function clauses(text,pattern,type,extra={}){return collect(text,pattern,type,extra);}
function unresolvedClauses(text,covered){const out=[];let offset=0;for(const part of text.split(/(?<=[。；!?！？\n])/u)){const raw=part.trim();const leading=part.indexOf(raw);const start=offset+Math.max(0,leading);offset+=part.length;if(!raw||covered.some((entry)=>entry.start<=start&&entry.end>=start+raw.length))continue;if(/^(?:也许|可能|看着办|处理一下|弄一下|优化一下)/u.test(raw))out.push(item('unresolved',raw,start,{reason:'deterministic_rule_not_confirmed'}));}return out;}

export function extractGroundTruth(originalText){
  const text=assertOriginalText(originalText);
  const quoted=[...collect(text,fencedPattern,'quoted_literal'),...collect(text,inlineQuotePattern,'quoted_literal')];
  const paths=[...collect(text,uncPathPattern,'unc_path'),...collect(text,windowsPathPattern,'windows_path')];
  const urls=collect(text,urlPattern,'url');
  const filenames=outside(collect(text,filenamePattern,'filename'),[...paths,...urls,...collect(text,numberPattern,'number')]);
  const numbers=outside(collect(text,numberPattern,'number'),[...paths,...urls]);
  const facts=stable([...paths,...urls,...filenames,...numbers,...quoted]);
  const authorizationClaims=stable(clauses(text,authorizationPattern,'authorization_claim',{trusted:false}));
  const constraints=stable(clauses(text,constraintPattern,'constraint'));
  const successCriteria=stable(clauses(text,successPattern,'success_criterion'));
  const actions=stable(outside(clauses(text,actionPattern,'explicit_action'),[...constraints,...successCriteria,...authorizationClaims]));
  const unresolved=stable(unresolvedClauses(text,[...actions,...constraints,...successCriteria,...authorizationClaims]));
  return {version:'d0-1b-v1',originalText:text,facts,actions,constraints,successCriteria,authorizationClaims,unresolved};
}

export function validateGroundTruth(result){
  if(result?.version!=='d0-1b-v1'||typeof result.originalText!=='string')throw new Error('invalid ground-truth envelope');
  for(const list of ['facts','actions','constraints','successCriteria','authorizationClaims','unresolved']){
    if(!Array.isArray(result[list]))throw new Error(`${list} must be an array`);
    for(const entry of result[list]){
      for(const key of ['id','type','raw','start','end'])if(!(key in entry))throw new Error(`${list} item missing ${key}`);
      if(result.originalText.slice(entry.start,entry.end)!==entry.raw)throw new Error(`source span mismatch: ${entry.id}`);
    }
  }
  return result;
}