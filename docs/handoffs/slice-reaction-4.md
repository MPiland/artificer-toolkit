# Slice workbook: REACTION-4 (non-movement reactions: trigger model)

**Status:** T1, T5 and T2 merged (f875185dc, d98b1264f, c9cda1489). AC 4.2 is partly met: resistance to only the triggering type, offering every eligible reaction, ON_CRIT filtering and slot-scaled follow-up damage moved into T3. Next: T6 (finish AC 4.5), then T3, T4.
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Reactions only fire on movement today. REACTION-3 offers opportunity attacks as Use or Decline decisions: the room holds the Scene while a decision is pending (D26), and the reactor's controller answers it (players drive their own Characters, D19). The planner is in `packages/shared` (movement), with execution in `apps/session-worker/src/nativeEncounterMovement.ts`. The journeys are `apps/apis/convex/scenes/assistedAutomaticMovement.test.ts` and `apps/apis/convex/encounters/movementReactionEffects.test.ts`.

This slice adds a generic, authorable trigger model for reactions that fire on non-movement events, and uses it for the SRD reaction spells:

- **Shield:** when the caster is hit by an attack (or targeted by Magic Missile), the caster gets +5 AC until the start of their next turn, and that AC counts against the triggering attack. The hit is re-evaluated, so a hit can become a miss. The caster also takes no damage from Magic Missile.
  - Source: `packages/source-data/src/srd/spells/shield.ts` authors the +5 AC grant with `ACTIVATION_CODE.REACTION`, but it has no trigger.
- **Counterspell:** when a creature within 60 feet casts a spell:
  - a spell of 3rd level or lower fails;
  - a higher-level spell needs an ability check against DC 10 + its level, using the reactor's spellcasting ability;
  - upcasting raises the automatic threshold.
  - Source: `counterspell.ts` is a `CLOSED_RULE` today. ADR 0038 retires closed rules, so this slice converts it to core options and deletes the `COUNTERSPELL` kind and its resolver, if it has one.
- **Absorb Elements (AC REACTION-4.2):** not in SRD 5.1. A user must be able to author it from the same options: triggered when its caster takes damage of chosen types, it applies before that damage (resistance to the triggering type) and grants a follow-up benefit. Prove it with a user-authored fixture in a test, not with seeded content.

ADR 0038 governs: the trigger is a generic authored option (event kind plus filters) in the shared contract, the Authoring Schema node map and the Builder authoring form. Nothing is spell-specific, there are no closed rules and there are no spell id checks. The same model must be able to express creature reactions such as Marilith Parry (+AC against one melee hit), but converting those is not in scope.

### Phase 1: design (stop and send it before writing product code)

Send the main session one design packet (`SendMessage`), then wait for approval. Approval also confirms the scope of the public contract change. The packet covers:

1. **The authored trigger contract:**
   - event kinds: attack hit on self, targeted by a named action or spell, spell cast within range, damage taken of types;
   - filters: range, damage types, spell level;
   - where it lives on the Effect invocation, and the Authoring Schema node-map change.
2. **The interception points:**
   - where the attack, cast and damage pipelines pause for a reaction decision;
   - how the pause reuses the REACTION-3/D26 decision and hold machinery, rather than adding a second mechanism;
   - who is asked (controller per D19/D24), and how defeated or Unconscious reactors and spent reactions are excluded.
3. **Resolution semantics:**
   - re-evaluating a hit after the AC grant;
   - "no damage from Magic Missile" expressed as a core option;
   - a cast that fails and has no effect: slot and action are still spent, per SRD;
   - the Counterspell check and upcast threshold from core options;
   - Absorb Elements' before-damage resistance and the follow-up benefit;
   - the receipt and GM undo.
4. **Options considered**, with tradeoffs and a recommendation, and every ADR or decision the design touches.

### Phase 2: implementation, after approval

Red-first, per the checklist below.

## Closes

- ACs REACTION-4.1 and REACTION-4.2.

## File scope (phase 2, to be confirmed by the approved design)

- `packages/shared`: authored trigger types and node maps.
- `packages/schema`: the contract.
- `packages/authoring`: resolver and publication.
- `packages/rules-runtime`: the compiler, reaction offers and resolution.
- `packages/source-data`: Shield and Counterspell.
- `apps/session-worker`: the decision hold on attack, cast and damage.
- `apps/web`: only the authoring form's generated fields, and the decision drawer labels if needed.
- Tests next to each.

## Red-first checklist (phase 2)

1. The real SRD Shield and Counterspell compile to reactions with their triggers. This fails on base.
2. **Shield, in the Worker:**
   - a hit on a Shield-holder offers Use or Decline to its controller;
   - Use spends the reaction and the slot, applies +5 AC and turns the hit into a miss when the new AC beats the roll;
   - Decline leaves the hit standing;
   - a Magic Missile does no damage while Shield is up.
3. **Counterspell, in the Worker:**
   - a 3rd-level-or-lower cast within 60 feet is offered and, if used, fails with no effect;
   - a higher-level cast requires the check;
   - an upcast Counterspell raises the threshold.
4. **Absorb Elements:** a user-authored fixture compiles and resolves through the same model: resistance against the triggering damage and the follow-up benefit.
5. Refusals: no offer is made when the reactor's reaction is spent, when the reactor is defeated or Unconscious, or when it is out of range.
6. GM undo restores the state before the reaction.
7. **Journeys:** a Worker Encounter journey through real code for Shield and for Counterspell.

## Status log

- 2026-10-15: workbook written.
- 2026-10-15: design packet approved (option A).
  - **Rulings:**
    - `reactionTrigger` union replaces `reactionMovementTrigger`, with no shim.
    - The REACTION_CHOICE phase lives inside the triggering occurrence.
    - `sourceEffectIds` are authored content references.
    - D26 holds the Scene for any reaction decision.
    - Counterspell chains resolve innermost first inside the occurrence (AC REACTION-4.3).
    - Interstitial order on one attack: reaction choice after TEST, before OUTCOME. Legendary Resistance stays where it is (after a failed save).
  - **Split in the ledger:**
    - T1: contract, phase, hold, undo child, Shield against a hit; AC 4.4.
    - T2: DAMAGE_TAKEN and Absorb Elements; AC 4.2.
    - T3: SPELL_CAST, Counterspell conversion and chain; AC 4.3.
    - T4: TARGETED_SELF, Shield against Magic Missile; AC 4.1, after SPELLS-26 (multi-target spells, registered).
  - The main session records the decision entry at merge. The slice updates ADR 0038 and the engine guide.
- 2026-10-15: REACTION-4.T1 built (state: compiling and testing; see the final report for results).
  - **Shape:**
    - `reactionTrigger` is a discriminated union (`MOVEMENT`, `ATTACKED_SELF`) in the authored node map, schema, compiler and economy. The old movement-only field is gone and the fixtures migrated in the same change.
    - A reaction pause is `applicationContext.reactionChoice` on the triggering ENCOUNTER_ACTION occurrence, beside `legendaryResistance`. Its `reactions` array is a stack (innermost first) for T3 chains; T1 only ever holds one.
    - The choice comes after TEST on ON_HIT/ON_CRIT and before OUTCOME. Use re-evaluates the TEST against the defense after the reaction, as a sealed `adjustment` (`defenseBefore`, `defenseAfter`, `adjustedBoundFactsChecksum`) in the evidence and checksum. The "TEST evidence is stale" guard still applies to everything else.
    - D26 holds the Scene for the pending reaction decision ("Waiting on a reaction decision.").
  - **Deviations from the approved design:**
    - Undo is not a separate REACTION undo child. The reaction's slot, allowance and effect ride in the attack's `CHARACTER_MECHANICS_BATCH.reaction` receipt, so the existing action undo restores them. A GM void of the held attack cancels the whole attack (same as Legendary Resistance).
    - The node map shows `reactionTrigger` for every ACTION invocation, not only REACTION activations, because the node-map condition language cannot read `activation.code` from the invocation union. The schema refuses a trigger on a non-REACTION activation, and the compiler refuses a self reaction that has no trigger.
    - The shared choice graph still carries the "movement" name (`ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID`).
  - **Premise change: `reactionTrigger` is optional in the node map.** The trigger union covers only MOVEMENT and ATTACKED_SELF until T2/T3, so requiring it for every REACTION activation would make other SRD reactions unsaveable. `effect-node-maps.test.ts` asserts `requiredIf` is undefined, so a later change fails loudly. Requiring it for REACTION activation is revisited at REACTION-4.T4. A REACTION activation authored with no trigger compiles to `CharacterRuleActionUnsupportedCompilationError`, so capability discovery leaves it manual (`reactionTriggerCompile.test.ts`).
  - **Legendary Resistance and reaction cannot collide.** LR is offered only on ON_SAVE_FAIL and a reaction only on ON_HIT/ON_CRIT. A TEST has either an attack path or a save path, and `continueNativeActionAfterTest` rejects an audit carrying both.
  - **Out-of-range refusal is vacuous for Shield** (its range is SELF), so no test exercises it in T1.
  - **Follow-ups to register (outside T1):**
    - Movement-reaction opportunity attacks and the area and explicit-flow callers do not offer the reaction yet.
    - `movementInterruption` is not in the authoring form.
    - Creature (non-Character) reactors, multiple eligible reactions (only the first is offered), self-attacks.
    - Reactions that need dice, create state effects or use maintenance are refused.
    - Limits: `activeEffectTransitions` max 1 and commit `createdEffects` max 3.
    - The legacy `ENCOUNTER_ACTOR_RULE_ACTION` and `ENCOUNTER_CREATURE_RULE_ACTION` contexts have no reaction phase.
- 2026-10-15: REACTION-4.T1 results (CI `ci/reaction-4-t1`, run 38789232225, sha b9d1ebd41, attempt 2 green on all nine jobs).
  - **Attempt 1** failed only `developmentLifecycleProof` (`developmentEncounterTransactions.ts:286`, replayed START returns the player projection with `health: null`): the base defect registered as PRIVACY-1.T1, not this slice. Run 38786881067 (sha 5502e8d44) was green on that suite.
  - **D99 bug found and fixed.** The action-economy path ignored `REACTION_COUNT 0` grant suppressions (`activeEffectCapabilitySuppressions` lacked `encounterActiveGrantCapabilitySuppressions`), so a creature that "can't take reactions" was still offered one. One shared helper now serves both `encounterActionEconomy.ts` and `encounterRuleCapabilityState.ts`. Regression: `hitGrant.test.ts` (fails without the fix, passes with it); it also fixes `encounterBasicActions.ts`, which uses the same helper.
  - **Test-premise corrections** (not product changes): the D63 case now uses a dead Character (0 HP, three death-save failures, D96) because a 0-HP Character is dying, not defeated, and acknowledges the attacker's `TARGET_DEFEATED` warning; the wrong-player case uses `otherPlayerControlledActorIds` and `OTHER_PLAYER` because the main player owns the Character. The fixture gained an optional `deathSaves` play override.
  - **Premise change: reactions are metered.** The REACTION allowance now binds to the SRD reaction allowance, so `encounterActionRuleWarnings.test.ts` asserts that binding instead of "REACTION is unmetered".
  - Not run: local codegen push for `apps/apis/convex` (heavy lane; CI Convex suites cover the contract change), Storybook, Playwright.

## REACTION-4.T5: T1 merge-review hardening (frozen list)

Closes AC REACTION-4.5. Base: the phase branch at or after `2c30b97d7` (sync first). The review list is frozen; new findings go to a follow-up task.

Should-fix:

1. `nativeEncounterAttackReaction.ts:143` mints the reaction effect id with `crypto.randomUUID()`. Derive it from the command and occurrence ids so a replay produces the same id (no ambient randomness on the rules path).
2. The `REACTION_TRIGGER_ONLY` refusal covers only the single-target path (`nativeEncounterRules.ts:476`). Apply it on every action path, including area actions, through the shared admission point rather than a second copy.
3. `actionResumeAdmission` reads `reactions[0]`. Admit any reaction the offer carries, and refuse one it does not.

Nits (fix in passing):

- The choice definition is still named for movement; name it for reactions generally.
- Plain `Error` throws on the reaction path; use the coded refusals the rest of the path uses.
- The IIFE in the reaction resolution; use plain control flow.
- The generic stale-option message; say which option went stale.

Red-first: each should-fix item gets a failing test against real code first (replay id equality; area reaction-only refusal; a second offered reaction admitted). CI on `ci/reaction-4-t5`.

### T5 results

All items done on branch `claude/frosty-grothendieck-0a7840`; CI on `ci/reaction-4-t5`.

- **1. Derived effect id.** `encounterReactionEffectId({ commandId, occurrenceId })` (uuid v5, now in rules-runtime; first added as `nativeReactionEffectId` in the Worker) replaces `crypto.randomUUID()`; the id flows through `reactionEffect: { id, plan }` into settlement. Red: `ci/reaction-4-t5-red2` (missing export). Test: `nativeRoomReaction.test.ts` replay id equality.
- **2. `REACTION_TRIGGER_ONLY` everywhere.** `refuseActionOutsideItsWindow` in `nativeEncounterActionInputs.ts` now serves single-target and the three area call sites (lead, per-target x2). Covered end to end by the single-target Shield-as-action test. **No end-to-end red proof for the area path:** the compiler admits an area only for an Action (`isSupportedTestArea`), so a reaction-activated area is refused earlier as `SOURCE_REQUIREMENTS_NOT_MET`; `nativeRoomReaction.test.ts` asserts that outcome. The area call sites are covered by sharing the helper.
- **3. Resume admission.** `offeredDecisionOptionIds` (`actionPending.ts`) lists every offered option; `actionResumeAdmission` admits any carried option and refuses others with a message naming the option. Unit test `actionPendingOffers.test.ts` (red first).
- **Nits.** Choice definition renamed `reactionChoiceDefinition.ts` (`createReactionChoiceDefinition`, `ASSISTED_REACTION_CHOICE_DEFINITION_ID`); coded `REACTION_UNSUPPORTED` refusal (new transport reason in `domainRejections.ts`) replaces plain `Error`; IIFEs replaced with plain control flow; stale-option message names the option.
- **Follow-up (T3):** the pending summary (`REACTION_CHOICE.options` single-element tuple in `encounterRuleOccurrence.ts`) and the drawer (`options[0]`) still show one option. Admission accepts any offered reaction; widening the contract/UI belongs with the SPELL_CAST chain.
- Not run locally: Worker tests (stale rules-runtime dist, heavy lane queued), local codegen push, Storybook/Playwright.

## REACTION-4.T2: DAMAGE_TAKEN trigger and a user-authored Absorb Elements (AC REACTION-4.2)

### T2 results

- **Commits:** `582c5680c` (red tests), `c61ed909e` (implementation), `1d7b7b751` (regenerated `apps/apis/convex/_generated/api.d.ts`; the trigger union is in the generated API types, so codegen is needed at merge), then review hardening. Red proof: CI run 38820570288 on `ci/reaction-4-t2-red` (Build fails, TS2322 on `DAMAGE_TAKEN`; branch deleted).
- **Trigger union** extended in shared authored types, the effect node map (`damageTypeIds` SELECT_MULTI over `damage_types`), schema (`reaction.ts`, the pin), the dnd5e compiler and `discoverAttackReactionActions`. The pin carries `trigger`, so a changed trigger is a different offer.
- **Proofs:** schema parsing and node-map tests; `reactionTriggerCompile.test.ts`; Worker journeys in `nativeRoomReaction.test.ts` (used halves 10 to 5 and spends reaction and slot; declined applies 10; undo; non-matching type offers nothing; a spent reaction offers nothing; a later chosen type (COLD) is offered; the effect holds two resistances and the melee `DAMAGE` bonus; the sealed reaction names `DAMAGE_TAKEN`).
- **Independent review (opus, no checkout).** Fixed: follow-up grant and pin trigger unproved; second-type match unproved; the trigger union copy in discovery; two unused exports. Deferred to `future-enhancements.md` "Deferred edge cases": a follow-up-only reaction refused at resolve when the reactor already resists (guard allow-lists defenses), crit-only over-offer, duplicate `damageTypeIds`, an unsealed resistance change in the audit. Registered limit (in `rules-runtime.md`): the resistance covers every named type, not only the triggering one; binding it needs a trigger fact (T3).
- **Not covered:** a unit test of `discoverAttackReactionActions` variants (ON_MISS, non-REACTION activation, both triggers together): a candidate is a large schema object, so the variants run through the Worker journeys; the fixture is built in code and published through the SRD snapshot, not saved through the user-content path.
- Not run locally: Worker tests (stale dist), Storybook, Playwright. Codegen push done locally under the heavy lock.

## REACTION-4.T6: settle the chosen reaction (AC REACTION-4.5)

### T6 results

- **Commits:** `d170edf74` (red tests), `59322ecc7` (implementation), then `a64330729` (review: settle proof through `settleEncounterReactionChoice`). Red proof: CI run 38826744923 on `ci/reaction-4-t6-red` (Build/typecheck TS2724, no exported `chosenEncounterReaction`; branch deleted). Green runs on `ci/reaction-4-t6`.
- **Change:** `chosenEncounterReaction(offer, selection)` picks the pin whose `useOptionId` was chosen (DECLINE answers the innermost; an unissued option throws); `settleEncounterReactionChoice` uses it instead of `reactions[0]` and now takes only the offer fields it reads. The Worker finds the chosen reaction again by `actionId` (`discoverNativeAttackReaction(answering)`), both on the answer and on the later-resume replay (the audit's own pin).
- **Proofs:** `encounterReactionChoice.test.ts` (chooser, plus `settleEncounterReactionChoice` on a two-pin offer with the real runtime: second option settles the second, answering it against the first's candidate is stale, decline settles the first); `nativeRoomReaction.test.ts` (identical resolve command replays without a second use or effect; an unoffered option is refused VERSION_STALE and leaves the hit held for the real answer).
- **Honest limits:** only the unit tests were red-first; the two Worker tests characterize behavior T5 already had. A Worker journey with two offered reactions is unreachable until T3 offers every eligible reaction. The Worker replay test returns the stored receipt without rebuilding; the rebuild is proved in rules-runtime (`encounterReactionRebuild.test.ts`, commit after `6ad85127c`): the real `prepareEncounterActionEffectPlans` run twice on the same stored command and occurrence ids gives an identical effect plan, `encounterReactionEffectId` (moved from the Worker so it is testable; same namespace, same ids) and the reaction pin are identical, and another occurrence derives other ids. No Worker fixture pauses after the reaction, so the later-resume path itself is not driven end to end.
- **Independent review (opus, no checkout):** no production bug. Fixed: settle clause proved only via the helper (now through `settleEncounterReactionChoice`), AC label 4.6 to 4.5. Carried to T3: (a) decide menu versus stack for the offer (`chosenEncounterReaction` treats OPTION as a menu but DECLINE as `reactions[0]`; the schema says only the first is decided at a time); (b) require every pin's `reactorActorId` to equal the roller in the schema refinement (`encounterActionPending.ts`, `actionPendingPersistence.ts` check only `reactions[0]`); (c) the rebuild-twice test, moved into T6 at Phase 8's request.
- Not run locally: Worker tests (stale dist). Rules-runtime unit test passed locally (7).

## REACTION-4.T3 notes (carried from T5)

- The pending summary `REACTION_CHOICE.options` (`packages/schema/src/shared/encounterRuleOccurrence.ts`) is a single-element tuple and `CampaignTabletopDecisionDrawer.tsx` reads `pending.options[0]`. Resume admission already accepts any offered reaction (`offeredDecisionOptionIds`), so T3 widens the summary contract to every offered option and the drawer to list them, when a chain can hold more than one reaction.

## REACTION-4.T3: plan and increments

Closes AC REACTION-4.3 and the rest of AC REACTION-4.2. Built in increments, each its own commit and CI run on `ci/reaction-4-t3`.

- **Increment 1 (A2/A3, T6 items a and b): the reaction menu.**
  - **Decision (a): menu, not stack.** A Character has one reaction a round, so one hit offers a menu of every eligible reaction (sorted by `actionId`); choosing an option uses that reaction and declining declines them all. `chosenEncounterReaction` already matches this (a decline settles against the first pin, which only names the audit). The cross-reactor Counterspell chain is a separate mechanism (nested pauses, increment 3), not this array.
  - **Decision (b): one reactor per offer.** The pending-context refinement (`encounterActionPending.ts`) and the persistence root check (`actionPendingPersistence.ts`) require every pin's `reactorActorId` to be the roller.
  - `discoverNativeAttackReaction` returns every eligible reaction (`{ critical }` for a fresh offer, `{ answering }` to find the chosen one again, where the hit's severity is read from the sealed TEST evidence, `originalD20.resultPath`, or from the retained TEST on replay). `attackHitDamageTypeIds(facts, critical)` counts ON_CRIT types only on a critical hit.
  - The pending summary `REACTION_CHOICE.options` is a 1..8 array of `{ optionId, actionId }`; the drawer lists a button per option ("Use reaction" when there is one, "Use {actionId}" otherwise).
  - Proofs: `nativeRoomReaction.test.ts` "room reaction menu for one hit" (Shield and Absorb Elements both offered; each can be used; decline declines both; a forged pin for another creature fails the context schema), `encounterAttackReactionDiscovery.test.ts` (ON_CRIT filter).
- **Increment 2 (A1, finishes AC REACTION-4.2): resistance to only the triggering type and a slot-scaled follow-up.**
  - **Result:** CI green on 1409a6e1a (run 38837833587). The independent review found the answer path read the hit's severity from a policy with no `resultPath` (fixed: `originalD20.resultPath`, and the retained TEST on replay), an unexported plan error, and a duplicated damage-type lookup. Deferred to future-enhancements: upcast levels for a grant-only slot scaling, resistance outliving the SRD's start-of-turn end, the ON_ATTACK_ROLL approximation. The Worker has no crit-only-type journey (the fixture cannot author one); ON_CRIT filtering is proved in `encounterAttackReactionDiscovery.test.ts`. `apps/apis/convex/_generated/api.d.ts` still needs a codegen regeneration (live-backend CI).
  - **Authored shape:** a `DAMAGE_RESISTANCE` grant payload is `{ damageTypeId } | { damageTypeSource: 'TRIGGER' }` (shared type, schema, node map). Nothing is spell-specific.
  - **Binding:** discovery (`discoverAttackReactionActions`) returns `triggerDamageTypeIds`, the authored `DAMAGE_TAKEN` types the hit dealt. The Worker passes them as `trigger` to `prepareNativeActionEffectsPlan`, and `bindTriggerDamageTypes` (in `prepareEncounterActionEffectPlans`) turns the one trigger-sourced resistance into one resistance per type (grant id `<id>:<damageTypeId>`). A trigger-sourced resistance planned with no trigger type throws `EncounterActionEffectPlanError`. Ids derive from the authored id and the damage type id, so replaying an answer mints the same plan.
  - **Slot scaling:** `effectAtCastLevel` (now exported) also fixes an `APPLY_GRANT` modifier amount of `SPELL_SLOT_LEVEL` kind to `multiplier × (castLevel − subtractLevels)` before the entry point is built, so the `modifierGrantEntryPlan` guard (a leftover `SPELL_SLOT_LEVEL` stays manual) no longer blocks the spell. The Absorb Elements fixture adds `2 × slot level` melee damage, consumed by the first attack roll (`consumeOnFirstEvents: ['ON_ATTACK_ROLL']`).
  - **Proofs:** `plannedAbsorbElements.test.ts` (rules-runtime; new shared helper `testing/plannedAbsorbElements.ts` plans the real compiler's effect for a cast level and trigger types): resists only the triggering type though two are named, resists each type a hit dealt, refuses a trigger resistance with no trigger type, follow-up amount at cast levels 1 and 3, follow-up consumed by `ON_ATTACK_ROLL`. `nativeRoomReaction.test.ts`: the Worker effect holds two modifiers (one fire-only resistance, the `FIXED` 2 melee bonus), and a cold hit leaves a cold-only resistance. `encounterReactionRebuild.test.ts` uses the same helper.
  - **Honest limit:** the `ON_ATTACK_ROLL` consume event is the only attack-roll event the model has, so a miss or a non-melee attack roll also spends the melee bonus. Registered in `future-enhancements.md` "Deferred edge cases".
  - **Not run locally:** typecheck, the Worker suite and the Convex suites (CI only). The local `characterSpellCastActions.test.ts` has four Concentration failures that also fail with the original file (stale local dist); CI is the proof.

## REACTION-4.T3 Part B: SPELL_CAST and the Counterspell chain (design packet; the split, option A and the new contracts taken as approved by Phase 8's "continue" of 2026-10-15)

Surveyed 2026-10-15 after increment 2 closed AC REACTION-4.2. AC REACTION-4.3 needs four things the codebase does not have, and three of them are new persisted or authored contracts, so this is escalated rather than decided in the slice (AGENTS.md "Architect Escalation").

**What exists.** The `COUNTERSPELL` closed-rule kind is a marker with no resolver (`closedRuleKind.ts`, `counterspell.ts`; creature stat blocks only cite the spell id), so "delete the kind" is a source-data and shared-enum change. The only reaction pause is `reactionChoice`, which sits after an attack TEST (`advanceNativeActionGraphs`, `encounterActionExecution.ts`) and is a graph continuation. Only Character casts (`characterSpellCast`) are planned in an Encounter. No authored ability-check test exists in the effect model (`triggerCode CHECK` is basic actions only). A reaction that needs a roll is refused today (`REACTION_UNSUPPORTED`).

**What AC 4.3 needs, in dependency order.**

1. **`SPELL_CAST` in the `reactionTrigger` union** (additive). Range comes from the reaction's own invocation range, measured from the reactor to the caster. Filters: none beyond range in v1 (the SRD level rule is an outcome, not a trigger filter).
2. **A pre-execution pause for a cast.** A cast has no TEST to hang a pause on, and its graph has not run when a Counterspell must be offered. Proposal: a new pending-context phase `CAST_REACTION` on the `ENCOUNTER_ACTION` occurrence, held before `advanceNativeActionGraphs` runs, carrying a stack of nested offers (innermost first) where each offer names its own reactor. This is a new persisted pending shape (`encounterActionPending.ts`, `actionPendingPersistence.ts`, the `REACTION_CHOICE` summary, the Convex pending mirror).
3. **`CANCEL_TRIGGERING_EVENT` outcome and the `SPENT_NO_EFFECT` settlement.** A countered cast spends its slot and action and applies nothing, so it settles as a stored execution that has no graph outcome (a new terminal status in `ruleExecutionResults.ts` and the batch receipt), with undo restoring slot and action.
4. **The Counterspell check.** A cast of a higher level than the Counterspell slot needs an ability check (spellcasting ability, DC 10 + the cast's level) by the reactor. Options: (A) author a real ability-check test in the effect model (new path/test kind, dnd5e compiler support, a d20 prompt for the reactor, `TRIGGER_FACT` for the triggering level) and run Counterspell through the same graph machinery; (B) a server-rolled check inside the cancel outcome (smaller, but a second dice path outside the d20 evidence model, so it cannot be entered with physical dice). Recommendation: A, because B would violate the d20 evidence rules every other roll follows.
5. **The chain.** Each used Counterspell is itself a cast offered to other eligible reactors (including the original caster); nested offers resolve innermost first inside the one occurrence.

**Recommended split of the remaining work (each independently shippable and CI-green).**

| Slice | Delivers | Depends on |
|---|---|---|
| T3b | `SPELL_CAST` trigger, `CAST_REACTION` pause, `CANCEL_TRIGGERING_EVENT`, `SPENT_NO_EFFECT`; a Counterspell on a level ≤ its slot cast (automatic success, no roll); `COUNTERSPELL` closed-rule kind deleted; Counterspell converted to core options | T3 increments 1 and 2 |
| T3c | The ability-check test kind (option A) and the higher-level check path | T3b |
| T3d | The chain: nested offers, innermost first, one occurrence | T3b, T3c |

AC 4.3 closes with T3d. Questions for the architect: (1) approve the split; (2) option A versus B for the check; (3) confirm the `CAST_REACTION` pending phase and `SPENT_NO_EFFECT` terminal status as the new persisted contracts.

### T3b-1 results (SPELL_CAST trigger and Counterspell from core options)

- **Delivered (CI run 38846684453 green on 5001d1d66):** `SPELL_CAST` in the `reactionTrigger` union and the pin trigger enum (not `consumeOnFirstEvents`/`endOnEvents`); the `CANCEL_TRIGGERING_EVENT` outcome compiling to the stored-state-free `dnd5e.cancel-triggering-event-proposal` (read from the trace by `executionCancelsTriggeringEvent`); `discoverCastReactionActions`; Counterspell authored from core options; the `COUNTERSPELL` closed-rule kind deleted; Convex `api.d.ts` and SRD manifest regenerated.
- **Review fix:** the compiler refuses `CANCEL_TRIGGERING_EVENT` on anything but a `SPELL_CAST` reaction (regression test in `reactionTriggerCompile.test.ts`).
- **Known, scheduled:** Counterspell is an unconditional cancel until T3c authors the level gate (a `TRIGGER_FACT` level plus the ability-check test); the `SPELL_CAST` trigger has no perception requirement yet; `discoverCastReactionActions` and `executionCancelsTriggeringEvent` have no production caller until T3b-2; the attack-path types still admit `SPELL_CAST` through the shared pin enum (narrow when T3b-2 adds the cast path); the web authoring-parity proof for a `SPELL_CAST` reaction lands before AC 4.3 closes.
- **Not built:** the `CAST_REACTION` pause, the `SPENT_NO_EFFECT` terminal and the cast apply path (T3b-2).
