# 3B-2b2d Controlled Real Canary Report

Status: `blocked_before_paid_call`.

The repository baseline was clean at `db4e055273c4cd8a3639fe61e322644d5ed5a908`, with no `managed-proxy` diff after the accepted 3B-2b2c commit. `git fetch origin --prune` still failed with `SEC_E_NO_CREDENTIALS`; no login or credential repair was attempted.

Production was confirmed before the controlled call:

- Worker: `ai-workbench-managed-proxy`
- Active deployment: `55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`
- Stable version `16333442-925a-4b11-a3d1-d6249d2492ba`: 99%
- Candidate version `483e4fae-3af8-40fa-ab83-4551f08b519e`: 1%
- Normal and version override `/health`: HTTP 200
- Normal and version override `/v1/models`: HTTP 200
- Budget tables before call: 0 rows, 0 reserved
- `installations` before call: 33 rows
- Today's `daily_usage` before call: 0 requests, 0 tokens

The fixed chat request was precomputed with the production budget formula. Raw JSON was 125 UTF-8 bytes, estimated input tokens were 2, reserved input tokens were 125, reserved output tokens were 8, and the expected conservative reservation was 21 micro-USD. This passed the `1..100 micro-USD` hard gate.

A one-time Node script was created outside the repository and deleted after execution. It sent the version override header targeting the candidate version and attempted registration once. The script did not receive an HTTP status and did not receive a token. Per the task boundary, it did not retry and did not execute the chat request.

Post-attempt read-only checks showed:

- Active deployment remained unchanged at 99% / 1%
- Budget tables remained 0 rows, 0 reserved
- `installations` remained 33 rows
- Today's `daily_usage` remained 0 requests, 0 tokens
- Secrets names were unchanged
- D1 schema was unchanged
- Production and candidate override health checks remained HTTP 200
- No rollback condition was triggered

This run must not be described as a successful real budget path verification. No real provider call was made by Codex in this segment.
