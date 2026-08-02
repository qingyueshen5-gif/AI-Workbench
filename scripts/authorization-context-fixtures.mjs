import { randomBytes } from 'node:crypto';

export function trustedAuthorization({taskId,userId='test-user',capabilityId,scope='controlled_test',now=Date.now(),ttlMs=60000,approvedBy='test-runtime-control-plane'}={}){
  if(!taskId||!capabilityId)throw new Error('trustedAuthorization requires taskId and capabilityId');
  return {taskId,userId,capabilityId,scope,approvedAt:now-1,approvedBy,expiresAt:now+ttlMs,nonce:randomBytes(16).toString('hex')};
}

export function trustedAuthorizations({taskId,userId='test-user',capabilityIds,scope='controlled_test',now=Date.now()}={}){
  return (capabilityIds||[]).map((capabilityId)=>trustedAuthorization({taskId,userId,capabilityId,scope,now}));
}
