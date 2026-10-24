# Workbook: SPELLS-34 summons cast from the Sheet

**Status:** T1 in CI on `ci/spells-34-t1` (branch `ci-spells-34-t1`). T2 (summon attacks) not started.

T1 closes AC SPELLS-34.1, .3 and .4 (D190).

## Rulings (orchestrator, binding)

- The entry lives in its own optional `state.spellSummons[]`, which is play state. The Extras DTO adds a
  `SPELL_SUMMON` member. UPDATE_SHEET_EXTRA and REMOVE_SHEET_EXTRA take kind `SPELL_SUMMON`. Only CAST_SPELL creates
  an entry.
- Only `armorClass` and `maximumHitPoints` are stored as resolved values. The UI reads everything else from `statBlock`.
- There is one shared compile (`compileCharacterSpellCasts`). The Sheet and Encounter builders share `summonHitPoints`.
- A Concentration summon is the Sheet's Concentration. END_CONCENTRATION, a new Concentration cast and the caster at
  0 HP end it.
- Attacks move to T2. The row shows no attacks placeholder.

## T1 (done in CI)

- **Schema:**
  - `effects/summonStatBlock.ts` is its own module.
  - `characterSpellSummonStateDtoSchema` is in `subjects/characterState.ts`.
  - The play record split and merge carry `spellSummons`.
  - The Extras DTO gains `SPELL_SUMMON`, and the command inputs take it.
- **Rules runtime:**
  - `compileCharacterSpellCasts` is shared with `encounterMovementTargets.ts`.
  - `character/sheetSpellSummon.ts` holds the plan pick, the builder and the Concentration filter.
  - The reducer handles cast, update, remove, END_CONCENTRATION and 0 HP. The long rest ends every summon.
  - The projection adds the Extras item and the overview Concentration.
  - The companion consumers (panel, rest, adjustments) skip summons.
- **Convex:** the `sheetCommands.ts` CAST_SPELL path passes `spellSummonPlacement`. `endCarriedConcentration` accepts
  `endsSpellSummon`, so ending Concentration that only a summon holds does not throw.
- **Web:** `extras/CharacterSheetSpellSummons.tsx` is a Summons group in Extras. It shows AC, speed, an inline HP input,
  Dismiss and a Concentration badge. Optimistic updates skip summons.
- **Proofs:**
  - `characterSpellCastActions.test.ts`: Arcane Hand through both builders (.4).
  - `sheetCommandReducer.test.ts`: summon lifecycle rules.
  - `characterRestPure.test.ts`: a short rest keeps summons; a long rest ends them.
  - `characterPlayState.test.ts`: property round-trip.
  - `apis/convex/characters/sheetSpellSummons.test.ts`: the Sheet journey (.1, .3).
  - `CharacterSheetExtras.test.tsx`: the UI.

## Known limits

- A carried Concentration from an Encounter and a Sheet summon's Concentration can both exist. The overview prefers the
  carried one. A Sheet cast does not end a carried effect, because Sheet casts start no effects.
- A summon plan whose stat block has no hit points refuses the Sheet cast (`buildSheetSpellSummon` throws). Only Arcane
  Hand compiles a summon plan today.
