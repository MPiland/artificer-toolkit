# Slice workbook: PRIVACY-1.T1 (replay after an ownership transfer shows the wrong audience's projection)

**Status:** done, CI green (run 38795738617)
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
- 2026-10-15: **Root cause: a test race against asynchronous notice delivery, not a Worker defect.** On an ownership transfer Convex queues `EVICT_USER` and `INVALIDATE_INPUTS` through `scheduler.runAfter(0, liveSessions/control:send | evictUser)`. The Worker's cached member role changes only when the room receives that notice (or at the lease's end). The proof's checkpoint and replay ran from the test clock, so the scheduled delivery sometimes landed before the owner's replay and sometimes after it. When it landed after, the room still held the PLAYER role the owner had on the first transfer and presented the replay as the player projection. Found by code analysis (`roomAuthorization.ts`, `roomEncounterReadPorts.ts` `requireCampaignAuthority`, `roomEncounterCommands.ts` `replayRoomEncounterCommand`, `nativeLiveSessionRoom.ts` control route and `#queueEagerReload`, `controlScheduling.ts`); the failure was not reproduced locally (a worktree has no `node_modules`; the CI run is the proof). It is the documented "Accepted exposure" in `docs/architecture/live-sessions.md`: room-local commands run from the cached role until the notice is delivered, bounded by the 60 s lease. The main session ruled option A (harness delivers the notice; room unchanged); options B (checkpoint carries the CAMPAIGN revision) and C (per-command authorization refresh) rejected as re-litigating ADR 0035 Amendment 21.
- 2026-10-15: **Fix (harness only).** `deliverQueuedRoomControl(t)` in `apps/apis/tests/fixtures/localRoomWorker.ts` runs the pending `liveSessions/control:send` and `evictUser` jobs the product itself queued (cancelling the scheduled copy so it cannot run twice), against the real local room worker, in rounds until none are pending (a refused delivery reschedules itself with a 1 s fake-time delay). `verifyEncounterTransactions` takes an optional `deliverRoomControl` and calls it after each ownership transfer, before the first checkpoint and before the `role === 'OWNER'` assertion. The assertion at the old line 286 is unchanged. No sleep, retry or re-read; no timeout raised. Scheduled delivery reaches the room in this harness, so the `invalidateRoomInputs` fallback was not used. Deviation: the workbook's file scope named `developmentEncounterTransactions.ts` "only to add assertions"; the main session approved the harness edit.
- 2026-10-15: **Worker tests** `apps/session-worker/test/nativeRoomOwnershipReplay.test.ts`, green on base code (no `src` change). Both directions, each after a transfer whose `INVALIDATE_INPUTS` notice the room received and with the Campaign scope revision moved, as Convex does:
  - owner → player → owner, then the regained owner replays their GM void of a movement decision and gets the GM projection, equal to the live one;
  - owner → player, then the former owner (now PLAYER) replays the command they issued as owner and gets the redacted player projection: no `currentHitPoints`, `features`, `gmNotes`, `resources` or `statBlock`.
  - The role-changed GM socket closing with "Campaign access ended." is asserted in both tests (also proved at `nativeLiveSessionRoom.test.ts` "follows an ownership transfer").
  - Fixtures: `roomAuthorizationResponse` takes an optional `campaignRevision`; `movementRoom` exposes a mutable `campaignRevision` it serves. Without a moving revision the room's Campaign rows are never reloaded after a transfer, which production does not do.
- 2026-10-15: **Lost or late EVICT_USER.** No path found that leaves a former owner with the GM view beyond one lease. A lost `EVICT_USER` keeps retrying until acknowledged (`deliver()`); a lost `INVALIDATE_INPUTS` stops after 5 attempts but the 60 s lease renews through `refresh()`, which reads the new role and closes mismatched sockets (`#refreshAuthorization`, `admitsRoomMember`); the old socket can be served only from the cached role for at most one lease.- 2026-10-15: **Validation.** Local runs not possible (no `node_modules` in the worktree); CI on `ci/privacy-1-t1`, run [38795738617](https://github.com/MPiland/artificer-toolkit/actions/runs/38795738617), merged base `codex/phase-08-2-convex-cutover` at 60c514fb5b: all 9 jobs green, including Convex suites 1/4 to 4/4 (3/4 holds `developmentLifecycleProof`), Packages and Worker (both new tests ran) and the three typechecks. Log: `local-validation/privacy-1-t1/ci-watch.log`. One green run is a single sample of an intermittent failure; the cause is removed rather than sampled. Red on base was not captured: the old failure needs the unordered scheduler, which the harness no longer leaves to chance.

## Proposed ledger edits (filled by the slice session)

- AC PRIVACY-1.7 → DONE. Proof: `apps/session-worker/test/nativeRoomOwnershipReplay.test.ts` (both directions, notice delivered, then replay) and `developmentLifecycleProof.test.ts` (deterministic through `deliverQueuedRoomControl`); CI run 38795738617. Its text already reads "once the room has received the ownership notice, a replay is presented for the issuer's current role".
- Task PRIVACY-1.T1 → DONE.
- Remove `activeWorkbook` from PRIVACY-1.T1 at merge.
