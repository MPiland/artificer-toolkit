# Slice workbook: ATTACK-10.T3 (opportunity attacks and Disarm apply attack-roll sight)

**Status:** T3a and T3b DONE (CI green on both workflows); T3c (Disarm) in progress.
**Closes:** AC ATTACK-10.4 (when T3c lands). **Decision:** D100 (see [phase-08-2-decisions.md](phase-08-2-decisions.md)).
**Split (2026-10-16):** T3a movement-reaction condition contributions, T3b opportunity-attack roll sight, T3c Disarm.

## What changed (T3a, T3b)

- **T3a.** `createEncounterMovementReactionPerception` reuses `resolveEncounterActorPairPerception`, so Blinded and Invisible gate the reaction.
- **T3b, execution.** `prepareNativeActionTest` / `continueNativeActionAfterTest` / `reconstructNativeActionTest` (`encounterActionExecution.ts`) take `attackSight` and carry `d20Belief`, `heldD20` and `modeAdjustment` like the graph path, through the shared `sightGovernedStageD20` and `heldStageD20`.
- **T3b, persistence.** The movement `ACTION_EVIDENCE` phase gained `d20Belief` and `heldD20` (`ruleExecutionSpatialPendingContexts.ts`); `retainEncounterMovementReactionActionEvidence` writes them; `requirePendingMatch` compares the belief and a snapshot-held pending takes `heldD20` from the phase.
- **T3b, replay.** `resolutionForRetainedEvidence` replays a mode-adjusted d20 as the roller's own entries.
- **T3b, Worker.** `prepareReaction` (`nativeEncounterMovement.ts`) supplies `loadAttackPerception` at the contact point.
- **T3b, redaction.** `projectEncounterSpatialOccurrenceSummary` takes `viewer.isOwner` (all callers updated).

## Proof paths

| Criterion | Proof |
| --- | --- |
| The reaction's perception applies Blinded and Invisible | `packages/rules-runtime/src/__tests__/encounterMovementReactionPerception.test.ts` |
| An opportunity attack against a mover that can't see its reactor rolls with advantage and keeps the higher die | `apps/session-worker/test/nativeMovementAttackSight.test.ts` |

## Open

- T3c Disarm: `nativeDisarm.ts` needs `loadAttackPerception` (its `sceneContext` is computed after the prepare call) and belief storage in the Disarm contest pending.
- Not covered: the player-side believed prompt and held die of an opportunity attack have no room test yet (the room fixture has no player-rolled reaction). Registered for T3c's pass.
- Movement reactions post no settled roll card, so a sight-adjusted opportunity attack shows no `D20_MODE_ADJUSTED` card.
