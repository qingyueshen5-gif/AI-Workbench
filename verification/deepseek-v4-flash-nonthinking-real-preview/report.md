# DeepSeek V4 Flash Non-Thinking Real Preview

Status: `v4_flash_nonthinking_real_path_passed`

The new non-thinking-compatible Worker version was uploaded successfully as version 13:

- Version ID: `cf002344-57ee-4c3f-86a6-115ca66c8b5f`
- Message: `DeepSeek V4 Flash non-thinking real validation candidate`
- Preview alias: `budget-v4-nt-real-candidate`
- Preview host: `budget-v4-nt-real-candidate-ai-workbench-managed-proxy.<redacted>.workers.dev`
- Preview host SHA256: `2FD6371B74E77EFB8F201E85D245C61D8F3C8358553C3D38330E422A8EB84048`
- Bundle SHA256: `9ED565A41CE72D68D9D1194CBDDFF676F75EF1240BE28A1FD282AB475B803ABA`

The upload used `wrangler versions upload`. No `wrangler deploy`, no `wrangler versions deploy`, and no Dashboard deployment was used.

Production traffic was not changed. Active deployment stayed `d9acb146-b720-4e09-b2b8-0257b93fc407`; stable version `16333442-925a-4b11-a3d1-d6249d2492ba` stayed at 100%; failed candidate `483e4fae-3af8-40fa-ab83-4551f08b519e`, version 12, and version 13 stayed at 0% normal production traffic.

Local validation passed: TypeScript passed, Managed Proxy tests were 19/19, Wrangler config JSON parsed, and `git diff --check` passed.

No-cost Preview gate passed:

- Preview `GET /health`: HTTP 200
- Preview `GET /v1/models`: HTTP 200
- Model row: `deepseek-chat`, `logical_alias`, upstream `deepseek-v4-flash`, `thinking_mode: disabled`
- Preview unauthenticated `POST /v1/chat/completions`: HTTP 401 `missing_token`
- Budgets remained platform 21/1 and historical `deepseek-chat` 21/1; no `deepseek-v4-flash` row was created.

The real-call phase did not complete. The one-time Node script sent the single approved registration request, then crashed while trying to read the pre-chat budget with `spawnSync npx.cmd EINVAL`. D1 confirms registration side effects: installations increased from 34 to 35 and today's daily usage request count increased from 2 to 3. Platform and model budget rows did not change, so no chat reservation and no provider call occurred.

The token existed only in the crashed process memory, was not printed, and was not persisted. Because the run allowed exactly one registration and it has been consumed, the real chat was not attempted and must not be retried without fresh product-owner approval.

Final state:

- Registered installation attempts: 1
- Authenticated chat attempts: 0
- Provider calls: 0
- Retry count: 0
- Platform budget remains 21 micro-USD / call_count 1
- Historical `deepseek-chat` row remains 21 micro-USD / call_count 1
- `deepseek-v4-flash` budget row still absent
- Secrets unchanged
- D1 schema unchanged
- Production traffic unchanged

Run2 reused the existing version 13 and did not upload or deploy any Worker version. The Token-holding Node process was reduced to network-only work: register once, keep Token in memory, chat once, emit sanitized results, and exit. It did not call child processes, Wrangler, `npx.cmd`, `cmd.exe`, or PowerShell.

Run2 result:

- Registration attempts: 1
- Registration HTTP status: 200
- Token obtained: yes, in memory only
- Chat attempts: 1
- Chat HTTP status: 200
- Provider model: `deepseek-v4-flash`
- Answer: `OK`
- `finish_reason`: `stop`
- Usage: prompt 7, completion 1, total 8
- `reasoning_content`: absent/null/empty
- Retries: 0

Budget result:

- Platform budget: 21/1 -> 44/2, delta +23 micro-USD and +1 call
- `deepseek-v4-flash`: absent -> 23/1, delta +23 micro-USD and +1 call
- Historical `deepseek-chat`: stayed 21/1
- Installations: 35 -> 36
- Daily usage: 3 requests / 2 input / 0 output -> 5 requests / 4 input / 1 output

Production state remained unchanged. Active deployment stayed `d9acb146-b720-4e09-b2b8-0257b93fc407`; stable version stayed 100%; version 13 stayed 0% normal production traffic. Secrets, D1 schema, Worker code, and Wrangler config were not modified.
