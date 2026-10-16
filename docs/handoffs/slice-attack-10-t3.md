# Slice workbook: ATTACK-10.T3 (opportunity attacks and Disarm apply attack-roll sight)

**Status:** T3a, T3b and T3c DONE (CI ids below).
**Closes:** AC ATTACK-10.4. **Decision:** D100 (see [phase-08-2-decisions.md](phase-08-2-decisions.md)).
**Split (2026-10-16):** T3a movement-reaction condition contributions, T3b opportunity-attack roll sight, T3c Disarm.

## What changed (T3a, T3b)

- **T3a.** `createEncounterMovementReactionPerception` reuses `resolveEncounterActorPairPerception`, so Blinded and Invisible gate the reaction.
- **T3b, execution.** `prepareNativeActionTest` / `continueNativeActionAfterTest` / `reconstructNativeActionTest` (`encounterActionExecution.ts`) take `attackSight` and carry `d20Belief`, `heldD20` and `modeAdjustment` like the graph path, through the shared `sightGovernedStageD20` and `heldStageD20`.
- **T3b, persistence.** The movement `ACTION_EVIDENCE` phase gained `d20Belief` and `heldD20` (`ruleExecutionSpatialPendingContexts.ts`); `retainEncounterMovementReactionActionEvidence` writes them; `requirePendingMatch` compares the belief and a snapshot-held pending takes `heldD20` from the phase.
- **T3b, replay.** `resolutionForRetainedEvidence` replays a mode-adjusted d20 as the roller's own entries.
- **T3b, Worker.** `prepareReaction` (`nativeEncounterMovement.ts`) supplies `loadAttackPerception` at the contact point.
- **T3b, redaction.** `projectEncounterSpatialOccurrenceSummary` takes `viewer.isOwner` (all callers updated).

## What changed (T3c, Disarm)

- **Shared helpers.** `encounterSightGovernedD20.ts` (new) holds `sightGovernedStageD20`, `heldStageD20` and `settleSightGovernedD20`, extracted verbatim from `encounterActionExecution.ts`; RESOLVE_ACTION, opportunity attacks and Disarm all use them.
- **Contest executor.** `executeEncounterOptionalContestAction` takes `initiatorSight`; the initiator's answer settles through `settleSightGovernedD20` and a missing die returns PENDING with a `held` die on the same continuation.
- **Pending contract.** `encounterActionPending.ts`: a `heldD20` is valid with a contest as well as a d20 policy.
- **Worker.** `nativeDisarm.ts` passes `sceneContext` and `loadAttackPerception` to `prepareEncounterActionMechanics`, so the contest's initiator policy carries the true sight; it stores `d20Belief` and `heldD20` in the pending context and records only the answered participant's roll evidence. `projectNativeActionPending` already redacts a contest's belief and held die for non-owners.
- **Side effect.** Disarm now also gets the melee/long-range and condition attack contributors (intended: it is an attack roll).

## Proof paths

| Criterion | Proof |
| --- | --- |
| The reaction's perception applies Blinded and Invisible | `packages/rules-runtime/src/__tests__/encounterMovementReactionPerception.test.ts` |
| An opportunity attack against a mover that can't see its reactor rolls with advantage and keeps the higher die | `apps/session-worker/test/nativeMovementAttackSight.test.ts` |
| A player rolling an opportunity attack against a mover that can't see them is shown a normal roll, holds the die, and the GM sees the full reason | `nativeMovementAttackSight.test.ts` (player-view test; `movementRoomFixture.ts` `pendingFor`) |
| Disarm against a Blinded target auto-rolls in the true mode, and a prompted initiator holds one die and settles in the true mode | `apps/session-worker/test/nativeRoomDisarm.test.ts` |
| A player's Disarm prompt hides the hidden fact (normal roll, generic held-die caption); the GM sees the full reason | `apps/apis/convex/encounters/actionDisarm.test.ts` |

## Open

- No direct unit test of the rules-runtime contest executor with `initiatorSight`; it is proved through the Worker and Convex Disarm tests.
- Deferred (future-enhancements, Deferred edge cases): movement reactions and Disarm post no `D20_MODE_ADJUSTED` card, and Disarm stores no `modeAdjustment`.
