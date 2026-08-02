import { timingSafeEqual } from 'node:crypto';

const requiredFields=['taskId','userId','capabilityId','scope','approvedAt','approvedBy','expiresAt','nonce'];
const unsafeInterpretationAuthorizationKeys=new Set(['preauthorized','controlled_test','approved','confirmed','trusted','authorized','authorization','authorizationContext','approval','isApproved']);

function text(value){return String(value??'').trim();}
function finiteTime(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}

export function stripInterpretationAuthorization(value){
  if(Array.isArray(value))return value.map(stripInterpretationAuthorization);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!unsafeInterpretationAuthorizationKeys.has(key)).map(([key,nested])=>[key,stripInterpretationAuthorization(nested)]));
}

export function validateAuthorizationContext(context,{taskId,userId,capabilityId,now=Date.now()}={}){
  if(!context||typeof context!=='object'||Array.isArray(context))return{valid:false,reason:'authorization_missing'};
  for(const key of requiredFields)if(!text(context[key]))return{valid:false,reason:`authorization_missing_${key}`};
  if(text(context.taskId)!==text(taskId))return{valid:false,reason:'authorization_task_mismatch'};
  if(text(context.userId)!==text(userId))return{valid:false,reason:'authorization_user_mismatch'};
  if(text(context.capabilityId)!==text(capabilityId))return{valid:false,reason:'authorization_capability_mismatch'};
  const approvedAt=finiteTime(context.approvedAt),expiresAt=finiteTime(context.expiresAt);
  if(!approvedAt||!expiresAt||approvedAt>Number(now)||expiresAt<=Number(now)||expiresAt<=approvedAt)return{valid:false,reason:'authorization_expired_or_invalid_time'};
  if(text(context.nonce).length<16)return{valid:false,reason:'authorization_nonce_invalid'};
  return{valid:true,reason:'trusted_authorization',authorization:{...context,taskId:text(context.taskId),userId:text(context.userId),capabilityId:text(context.capabilityId),scope:text(context.scope),approvedBy:text(context.approvedBy),nonce:text(context.nonce),approvedAt,expiresAt}};
}

export function trustedAuthorizationFor(capabilityId,contexts=[],binding={}){
  for(const context of Array.isArray(contexts)?contexts:[]){const result=validateAuthorizationContext(context,{...binding,capabilityId});if(result.valid)return result;}
  return{valid:false,reason:'no_matching_trusted_authorization'};
}

export function authorizationNonceEquals(a,b){const left=Buffer.from(text(a));const right=Buffer.from(text(b));return left.length===right.length&&left.length>0&&timingSafeEqual(left,right);}
