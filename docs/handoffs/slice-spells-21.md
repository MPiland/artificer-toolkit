# Slice workbook: SPELLS-21 (SRD breath weapons breathe areas)

**Status:** DONE (2026-10-15), pending merge by the main session
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

No SRD Creature can breathe through the area executor. The breath weapons are authored with a `SPECIAL` range and no area shape (for example `packages/source-data/src/srd/creatures/black-dragon-wyrmling.ts`, Acid Breath). The SPELLS-13 proofs use a synthetic Self cone action instead.

Author every SRD breath weapon the way a Self area is already authored elsewhere in source data. Turn Undead in `packages/source-data/src/srd/classes/cleric.ts` (about line 908) is the pattern: `range: { rangeKind: SELF }`, an invocation `shape` with its `shapeKind` and size, and `targeting: { selectionKind: AREA_CONTENTS }`.

- **Shapes:** a cone breath gets `CONE` with its printed length. A line breath gets `LINE` with its printed length and width. Take each size, save and damage from the row's own SRD description; never guess.
- **Scope:** every breath weapon in `src/srd/creatures`:
  - the chromatic and metallic dragons, wyrmling to ancient;
  - the Behir's Lightning Breath, the Chimera, the Dragon Turtle, the four mephits, the Gorgon, the Half-Red Dragon Veteran, the Hell Hound, the Iron Golem and the Winter Wolf.
  - "Hold Breath" traits are not breath weapons; leave them alone.
- **Condition breaths stay refused:** some breaths leave a condition or lasting effect (the metallic dragons' second breaths such as Sleep, Paralyzing, Slowing, Weakening and Repulsion Breath, and the Gorgon's Petrifying Breath). Author their area shape too, so the geometry is right, but leave their outcome as it is. The existing refusal (SPELLS-19) must still apply at open; prove it with one of them.
- **Recharge and uses:** keep the existing recharge or charge wiring on each row unchanged.
- **Ids:** every new `range` and `shape` row needs a stable id from the row's existing id helpers (`S.actionId(n, k)` with an unused `k`). Ids must stay unique across the corpus. The source-data tests check this.
- **Resolution:** everything after the catch (saves, half damage on a success, receipts, undo, perception) is the SPELLS-7 and SPELLS-13 directed-area path, unchanged. No rules-runtime or Worker change is expected. If one is needed, stop and report it.

Escalate only if:

- a printed breath cannot be expressed in the existing authored shapes; or
- an authored-shape or contract change would be needed.

Read first:

- The SPELLS-7 and SPELLS-13 decisions in `docs/handoffs/phase-08-2-decisions.md`.
- `encounterAreaTargetKind` and `encounterDirectedArea` in `packages/rules-runtime/src/encounterAreaAction.ts`.
- The SPELLS-13 Worker proof that uses the synthetic Self cone. Find it under `apps/session-worker/test`, and reuse its room setup.

## Closes

- AC SPELLS-21.1.

## File scope

- `packages/source-data/src/srd/creatures/*` (breath rows only).
- The tracked SRD manifest: run `yarn workspace @artificer-toolkit/apis generate:srd:manifest` under the runner.
- Tests:
  - source-data tests;
  - `packages/rules-runtime` compiler tests;
  - one Worker Encounter journey under `apps/session-worker/test`.

A Creature publication change reruns the whole apis `encounters` and `content` folders (slice-workbook-rules.md). Queue those runs with `-TimeoutMinutes 40`.

## Red-first checklist

1. **Corpus test** (source-data or rules-runtime): every SRD breath weapon row compiles to a directed area (COMPILED, not MANUAL), with the printed shape and size. Check a few named rows exactly: a wyrmling line, an ancient dragon cone, the Behir's line and the Winter Wolf's cone. The test fails on base.
2. **Condition breaths:** a condition breath (for example the Silver Dragon Wyrmling's Paralyzing Breath) still opens to the SPELLS-19 refusal.
3. **Journey:** a Worker Encounter journey through real code. An unmodified SRD dragon from the real corpus (not a synthetic action) breathes in a real room:
   - the caught creatures save;
   - damage applies, half on a success;
   - a token outside the area takes nothing;
   - the GM's undo restores every target.
4. **Regression:** the existing SPELLS-13 synthetic-cone tests still pass unchanged.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: red first. Row edits temporarily reverted under the runner (`local-validation/spells-21/red.ps1`): corpus test 79 of 152 failed (`rules-runtime.red.log`), Worker journey 3 of 3 failed (`session-worker.red.log`).
- 2026-10-14: 72 breath Effects in 52 creature files authored with `S.selfCone` / `S.selfLine` (new in `creatures/shared.ts`; each row keeps its range id and gets a new shape id). Manifest regenerated.
- 2026-10-14/15: green runs `green.ps1` to `green5.ps1` (logs `*.green*.log`). The first runs exposed that the breaths that leave more than damage do not compile, and that an area silently drops a bare condition (the Gorgon). Tests corrected honestly (below), the Gorgon row left unshaped, and everything rerun on the final data: source-data 52 tests, corpus 203 tests, Worker 4 files / 98 tests, Worker and Convex typechecks green (`green4.summary.log`); apis `content` and `encounters` folders rerun on the final manifest (`green5.summary.log`).

## Proposed ledger edits (filled by the slice session)

- AC SPELLS-21.1 (every SRD breath weapon authored as a Self cone or line with its printed size; an unmodified SRD dragon breathes it in a real room): closes for the 71 breaths below; the Gorgon's Petrifying Breath is deferred to SPELLS-19 (see Findings). Proof:
  - `packages/rules-runtime/src/__tests__/srdBreathWeaponAreas.test.ts`: 72 breath Effects found; each prints exactly one area; 71 compile to a `SELF` / `DIRECTED` area equal to the printed size; named rows (Black Dragon Wyrmling line 15x5, Red Dragon Wyrmling cone 15, Ancient Red Dragon cone 90, Ancient Blue Dragon line 120x10, Behir line 20x5, Winter Wolf cone 15, Dragon Turtle cone 60); all 50 damage-only breaths compile to a `TEST_OUTCOME`; the 22 breaths that leave more than damage are counted.
  - `apps/session-worker/test/nativeRoomSrdBreathJourney.test.ts`: the unmodified Black Dragon Wyrmling offers its 15 ft line and breathes it in a real room (three Wolves in the line save, full damage on two failures and half on the success, a Wolf past the line, a Wolf off the row and the dragon untouched, one `RESOLVE_ACTION`, GM undo restores every target).
- Refusals (checklist 2), proven in the same journey file: the Silver Dragon Wyrmling's Paralyzing Breath is rejected at open (`COMMAND_REJECTED`, nothing pending, vitals unchanged), and so is the unshaped Gorgon breath.
- Regression (checklist 4): `nativeRoomDirectedAreaAction.test.ts`, `nativeRoomAreaJourney.test.ts` and `nativeRoomAreaAction.test.ts` unchanged and green; `encounterAreaAction*` rules-runtime tests green.

### Findings for SPELLS-19 (proposed as ledger notes, not new work in this slice)

- 22 breaths leave more than damage: the metallic dragons' second breaths (Sleep, Repulsion, Slowing, Weakening and Paralyzing, 4 ages each = 20), the Gorgon and the Dust Mephit. They keep their area shape (except the Gorgon) and stay refused. The 21 shaped ones do not compile to an executable plan at all (existing compiler limits: a repeating follow-up save, a push, slow or weaken outcome, or a single `ON_SAVE_FAIL` path), so the Worker answers `COMMAND_REJECTED` with no reason, not the `TARGET_UNAVAILABLE` area-effect refusal.
- **Gorgon Petrifying Breath is deliberately left unshaped.** Its authored outcome is a bare `RESTRAINED` condition on a failed save. That plan compiles and the area refusal (`encounterActiveEffectPlan`) does not see it, so a shaped breath committed with nothing applied (a probe room: a caught Wolf failed its save and ended with no condition). A silent no-op is worse than a refusal, and fixing it is a Worker or rules-runtime change outside this slice. SPELLS-19 should make an area refuse (or apply) a bare condition outcome, then shape the Gorgon (30 ft cone) with `S.selfCone(S.actionId(148, 8), S.actionId(148, 11), 30)`.

### Deviations

- `selfCone` / `selfLine` helpers in `creatures/shared.ts` (used 71 times) instead of 71 hand-written blocks.
- The Hell Hound and Winter Wolf breaths were authored with `CHOSEN_CREATURES` targeting; they now use `AREA_CONTENTS`, as their descriptions ("each creature in that area") print.
- The Behir's stale comment ("waits on area targeting (D60)") was removed with its row edit.
- The Young Blue Dragon description reads "an 60-foot line" (existing data typo); size 60 taken, the description left alone.
- The corpus test asks for an executable plan only from the damage-only breaths; the brief's "every breath compiles" cannot hold for the 22 above.

### Not run

- Stage or browser journeys (this slice changes data and the Worker path, not the stage).
- The local-backend reset and reseed that publishes the changed Creatures (the apis folders ran green under convex-test).
