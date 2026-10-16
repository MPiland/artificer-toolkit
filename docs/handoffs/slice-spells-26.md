# Workbook: SPELLS-26 spells that target several chosen creatures

**Status:** survey done 2026-10-15; scope settled by Phase 8 rulings (see Rulings); T1 (Magic Missile) merged; T2 (saves) in CI. Branch `claude/elegant-sinoussi-7ba075`, CI branch `ci/spells-26`.

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

## Rulings (Phase 8, binding)

1. Corpus test derives from the real compiler, no allowlist: every `CHOSEN_CREATURES` + `maxTargets` spell compiles, or fails with the same reason as a `SINGLE_TARGET` cast of it. Every group C spell has an owner; a PBI is proposed only for outcome families nobody owns.
2. Projectiles use the existing `allowRepeatedTargets` and `maxTargets`/`maxTargetsScaling`; a repeated target entry is one dart or ray; each entry is its own damage instance. No `{actorId, count}`; RESOLVE_ACTION transport and authoring shape stay.
3. Eldritch Blast is folded in; its authoring is corrected if `CHARACTER_LEVEL` dice breakpoints mis-model the beam count.

### Group C owners

| Spell(s)                                                                            | Owner                                                 |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Aid                                                                                 | SPELLS-8.T4                                           |
| Bane, Bless, Feather Fall, Heroes' Feast, Water Breathing, Water Walk, Wind Walk    | SPELLS-4.T2                                           |
| Plane Shift, Seeming, Mass Suggestion                                               | ADR 0018 fail-closed MANUAL_ADJUDICATION, SPELLS-4.T2 |
| Word of Recall, Telepathic Bond, Giant Insect (TELEPORT, MANIFEST, TELEPATHIC_LINK) | Unowned: proposed PBI SPELLS-28                       |

Not this slice: T7 multi-Effect, T8 LIMITED_USE/pool, T10 components, T11 rituals. Spare the Dying (SPELLS-8.2) is unclaimed.

## Tasks

- **T1 Projectiles on chosen creatures (Magic Missile).** Compile: cast-level `maxTargets` resolved, repeated targets accepted for unscaled dice damage. Transport: the ACTORS uniqueness refine is gone (the worker refuses a repeat for an action that does not allow it). Execution: one child, roll tape and occurrence per entry, hit points chained per creature, slot spent once, `rollsPerTarget` to persistence for roll cards. Web: per-creature projectile counts. Proofs: schema, compile, planner and worker journey tests (5), drawer test.
- **T2 Per-creature saves for a chosen list** (Acid Splash, Chain Lightning). Compile: a `CHOSEN_CREATURES` save list with a resolvable cap and no repeats; Chain Lightning's cap is authored as `maxTargetsScaling` on the cast level (4 at level 6 .. 7 at level 9). Room: a list with a save plan reuses the point area's pending machinery through `sealReachSaves` (one sealed save per distinct creature, damage rolled once on a frozen tape, one slot, one undo); the pending context's `scene`, `area` and `token` became nullable so a list needing no Scene seals nothing it did not read. Proofs: compile tests, five Worker journeys (`nativeRoomChosenActorsSpell.test.ts`: waiting saves and one roll, no-Scene list, auto-roll at open, GM removal, Chain Lightning's full and lesser dice with one slot and one undo, cap refusal).
- **T3 One attack roll per ray or beam** (Scorching Ray; Eldritch Blast on a `CHARACTER_LEVEL` cap). Compile: an attack list with a resolvable cap and repeats allowed; `characterLevel` rides the entry point and descriptor beside `spellCastLevel`, and `resolveChosenCreaturesTargeting` reads both. Room: the save-list path with per-entry occurrences, the caster as roller, per-hit damage tapes and a hit point chain per creature. Authoring: Scorching Ray caps by slot level (3 at 2nd, +1 per level), Eldritch Blast caps by Character level (1, 2, 3, 4 at 1, 5, 11, 17) with a plain 1d10; the unused `resolutionCount`/`resolutionCountScaling` are deleted. Proofs: compile tests, entry and removal unit tests, Worker journeys (`nativeRoomChosenActorsSpell.test.ts`).
- **T4 Corpus test** (`encounterAreaActionCompilation.test.ts`, "chosen-creature spells in the SRD corpus"). It collects every SRD spell effect with `CHOSEN_CREATURES` and a cap from the real corpus, compiles each as authored and with the targeting swapped to `SINGLE_TARGET` (cast at the spell's level, Character level 20), and asserts that a refused list is refused for the same reason a single-target cast is. There is no allowlist: a spell that starts or stops compiling changes the result with no edit to the test. Docs: `docs/architecture/rules-runtime.md` (chosen creatures, rays).

## Superseded question (answered by the rulings above)

Literal AC wording ("every ... compiles; the corpus test fails on any that does not") cannot be met by this slice for group C: those spells fail as single-target casts too, for outcome reasons (grants with lifecycle, closed rules, teleport, manual adjudication) owned by no registered PBI. See the packet sent to the Phase 8 session.
