#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveBoundVerifierResult, deriveTaskTerminalVerification } from '../agents/verified-semantics.mjs';

const revision=7;
const task={taskId:'task-1',currentState:'completed',failure:null,activeRunId:'run-1'};
const run={taskId:'task-1',runId:'run-1',taskRevision:revision,status:'completed'};
const verification={passed:true,taskId:'task-1',runId:'run-1',taskRevision:revision,verifierId:'ResultVerifier'};
const finalResult={verified:true,taskId:'task-1',runId:'run-1',taskRevision:revision};
const finalEvidence={passed:true,taskId:'task-1',runId:'run-1',taskRevision:revision,verifierId:'ResultVerifier'};
const bound={task,run,verification,finalResult,finalEvidence};
assert.equal(deriveBoundVerifierResult(bound),true);
for(const mutation of [
  {task:{...task,currentState:'failed'}},
  {task:{...task,failure:{errorCode:'X'}}},
  {run:{...run,status:'failed'}},
  {verification:{...verification,passed:false}},
  {verification:{...verification,taskId:'other'}},
  {verification:{...verification,runId:'other'}},
  {verification:{...verification,taskRevision:revision+1}},
  {finalResult:null},
  {finalResult:{...finalResult,verified:false}},
  {finalResult:{...finalResult,taskId:'other'}},
  {finalResult:{...finalResult,runId:'other'}},
  {finalResult:{...finalResult,taskRevision:revision+1}},
  {finalEvidence:{...finalEvidence,passed:false}},
  {finalEvidence:{...finalEvidence,verifierId:'OtherVerifier'}},
  {task:{...task,activeRunId:'run-fenced'}}
]) assert.equal(deriveBoundVerifierResult({...bound,...mutation}),false,JSON.stringify(mutation));
const terminalTask={...task,runs:[{...run,verification,finalEvidence}],finalResult};
assert.equal(deriveTaskTerminalVerification(terminalTask),true);
assert.equal(typeof deriveTaskTerminalVerification(terminalTask),'boolean');
assert.equal(deriveTaskTerminalVerification({...terminalTask,finalResult:undefined}),false);
console.log(JSON.stringify({ok:true,module:'VERIFIED-SEMANTICS-TRUSTED-DERIVATION-001',positive:1,negative:15,strictBoolean:true}));
