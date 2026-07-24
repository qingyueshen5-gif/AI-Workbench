# Monthly Budget Production Preflight and Backup

Generated at: 2026-07-24T22:46:30+08:00

## Result

Execution status: `preflight_and_backup_passed`.

This was a production preflight and backup only. No remote D1 migration was executed, no Worker was deployed, no Secrets were changed and no real provider was called.

## Target Confirmation

- Wrangler version: `4.113.0`
- Cloudflare login: confirmed with existing OAuth credentials
- Account: `q***@gmail.com`, account id `351b5cce...7f30`
- Worker: `ai-workbench-managed-proxy`
- D1 binding: `DB`
- Production database: `aiw-managed-proxy`
- Database id: `202583b9...3de8`

The Worker name, D1 database name and database id match `managed-proxy/wrangler.jsonc` and the existing production evidence in `verification/managed-proxy-production/summary.json`.

## Remote Schema

The production D1 database was exported and inspected without recording database contents in Git.

Current remote tables before migration:

- `daily_usage`
- `installations`
- `revoked_tokens`

Row-count metadata:

- `daily_usage`: 33
- `installations`: 33
- `revoked_tokens`: 0

Budget tables before migration:

- `monthly_platform_budget`: absent
- `monthly_model_budget`: absent

No migration table was present in the restored schema.

## Backup

- External path: `D:\AI-Workbench-Backups\2026-07-24-managed-proxy-budget-predeploy\aiw-managed-proxy-predeploy-20260724.sql`
- Size: 20253 bytes
- SHA256: `0D0A554C9BB655578FF747FB04F0B3407874A9022A1B6A9617F800C27AC54AAD`
- SHA256 was calculated twice and matched.
- The SQL file exists, is readable, is larger than 0 bytes and contains schema plus data.
- The SQL backup was not copied into `verification/` and is not committed to Git.

## Local Restore Check

Local `sqlite3` was available at `D:\Anaconda\Library\bin\sqlite3.exe`.

The backup SQL was imported into a temporary local SQLite database. Restore exit code was 0. The restored schema exposed `daily_usage`, `installations` and `revoked_tokens`. The temporary database was deleted after verification.

## Boundary

This evidence must not be described as migration passed or production deployment passed. The next step requires product owner approval before any remote migration or Worker deployment.
