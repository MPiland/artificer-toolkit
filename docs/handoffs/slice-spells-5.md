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

Next: T12 (5.12), then T11 (5.13b).
