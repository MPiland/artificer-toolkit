# Slice workbook: REACTION-4 (non-movement reactions: trigger model)

**Status:** T1 merged (f875185dc, CI 38804169007 green). Next: T5 (merge-review hardening), then T2, T3, T4 in order.
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

- **1. Derived effect id.** `nativeReactionEffectId({ commandId, occurrenceId })` (uuid v5) replaces `crypto.randomUUID()`; the id flows through `reactionEffect: { id, plan }` into settlement. Red: `ci/reaction-4-t5-red2` (missing export). Test: `nativeRoomReaction.test.ts` replay id equality.
- **2. `REACTION_TRIGGER_ONLY` everywhere.** `refuseActionOutsideItsWindow` in `nativeEncounterActionInputs.ts` now serves single-target and the three area call sites (lead, per-target x2). Covered end to end by the single-target Shield-as-action test. **No end-to-end red proof for the area path:** the compiler admits an area only for an Action (`isSupportedTestArea`), so a reaction-activated area is refused earlier as `SOURCE_REQUIREMENTS_NOT_MET`; `nativeRoomReaction.test.ts` asserts that outcome. The area call sites are covered by sharing the helper.
- **3. Resume admission.** `offeredDecisionOptionIds` (`actionPending.ts`) lists every offered option; `actionResumeAdmission` admits any carried option and refuses others with a message naming the option. Unit test `actionPendingOffers.test.ts` (red first).
- **Nits.** Choice definition renamed `reactionChoiceDefinition.ts` (`createReactionChoiceDefinition`, `ASSISTED_REACTION_CHOICE_DEFINITION_ID`); coded `REACTION_UNSUPPORTED` refusal (new transport reason in `domainRejections.ts`) replaces plain `Error`; IIFEs replaced with plain control flow; stale-option message names the option.
- **Follow-up (T3):** the pending summary (`REACTION_CHOICE.options` single-element tuple in `encounterRuleOccurrence.ts`) and the drawer (`options[0]`) still show one option. Admission accepts any offered reaction; widening the contract/UI belongs with the SPELL_CAST chain.
- Not run locally: Worker tests (stale rules-runtime dist, heavy lane queued), local codegen push, Storybook/Playwright.

## REACTION-4.T3 notes (carried from T5)

- The pending summary `REACTION_CHOICE.options` (`packages/schema/src/shared/encounterRuleOccurrence.ts`) is a single-element tuple and `CampaignTabletopDecisionDrawer.tsx` reads `pending.options[0]`. Resume admission already accepts any offered reaction (`offeredDecisionOptionIds`), so T3 widens the summary contract to every offered option and the drawer to list them, when a chain can hold more than one reaction.
