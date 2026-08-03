import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const source=await fs.readFile(join(root,'scripts','verify-gateway-runtime-switch.mjs'),'utf8');
assert.match(source,/fs\.mkdtemp\(join\(os\.tmpdir\(\),'aiw-gateway-switch-'\)\)/);
assert.doesNotMatch(source,/[A-Z]:\\\\aiw-gateway-switch-fixed/i);
const run=()=>{const probeRoot=join(os.tmpdir(),`aiw-runtime-switch-portability-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);return spawnSync(process.execPath,['scripts/verify-gateway-runtime-switch.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,AIW_FEISHU_IPC_DIR:join(probeRoot,'ipc'),AIW_WORKER_STATE_PATH:join(probeRoot,'worker-state.json')}});};
const first=run();assert.equal(first.status,0,first.stderr||first.stdout);const a=JSON.parse(first.stdout.trim().split(/\r?\n/).at(-1));
const second=run();assert.equal(second.status,0,second.stderr||second.stdout);const b=JSON.parse(second.stdout.trim().split(/\r?\n/).at(-1));
for(const item of[a,b]){assert.equal(item.ok,true);assert.equal(item.switchWithoutGatewayRestart,true);assert.equal(item.failedCandidateRolledBack,true);assert.equal(item.fixtureRootInOsTmp,true);assert.equal(item.fixtureRootRemovedAfterCleanup,true);assert.ok(item.fixtureRoot.startsWith(os.tmpdir()));}
assert.notEqual(a.fixtureRoot,b.fixtureRoot);for(const item of[a,b])await assert.rejects(fs.stat(item.fixtureRoot));
console.log(JSON.stringify({ok:true,module:'RUNTIME-SWITCH-FIXTURE-PORTABILITY-001',paths:[a.fixtureRoot,b.fixtureRoot],osTmp:os.tmpdir(),isolated:true,cleaned:true,realAssertionsPreserved:true}));
