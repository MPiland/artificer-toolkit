# Slice workbook: PRIVACY-1.T1 (replay after an ownership transfer shows the wrong audience's projection)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

`apps/apis/convex/encounters/developmentLifecycleProof.test.ts` fails intermittently in CI and passed 3 of 3 runs locally on base `79a60ef0a` (`local-validation/lifecycle-base/`). It failed on unrelated branches:

- `ci/spells-17-t2`, run 38782976507 (Convex 3/4);
- ATTACK-9.T1 run 38781276358, attempt 1;
- SPELLS-8 run 38782673073, and once locally in that worktree.

It passed on the merge run 38776510529.

The failing assertion is `apps/apis/tests/developmentEncounterTransactions.ts:286`.

1. Ownership goes to the player and back. The owner is OWNER again.
2. The test checkpoints the room and reads `api.encounters.projectionReads.get` as the owner. That returns the GM projection: the Wolf has `currentHitPoints: 11` and its features.
3. The owner then replays the earlier START command by its command ID.

The replay returned the player projection: `health: null`, with no features. So the room presented the replay for the owner's old role, PLAYER.

The reverse case is the privacy risk. If the room can present a replay for a stale role, a former owner who is now a player may be shown the GM projection. PRIVACY-1.2 says ownership transfer changes the audience. PRIVACY-1.4 says every command result and replay a player receives is the redacted player projection.

Find the cause. Candidates:

- the room's cached member role is not refreshed when ownership changes (or after a checkpoint);
- a replay presents from the role stored with the original command, or from a stale replay index entry (`apps/session-worker/src/roomEncounterReplayIndex.ts`, `roomEncounterCommands.ts`, `nativeLiveSessionRoom.ts`);
- the role refresh races the replay.

Fix it at the cause. A replay is always presented for the issuer's current role. Do not add a retry, a wait or a re-read in the test.

Escalate (`SendMessage` to the main session) only if:

- the fix changes who may replay a command (PRIVACY-1.5) or what a replay returns; or
- it needs a transaction-boundary or lock-order change in the Worker commit.

Read first: the PRIVACY-1 and D86 entries in `docs/handoffs/phase-08-2-decisions.md`, and `docs/architecture/` on room authority and redaction.

## Closes

- AC PRIVACY-1.7.

## File scope

- `apps/session-worker/src/**`: room membership and role, replay presentation.
- `packages/encounter-persistence` only if the replay record carries the role.
- Tests next to each. `apps/apis/tests/developmentEncounterTransactions.ts` only to add assertions; never weaken the one at line 286.

## Red-first checklist

1. **Reproduce:** make the failure deterministic before fixing it. Use a focused Worker or Convex test that orders the steps (transfer, transfer back, checkpoint, replay) so the stale role is forced, not timed. If you cannot force it, record how often it fails in a loop of scoped runs and what timing makes it fail.
2. **Both directions, red on base:**
   - the owner who has regained ownership replays and gets the GM projection;
   - the former owner, now a player, replays a command they issued as owner and gets the redacted player projection, with no `currentHitPoints` or GM-only features.
3. **Fix**, then the tests green, plus `developmentLifecycleProof.test.ts` and the PRIVACY-1 Worker tests.
4. **CI:** push to `ci/privacy-1-t1` and confirm Convex 3/4 is green. A failure there is a finding, not a rerun.

## Status log

- 2026-10-15: workbook written.

## Proposed ledger edits (filled by the slice session)
