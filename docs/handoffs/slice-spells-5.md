# Slice SPELLS-5: grants apply through APPLY_GRANT (remaining ACs)

Branch: reset to `origin/codex/phase-08-2-convex-cutover` at 163032673. CI branch: `ci/spells-5`.

## Open ACs

- **SPELLS-5.12**: a caster whose Concentration carried over is still concentrating in a later Encounter.
- **SPELLS-5.13**: carried grants count down in a later Encounter, and COMPLETE offers to advance the Campaign clock.

## Proposed tasks (sent to the orchestrator 2026-10-17, awaiting ruling)

- **T10 (5.13a)**: carried timers resume at room START.
  - Remaining ticks are derived from `expiresAtCampaignMinute` and the clock, using the same predicate as `planCarriedOverEffects`.
  - A SOURCE anchor from an earlier Run falls back to HOLDER.
  - Needs a new `CAMPAIGN_CLOCK` capture (contract 1, escalated).
  - Includes a red-first fix: `grantTickPersistence.ts` UPDATE overwrites the whole lifecycle, which drops `concentrationCasterCharacterId`, `expiresAtCampaignMinute` and the other optional fields.
- **T12 (5.12)**:
  - Option (a), recommended: reinstate the carried caster's Concentration as a maintained state at START and relink the in-Run holders. When it ends, append the caster to `concentrationCasterCharacterIds`.
  - Descriptor provenance needs a CARRIED variant (contract 2, escalated). Option (b) threads a discriminated concentration subject through the check contracts instead.
- **T11 (5.13b)**: the GM's completed-Encounter view offers to advance the clock by `ceil(round/10)` minutes, using the existing `campaigns.clock.advance`. Web only.

Order: T10, then T12, then T11.

## Key seams (evidence)

- Carry-over planner: `packages/rules-runtime/src/encounterGrantLifetimes.ts:220-254`. The tick planner skips null remaining ticks at :151, and anchors are resolved at :100-112.
- Convex carry-over: `apps/apis/convex/encounters/runGrantCarryOver.ts`, called from `apps/apis/convex/liveSessions/checkpointRecords.ts:574-577`.
- Check staging needs a slot:
  - `packages/rules-runtime/src/encounterConcentration.ts:43`
  - `apps/session-worker/src/nativeEncounterConcentration.ts:138-157`, 345
- Carried ending: `endCarriedGrantsOfConcentratingCasters` (`packages/encounter-persistence/src/characterRunEffects.ts:84-142`).
- Clock expiry: `apps/apis/convex/campaigns/clockGrantExpiry.ts`. The clock is paused during combat (`clockCombat.ts`).

## Coordination

- RELIABILITY-6 (T3 grant folding) has been asked which files it is editing. Expected overlap is none.
- RELIABILITY-6.7 (deleting descriptor v1) may touch the maintained descriptor schema that T12 extends.

## Status

D151 approved the split (T10, then T12, then T11). The `CAMPAIGN_CLOCK` response carries no `revisions` (deviation accepted by the orchestrator).

**T10 (5.13a): code and tests done, pushing to `ci/spells-5`.**

- `planResumedCarriedEffects` and the SOURCE-anchor fallback (`grantAnchorActorId`, `planDepartedSourceGrantRemovals`) are in `encounterGrantLifetimes.ts`.
- `persistCarriedEffectResumes` (`grantTickPersistence.ts`) runs in the room's START transaction before planning; PREPARED-only, so replays are no-ops.
- `CAMPAIGN_CLOCK` room input: schema scope and response, Convex `readCampaignClockMinute` (`campaigns/clockReads.ts`, shared with `runGrantCarryOver.ts`), Worker `RoomInputs.campaignClockMinute()`.
- Lifecycle spread fix: the turn-effect kernel, its persistence validation and write, and grant ticks keep the optional lifecycle fields (caster stamp).
- Proofs:
  - `grantLifetimes.test.ts`: the resume planner and the anchor fallback.
  - `nativeRoomCarriedGrantResume.test.ts`: the room journey (resume, expiry end, untimed, replay, count-down with stamp).
  - `roomInputs.test.ts` (Convex): the `CAMPAIGN_CLOCK` read.
- Light lane green: rules-runtime 104, worker journey 2, worker neighbours 42, Convex 48 + 15.
- Fixture: `movementRoomFixture` derives a Character row's `sourceEncounterId` with `sourceEncounterIdForDefinition`, so a carried OWNER grant gets null, and takes `campaignClockMinute`.
- Deferred post-launch: joining an ACTIVE Run and worn-form-only carried effects (future-enhancements, Deferred edge cases).

T10 CI: Live backend 39096689340 failed only on generated-file drift; the auto-fix committed 0a8ca61e9 on `ci/spells-5`, merged here before T12.

**T12 (5.12): code and tests done.**

- Descriptor `provenance` union (`ACTION` | `CARRIED`) replaces the top-level `sourceActionId`/`sourceOccurrenceId`; the receipt's `priorState` drops both. The orchestrator approved this as option A: nothing reads the prior state's action ids, and `descriptorChecksum` already pins the prior descriptor. Old dev ledgers are handled by the standing local reset/reseed approval, and the D151 note is added at merge. Stored states migrate through `rules/maintainedProvenanceMigration:run`.
- `planReinstatedConcentrations` (`encounterGrantLifetimes.ts`) and `persistCarriedEffectResumes` reinstate one System Concentration per carried caster in the Run and relink their grants (`effectStore.relinkCarriedCas`); `readCharacterEffect` accepts a relinked stamped row.
- `applyLiveConcentrationCleanup` records a `CARRIED` state's caster in `concentrationCasterCharacterIds`; `requireTurnMaintainedStates` binds a carried turn effect by its caster stamp.
- Proofs: `grantLifetimes.test.ts` (planner), `encounterTurnEffectState.test.ts` (carried binding), `maintainedProvenanceMigration.test.ts` (migration), `nativeRoomCarriedGrantResume.test.ts` (room journey: START reinstates and relinks, Bite damage, failed check ends both carried grants, caster recorded).
- `_generated/api.d.ts` gained the migration module by hand in codegen's shape; CI's live-backend drift check confirms it.
- Deferred post-launch: actor removal of a reinstated caster, undo of a relinked grant, a reinstated state emptied by its own dependents.

**T11 (5.13b): done.**

- `campaignMinutesForRounds`/`ROUNDS_PER_CAMPAIGN_MINUTE` (`rules-runtime/campaignClock.ts`) are the one home of "ten rounds a minute". The carry-over and resume planners and the web offer use them.
- `EncounterClockAdvanceOffer`: right after a COMPLETE command succeeds, the GM's Encounter view offers an ordinary `campaigns.clock.advance` by the elapsed rounds. "Not now" declines it. There's no backend change, and the offer is not persisted: a reload after completing drops it, and the GM can still use the clock editor's Advance.
- Proofs: `CampaignEncounterWorkspace.test.tsx` (journey: complete, offer, advance by 2 minutes for 12 rounds; decline), `campaignClock.test.ts` (rounding).
- T12 journey fix: the fixture stores an OWNER-lifetime carried grant with no source Run, so the untouched unstamped grant asserts `[null, null]`.
- Light lane green: packages 256, Convex 26, Worker 33 + 2, web 14. Typecheck lane `spells-5-t12c` green.
- Ledger: T10 now closes SPELLS-5.13 (its empty `closes` failed `acceptanceProgress.mjs`). T10, T11 and T12 are DONE, and ACs 5.12 and 5.13 are DONE. The PBI's status is left for the merge.

T10 CI green: Tests 39097111839, Live 39097113212. Red proof: `roomInputs.test.ts` (Convex), `nativeRoomCarriedGrantResume.test.ts` and `grantLifetimes.test.ts` are RED. Worker `roomInputs.test.ts` is ALREADY-PASSING.
