# Slice workbook: SPELLS-8.T1 (core Encounter casting)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

A Character casts its spells in an Encounter through `RESOLVE_ACTION`, like a Feature action. Today no Character spell reaches it: `buildCharacterActionRuleFacts` (`packages/rules-runtime/src/character/characterActionRuleFacts.ts`) has no spell branch, `encounterActionChoices.ts` has no spell kind, and action receipts never spend a slot (`encounterActionReceipt.ts` sets `spellCastConsumption` to null; only movement reactions spend one, and `actionRevert.ts` refuses any root that carries one).

Build, for Characters:

1. **Choice.** One spell action choice per `spellCastCandidates` entry (one per cast level), so upcasting is picking the higher-level candidate and the command needs no cast-level field. Integration-owner ruling (contract shape): the choice is a new member of the closed action-choice union, built from the candidate the Sheet and initiative declarations already read. Label it with the spell and its level, e.g. "Cure Wounds (2nd level)"; a cantrip has one candidate.
2. **Spend and undo.** Resolving a leveled cast spends the slot (or pact slot) in the same transaction as its outcome, and GM undo restores it, for single-target and point-area roots (D103 commit and undo). Never spend twice on an area: the root holds the spend once.
3. **Concentration.** A Concentration spell starts the caster's maintained effect and ends the previous one (D95 policy, `prepareEncounterActionMaintenance`). Area spells whose outcome is a maintained or lasting effect stay refused until SPELLS-19; do not lift that.
4. **Rituals.** A ritual cast takes 10 minutes longer, so it is never offered as a ritual in an Encounter; a ritual spell the Character can cast normally is offered as a normal cast and spends a slot.
5. **Multi-effect spells and components.** A spell with several Effects resolves all of them in one action. Components follow the rules the Sheet already applies (a material component with a cost needs the item; a Character that cannot speak or has no free hand for V or S is refused with the same refusal the Sheet uses). If the Sheet has no such rule today, report it rather than inventing one.

Slot spend and its undo land in the same change (SPELLS-8.1 note). Fireball (SPELLS-8.4), Spare the Dying (8.2) and the APPLY_GRANT spells (8.3) are later tasks; do not build them, but do not block them.

Read first: D95, D99 (grants and Concentration), D103 (area commit and undo, "Action receipts do not yet spend a spell slot"), D104 in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/rules-runtime.md`; ADR 0034 for control and redaction.

## Closes

- Task SPELLS-8.T1; AC SPELLS-8.1.

## File scope

`packages/schema` (action choice and receipt contracts), `packages/rules-runtime` (Character action facts, spell choices, mechanics, maintenance), `packages/encounter-persistence` (choices, receipt, revert, Sheet write), `apps/apis/convex/encounters`, the Session Worker's action and area routes, and the web drawer only to list and label the new choice. Out of scope: the VTT stage area aiming (`CampaignVttStage.tsx`, area overlays in `vttSceneRenderer.model.ts`), owned by the parallel SPELLS-13 session. Both slices touch the area commit path; keep your area change to the slot spend on the root and its undo.

## Red-first checklist

1. A Character's spell choices: one per cast level; a cantrip once; labels name the spell and level.
2. A leveled single-target cast spends the slot in the same Run version as its outcome; GM undo restores it (Convex through the real room).
3. A leveled point-area cast spends the slot once on the root; GM undo restores it.
4. Upcasting uses the higher slot and the higher-level scaling of the spell.
5. A pact-magic Character spends a pact slot.
6. No slot left at that level: the choice is not offered, and a stale command is refused.
7. A Concentration spell starts Concentration and ends the previous one; undo restores the previous one.
8. A ritual spell is never offered as a ritual cast in an Encounter.
9. A multi-effect spell resolves every Effect in one action and one undo.
10. Components: the refusals the Sheet applies are applied here (or the gap is reported).
11. Journey: a player casts a leveled spell on their own Character in a real room, the slot is spent on the Sheet, and the GM undoes it.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-14: core casting built and proven (logs under `local-validation/spells-8-t1/`):
  - Choices, labels, rituals, unprepared and unexecutable spells: Convex `actionSpellCasting.test.ts` (`green-convex-spell-casting.log`, 7 tests).
  - Single-target spend/undo, point-area spend on the root (nobody caught; caster caught), upcast (2nd-level slot, 3d4 dice) and undo: Worker `nativeRoomSpellCasting.test.ts` (`green-worker-spell-casting.log`, 4 tests).
  - Pact slot, exhausted slot offer and stale refusal, Concentration start/replace, undo refusal after a Sheet spend, journey: Convex file above.
  - Slot write/restore and stale-spend refusal: rules-runtime `encounterMechanicsBatchPlan.test.ts`; Character state: `characterNativeActionResources.test.ts` (`green-rr-native-resources.log`).
  - Regression: rules-runtime, encounter-persistence, 8 Worker and 11 apis files (`regression-1.log`); typecheck, convex tsc and local codegen green (`typecheck.log`).
  - Red logs: not captured. The implementation preceded the tests, and a baseline worktree needs a full install; the new tests exercise paths that did not exist before (no `spell-cast:` choice, no `spellCastConsumption`).

## Proposed ledger edits (filled by the slice session)

- SPELLS-8.T1: done. AC SPELLS-8.1: proven for single-target and point-area casts (slot spend on the same version, GM undo), pact slots, Concentration start/replace and the journey.
- New follow-up tasks (WSJF to be scored by the integration owner):
  - dnd5e Effect-action compiler: execute a scaling heal (real Cure Wounds, upcast) and a multi-Effect spell as one action. Today they compile `MANUAL`, so the Encounter does not offer them; checklist items 4 and 9 are proven only for damage-scaling and single-Effect spells.
  - Spell components (material cost, free hand, silence) have no Sheet rule, so neither surface refuses (item 10 is a reported gap).
  - LIMITED_USE and pool-backed FIXED_LEVEL casts, and casting times the adapter cannot compile, are not offered.
