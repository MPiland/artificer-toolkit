# SPELLS-31.T4k1: Protection and Giant Killer (D217)

Split on 2026-11-10 after the design pass: T4k1 (predicates, trigger and outcome authoring), then T4k1b (Protection pause) and T4k1c (Giant Killer offer), which can run in parallel.

## Predicates (T4k1, orchestrator ruling within D217)

- **Size:** one size predicate. Extend `TARGET_SIZE_MAXIMUM` (`packages/schema/src/effects/actorRelationship.ts`) into a size range (minimum and/or maximum) and migrate its users and data; do not add a parallel minimum kind.
- **Equipped item:** a generic "holder has an equipped item of category X" predicate (Protection: SHIELD). Reuse the equipped-item facts the Dueling rule reads (`packages/schema/src/api/characterActionRules.ts` ~105).
- **Distance:** a within-N-feet predicate measured from the reactor to the triggering creature or to the attack's target.
- Named by domain, never by feature.

## Protection (T4k1b)

- **Trigger:** `ATTACK_ON_OTHER { requiresSight?, targetWithinFeet }`. Add it in:
  - `packages/schema/src/shared/reaction.ts`
  - `packages/shared/src/domains/effects/authored/effect.ts`
  - `packages/schema/src/shared/ruleExecutionReactionChoice.ts`
  - `encounterEventTable.ts` and `encounterEventHooks.ts`
- **Outcome:** `IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL { rollMode }`. Plumb it like `SUBTRACT_FROM_TRIGGERING_ROLL`:
  - `effectKind.ts`, the authored type and the schema
  - `compilers/effect.ts`
  - `effectActionCompiler.ts`, `effectActionContracts.ts` and `effectActionOutcomes.ts` (REACTION_ONLY_OUTCOMES)
  - the operation registry and `runtimeTier.ts`
  - `characterActionRuleFacts.ts`
  - `packages/schema/src/effects/path.ts`
- **Injection:** reaction-sourced roll-mode contributors merge through `mergeCanonicalD20Contributors` in `encounterActionMechanicsPreparation.ts` (~950).
  - The source is a RULE source `ROLL_MODE_RULE_SOURCE_IDS.REACTION`, labelled "Reaction" in `encounterRollModeReasons.ts`, with domainKey `reaction:<reactorActorId>`.
  - The `CAST_MODIFIER` rule contributor is the precedent.
- **Pause:** `ROLL_INFLUENCE_REACTION` in `packages/schema/src/shared/encounterPause.ts`, modelled on `createNativeCastPause` (`nativeEncounterCastPause.ts`).
  - It runs in `nativeEncounterRules.ts` after the gate and retarget steps, before `castPause.advance`, and is skipped once resumed.
  - The ENCOUNTER_ACTION context records the influences used and the reactors already asked, like `passedIncomingGate` and `failedCounters`.
  - The terminal commit spends each used reaction through the `applyFailedCounterSpends` and `windowReactions` route.
- **Touch points:**
  - Worker: `nativePauseHandlers.ts`, `nativePauseTypes.ts`
  - Persistence: `packages/encounter-persistence/src/actionPending.ts`, `actionPendingPersistence.ts`, `occurrenceOwner.ts`
  - Schema: `encounterActionPending.ts`
  - the web drawer
- **Proofs:**
  - `nativeRoomCuttingWords.test.ts` is the room-journey pattern;
  - `actionPendingOffers.test.ts` covers the validators.

## Giant Killer (T4k1c)

- **Why a new trigger:** `HIT_BY_ATTACK` fires only on a hit (`apps/session-worker/src/nativeEncounterAttackReaction.ts:101`) and pauses before damage, so it cannot serve.
- **New trigger:** `ATTACK_RESOLVED_ON_SELF { outcome: HIT | MISS | ANY }` with attacker predicates (size range, within 5 ft). It reads the settled attack result against AC and never recomputes it.
- **The offer:** after the attack commits, a reaction opportunity with its own pending record and timer (`readPendingRunDecision`). USE runs an ordinary REACTION-activation weapon attack by the reactor against the triggering creature. Only the pin, timer and decline path are shared with T4k1b.

Each piece removes its closed-rule effects from source data. `closedRuleKind.ts` is left to SPELLS-4.T4e.
