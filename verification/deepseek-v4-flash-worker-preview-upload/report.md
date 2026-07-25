# DeepSeek V4 Flash Worker Preview Upload Report

Status: `v4_flash_candidate_preview_verified`.

## Scope

This run uploaded the accepted local DeepSeek V4 Flash route fix as a new Cloudflare Worker version and verified its Preview URL without registration, token issuance, authenticated chat or provider calls.

No production deployment was created. No normal production traffic was changed.

## Baseline

- Accepted local candidate commit: `4f6c0dda038c33f2a643ed113b9f9ef7d9401849`.
- Worker: `ai-workbench-managed-proxy`.
- Stable production version: `16333442-925a-4b11-a3d1-d6249d2492ba`.
- Known failed candidate: `483e4fae-3af8-40fa-ab83-4551f08b519e`.
- Active deployment before upload: `d9acb146-b720-4e09-b2b8-0257b93fc407`.
- Production traffic before upload: stable 100%, failed candidate 0%.

`git fetch origin --prune` still failed with `SEC_E_NO_CREDENTIALS`; credentials were not modified. Local HEAD and `origin/main` were already equal before the upload.

## Local Candidate Recheck

- TypeScript check: passed.
- Managed Proxy tests: 16 passed, 0 failed.
- Config JSON parsed successfully.
- `ALLOWED_MODELS`: `deepseek-chat`.
- `upstreamModel`: `deepseek-v4-flash`.
- `git diff --check`: passed.

The tests cover logical routing, upstream mock payload model, V4 Flash budget price regression, platform aggregate cap, fail-closed behavior, and current no-refund behavior for upstream failures.

## Bundle Check

`wrangler versions upload --dry-run --outdir` produced a 20.13 KiB bundle, 5.56 KiB gzip.

- Main bundle: `index.js`, 20609 bytes.
- Bundle SHA256: `828AD0203C78177A01B16F970FC7AD865AFFA1DC25D7E2A985381FD14A0DF0BC`.
- Required strings present: `deepseek-v4-flash`, `upstreamModel`, `deepseek-chat`.
- No Secret values, token values, proxy credentials, full Preview URL or local absolute user path were found.
- Cleanup was attempted for `.tmp-v4-flash-worker-upload-bundle` and `managed-proxy/.wrangler/tmp`, but Windows returned `Access is denied`. These ignored temporary directories were not committed.

The temporary bundle and generated Worker type file were not committed.

## Upload

Upload command used `wrangler versions upload`, not `wrangler deploy` and not `wrangler versions deploy`.

- New candidate version ID: `a7eb385b-84df-4a45-b554-0aca40b6b407`.
- New candidate version number: `12`.
- Version message: `DeepSeek V4 Flash route migration candidate`.
- Version tag: `v4-flash-route-candidate`.
- Preview alias: `budget-v4-flash-candidate`.
- Preview host: redacted in repository evidence.
- Preview host SHA256: `C7B2EF325BADFC314B024887CF25682062630F00E00FD5C376A13369BE4AA8C9`.

## Post-Upload Production Check

- Active deployment after upload: `d9acb146-b720-4e09-b2b8-0257b93fc407`.
- Stable version traffic after upload: 100%.
- Failed candidate traffic after upload: 0%.
- New candidate normal production traffic: 0%.
- New candidate is not in active deployment.
- No third version is serving normal production traffic.

Secrets, D1 schema and budget records were unchanged.

## Preview Smoke Test

The new Preview alias passed all no-fee checks:

- `GET /health`: HTTP 200.
- `GET /v1/models`: HTTP 200.
- `/v1/models` exposes logical model `deepseek-chat`.
- `/v1/models` marks it as `logical_alias`.
- `/v1/models` shows upstream model `deepseek-v4-flash`.
- Unauthenticated `POST /v1/chat/completions`: HTTP 401 `missing_token`.

Registration attempts: 0.
Authenticated chat attempts: 0.
Provider calls: 0.

## Budget

Budget before and after Preview verification stayed unchanged:

- Platform monthly budget: `reserved_micro_usd=21`, `call_count=1`.
- Historical `deepseek-chat` model detail: `reserved_micro_usd=21`, `call_count=1`.
- No new `deepseek-v4-flash` model budget row was created.

## Next Action

Wait for product owner acceptance of the DeepSeek V4 Flash fixed Worker Preview. Do not add the new fixed version to production deployment, do not register an installation, and do not make a real model call without explicit approval.
