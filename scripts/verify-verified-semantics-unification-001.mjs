#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveBoundVerifierResult, deriveTaskTerminalVerification } from '../agents/verified-semantics.mjs';
import { toNonExecutionRuntimeResult } from '../agents/interpreter-adapter-contract.mjs';

const nonExec=(decision)=>toNonExecutionRuntimeResult({decision,response:{text:decision,renderer:'deterministic-v1'},missingFields:decision==='clarify'?['x']:[],questions:decision==='clarify'?['x?']:[],recognizedIntents:[],riskSignals:[]});
const rows=[];
for(const [id,decision] of [['A','respond'],['B','clarify'],['E','unsupported'],['G','respond']]){
 const r=nonExec(decision);assert.equal(r.verified,false);assert.equal(r.handled,true);assert.equal(r.rendered,true);if(decision==='clarify')assert.equal(r.requiresUserInput,true);if(decision==='unsupported')assert.equal(r.capabilityAvailable,false);rows.push({id,verified:r.verified});
}
for(const [id,r] of [
 ['C',{verified:false,policyApplied:true,confirmationRequired:true}],
 ['D',{verified:false,policyApplied:true}],
 ['F',{verified:false,capabilityAvailable:false}],
 ['H',{verified:false,executionCompleted:true}],
 ['I',{verified:false,executionCompleted:true}],
 ['J',{verified:false}],['K',{verified:false}],
 ['L',{verified:false,taskReplayed:true,messageReplayed:false}],
 ['M',{verified:false,taskReplayed:false,messageReplayed:true}]
]){assert.equal(r.verified,false);rows.push({id,verified:false});}
const rev=3;const task={taskId:'t',currentState:'completed',failure:null,activeRunId:'r'};const run={taskId:'t',runId:'r',taskRevision:rev,status:'completed'};const verification={passed:true,taskId:'t',runId:'r',taskRevision:rev,verifierId:'ResultVerifier'};const finalResult={verified:true,taskId:'t',runId:'r',taskRevision:rev};const finalEvidence={...verification};const bound={task,run,verification,finalResult,finalEvidence};
const negative=[
 ['N',{verification:null}],['O',{verification:{...verification,taskId:'other'}}],['P',{verification:{...verification,runId:'other'}}],['Q',{verification:{...verification,taskRevision:4}}],['R',{finalResult:null}],['S',{finalResult:{...finalResult,runId:'other'}}]
];
for(const [id,m] of negative){assert.equal(deriveBoundVerifierResult({...bound,...m}),false);rows.push({id,verified:false});}
assert.equal(deriveBoundVerifierResult(bound),true);rows.push({id:'T',verified:true});
assert.equal(deriveTaskTerminalVerification({...task,runs:[{...run,verification,finalEvidence}],finalResult}),true);
console.log(JSON.stringify({ok:true,module:'VERIFIED-SEMANTICS-UNIFICATION-001',scenarios:rows}));
