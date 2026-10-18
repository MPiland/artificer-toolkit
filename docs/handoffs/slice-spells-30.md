# Slice SPELLS-30: cast-time choice spells resolve automatically (T1: per-option execution plan)

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (closes AC SPELLS-30.1 with T2): contract shape escalated to the orchestrator 2026-10-17, awaiting the ruling.
- Branch `claude/nifty-golick-513885` based on the lane head c846c9359; CI branch `ci/spells-30-t1`.

## T1: per-option execution plan (D140 amendment)

Consumers: Protection from Energy (resistance to the chosen damage type on the touched willing creature, for its Concentration) and Blindness/Deafness (the chosen condition on a failed Constitution save, a repeat save at the end of each of the target's turns, one extra target per slot level above 2nd).

### Findings

- Protection from Energy already authors an ON_USE CHOICE whose five options each `APPLY_GRANT` a `DAMAGE_RESISTANCE` modifier. It goes manual only because nothing compiles a non-zone CHOICE.
- Blindness/Deafness was mis-authored: two ON_SAVE_FAIL CHOICE paths with one option each, no repeat save, no upcast, and single-target targeting.
- The compiled effect loses an option's result kind: every CHOICE entry has `groupKind: 'CHOICE'` (`compileResultBlock`), so a narrowed option can't tell SINGLE from SEQUENCE. The repeat-save and grant plans read that kind.
- Existing machinery reused: `zoneChoiceOptions` (narrowing an action to one option), `maxTargetsScaling` with `SPELL_CAST_LEVEL` (Chain Lightning, Magic Missile), FOLLOW_UP_SAVE `TARGET_TURN_END` (Hold Person), `modifierGrantPlan` (resistance grants), `choiceOptionsSchema` and the drawer Select (T4e).
- No CLOSED_RULE names either spell.

### Proposed shape (escalated, recommendation A)

1. `compilation.choice: nullable({ options: [{ optionId, label, activeEffectPlan, executionPlan }] })` on the v4 CHARACTER_ACTION entry, exclusive with `zonePlacement`. The top-level plans hold the first option (zone precedent), and `prepareEncounterActionSource` swaps in the picked option.
2. Optional `choiceOptionId` on the ACTOR and ACTORS command targets.
3. `choiceOptions` on the ACTOR and ACTORS choice DTO targets.
4. `optionGroupKind` on CHOICE-option compiled entries.

Rejected: an executionPlan kind `CHOICE` (every plan reader would branch).
