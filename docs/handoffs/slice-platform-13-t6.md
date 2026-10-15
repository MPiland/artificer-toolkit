# Slice workbook: PLATFORM-13.T6 (assisted-party roll-card flake)

**Status:** IN_PROGRESS (started 2026-10-15)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

The SPELLS-8.T1 merge batch (`local-validation/merge-s8t1/apis.log`) had one failure under load: `apps/apis/convex/liveSessions/assistedPartyJourney.test.ts` (the ENCOUNTER-5.1 journey) threw "Conversation not found." at `readRoomRollCards`. The test reads three party members' roll cards through `Promise.all`, and each read runs `checkpointLiveRoom` (`apps/apis/tests/fixtures/localRoomWorker.ts`, `apps/session-worker/test/roomHistoryReads.ts`). Run alone, it passed 4/4 (`local-validation/merge-s8t1/rerun-apj.log`).

Find out why concurrent checkpoints can miss the TABLE conversation, and fix it at the cause:

- **Fixture race:** the fix is in the fixture. For example, the fixture serializes its own room checkpoints the way the real room does, or the conversation is created before the reads. Do not just switch the test to sequential reads, because that hides the race instead of explaining it.
- **Product race in checkpoint or chat:** concurrent checkpoints can lose or not yet see the TABLE conversation in real code. The fix goes in product code with a regression test that fails first: a deterministic interleaving, not a timing loop.

Raising timeouts, adding retries or sleeps, and weakening or reordering assertions are not fixes.

Escalate (`SendMessage` to the main session) only if the cause is a product race whose fix changes checkpoint transaction boundaries, lock order or idempotency.

## Closes

- AC PLATFORM-13.8.

## File scope

- `apps/apis/tests/fixtures/localRoomWorker.ts`, `apps/session-worker/test/roomHistoryReads.ts`, and the journey test.
- Product checkpoint or chat code only if the cause is there.

## Red-first checklist

1. Reproduce the failure deterministically, or explain with evidence (code path and interleaving) why it occurs. Record it in the status log.
2. If the cause is a product race: a regression test that fails on base.
3. The fix at the cause.
4. Proof: the journey passes in a loaded scoped Convex run, the same scope as the merge batch (`liveSessions` plus `encounters`), through the validation runner, with no timeout raised.

## Status log

- 2026-10-15: workbook written.
