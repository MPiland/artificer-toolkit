# Slice workbook: REACTION-4 (non-movement reactions: trigger model)

**Status:** IN_PROGRESS (started 2026-10-15), phase 1 design
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
