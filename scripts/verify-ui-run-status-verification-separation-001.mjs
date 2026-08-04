#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveExecutionView, deriveVerificationView, deriveRunStatusView } from '../src/lib/run-status-view.js';
const scenarios={};
let v=deriveRunStatusView({status:'pending'});assert.equal(v.execution.code,'NOT_STARTED');assert.equal(v.verification.verified,false);scenarios.A='PASS';
v=deriveRunStatusView({status:'running',executionStarted:true});assert.equal(v.execution.code,'RUNNING');assert.equal(v.execution.terminal,false);assert.equal(v.verification.verified,false);scenarios.B='PASS';
v=deriveRunStatusView({status:'completed',verified:false});assert.equal(v.execution.code,'TERMINAL_UNVERIFIED');assert.equal(v.execution.terminal,true);assert.equal(v.verification.verified,false);scenarios.C='PASS';
v=deriveRunStatusView({status:'completed',verificationStatus:{verified:true,trusted:true,source:'BOUND_VERIFIER'}});assert.equal(v.execution.code,'VERIFIED_COMPLETED');assert.equal(v.verification.verified,true);assert.equal(v.verification.trusted,true);scenarios.D='PASS';
v=deriveRunStatusView({status:'failed',failure:{code:'FAILED',message:'reason'},verified:false});assert.equal(v.execution.code,'FAILED');assert.equal(v.verification.verified,false);assert.deepEqual(v.failure,{code:'FAILED',message:'reason'});scenarios.E='PASS';
v=deriveRunStatusView({status:'cancelled',verified:false});assert.equal(v.execution.code,'CANCELLED');assert.equal(v.verification.verified,false);scenarios.F='PASS';
v=deriveRunStatusView({status:'completed',verified:false,legacyVerifiedClaimObserved:true});assert.equal(v.verification.verified,false);scenarios.G='PASS';
v=deriveRunStatusView({status:'completed',verified:false,executionCompleted:true,postconditionObserved:true,runEvidenceValidated:true,handled:true,rendered:true,policyApplied:true});assert.equal(v.verification.code,'UNVERIFIED');assert.equal(Object.entries(v.facts).filter(([key])=>key!=='executionStarted').every(([,value])=>value===true),true);scenarios.H='PASS';
v=deriveRunStatusView({status:'pending',verified:false,input:{status:'completed',verified:true},output:{verified:true,passed:true},evidence:{verified:true}});assert.equal(v.execution.code,'NOT_STARTED');assert.equal(v.verification.verified,false);scenarios.I='PASS';
for(const x of [{status:'completed',verified:false},{status:'running',executionCompleted:true,verified:false},{status:'pending',postconditionObserved:true,verified:false}])assert.equal(deriveVerificationView(x).verified,false);scenarios.J='PASS';
v=deriveRunStatusView({status:'failed',failure:{message:'kept'},executionStarted:true,executionCompleted:true,userVisibleSummary:'ordinary summary'});assert.equal(v.facts.executionStarted,true);assert.equal(v.facts.executionCompleted,true);assert.equal(v.failure.message,'kept');assert.equal(v.businessSummary,'ordinary summary');scenarios.K='PASS';
for(const status of ['failed','cancelled','running']){v=deriveRunStatusView({status,verificationStatus:{verified:true,trusted:true,source:'BOUND_VERIFIER'}});assert.equal(v.verification.verified,false);assert.equal(v.execution.inconsistentVerification,true)}scenarios.L='PASS';
assert.equal(deriveExecutionView({status:'done'},deriveVerificationView({verified:false})).code,'TERMINAL_UNVERIFIED');
console.log(JSON.stringify({ok:true,module:'UI-RUN-STATUS-VERIFICATION-SEPARATION-001',productionImport:'src/lib/run-status-view.js',scenarios},null,2));
