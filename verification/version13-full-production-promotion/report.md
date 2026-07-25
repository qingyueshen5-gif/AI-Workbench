# Version 13 Full Production Promotion Report

Status: `version13_full_production_active_observation_limited_by_low_traffic`

Version 13 `cf002344-57ee-4c3f-86a6-115ca66c8b5f` was promoted from 1% to 100% normal production traffic using `wrangler versions deploy`. No new Worker version was uploaded, no Worker code or Wrangler config was changed, and no Secrets or D1 schema were modified.

Before promotion, active deployment `9952d7cb-2d99-483a-85f7-c9ada1a09db4` contained old stable version `16333442-925a-4b11-a3d1-d6249d2492ba` at 99% and version 13 at 1%. After promotion, active deployment `0400b7aa-49fe-460d-ac6d-3ed5bfdb0480` contains only version 13 at 100%.

The 30 minute active observation plus 5 minute metrics buffer completed. Production and Preview `/health` and `/v1/models` checks stayed HTTP 200. `/v1/models` continued to expose `deepseek-chat` as a logical alias routed to `deepseek-v4-flash` with `thinking_mode: disabled`.

Bounded `wrangler tail` error windows did not emit JSON runtime error events. Historical Workers metrics were not available through the current CLI flow, so the observation uses realtime tail windows, deployment state, health checks, and D1 budget checks. No natural production provider activity was observed; therefore this is a healthy full-production activation with low natural traffic, not proof of long-term real-user scale.

Budget ledgers stayed unchanged: platform budget remained 44 micro-USD / call_count 2, historical `deepseek-chat` remained 21 / 1, and `deepseek-v4-flash` remained 23 / 1. Installations remained 36 and daily usage for 2026-07-25 remained request_count 5, input_tokens 4, output_tokens 1. Codex did not register an installation, did not chat, and did not call a provider in this round.

Rollback was prepared with old stable version `16333442-925a-4b11-a3d1-d6249d2492ba` as the target, but no rollback condition triggered.

Next action: wait for product owner acceptance of version 13 full production promotion and Stage 3 production result. Do not enter model tiering, context compression, v0.4.7, or any new stage without approval.
