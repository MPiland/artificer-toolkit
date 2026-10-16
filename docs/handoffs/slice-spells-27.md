# Slice workbook: SPELLS-27 (effects end on their authored end events)

**Status:** T1 in progress (2026-10-15): D122 ruled; spike done; bare timed-condition plan implemented and awaiting CI on `ci/spells-27`. `packages/source-data` not edited.
**Base:** `codex/phase-08-2-convex-cutover` (a51dfa81f).
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0038](../adr/0038-rules-authored-from-core-options.md), D95, D113, D115, D116 in [phase-08-2-decisions.md](phase-08-2-decisions.md).

## ACs

- **27.1** An effect authored to end on an event ends when its holder triggers it, through one generic end-event consumer. Invisibility ends when the invisible creature makes an attack roll or casts a spell, and GM undo of that attack or cast restores it.
- **27.2** Every SRD effect whose text ends it on an event authors that end event from core options (Sanctuary, Charm Person); a corpus test lists any SRD effect left with such text and no authored end event.

## 1. Current mechanics (verified in source)

### Vocabulary: two overlapping flat enums

`packages/schema/src/shared/enums.ts:339-356`, node map `packages/shared/src/domains/effects/maps/path.ts:335-348`:

| Field                  | Authored values                                                                 | A timed grant may carry                      |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `consumeOnFirstEvents` | `ON_ATTACK_ROLL`, `ON_ABILITY_CHECK`, `ON_CAST_SPELL`                           | `ON_ATTACK_ROLL`, `ON_ABILITY_CHECK`         |
| `endOnEvents`          | `ON_ATTACK_ROLL`, `ON_CAST_SPELL`, `ON_HIT_POINTS_REGAINED`, `ON_INCAPACITATED` | `ON_HIT_POINTS_REGAINED`, `ON_INCAPACITATED` |

`ON_ATTACK_ROLL` and `ON_CAST_SPELL` are authorable in both fields, but the compiler rejects them on a grant's end list (`isGrantEndEvent`, `effectActionCompiler.ts:1280`), and nothing reads them anywhere else.

### Consumers (all in `encounterGrantLifetimes.ts` plus callers)

- **`consumableGrants(effects, event)`** matches `consumeOnFirstEvents` for effects that are a modifier grant (`isModifierGrant`) or a concealment (widened by ATTACK-10.T1, D116). Callers:
  - attack roll: `nativeEncounterRules.ts:463`, `nativeEncounterMovement.ts:242`, `nativeDisarm.ts:362`, and the Legendary window commit (now `persistEncounterTurnResources`);
  - ability checks: `encounterBasicActionCheck`, `encounterEscapeCheck`, `encounterConcealmentCheck`, `encounterMovementPassageResponse`.
- **`grantsEndedBy(effects, event)`** matches `endOnEvents` for modifier grants only. Its only real caller is `endGrantsOnHitPointsRegained` (`mechanicsBatchPersistence.ts:114`, `commands.ts:448`). There is no `ON_ATTACK_ROLL` or `ON_CAST_SPELL` call site (confirmed: `grantsEndedBy(held, 'ON_ATTACK_ROLL')` is asserted `[]` in `encounterZonePlacementCompilation.test.ts:247`).
- **`grantsEndedByHolderState`** (D95/D113): `ON_INCAPACITATED` and `endOnConditionIds`, detected at the D95 point; the ended grants travel as `endedGrants`.
- **No code path ever fires `ON_CAST_SPELL`.** No Encounter commit carries a "this action was a spell cast" fact to match on.

### Undo by receipt (already generic)

`receiptConsumedGrants({consumedGrants, endedGrants})` builds the root command's `consumedGrants`. Action, area, basic-action and cleaving roots all call it. `restoreConsumedGrants` re-creates each exact `ActiveRuleEffectRecord` (same id, ordinal, version, timestamps), and `addEndedGrantsToRoot` lets a later response add records to the root. This works for any `ActiveRuleEffectRecord`, not only grants. Nothing new is needed for the effect record itself.

### How Invisibility is held today

- Authored (`spells/invisibility.ts:68-78`): result block `duration` 1 hour, `lifecycle.endOnEvents ['ON_ATTACK_ROLL','ON_CAST_SPELL']`, one `CONDITION` outcome (`INVISIBLE`, which carries `EMISSION_SUPPRESS` / `bypass INVISIBILITY` in `ruleState.ts:141-149`). A concentration spell.
- Compile: a bare `CONDITION` outcome with no save compiles to `CONDITION_APPLY` (`effectActionCompiler.ts:2387`). **No active-effect plan covers it.** The plans that own a timed condition all hang off a save: `repeatingDirectFollowUpSavePlan`, `repeatingImmediateFollowUpSavePlan`, `timedImmediateConditionPlan` (needs a "condition on failure" save). So the 1-hour duration and the `endOnEvents` are dropped. This is the first gap and is separate from the missing consumer. (Verify with a red test in T1 before relying on it.)
- Condition ownership already exists: an active effect with a `CONDITION_OWNERSHIP` contribution (`conditionId`, `baselinePresent`) owns a condition. When it expires, the turn-effect kernel removes the condition unless a baseline or another owning effect retains it (`turnEffectRetainedConditions`, `turnEffectsPersistence.ts:202`, `retainedConditionIds` on the mechanics batch).
- `planEncounterGrantTicks` and `planDepartedSourceGrantRemovals` are gated by `isModifierGrant`, so a condition-owning effect counts down through the turn-effect kernel (`recurrenceStage END_OF_TURN`), not the grant tick planner. After a Run completes, a condition-owning effect was not carried to the Campaign clock (D99 covered modifier grants only; SPELLS-5.T9 fixes it, below). One hour is 600 turns, below `MAX_ACTIVE_EFFECT_TURNS` (10,000).

### Node map

`lifecycle.endOnEvents` / `consumeOnFirstEvents` are `selectMulti` inline-option nodes in the lifecycle node map. Adding an enum value needs: `core/path.ts` registry (label, description), `schema/enums.ts`, and the grant subset schema if grants may carry it. An authored-parity test follows ADR 0038 decision 1.

## 2. Design: one generic consumer

### The semantics are the same

For an attack roll, "consumed by the first attack roll" (Hide, Absorb Elements, Vicious Mockery) and "ends on an attack roll" (Invisibility) behave identically: the roll is made with the effect, then the effect is gone, in the same commit, restored by the same receipt. The split between `consumeOnFirstEvents` and `endOnEvents` is historical, so the enums overlap.

### Options

- **Option 1: extend the end side only.** Widen `grantsEndedBy` beyond modifier grants, add `ON_ATTACK_ROLL` and `ON_CAST_SPELL` call sites that read `endOnEvents`. Leaves two parallel consumers over the same effect set (`consumableGrants` for one list, `grantsEndedBy` for the other), so every new attack-roll site must call both.
- **Option 2 (recommended): one consumer over both lists, predicate widened.** Rename/replace the pair with one `effectsEndedBy(effects, event)` that matches `consumeOnFirstEvents ∪ endOnEvents` for **any** v2 effect (drop the `isModifierGrant` / concealment gate, which exists only because nothing else carried these lists). Every existing attack-roll and check call site keeps its current shape; HP-regained and the D95 detectors reuse it. Persistence deletes the matched records and puts them in the receipt through the existing `receiptConsumedGrants`. For a condition-owning record the same delete also releases the condition via `turnEffectRetainedConditions` semantics. No schema rename; the overlapping enum values stay authored but have one meaning.
- **Option 3: unify the fields** (`endOnEvents` only, delete `consumeOnFirstEvents`). Cleanest end state and consistent with the pre-launch rule, but about 37 files plus SRD records and stored data. Recommended as a separate cleanup slice after Option 2 proves the consumer, not inside this one.

### What Option 2 needs

1. **A plan for a bare timed condition** (new generic compiler plan beside `timedImmediateConditionPlan`): a `CONDITION` outcome with a duration, no save, and a lifecycle of consume/end events becomes an active effect with `CONDITION_OWNERSHIP`, `expiration TICKS` anchored on the holder, and its `recurrence` event lists. Targets a willing creature (Invisibility) and also feeds Greater Invisibility / See Invisibility-style spells.
2. **Condition release on delete.** The attack/cast commit writes the holder's state, so a delete of a condition-owning effect must also drop the condition (or the condition set is derived from owning effects; see risk 1).
3. **`ON_CAST_SPELL` event.** The committed action must expose "this action is a spell cast" (a generic occurrence fact; cantrips count), read at commit and at the same sites as `ON_ATTACK_ROLL` (action, area, reaction-cast).
4. **Authoring parity.** An author-built Invisibility variant (e.g. ends on attack only) through the real form and publication equals the SRD record, resolves and ends the same way (ADR 0038 proof).

### Risks to settle before building

1. **Condition write at attack/cast commit.** The attacker's Character state is probably not written by an action commit today. If conditions are stored (not derived), the commit needs a mechanics-batch write for the holder, plus restore on undo. If conditions are derived from the live ownership effects, deleting the effect is enough. T1 starts with a spike that answers this by reading `encounterCharacterMechanicsBatch.ts` and the escape-removal path, and reports before more is built.
2. **Carry-over (D99).** A Run that completes with Invisibility active: condition-owning effects are not carried to the Campaign clock today. Out of scope for 27.1 unless the spike shows it is cheap; if so it is a registered follow-up.
3. **Concentration.** Invisibility is a concentration spell. The `maintenancePlan` link must still end the effect when concentration drops.

## 3. Event vocabulary for 27.2

Corpus scan (spell descriptions in `packages/source-data/src/srd/spells`, two passes with regexes; not exhaustive, see T5 for the scan that backs the test):

| Event the text names                                      | SRD spells found                                                                                         | Authorable today?                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Holder makes an attack roll                               | Invisibility, Mislead ("invisibility ends if you attack")                                                | yes, `ON_ATTACK_ROLL`                                            |
| Holder casts a spell                                      | Invisibility, Mislead                                                                                    | yes, `ON_CAST_SPELL` (no emission)                               |
| Holder attacks or casts a spell that affects an **enemy** | Sanctuary                                                                                                | no: needs an enemy qualifier                                     |
| Holder takes damage                                       | Hypnotic Pattern, Sleep ("sleeper takes damage"), Sequester, Modify Memory, Project Image (the illusion) | no: `ON_DAMAGE_TAKEN`                                            |
| Source or its companions harm the holder                  | Charm Person                                                                                             | no: damage taken **from the source side**                        |
| Holder is attacked or harmed; witnesses friends harmed    | Calm Emotions                                                                                            | partly: attacked/harmed = damage taken; "witnesses" has no event |
| Holder's creature takes damage (a bound creature)         | Phantom Steed (the steed)                                                                                | no, depends on a bound creature; leave on the allow-list         |
| Holder regains HP / is incapacitated                      | caltrops-style penalties, Rage                                                                           | yes, already consumed                                            |

Not events of the holder, so not in scope for the consumer; the test lists them with the mechanism that covers each:

- Dismissed or recast (Light, Produce Flame, Minor Illusion, Foresight, Shillelagh): `holderEnd` or concentration.
- Someone uses an action to wake or shake a creature (Sleep, Hypnotic Pattern): a GM or holder action, not a commit event.
- Distance or position rules (Tiny Hut, Warding Bond, Time Stop): spatial, other slices.
- Caster drops to 0 HP or is incapacitated (Warding Bond, Enthrall, Gaseous Form): D95 detectors on the **source**, not the holder.
- Task completed (Suggestion, Mass Suggestion): adjudicated by the GM.

### Authoring shape for the qualifiers (needs a ruling)

- **Flat enum growth:** add `ON_DAMAGE_TAKEN`, `ON_DAMAGE_TAKEN_FROM_SOURCE_SIDE`, `ON_ATTACK_ENEMY`, `ON_CAST_SPELL_ON_ENEMY`. Quick, but the enum encodes disposition in its names and grows one value per qualifier combination.
- **Structured trigger (recommended):** a generic discriminated option like D115's `reactionTrigger`: `{ event: 'ATTACK_ROLL' | 'SPELL_CAST' | 'DAMAGE_TAKEN' | ..., by: 'HOLDER' | 'SOURCE_SIDE', against: 'ANY' | 'ENEMY' }`. Flat unqualified events stay as they are; the node map shows the group only when an event is chosen. It changes the authored contract, so it is yours to rule on.

## 4. Task split

Dependency order. Each task is a vertical slice with red-first tests; checkpoints on `ci/spells-27`.

| Task   | Closes                      | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** | spike + groundwork for 27.1 | Spike on risk 1 (condition write/derive, undo). Bare timed-condition plan (Invisibility becomes an active effect with duration and event lists). Red tests: compile plan; target holds the effect; concentration drop and 1-hour expiry end it.                                                                                                                                                                                                                                                                             |
| **T2** | 27.1 (attack roll)          | `effectsEndedBy` replaces `consumableGrants` + `grantsEndedBy` for these lists; condition release on delete; attack-roll sites. Journey: cast Invisibility, attack, effect and condition gone, GM undo restores both.                                                                                                                                                                                                                                                                                                       |
| **T3** | 27.1 (cast)                 | Spell-cast occurrence fact; same consumer at the cast commit (action, area, reaction-cast). Journey: cast a spell while invisible, effect ends, GM undo restores. Authoring-parity test for the Invisibility variant.                                                                                                                                                                                                                                                                                                       |
| **T4** | 27.2 vocabulary             | The qualifier shape (per the ruling), `ON_DAMAGE_TAKEN`-style events, their emission at the damage commit and consumer. Node map, authored-parity proof, no feature-named kinds.                                                                                                                                                                                                                                                                                                                                            |
| **T5** | 27.2 corpus                 | Author Sanctuary, Charm Person, Mislead, Hypnotic Pattern, Sleep, Sequester, Modify Memory, Project Image, Calm Emotions, plus the non-spell effects the corpus pass finds (**edits to `packages/source-data`, protected**). Corpus test over every SRD effect (spells, features, items, creature traits) with a typed allow-list (covering mechanism named) and a failing list for any phrase match with neither an authored end event nor an allow-list entry. Closes 27.2 only when no "consumer pending" entry remains. |
| **T6** | cleanup                     | Unify `consumeOnFirstEvents` and `endOnEvents` into one structured shape with an explicit timing field; delete the old enum, migrate data, no shim. After REACTION-4.T3 merges.                                                                                                                                                                                                                                                                                                                                             |

### `packages/source-data` edit plan (not executed)

- Spell records T5 would touch: `sanctuary.ts`, `charm-person.ts`, `mislead.ts`, `hypnotic-pattern.ts`, `sleep.ts`, `sequester.ts`, `modify-memory.ts`, `project-image.ts`, `calm-emotions.ts`. Each adds only a `lifecycle` end-event list (or the structured trigger) in its existing result block; no description text changes.
- `invisibility.ts` changes only if the ruling moves its events onto `consumeOnFirstEvents` or the structured trigger.
- The corpus test lives beside `import.test.ts` and reads the authored records, not copies of the rule.

## 5. Rulings (D122) and spike result

1. **Consumer:** Option 2 now. One `effectsEndedBy(effects, event)` over `consumeOnFirstEvents` and `endOnEvents` for any v2 effect. "Consume" applies to the event, then ends; "end" ends without applying (Invisibility's own attack still gets advantage, then ends; prove it). Unification is **T6**, the last task, after REACTION-4.T3 (Absorb Elements uses `consumeOnFirstEvents`): one structured shape with an explicit timing field, old enum deleted, data migrated, no shim.
2. **Qualifier:** the structured trigger, reusing or extracting the `reactionTrigger` filter types (no parallel look-alike); core options only (ADR 0038).
3. **Authoring before consumers:** T5 may author an end event whose consumer is pending, but 27.2 closes only when the "consumer pending" list is empty. At close the only entries allowed are the typed allow-list of texts another named mechanism covers.
4. **Corpus scope:** every SRD effect (spells, class features, items, creature traits). Non-spell authoring that turns up is sized, added as a task here, and reported.
5. **D99 carry-over:** out of scope. Follow-up registered by the main session (see below).

### Spike result (T1)

- Conditions are stored on the holder, so deleting the effect alone never removes `INVISIBLE`. The end consumer must emit `CONDITION_REMOVE` (with `sourceActiveEffectId` and `retainedConditionIds`) through the mechanics batch in the same transaction. The action commit's source-Character write (`DIRECT_ACTION_RESOURCE`, no applications) can carry it.
- The turn-effect kernel refused any effect with a non-empty event list (`encounterTurnEffects.ts`, `turnEffectsPersistence.ts`). Both guards are removed in T1; grants never reach the kernel (recurrence stage `NONE`).
- A no-save `CONDITION` compiled to a bare `CONDITION_APPLY` with no active-effect plan. T1 adds `timedConditionPlan` (compiler) and `conditionContribution.{consumeOnFirstEvents,endOnEvents}` (plan type, persisted plan schema, `recurrence`).
- **Undo gap (T2):** `actionRevert.ts` restores effect records exactly (`restoreConsumedGrants`) but a Character inverse only removes added conditions (`removedConditionIds`); it refuses to restore a removed one. T2 adds a restored-condition inverse fenced by the stream version.
- **D99 answer:** WRONG before SPELLS-5.T9. `planCarriedOverGrants` carried modifier grants only, so a Character-held timed condition effect from an Encounter never counts down or ends after the Run completes and its stored condition sticks.

## 6. SPELLS-5.T9 (AC SPELLS-5.14): a Character's timed condition effect outlives its Run

Own commit range on `ci/spells-5-t9`, mergeable apart from SPELLS-27 beyond T1.

- **Ruling (Phase 8):** carry the effect over, don't release it. A Character's timed condition-owning
  effect moves to the Campaign clock exactly as its grants do, keeping its condition until it ends there.
  A Creature's effect ends with the Run and releases its condition. Extend the existing carry-over; no
  parallel path.
- **Root cause:** a condition plan was always `ENCOUNTER`-scoped, so COMPLETE deleted the effect row but
  the condition stayed on the Character's Sheet (nothing released it), and `planCarriedOverGrants` skipped
  it.
- **Change:** `prepareEncounterActionEffectPlans` gives a condition effect the target's `lifetimeScope` (Character `OWNER`, Creature
  `ENCOUNTER`); `planCarriedOverGrants` becomes `planCarriedOverEffects` and selects condition-owning
  effects too; `isTurnEffectEligible` skips an effect that carries a Campaign-clock expiry;
  `executeCharacterSheetCommand` strips the conditions only the ended effects held on
  `END_ACTIVE_EFFECT` / `END_CONCENTRATION` (reusing `endedMaintenanceConditions`, which the
  Concentration-caster end paths already reach through `reconcileNativeMaintenanceOwners`). The clock's
  expiry pass already ends a carried effect through `END_ACTIVE_EFFECT`.
- **Proof:** `grantLifetimes.test.ts` (carry plan, kernel skip, condition release) and the
  `finishedRun.test.ts` journey (Hold Person on a Character: still live after COMPLETE, gone with its
  Paralyzed condition when the Campaign clock reaches the expiry).
- **Note for T2:** Invisibility's plan now takes the same scope, so a one-hour Invisibility on a
  Character outlasts a three-round fight.

## 7. SPELLS-27.T2: effects ended by an event release what they owned

Decided as D125.

- **One consumer.** `effectsEndedBy(effects, event)` reads `consumeOnFirstEvents` and `endOnEvents`; `consumableGrants` and `grantsEndedBy` are deleted. Invisibility ends on its holder's attack roll after granting advantage on that roll.
- **Release.** `planNativeEncounterActionMechanics` plans `CONDITION_REMOVE` on the source batch (`sourceReleases` from `endedEffectConditionReleases`, which wraps `endedMaintenanceConditions`) for Character and Creature sources. A self-targeted action puts the releases first on the holder's own batch (T3), since that batch is the source batch.
- **Contract.** `sourceApplications` is required on both batch kinds and on settled DTOs. Stream version: the Character source uses `characterStreamVersion`; a Creature source passes `null`.
- **Undo.** The root receipt carries `endedMaintainedStates`; `actionRevert.ts` restores them (`restoreMaintainedState`) before `restoreConsumedGrants`, then restores the condition through a `restoredConditionIds` inverse fenced by the source stream version. Actor-held effect rows store `sourceEncounterId: null`, so the Run id comes from `owner.encounterId`.
- **Authoring fence.** `NON_RELEASING_EFFECT_EVENTS` rejects condition-owning v2 definitions that list an event whose consumer does not release.
- **Local data.** Development receipts that fail the new required fields take the approved local reset.

### Split

- **T2a (done):** action and reaction attack rolls, schema, persistence and undo. The Legendary window, movement opportunity attack and Disarm skipped condition-owning effects meanwhile, so no intermediate merge stranded a condition.
- **T2b (done):** the Legendary window, movement opportunity attack and Disarm release their conditions through the same source batch (`attackRollEndedEffects` is the one helper every attack-roll root calls); the three fences are gone. The Disarm receipt carries the release in a required `sourceApplications` on `CONTESTED_ACTION`; the Legendary window applies it in `persistEncounterTurnResources`; the movement reaction applies it in `liveMovementReactionPersistence`. Disarm and the Legendary window have no GM undo, so nothing restores these.
- **T3 (done, see [slice-spells-27-t3.md](slice-spells-27-t3.md)):** a Character's spell cast ends effects listing `ON_CAST_SPELL`, from the one cast-commit path of each kind (action and reaction, area and chosen-creature list, countered). `actionEndedEffects` replaces `attackRollEndedEffects`. AC 27.1 is closed.
- **T3b (see [slice-spells-27-t3b.md](slice-spells-27-t3b.md)):** the same fact from reactor casts (Shield, Counterspell as reactor) and Creature and Legendary spell-attack actions (`preparedCastsSpell`).

## 8. SPELLS-27.T4: a structured end trigger and the damage-taken event

Decided as D132.

- **Shape.** `definition.recurrence.endOnTriggers` is a list of `{ event: 'DAMAGE_TAKEN', by: 'ANYONE' | 'SOURCE_SIDE', damageTypeIds: string[] | null }`, unique and in `JSON.stringify` order. `damageTypeIds` is the same `damageTypeFilterDtoSchema` the `DAMAGE_TAKEN` reaction trigger uses (extracted into `shared/reaction.ts`), so the two never drift. The flat `consumeOnFirstEvents` / `endOnEvents` lists are untouched (T6 unifies them after REACTION-4.T3). `endOnTriggers` defaults to `[]` on read.
- **Source side.** `SOURCE_SIDE` is the effect's `origin.sourceActorId` or an actor `encounterActorRelationship` calls `ALLIED` to it (Charm Person). The schema rejects a `SOURCE_SIDE` trigger on an effect with no Encounter source actor.
- **Damage taken.** A `DAMAGE` application on the holder with `resolvedAmount > 0` (after resistance and immunity) matching the type filter. `damageTakenEndedEffects` returns the ended effects and their condition releases; the holder's own batch applies the releases after the outcome (`damageReleases` on `planNativeEncounterActionMechanics`) and the action commit deletes the effects through `consumedGrants`. GM undo restores both through the existing receipt.
- **Authoring.** `lifecycle.endOnTriggers` on a result block (schema, `PathLifecycleAuthored`, node map `pathLifecycleEndTrigger`). Only the timed-condition plan carries it; the grant, concealment and recurring-save plans reject a lifecycle that lists it, so authoring cannot name a trigger no plan consumes.
- **Proof.** `encounterEndedEffectRelease.test.ts` (consumer), `rules-runtime-contracts.test.ts` (schema), `characterSpellCastActions.test.ts` (compiler), `nativeRoomDamageEndsEffect.test.ts` (Worker journey with GM undo).

### Split

- **T4a (this slice):** the trigger shape, the damage-taken consumer on the single-action root, authoring for the timed-condition plan.
- **T4b (to register, blocks AC 27.2):** the other damage roots. The area commit, Legendary window, movement reaction, turn effects (ongoing damage) and death-save damage do not call `damageTakenEndedEffects` yet, so an effect with a damage trigger survives damage from them. Also the `ATTACK_ROLL`-against-enemy arm (Sanctuary) and the `SPELL_CAST` arm once T3's cast fact lands. T5 must not author a damage-ending spell whose damage arrives through an unwired root.

### Proposed ledger edits (the main session applies them)

- SPELLS-27.T4 DONE for T4a; register SPELLS-27.T4b with the roots above, WSJF the same as T4.
- AC 27.2 stays open: the consumer is pending on the roots listed under T4b.

## 9. SPELLS-27.T4b: the other damage roots and the against-enemy arms

Decided as the [D132 amendment](phase-08-2-decisions.md) of 2026-10-16.

- **Trigger shape.** `endOnTriggers` gains `{ event: 'ATTACK_ROLL' | 'SPELL_CAST', against: 'ENEMY' }` (runtime schema, authored schema, `PathLifecycleAuthored`, node map: `by` and `damageTypeIds` show only for `DAMAGE_TAKEN`, `against` only for the other two). `against` is explicit so a later `ALLY` or `ANY` value is a schema widening, not a reinterpretation. The compiler passes the new members through unchanged; `DAMAGE_TAKEN` members are normalized as before.
- **Enemy.** `actsAgainstEnemy`: any target in a `HOSTILE` relationship to the actor (`encounterActorRelationship`); a neutral target is not an enemy. `actionEndedEffects` takes a required `againstEnemy` and every call site computes it (single action, Shield and Counterspell reactors, area caster, Disarm, Legendary, movement reaction).
- **Roots wired.** Area commit (per target, deduped), Legendary window (planner plus persistence recomputation), movement reaction (mover's ended effects on the REACTION step's `consumedGrants`, limit doubled), turn effects (`turnEffectDamageEnded`; the releases are on the damaging execution, validated by the turn result schema and recomputed by `turnEffectsPersistence`). Death-save damage needs no wiring: it is a `DAMAGE` application inside the roots above.
- **GM undo.** Only the single-action and area roots have it, and both are proved with it. Legendary, movement reaction and turn effects have no undo, so they are proved without it.
- **Proof.** `encounterEndedEffectRelease.test.ts`, `rules-runtime-contracts.test.ts`, `characterSpellCastActions.test.ts`, `nativeRoomAreaDamageEndsEffect.test.ts`, `nativeMovementDamageEndsEffect.test.ts`, `nativeRoomLegendary.test.ts`, `nativeRoomTurnEffects.test.ts`, `nativeRoomAttackEndsEffect.test.ts`, `nativeRoomDamageEndsEffect.test.ts`.

### Deferred edge cases

- Cleaving and zone-entry damage roots do not call `damageTakenEndedEffects`; T5 authors no effect whose damage arrives through them.
- The countered-cast path (`planNativeCounteredCast`) computes `againstEnemy` from the lead target, so an area spell countered after the lead is an ally and the rest are enemies does not end a `SPELL_CAST` effect.
- A turn effect that is itself a candidate at its boundary and also ends on damage keeps its lifecycle path; the damage does not end it. A candidate that owns the same condition as a damage-ended effect keeps the condition from the release only if it is not a candidate (the release is computed against non-candidates).
- Turn effects planned for the second boundary of an `ADVANCE_TURN` do not see an effect the first boundary's damage ended (matters only when both boundaries belong to one actor).

### Proposed ledger edits (the main session applies them)

- SPELLS-27.T4b DONE; AC 27.2 can close once T5 and T6 land.
