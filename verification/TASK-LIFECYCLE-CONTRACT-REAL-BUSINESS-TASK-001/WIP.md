# TASK-LIFECYCLE-CONTRACT-REAL-BUSINESS-TASK-001 WIP

## Scope completed

- Replaced the obsolete `hello` replay sample with an isolated `runtime.status` business Task.
- Preserved `second.replayed === true`.
- Added assertions for one first Task, one first Run, no second Task/Run/history transition, stable final result, one assistant reply, and `activeRunId=null`.
- Updated the isolated `file.read` input to an unambiguous single-intent read request.
- Added per-runtime isolated non-execution idempotency state roots to prevent fixture cross-contamination.

## Current gate state

`node --check scripts/verify-task-lifecycle-001.mjs` passes.

The full Task Lifecycle gate remains non-zero at the historical clarification case:

```text
scripts/verify-task-lifecycle-001.mjs:154
expected schedulerStatus=needs_clarification
actual undefined
```

Root cause: the old case uses `处理一下`; the current B2 Adapter correctly treats it as non-execution `respond`, whereas the historical fixture expects creation of a clarification business Task. This is a separate stale sample/precondition after the replay sample and provider expectations were corrected. No production change was made to force `respond` back into Task creation.

## Earlier non-zero exits in this WIP

1. file.read sample contained both `读取` and `不要修改`, which the Adapter's unsupported write pattern classified as deterministic unsupported. Corrected the sample to `只读查看 <isolated path>`.
2. historical provider names `local-read`/`local-status` were stale; the actual registered providers are `local-tool-executor` and `local-runtime-state`. Assertions were aligned to the registered capability assignment without lowering grounded evidence requirements.
3. historical status text expected Gateway PID while the formal current status result reports Runtime PID from the worker state fixture. The isolated expectation was aligned to the actual evidence source.

## Safety status

- Production execute path unchanged in this WIP.
- Gateway/IPC/Authorization/Risk/Verifier unchanged.
- No assertion was deleted from the replay case.
- No real model was called.
- Full gate not claimed PASS.
