# Monthly Budget Circuit Breaker Local Report

Generated at: 2026-07-24T21:53:00+08:00

## Result

Execution status: local_passed.

Deployment status: not_deployed.

No real provider was called. No Cloudflare Worker deployment, remote D1 migration, Secret change, production model call, UI change, model layering, context compression or v0.4.7 work was performed.

## Budget Decision

- Platform monthly policy cap: 50 USD = 50000000 micro-USD.
- Monthly model hard cap implemented in this task: 40 USD = 40000000 micro-USD.
- Infrastructure and price fluctuation reserve: 10 USD = 10000000 micro-USD.

Only the model hard cap is enforced in code in this 3A segment. The infrastructure reserve is a policy record, not a Cloudflare billing control.

## Implementation

The Managed Proxy now has a provider-aware price layer. Current default model prices cover the current production implementation:

- `deepseek-chat`
- `deepseek-v4-flash`

The budget engine reads model pricing by model id. If model pricing is missing or invalid, the Worker returns 503 before upstream and does not call the provider. The code remains framework/provider-aware; DeepSeek is the first configured provider implementation, not product positioning.

The D1 schema adds:

```sql
CREATE TABLE IF NOT EXISTS monthly_model_budget (
  month_key TEXT NOT NULL,
  model TEXT NOT NULL,
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (month_key, model)
);
```

## Atomic Reservation

Before every upstream model call:

1. The Worker resolves model pricing.
2. It computes conservative maximum possible cost in integer micro-USD.
3. It initializes the current month/model ledger row with `INSERT OR IGNORE`.
4. It performs one conditional `UPDATE monthly_model_budget SET reserved_micro_usd = reserved_micro_usd + ?, call_count = call_count + 1 ... WHERE reserved_micro_usd + ? <= ?`.
5. If the update changes no row, the request returns HTTP 429 with `monthly_budget_exhausted` before upstream.
6. If D1, pricing, or reservation parsing fails, the request returns HTTP 503 before upstream.

This avoids a read-then-write budget race.

## Conservative Reservation

The reservation uses:

- `reserved_input_tokens = max(existing estimated input tokens, raw request UTF-8 bytes)`
- `reserved_output_tokens = final effective max_tokens`
- input cache-miss price
- full reserved output token price
- integer micro-USD with upward rounding

This is intentionally conservative for Chinese and other multibyte text, provider failure paths and local proxy retries.

Reservations are never refunded after upstream success, failure, timeout, connection interruption or Worker crash. This is intentional: stop early rather than miss billable attempts.

## User-Facing Errors

Budget exhausted:

- HTTP 429
- code: `monthly_budget_exhausted`
- message: `共享模型服务本月额度已用完，请稍后再试。`

Budget system unavailable or missing pricing:

- HTTP 503
- code: `monthly_budget_unavailable` or `model_price_unavailable`
- no budget amount, internal price table, D1 structure or Secret is returned to users

## Local Validation

`npm.cmd test` in `managed-proxy` passed 9/9 tests.

Covered cases:

- budget below cap allows mock upstream
- exact cap allows one call and rejects the next before upstream
- 25 concurrent calls against 10-call remaining cap produce only 10 upstream calls and do not reserve over cap
- upstream timeout does not refund
- mock upstream 500 does not refund
- D1 budget write failure returns 503 before upstream, upstream calls 0
- unknown model or missing pricing returns 503 before upstream, upstream calls 0
- month switch creates a separate ledger row
- multibyte input uses raw UTF-8 request bytes where larger than the existing char/4 estimate
- existing register, authentication, daily request and daily token flow remains exercised through the Worker mock

The attempted command `node --test --test-reporter=json tests/*.test.mjs` failed because this Node runtime treats `json` as an external reporter package. This did not affect implementation behavior; formal evidence is summarized in `test-results.json` from the passing `npm.cmd test` run.

## Production Boundary

This is local validation only. It must not be described as production passed. Production deployment and remote D1 migration are explicitly not performed in this 3A segment.
