# Slice SPELLS-34: summons on the sheet Extras tab

Living handoff for SPELLS-34 (a summon cast shows the creature on the caster's sheet Extras tab, for groups that play without the VTT). Decision: D190 in [phase-08-2-decisions.md](phase-08-2-decisions.md).

## Current task

SPELLS-34.T2: Encounter summons in Extras and summon attacks on both paths. Closes SPELLS-34.1, SPELLS-34.2 and
SPELLS-34.3. T1 (merged) closed SPELLS-34.4.

## Next

None: T2 is the PBI's last task.

## Rulings (orchestrator, binding)

- The entry lives in its own optional `state.spellSummons[]`, which is play state. The Extras DTO adds a
  `SPELL_SUMMON` member. UPDATE_SHEET_EXTRA and REMOVE_SHEET_EXTRA take kind `SPELL_SUMMON`. Only CAST_SPELL creates
  an entry.
- The entry stores only resolved, typed stat block values: size (the size enum), AC, ability scores, speeds, passive
  Perception and max/current HP. It never stores the plan's expressions (review of e1c6cd83c). The shared
  `CharacterSpellSummonState` owns the shape, because `packages/schema` depends on `packages/shared` and not the reverse.
  The schema is typed `z.ZodMiniType<CharacterSpellSummonState>`, so the two cannot drift.
- The summon stat block's `size` parses as the size enum.
- There is one shared compile (`compileCharacterSpellCasts`). The Sheet and Encounter builders share `summonHitPoints`.
- A Concentration summon is the Sheet's Concentration. END_CONCENTRATION, a new Concentration cast and the caster at
  0 HP end it.
- Attacks move to T2. The row shows no attacks placeholder.

## T1 contents (in CI on `ci/spells-34-t1`)

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

## T2 contents (in CI on `ci/spells-34-t2`)

- **One stat block resolver:** `rules-runtime/spellSummonStatBlock.ts` resolves the shared
  `SpellSummonStatBlockValues` (shared `character/state.ts`, schema `spellSummonStatBlockValuesDtoSchema`) from the
  compiled summon placement. That covers AC, ability scores, speeds, passive Perception, Concentration and `actions`.
  The actions are the plan's CONJURED repeat-source offers: the trigger label (for example "Melee Spell Attack") and
  the activation label. The Sheet entry (`CharacterSpellSummonState extends` it) and the Encounter actor both store
  its output.
- **Encounter actor as the record:** `buildEncounterSummon` takes `spellSummon` (null when no spell made the summon)
  and keeps it on the actor snapshot as `summon`. The Worker's area commit resolves it for spell casts.
- **Sheet read view:** `ownedEncounterSpellSummons` reads the caster's owned, undefeated actors whose snapshot holds a
  summon. `encounterSpellSummonExtra` maps one to a `SPELL_SUMMON` Extra with `encounterActorId`, so its id is the
  actor id and its HP is the actor's live HP. `projectCharacterSheet` takes them as `encounterSummons`.
- **Worker:** `roomCharacterSummons.ts` reads them from the room's ACTIVE Runs. The Sheet feed keys its push on their
  hit points, because actor changes do not bump the Character's stream. The entry leaves with the actor (Concentration
  end, expiry, revert) or when 0 HP defeats it.
- **Web:** the Summons row lists attacks. An Encounter summon shows read-only HP and no Dismiss.
- **Proofs:**
  - `characterSpellCastActions.test.ts`: Arcane Hand on both paths, with the Clenched Fist action from one plan (.1, .2).
  - `apis/convex/characters/sheetSpellSummons.test.ts`: Sheet entries list their attacks (.1).
  - `CharacterSheetExtras.test.tsx`: the read-only Encounter row with its attacks (.1, .2).
  - Journey, `session-worker/test/nativeRoomCoreOptionSpells.test.ts` (room Arcane Hand): the owner's pushed Sheet
    lists the cast hand with live HP, follows the GM's HP edit and drops it at 0 HP and on Concentration end (.2, .3).

## Known limits

- A carried Concentration from an Encounter and a Sheet summon's Concentration can both exist. The overview prefers the
  carried one. A Sheet cast does not end a carried effect, because Sheet casts start no effects.
- A summon plan whose stat block has no hit points refuses the Sheet cast (`buildSheetSpellSummon` throws). Only Arcane
  Hand compiles a summon plan today.
