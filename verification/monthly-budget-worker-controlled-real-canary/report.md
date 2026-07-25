# 3B-2b2d Controlled Real Canary Report

Status: `blocked_transport_cause_unresolved`.

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

Recovery diagnosis
------------------

The prior evidence did not preserve detailed exception fields for the original registration attempt, so the exact prior `error.name`, `error.message`, `error.code` and `error.cause` are marked `previous_exception_details_missing`.

This run reproduced the transport class safely without registering:

- Node.js version: v24.18.0
- Fetch implementation: Node.js built-in fetch, undici
- Without explicit proxy dispatcher: all no-fee probes failed before response headers with `TypeError: fetch failed`, cause `ConnectTimeoutError`, cause code `UND_ERR_CONNECT_TIMEOUT`.
- With undici `ProxyAgent` loaded from the repository dependency path: `GET /health` HTTP 200, `GET /v1/models` HTTP 200, `OPTIONS /v1/install/register` HTTP 404, and a stateless missing-path `POST` HTTP 404.
- PowerShell cross-check of candidate override `GET /health` and `/v1/models` returned HTTP 200.

The root cause category is `system_proxy_error`: the local Node fetch transport did not use the available proxy path by default and timed out before any response headers. However, the task also required independent proof that version override hit the candidate version, not merely that the header was sent. A short `wrangler tail --version-id` attempt did not yield usable confirmation. Because that condition was not satisfied, no second registration attempt was made.

This run must not be described as a successful real budget path verification. No new registration, no chat request and no real provider call occurred in this recovery run.
