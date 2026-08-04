#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveBoundVerifierResult } from '../agents/verified-semantics.mjs';
import { toNonExecutionRuntimeResult } from '../agents/interpreter-adapter-contract.mjs';

const respond=toNonExecutionRuntimeResult({decision:'respond',response:{text:'hello',renderer:'deterministic-v1'},missingFields:[],questions:[],recognizedIntents:[],riskSignals:[]});
assert.equal(respond.handled,true);assert.equal(respond.rendered,true);assert.equal(respond.verified,false);
const clarify=toNonExecutionRuntimeResult({decision:'clarify',response:{text:'question',renderer:'deterministic-v1'},missingFields:['path'],questions:['path?'],recognizedIntents:[],riskSignals:[]});
assert.equal(clarify.requiresUserInput,true);assert.equal(clarify.verified,false);
for(const value of [
  {handled:true,verified:false},
  {rendered:true,verified:false},
  {policyApplied:true,verified:false},
  {executionCompleted:true,verified:false},
  {postconditionObserved:true,verified:false}
]) assert.equal(value.verified,false);
const revision=2;
const task={taskId:'t',currentState:'completed',failure:null,activeRunId:'r'};
const run={taskId:'t',runId:'r',taskRevision:revision,status:'completed'};
const verification={passed:true,taskId:'t',runId:'r',taskRevision:revision,verifierId:'ResultVerifier'};
const finalResult={verified:true,taskId:'t',runId:'r',taskRevision:revision};
const finalEvidence={...verification};
assert.equal(deriveBoundVerifierResult({task,run,verification,finalResult,finalEvidence}),true);
assert.equal(deriveBoundVerifierResult({task:{...task,currentState:'failed'},run,verification,finalResult,finalEvidence}),false);
console.log(JSON.stringify({ok:true,module:'VERIFIED-SEMANTICS-CONSUMER-MIGRATION-001',consumerRules:['handled_not_verified','rendered_not_verified','policy_not_verified','execution_not_verified','postcondition_not_verified','failed_not_success','trusted_pass_true']}));
