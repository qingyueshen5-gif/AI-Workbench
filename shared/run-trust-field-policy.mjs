export const RUN_TRUST_FIELD_POLICY = Object.freeze([
  { scope:'RUN_ROOT', entityType:'Run', path:'verified', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Business verification is server-derived' },
  { scope:'RUN_ROOT', entityType:'Run', path:'verification', matchMode:'SUBTREE', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Verifier record is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'verificationPassed', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Verifier PASS alias is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'verificationResult', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Evidence-check result is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'finalEvidence', matchMode:'SUBTREE', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Final evidence is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'finalResult.verified', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Final business verification is server-derived' },
  { scope:'RUN_ROOT', entityType:'Run', path:'verifierId', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Verifier identity is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'verifiedAt', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Verification timestamp is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'runEvidenceValidated', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Evidence validation fact is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'legacyVerifiedClaimObserved', matchMode:'EXACT', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Legacy claim audit marker is server-owned' },
  { scope:'RUN_ROOT', entityType:'Run', path:'trustedTask', matchMode:'SUBTREE', serverOwned:true, clientWritable:false, opaqueBoundary:false, reason:'Trusted task binding is server-owned' }
]);

export const RUN_OPAQUE_BOUNDARIES = Object.freeze(['input','output','evidence','errorRaw','errorUserMessage','memorySuggestions']);
export const RUN_FORBIDDEN_PATHS = Object.freeze(RUN_TRUST_FIELD_POLICY.map(rule => rule.path));

export function findForbiddenRunPaths(run, prefix='') {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return [];
  const offending=[];
  for (const rule of RUN_TRUST_FIELD_POLICY) {
    const segments=rule.path.split('.');
    let current=run;
    let present=true;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current,segment)) { present=false; break; }
      current=current[segment];
    }
    if (present) offending.push(prefix ? `${prefix}.${rule.path}` : rule.path);
  }
  return [...new Set(offending)].sort();
}

export function findForbiddenTrustPathsForEndpoint(endpoint, payload) {
  if (endpoint==='POST /api/runs') return findForbiddenRunPaths(payload);
  if (endpoint==='PUT /api/data' && Array.isArray(payload?.runs)) return payload.runs.flatMap((run,index)=>findForbiddenRunPaths(run,`runs[${index}]`)).sort();
  return [];
}
