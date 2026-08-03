import { spawnSync } from 'node:child_process';
const commands=[
  ['concurrent_startRun','scripts/verify-run-fencing-phase-a.mjs'],
  ['unique_active_run','scripts/verify-run-fencing-phase-a.mjs'],
  ['revision_CAS','scripts/verify-run-fencing-phase-a.mjs'],
  ['provider_persisted_before_start','scripts/verify-run-fencing-phase-b.mjs'],
  ['same_attempt_single_run','scripts/verify-run-fencing-phase-b.mjs'],
  ['stale_progress','scripts/verify-run-fencing-phase-c.mjs'],
  ['stale_verification','scripts/verify-run-fencing-phase-c.mjs'],
  ['stale_final','scripts/verify-run-fencing-phase-c.mjs'],
  ['single_final','scripts/verify-run-fencing-phase-c.mjs'],
  ['cross_task_isolation','scripts/verify-run-fencing-phase-c.mjs'],
  ['lease_takeover','scripts/verify-run-fencing-phase-d.mjs'],
  ['cancel_finish_race','scripts/verify-run-fencing-phase-d.mjs'],
  ['restart_recovery','scripts/verify-run-fencing-phase-d.mjs'],
  ['old_run_superseded','scripts/verify-run-fencing-phase-d.mjs'],
  ['d0_1a_runtime_status_and_file_read','scripts/verify-run-fencing-phase-e-d0-1a.mjs']
];
const cache=new Map();const scenarios=[];
for(const [name,script] of commands){if(!cache.has(script)){const run=spawnSync(process.execPath,[script],{cwd:process.cwd(),encoding:'utf8'});cache.set(script,{ok:run.status===0,exitCode:run.status,stdout:run.stdout.trim(),stderr:run.stderr.trim()});}const result=cache.get(script);scenarios.push({name,status:result.ok?'PASS':'FAIL',script,exitCode:result.exitCode});if(!result.ok){console.error(JSON.stringify({ok:false,module:'RUN-FENCING-001',scenarios,firstFailure:{script,...result}},null,2));process.exit(1);}}
console.log(JSON.stringify({ok:true,module:'RUN-FENCING-001',passed:scenarios.length,total:15,scenarios},null,2));
