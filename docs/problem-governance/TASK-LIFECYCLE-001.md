# TASK-LIFECYCLE-001

- **Problem:** Runtime task state was split between per-conversation active-task files, progress/status files, and terminal result delivery, which allowed stale tasks, duplicate final replies, and status queries to observe component health as task lifecycle state.
- **First failure point:** `AgentRuntime.handle()` updated legacy active-task documents directly while the supervisor also inferred task completion from `status.json`.
- **Lifecycle invariant:** One task entity is keyed by `taskId`; `originalMessageId` is immutable and one-to-one. Every state change must go through `transitionTask(taskId, from, to, reason, actor, evidence)`.
- **Runtime ownership:** Gateway IPC remains transport-only and carries `taskId`. Session context stores conversation history only. `status.json` is component health only. Old active-task files are read-only compatibility artifacts and are never dual-written.
- **Interpreter invariant:** Clarification is valid only when `context.missingFields`, `context.questions`, and low confidence evidence are present. Invalid interpreter output receives one correction attempt; if still invalid, the task explicitly fails.
- **Regression gate:** `scripts/verify-task-lifecycle-001.mjs` exercises `AgentRuntime.handle()` end to end across creation, state transitions, controls, clarification, invalid interpreter handling, status query grounding, terminal binding, restart recovery, and exactly-once final result delivery.
