# NON-EXECUTION-MESSAGE-IDEMPOTENCY-INVESTIGATION-001 Report

## Conclusion

```text
case=2
classification=NON_EXECUTION_MESSAGE_IDEMPOTENCY_DEFECT
```

The same `messageId`/`originalMessageId` was handled twice for each deterministic non-execution decision:

| Decision | Assistant replies | Duplicates | Task | Run | Provider | Model |
|---|---:|---:|---:|---:|---:|---:|
| respond | 2 | 1 | 0 | 0 | 0 | 0 |
| clarify | 2 | 1 | 0 | 0 | 0 | 0 |
| unsupported | 2 | 1 | 0 | 0 | 0 | 0 |

## Root cause

The terminal business-Task lookup is correct, but non-execution decisions deliberately create no Task. The non-execution branch appends user and assistant session messages on every `handle()` without checking whether that original message already has a persisted deterministic result.

## Scope

Read-only behavior investigation plus a deterministic inspection script. Production code was not modified. Repair is deferred for separate product-owner approval.

## Files

- `scripts/inspect-non-execution-message-idempotency-001.mjs`
- `verification/NON-EXECUTION-MESSAGE-IDEMPOTENCY-INVESTIGATION-001/evidence.json`
- this report

## Test

```text
node --check scripts/inspect-non-execution-message-idempotency-001.mjs
node scripts/inspect-non-execution-message-idempotency-001.mjs
exitCode=0
```
