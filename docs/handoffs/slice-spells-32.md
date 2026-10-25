# Slice SPELLS-32: racial trait closed rules

Living handoff for SPELLS-32 (racial trait closed rules become core authoring options).

## Current task

SPELLS-32.T1: classify the racial trait closed-rule kinds as description-only, existing options or new options (D156), reusing the SPELLS-4 T2 and SPELLS-31 T5 option groups where they fit, and propose a split into subtasks of size 1, 2, 3 or 5 for a ruling.

## T1 classification (D156)

Every kind is one of the 14 `RACE_*` entries in `packages/shared/src/domains/effects/core/closedRuleKind.ts`; none has runtime handling, so all are inert today. Files are under `packages/source-data/src/srd/races/`. Class C deletes the kind and keeps the description, class A converts to existing options with a parity proof, and class B needs a new or extended generic option, ruled before code. "Task" is the proposed subtask below.

Totals: **C 6, A 2, B 6** (every B kind joins a SPELLS-4, SPELLS-31 or SPELLS-33 group; none needs a race-only group).

| Kind (without `RACE_`)  | File:line                   | SRD mechanic                                                           | Authored now                                                                                                                     | Class | Task and option                                                                                                                                                                 |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DWARF_HEAVY_ARMOR_SPEED | dwarf.ts:135                | Speed is not reduced by heavy armor                                    | closed rule only; the heavy armor Strength speed penalty already excludes the dwarven heritage (`dnd5eEquipmentBuilders.ts:541`) | C     | T2 (sibling rule resolves it)                                                                                                                                                   |
| DWARVEN_RESILIENCE      | dwarf.ts:176                | Advantage on saves against poison; resistance to poison damage         | poison resistance granted; save advantage only as a closed rule                                                                  | A     | T3: SAVING_THROW_MODIFIER ADVANTAGE with POISONED across every ability (Steel Will pattern, `hunter.ts:209-225`); "against poison" is broader than the condition (open point 2) |
| STONECUNNING            | dwarf.ts:261                | Double proficiency on History checks about stonework                   | closed rule only                                                                                                                 | C     | T2 (the stonework relation is a GM call, like Natural Explorer)                                                                                                                 |
| FEY_ANCESTRY            | elf.ts:203, half-elf.ts:242 | Advantage on saves against being charmed; magic can't put you to sleep | closed rule only                                                                                                                 | B     | T4j: SPELLS-4.T2j source qualifier ("magic") for the sleep immunity; the charmed advantage is the Steel Will pattern                                                            |
| TRANCE                  | elf.ts:215                  | Meditate 4 hours instead of sleeping                                   | closed rule only                                                                                                                 | C     | T2 (no rest duration state)                                                                                                                                                     |
| HALFLING_LUCKY          | halfling.ts:126             | Reroll a 1 on an attack roll, ability check or saving throw            | closed rule only                                                                                                                 | B     | T5: SPELLS-31.T5c d20 reroll                                                                                                                                                    |
| HALFLING_BRAVE          | halfling.ts:139             | Advantage on saves against being frightened                            | closed rule only                                                                                                                 | A     | T3: SAVING_THROW_MODIFIER ADVANTAGE with FRIGHTENED across every ability (Steel Will pattern)                                                                                   |
| HALFLING_NIMBLENESS     | halfling.ts:153             | Move through the space of any creature a size larger                   | closed rule only                                                                                                                 | B     | T6: SPELLS-33.T6k1 passage through hostile footprints, gated by relative size                                                                                                   |
| NATURALLY_STEALTHY      | halfling.ts:229             | Can hide when obscured only by a larger creature                       | closed rule only                                                                                                                 | C     | T2 (hide eligibility is a GM call)                                                                                                                                              |
| GNOME_CUNNING           | gnome.ts:160                | Advantage on Int, Wis and Cha saves against magic                      | closed rule only                                                                                                                 | B     | T4j: SPELLS-4.T2j "against magic" qualifier, shared with creature Magic Resistance (SPELLS-33.T4j)                                                                              |
| ARTIFICERS_LORE         | gnome.ts:236                | Double proficiency on History checks about magic items and devices     | closed rule only                                                                                                                 | C     | T2 (subject relation is a GM call)                                                                                                                                              |
| TINKER                  | gnome.ts:248                | Build tiny clockwork devices                                           | tinker's tools proficiency granted                                                                                               | C     | T2 (narrative; the tool proficiency is already granted)                                                                                                                         |
| RELENTLESS_ENDURANCE    | half-orc.ts:204             | Once per long rest, drop to 1 hit point instead of 0                   | long-rest charge authored; the drop-to-1 only as a closed rule                                                                   | B     | T5: SPELLS-31.T5f drop-to-1-instead-of-0 option, unbound case                                                                                                                   |
| SAVAGE_ATTACKS          | half-orc.ts:218             | One extra weapon damage die on a melee critical hit                    | closed rule only                                                                                                                 | B     | T5: SPELLS-31.T5d extra critical dice, as Brutal Critical                                                                                                                       |

### Vocabulary checked for the class B rulings

- `SAVING_THROW_MODIFIER` params are `{ability, conditionTypeId?, ruleDefinitionId?, requiresHolderSeesSource?}` (`packages/schema/src/grants/modifier.ts:61`); condition advantages are class A, "against magic" is not expressible (SPELLS-4.T2j).
- Hostile-footprint passage is enforced in the movement planner (`packages/rules-runtime/src/encounterMovementPassageContacts.ts:35`), so Halfling Nimbleness changes resolved state; it shares the passage option with creature Air Form and Incorporeal Movement (SPELLS-33.T6k1).
- The heavy armor speed penalty already carries a HERITAGE EXCLUDE predicate for dwarves (`packages/shared/src/domains/subjects/authored/dnd5eEquipmentBuilders.ts:541`).

### Authoring gaps found

None beyond the closed rules themselves.

## Proposed split (for ruling)

Sizes are Fibonacci points from 1, 2, 3 and 5. T2 and T3 have no dependencies and go first; the others start after the group they join merges.

| Task | Size | Depends on              | Scope                                                                                                                                                                                                         |
| ---- | ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2   | 1    | none                    | C: delete the description-only kinds and their CLOSED_RULE outcomes; keep descriptions (6 kinds)                                                                                                              |
| T3   | 1    | none                    | A: Dwarven Resilience and Halfling Brave as saving throw advantages (Steel Will pattern) (2 kinds)                                                                                                            |
| T4j  | 1    | SPELLS-4.T2j            | Fey Ancestry, Gnome Cunning ("against magic" qualifier, built with SPELLS-33.T4j) (2 kinds) Converted with SPELLS-33.T4j, with Dwarven Resilience as POISONED-scoped save advantage; the 3 kinds are deleted. |
| T5   | 2    | SPELLS-31.T5c, T5d, T5f | Halfling Lucky, Relentless Endurance, Savage Attacks (3 kinds)                                                                                                                                                |
| T6   | 1    | SPELLS-33.T6k1          | Halfling Nimbleness (1 kinds)                                                                                                                                                                                 |

5 subtasks, 6 points.

Order: T2 and T3 in parallel; T4j with SPELLS-33.T4j once SPELLS-4.T2j merges; T5 once SPELLS-31.T5c, T5d and T5f merge; T6 once SPELLS-33.T6k1 merges.

Open points for the ruling:

1. Stonecunning, Artificer's Lore and Naturally Stealthy as C: each depends on a GM call about the subject or the cover, like Natural Explorer (SPELLS-31.T1 ruling).
2. Dwarven Resilience as A with the POISONED condition: the SRD says "saving throws against poison", which also covers poison damage saves. The broader reading needs a damage-type qualifier on SAVING_THROW_MODIFIER and would move it to T4j.

## Status

T1 classification and proposed split recorded; waiting on the orchestrator's ruling.
