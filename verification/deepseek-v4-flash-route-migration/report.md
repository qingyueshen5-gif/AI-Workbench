# DeepSeek V4 Flash Route Migration Report

Status: `new_provider_model_route_candidate_ready_locally`.

## Root Cause

The 3B-2b2d candidate Preview real chat attempt returned HTTP 400 with provider error code `invalid_request_error` after the budget reservation had already been written.

The root cause is fixed as `deprecated_upstream_model_identifier` with high confidence. DeepSeek official docs state that the OpenAI base URL remains unchanged but the model parameter should use `deepseek-v4-flash` or `deepseek-v4-pro`; `deepseek-chat` and `deepseek-reasoner` are retired after 2026-07-24 15:59 UTC. The failed AI Workbench request happened on 2026-07-25 and still sent `deepseek-chat` upstream.

Official sources checked:

- DeepSeek API Docs - Change Log: `https://api-docs.deepseek.com/updates/`
- DeepSeek API Docs - V4 Preview Release: `https://api-docs.deepseek.com/news/news260424/`
- DeepSeek API Docs - Models & Pricing: `https://api-docs.deepseek.com/quick_start/pricing/`

## Traffic Containment

The known failed candidate version was removed from live traffic before local code changes.

- Before: active deployment `55b20f6c-1a50-446b-95cc-18ebf0e6cbe1`, stable version `16333442-925a-4b11-a3d1-d6249d2492ba` at 99%, failed candidate `483e4fae-3af8-40fa-ab83-4551f08b519e` at 1%.
- After: active deployment `d9acb146-b720-4e09-b2b8-0257b93fc407`, stable version at 100%, failed candidate at 0%.
- No third version was introduced.
- Production `/health` and `/v1/models` returned HTTP 200 through Node `--use-env-proxy`.
- D1 budget tables still show 21 micro-USD and call_count 1 in both platform and model ledgers.

This containment does not prove the old stable provider call path is compatible with DeepSeek after the retirement. It only removes the known failed budget candidate from production traffic.

## Local Fix

The Worker now treats `deepseek-chat` as a client-facing logical model and routes it internally to `deepseek-v4-flash` before calling DeepSeek.

Implemented behavior:

- Client may continue sending `model: deepseek-chat`.
- `MODEL_PRICE_CONFIG_JSON` includes `upstreamModel`.
- Budget calculation uses the configured route price.
- Monthly platform budget remains the only hard cap.
- Monthly model detail now records the actual upstream model, `deepseek-v4-flash`.
- The upstream request body is a cloned payload with `model: deepseek-v4-flash`.
- Missing or empty `upstreamModel` fails closed before provider fetch.
- `/v1/models` still exposes `deepseek-chat`, marked as `logical_alias`, with `upstream_model: deepseek-v4-flash`.

## Tests

Validation:

- TypeScript check: passed.
- Full Managed Proxy tests: 16 passed, 0 failed.
- Upstream payload test confirmed mock upstream receives `deepseek-v4-flash`.
- Budget regression confirmed the fixed 125-byte request still reserves 21 micro-USD with V4 Flash pricing.
- Fail-closed tests confirmed missing route or price does not call upstream.
- Upstream 400 and timeout tests confirmed current no-refund platform reservation policy remains unchanged.

No real provider call was made. No new Worker version was uploaded. No production code was deployed. Secrets and D1 schema were not modified.

## No-Refund Record

The existing 21 micro-USD reservation from the failed real call remains unchanged.

- Provider actual billing: not confirmed.
- Platform internal conservative reservation: confirmed at 21 micro-USD.
- User billing: not applicable; there is no user billing mechanism.
- Policy purpose: protect platform monthly wallet from failures, timeouts and retries bypassing the hard cap.

Risk retained: if a bad provider route is left live, failed requests can consume internal reserved budget without successful answers. This is why provider model retirement and route config must be verified before the next upload or deployment.

## Next Action

Wait for product owner acceptance of the DeepSeek V4 Flash route migration local candidate. Do not upload or deploy a new Worker version and do not make another real model call without explicit approval.
