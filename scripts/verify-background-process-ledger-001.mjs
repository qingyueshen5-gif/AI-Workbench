import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const allowed=new Set(['PASS','EXPECTED_TERMINATION','NON_GATING_FAILURE','FORMAL_GATE_FAILURE','UNKNOWN_FAILURE']);
export function validateBackgroundProcessLedger(ledger){
  assert.ok(ledger&&Array.isArray(ledger.processes),'background process ledger processes missing');
  const byRef=new Map(ledger.processes.map((item)=>[item.processRef||String(item.processId||''),item]));
  for(const item of ledger.processes){
    for(const key of['command','workingDirectory','startedAt','finishedAt','exitCode','owningTask','owningGate','gating','classification','supersededBy','evidencePath'])assert.ok(Object.hasOwn(item,key),`ledger field missing ${key}`);
    assert.ok(allowed.has(item.classification),`invalid classification ${item.classification}`);
    if(item.classification==='UNKNOWN_FAILURE')throw new Error(`UNKNOWN_FAILURE blocks completion: ${item.processRef||item.processId}`);
    if(item.gating&&Number(item.exitCode)!==0){
      assert.equal(item.classification,'FORMAL_GATE_FAILURE');
      assert.ok(item.supersededBy,'formal gate failure requires supersededBy');
      const successor=byRef.get(item.supersededBy);assert.ok(successor,'superseding process missing');assert.equal(successor.gating,true);assert.equal(Number(successor.exitCode),0);assert.equal(successor.owningGate,item.owningGate);assert.equal(successor.classification,'PASS');assert.ok(successor.evidencePath);
    }
  }
  return {ok:true,processCount:ledger.processes.length};
}
if(process.argv[1]){const path=process.argv[2];if(path){const ledger=JSON.parse(await fs.readFile(path,'utf8'));console.log(JSON.stringify(validateBackgroundProcessLedger(ledger)));}}
