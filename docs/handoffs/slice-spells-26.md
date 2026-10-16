# Workbook: SPELLS-26 spells that target several chosen creatures

**Status:** survey done 2026-10-15; scope question open with the Phase 8 session (see Open question). Branch `claude/elegant-sinoussi-7ba075`, CI branch `ci/spells-26`.

Closes AC SPELLS-26.1. Unblocks REACTION-4.T4 (Shield vs Magic Missile).

## Survey (2026-10-15, from the real compiler)

Method: every SRD Effect whose targeting is `CHOSEN_CREATURES` was compiled through `compileEffect` and the D&D 5e action adapter (`compileExecutionPlan`), once as authored and once with the targeting swapped to `SINGLE_TARGET`. The second compile separates "blocked by the target kind" from "blocked by the outcome", which single-target casts cannot do either.

- 31 Effects author `CHOSEN_CREATURES`: 22 have a cap (`maxTargets`, or `maxTargetsScaling` for Eldritch Blast), 9 have none and are outside the AC wording (Animal Shapes, Astral Projection, Beacon of Hope, Compulsion, Divine Word, Enthrall, Pass without Trace, Mass Heal, Teleport).
- **3 of 22 compile today:** Mass Healing Word, Mass Cure Wounds, Prayer of Healing (T12; heal outcome only, `ACTORS` target kind).
- **A. Blocked only by the target kind (single-target compiles): Acid Splash (2, save), Chain Lightning (4, save), Scorching Ray (3 rays, attack).**
- **B. Blocked by the target kind and by damage scaling the single-target path also refuses:** Magic Missile (authored as a pooled total per cast level, 3d4+3 .. 11d4+11, not per dart; single-target fails "one fixed direct result"), Eldritch Blast (`CHARACTER_LEVEL` breakpoints on dice and on `maxTargetsScaling`).
- **C. Blocked by the outcome (single-target also fails; not a target-kind gap):**
  - Lifecycle or rule outcomes (`CLOSED_RULE`, duration, `MANIFEST`): Aid, Bane, Bless, Feather Fall, Giant Insect, Heroes' Feast, Water Breathing, Water Walk, Wind Walk, Telepathic Bond.
  - Manual or teleport outcomes: Plane Shift, Seeming, Mass Suggestion, Word of Recall.

Raw table: `local-validation/spells-26/survey.txt` (disposable).

## Open question

Literal AC wording ("every ... compiles; the corpus test fails on any that does not") cannot be met by this slice for group C: those spells fail as single-target casts too, for outcome reasons (grants with lifecycle, closed rules, teleport, manual adjudication) owned by no registered PBI. See the packet sent to the Phase 8 session.
