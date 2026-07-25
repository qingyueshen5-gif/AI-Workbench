# Version 13 One Percent Production Canary

Status: `version13_one_percent_canary_observation_limited_by_low_traffic`

Product owner accepted the version 13 real Preview path at commit `649eb031907bd476828e50134a948c01858e606d`. This run corrected ambiguous run1/run2 fields in the previous real Preview summary, then deployed existing version 13 to 1% normal production traffic without uploading a new version or changing Worker code, Secrets, or D1 schema.

Deployment result:

- Stable version `16333442-925a-4b11-a3d1-d6249d2492ba`: 99%
- Candidate version `cf002344-57ee-4c3f-86a6-115ca66c8b5f`: 1%
- Active deployment before: `d9acb146-b720-4e09-b2b8-0257b93fc407`
- Active deployment after: `9952d7cb-2d99-483a-85f7-c9ada1a09db4`

Observation completed for 20 minutes plus a 5 minute buffer. Production `/health` and `/v1/models` stayed HTTP 200, and the version 13 Preview GET checks also stayed HTTP 200. Bounded `wrangler tail` windows for candidate traffic and candidate errors emitted no JSON invocation or error events. Because no natural candidate invocation was captured, this is not evidence of sufficient real natural candidate traffic; it is a low-traffic 1% canary observation with normal health and no observed candidate runtime errors.

Budget and side effects stayed unchanged: platform budget remained 44 micro-USD / call_count 2, historical `deepseek-chat` remained 21 / 1, and `deepseek-v4-flash` remained 23 / 1. Installations remained 36 and daily usage stayed 5 requests / 4 input tokens / 1 output token. Codex did not actively register an installation or send a chat request in this run.

Rollback was prepared but not executed because no rollback condition triggered. Version 13 remains at 1%; it has not been switched to 100%.
