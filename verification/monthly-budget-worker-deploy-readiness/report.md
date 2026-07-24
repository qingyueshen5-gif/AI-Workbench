# Monthly Budget Worker Deploy Readiness

Generated at: 2026-07-24T23:55:00+08:00

## Result

Execution status: `deployment_candidate_ready`.

This task locked a production Worker deployment candidate only. No Worker was deployed, no traffic was changed, no rollback was executed, no Secrets were modified and no real provider was called.

## Explicit Budget Configuration

`managed-proxy/wrangler.jsonc` now explicitly includes non-sensitive production vars:

- `PLATFORM_MONTHLY_BUDGET_MICRO_USD`: `50000000`
- `MONTHLY_MODEL_HARD_CAP_MICRO_USD`: `40000000`
- `MODEL_PRICE_CONFIG_JSON`: one model, `deepseek-chat`

The explicit `deepseek-chat` pricing config is:

- provider: `deepseek`
- input cache miss: `140000` micro-USD per 1,000,000 tokens
- output: `280000` micro-USD per 1,000,000 tokens

The config does not include API keys or Secrets. `ALLOWED_MODELS`, existing daily limits, `MANAGED_PROXY_ENABLED` and D1 database id were not changed.

## Code Consistency

The candidate still contains:

- `monthly_platform_budget` platform aggregate reservation
- `monthly_model_budget` model detail ledger
- budget reservation before upstream provider call
- `monthly_budget_exhausted`
- missing price fail-closed behavior
- default model hard cap `40000000`
- integer micro-USD checks

No budget algorithm change was made in this segment.

## Local Regression

`npm.cmd test` in `managed-proxy` passed 12/12 tests.

Covered regression points include:

- cross-model aggregate budget
- 25 concurrent requests with a 10-call cap
- model detail write failure calls upstream 0 times
- timeout and upstream 500 do not refund reservation
- D1 failure, unknown model and missing price fail closed before upstream
- no real provider call

Configuration parsing validation passed for 50 USD policy cap, 40 USD model hard cap and explicit `deepseek-chat` price integers.

## Remote Readiness

Remote D1 read-only verification found:

- `monthly_platform_budget`: exists, 0 rows
- `monthly_model_budget`: exists, 0 rows

The current production Worker version was confirmed by read-only Cloudflare API:

- current deployment id: `61aa34dd-c20a-42b4-a3c6-1ca474a81e5e`
- current traffic version id: `16333442-925a-4b11-a3d1-d6249d2492ba`
- current version created: `2026-07-23T09:57:13.181688Z`
- `/health`: HTTP 200
- `/v1/models`: HTTP 200

Rollback baseline:

- rollback target version id: `16333442-925a-4b11-a3d1-d6249d2492ba`
- previous available version id: `be24a4ff-6253-4883-a162-10dd04d91490`

## Boundary

The deployment candidate is ready, but production wallet circuit breaker is not active yet. Worker deployment belongs to a later approved segment.
