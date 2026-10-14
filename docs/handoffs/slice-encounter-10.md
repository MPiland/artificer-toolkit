# Slice workbook: ENCOUNTER-10 (declared initiative honors advantage and disadvantage)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Under `DECLARED_ACTION_ROLL` every declared actor rolls one d20, even with advantage or disadvantage on initiative. `createDnd5eSpeedFactorInitiativeDefinition` (`packages/rules-runtime/src/systems/dnd5e/initiativeFactAdapter.ts`) rolls one `evidence.integer-range` d20 and adds with `number.add`. `bindDeclaredActor` binds the `initiative.roll-mode` fact, but nothing reads it, and the settlement evidence records neither the mode nor the faces. A GM-rolled initiative (`ROLL_ACTOR_INITIATIVE`) already rolls two dice and keeps the higher or lower one.

Make the declared graph roll two d20s and keep the higher (advantage) or lower (disadvantage), as the rules dictate. Record the roll mode and both faces in the settlement. Post the Initiative card with both faces through the shared builder `initiativeRollRecord({ id, expression, rollMode, nextInt, ... })` in `packages/rules-runtime/src/encounterRuleCheckRolls.ts`, the builder ENCOUNTER-9 introduced so the declared and GM-rolled cards are the same by construction. `persistEncounterInitiativeRollCards` (`packages/encounter-persistence/src/initiativeRollCards.ts`) currently throws on a result with more than one die. Replace that invariant with the two-die case: replay both settled faces through `nextInt` in roll order. Any other die count or shape still throws.

Integration-owner ruling (ledger note): this is a bug fix whose behavior the rules dictate, not a scope change. If the published definition changes, its checksum and the snapshot change with it. Record the new checksum in the status log; the main session reseeds after merge.

Read first: ENCOUNTER-9's workbook ([slice-encounter-9.md](slice-encounter-9.md), especially the parity note); ADR 0034; `initiativeFactAdapter.ts` (the definition and `bindDeclaredActor`); `packages/rules-runtime/src/encounterInitiativeEntities.ts`; `packages/rules-runtime/src/initiativeFactAdapter.ts`; `encounterRuleCheckRolls.ts`; `initiativeRollCards.ts`; and the graph operations the definition can use. Check for an existing keep-highest/lowest operation (for example in `optionalCombatContestGraph.ts`) before adding one. If you must add a graph operation, it is a schema-level contract: add it in a reusable way next to the existing operations, not as a one-off.

## Closes

- AC ENCOUNTER-10.1.

## File scope

`packages/rules-runtime` (the initiative definition, fact adapter, graph operation if needed, roll record builder), `packages/encounter-persistence/src/initiativeRollCards.ts`, `packages/schema` only if a graph operation must be added, and tests under `apps/apis/convex/encounters`, `apps/apis/convex/content/definitions.test.ts` and its snapshot, and `apps/apis/convex/liveSessions`. No web change is expected.

## Red-first checklist

1. A declared actor with advantage rolls two d20s and the score uses the higher one. The settlement records mode `ADVANTAGE` and both faces. This fails before the fix.
2. The same with disadvantage: the lower face is kept and mode `DISADVANTAGE` is recorded.
3. Advantage and disadvantage together cancel to one die, matching the GM-rolled path.
4. An entered (manual) roll under advantage asks for both faces, or follows the ADR 0034 prompt rule the GM-rolled path uses. Read that path and match it; flag any difference in the status log.
5. The Initiative card for a declared advantage roll shows both faces and the mode, and equals the GM-rolled card for the same faces (`initiativeDeclarations.test.ts`).
6. A retried declaration replays the same two faces and one card (no duplicate).
7. `initiativeRollCards.test.ts`: two faces with a mode post one card, and three dice or a non-`1d20` pair still throw.
8. The definition snapshot and checksum in `definitions.test.ts` are updated deliberately, with the reason in the status log.
9. Journey: extend `apps/apis/convex/liveSessions/assistedPartyJourney.test.ts` with one declared actor that has advantage; every member sees its two-face Initiative card.

## Status log

- 2026-10-14: workbook written.

## Proposed ledger edits (filled by the slice session)
