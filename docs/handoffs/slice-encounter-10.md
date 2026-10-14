# Slice workbook: ENCOUNTER-10 (declared initiative honors advantage and disadvantage)

**Status:** DONE (merged f166b1be0, 2026-10-14)
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
- 2026-10-14: built and tested. Logs are under `local-validation/encounter-10/` (ignored).
  - **Design.** The rule graph kernel is linear (no skip), so two reusable operations were added in `packages/shared/src/domains/rules`: `evidence.optional-integer-range` (an EVIDENCE node with an `enabled` BOOLEAN input; disabled settles at `min`, asks nothing and leaves a trace entry without evidence) and `number.keep-by-roll-mode` (PURE; NORMAL keeps the first, ADVANTAGE the max, DISADVANTAGE the min, anything else throws). The registry admits a non-boolean enabling port only as an error. The declared definition (`initiativeFactAdapter.ts`) gains the BOOLEAN fact `initiative.extra-d20`, nodes `d20-extra` and `d20-kept`, and `score = d20-kept + declared-modifier`. `bindDeclaredActor` sets `extra-d20` when the resolved roll mode is not NORMAL. `persistEncounterInitiativeRollCards` replays one or two settled faces through `initiativeRollRecord` with the declared mode; other counts, non-`1dN` shapes and a mode that disagrees with the die count throw.
  - **Checklist.**
    1. Advantage: `dnd5eDeclaredInitiativeGraph.test.ts` (graph), `initiativeDeclarations.test.ts` "rolls two d20s for a Character with advantage…" (apis, real Feral Instinct Character). `green5-apis.log`.
    2. Disadvantage: graph level (`dnd5eDeclaredInitiativeGraph.test.ts`, `rules-runtime.test.ts` keep-lower) and card writer (`initiativeRollCards.test.ts`). **No apis-level disadvantage proof**: no SRD source gives a Character initiative disadvantage in the fixtures.
    3. Cancellation is upstream and unchanged: `rulePolicyOutput.rollModes.initiative` resolves advantage plus disadvantage to NORMAL before the graph, shared with the GM-rolled path. The graph's NORMAL cases prove one die for a resolved NORMAL mode.
    4. Entered dice: the declared path follows the ADR 0034 prompt rule, asking again for the second face (`initiativeDeclarations.test.ts` "asks a second time…"). No difference from the GM-rolled path found.
    5. Card parity: the declared card is built by the same `initiativeRollRecord`; the test asserts mode ADVANTAGE, both faces, subtotal, total equal to the stored score. The GM-rolled equality is by construction (shared builder), not a side-by-side assertion.
    6. Retry: "replays a retried advantage declaration to the same two faces and the same one card". `green5-apis.log`.
    7. `initiativeRollCards.test.ts`: two faces plus mode post one card; three dice, non-`1d20` pair and mode/die-count mismatch throw. `green2-packages.log`.
    8. See the snapshot and checksum entries below.
    9. Journey: `assistedPartyJourney.test.ts` "auto-rolls two d20s for each advantage Character…" (every member reads the same card with both faces).
  - **Red evidence.** The packages red run (`red-packages.log`) failed as expected. The first apis red run (`red-apis.log`) was invalid: stale `dist` of the built packages caused unrelated failures, so apis red evidence is not claimed. Greens ran after `turbo run build --filter='@artificer-toolkit/apis^...'`.
  - **Snapshot.** `encounterStoreConformance.test.ts.snap` changed only by the inserted fact contract `{"key":"initiative.extra-d20","valueKind":"BOOLEAN"}` (regenerated with `-u`, diff reviewed).
  - **Definition checksum.** `createDnd5eSpeedFactorInitiativeDefinition().checksum` is now `002fed918cb417f2e16652b2e7e7984e4dbeddd114b35215f360bc128750629f` (`checksum.log`). The published definition changed, so the main session reseeds after merge.
  - **Deviations.** (a) Edits to `packages/shared` kernel, registry and operations (outside the nominal file scope; the brief allowed a graph operation). (b) `apps/apis/tests/fixtures/encounterInitiative.ts` `pinFor(procedure)`: DECLARED policies now run the real definition instead of the simple one-d20 graph, so existing declared tests exercise product code. (c) `assistedParty.ts` accepts `classOptions` (the class feature is shared by both party Characters). (d) A tie resolver pinned to the same graph takes the same advantage dice.
  - **Validation.** Packages tests, apis `initiativeDeclarations`, `assistedPartyJourney`, `initiativeSpellDeclarations`, `turnActiveEffects`, `turnLegendaryAction`, `definitions` and `encounterStoreConformance` (7 files, 69 tests green, `green5-apis.log`, `--no-file-parallelism` because parallel apis files flake on this machine). Typecheck: turbo 18/18 and `apps/apis` `tsc -p convex/tsconfig.json` exit 0 (`typecheck-turbo.log`, `tsc-convex.log`) before the base merge. Storybook not run (no web change). No codegen push run (no change under `convex/` production code).
  - **Base merge.** `codex/phase-08-2-convex-cutover` merged cleanly (92b2d442b). Rerun on the merged tree (`merged-*.log`, `merged.exit`): build exit 0, packages 4 files / 31 tests green, apis 5 files / 51 tests green (`initiativeDeclarations`, `assistedPartyJourney`, `initiativeSpellDeclarations`, `definitions`, `encounterStoreConformance`), `turbo typecheck --filter="[codex/phase-08-2-convex-cutover]"` exit 0 and `apps/apis` convex `tsc` exit 0. Status: ready to merge.

## Proposed ledger edits (filled by the slice session)

- AC ENCOUNTER-10.1: done, proved by `initiativeDeclarations.test.ts` (advantage auto-roll, entered dice, retry), `assistedPartyJourney.test.ts` (journey), `initiativeRollCards.test.ts`, `dnd5eDeclaredInitiativeGraph.test.ts`, `rules-runtime.test.ts`. Gap: no apis-level disadvantage case (covered at graph and card-writer level).
- Follow-up for the main session: reseed the local backend for the new initiative definition checksum `002fed91…629f`.
