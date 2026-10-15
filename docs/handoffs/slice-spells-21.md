# Slice workbook: SPELLS-21 (SRD breath weapons breathe areas)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
