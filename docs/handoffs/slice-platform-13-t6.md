# Slice workbook: PLATFORM-13.T6 (assisted-party roll-card flake)

**Status:** READY_FOR_MERGE (started 2026-10-15)
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
- 2026-10-15: **Cause found: neither a fixture race nor a product race.** The auto-roll test's dice queue left an initiative tie to unqueued platform dice. The room's declaration order is random per run, and the queue `[4, 9, 14, 4, 9]` (two d20 for each advantage Character, one for the Wolf) is consumed in declaration order. When the Wolf declares second, Aria and Bryn both score best-of-(4, 9) and tie. The tie-break draws platform dice, which re-tie about one time in twenty, and an unresolved tie leaves a manual `INITIATIVE_ORDER` choice. The Run then stays `PREPARED` at version 0 and its occurrence stays `PENDING`. Nothing ever writes the initiative rows or the TABLE conversation and its roll cards, so `chat.list` throws "Conversation not found." Load only made the 3-in-83 rate visible; it does not cause it.
  - Evidence (repro: the journey's third test copied 83 times, no extra load, `red-stress-before-fix.log`): 3 to 8 failures of 83 across runs.
    - Every failing campaign's checkpoint 3->4 carried only the declaration tables (`red-bridge-before-fix.log`); a passing one carried `campaignConversations`, `campaignConversationMembers`, `campaignConversationEntries`, `encounterInitiativeParticipants` and `encounterRuns`.
    - The room's receipt for command 4 in failing campaigns was `PREPARED/0/0` with occurrence status `PENDING`; passing ones were `ACTIVE/1/1` with `COMPLETE` (`red-probe-before-fix.log`).
    - After the three declarations the GM's `pendingRuleOccurrence` in the three failing campaigns was `INITIATIVE_ORDER` with the two Characters as `optionIds`.
    - In all three failures the Wolf declared second. Earlier failures in other orders also ended with command 4 at `PREPARED/0/0`, but their pending kind was not captured, so a tie in those orders is inferred from the same dice arithmetic, not observed.
  - Fix: the queue is `[0, 1, 10, 2, 19]`. For every position the Wolf can declare in, the three best scores are at least nine faces apart, and each Character's two dice differ. Test 3's assertions are unchanged.
  - Proof: the same 83-repeat stress passes 83/83 (`green-stress-after-fix.log`).
- 2026-10-15: **Scoped proof on the merged source (base merged at `9a41d36f0`).**
  - Heavy lane, local, no timeout raised, nothing else of mine running (other sessions' batches were queued, not concurrent): `convex/liveSessions` 26/26 files, 168/168 tests, 313 s (`local-validation/platform-13-t6/final-live.log`), includes the journey. `convex/encounters` as one batch hit the runner's 20-minute limit (exit 124), so it was split into four name-interleaved chunks of 21 files; chunks 0 and 1 passed 42/42 files, 297/297 tests (`enc-0.log`, `enc-1.log`). The remaining chunks were moved to CI at the orchestrator's request.
  - CI (`ci/platform-13-t6`, run 38802484516): build, both typechecks, web tests, packages and Worker, and Convex shards 1, 2 and 4 pass; the journey passes (4/4, 11 s). Shard 3/4 has one failing file, `encounters/developmentLifecycleProof.test.ts` (95/96 files, 547/548 tests). It failed on a job rerun too, so it is deterministic. It is not this slice: this branch changes only the journey test's dice queue, and the same file fails on `ci/merge-platform-13-t9` (38802771124) and `ci/accounts-7-t1` (38804251333). The assertion diff is an actor-projection shape mismatch (`health: null` where `currentHitPoints`, `healthBand`, `features` and the rest are expected) in the lifecycle proof's Manual/Assisted step.
  - Limit: no red-first regression test is possible, because the declaration order cannot be forced; the red/green evidence is the 83-repeat stress.
- Proposed ledger edits (not applied): AC PLATFORM-13.8 done; retire follow-up T6; register `developmentLifecycleProof` projection failure on the base as a new item.
