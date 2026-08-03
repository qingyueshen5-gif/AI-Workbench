# Non-execution message idempotency implementation plan

1. Derive the identity from channel, user and stable original message ID; never deduplicate by text.
2. Use an exclusive `wx` Claim file with owner, decision and expiry.
3. A valid competing Claim waits for completion and never invokes the renderer.
4. A stale Claim is atomically moved to an archive; only the successful mover retries Claim creation.
5. The owner renders once, persists one result using atomic rename, then marks the Claim complete by removing it.
6. Session user/assistant messages are appended only after the unique result has been persisted.
7. Replays return the persisted result with `messageReplayed=true`, `taskReplayed=false`, and the original stable Delivery Key.
8. FAILED is fail-closed and is not reused as successful output.
9. Gateway business logic and IPC protocol remain unchanged. Existing provider Delivery Fence remains independently responsible for at-most-once external delivery.
