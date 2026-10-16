# Slice SPELLS-19: area actions that leave conditions or lasting effects

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- AC 1: a point-area action whose per-creature outcome applies a condition, a lasting or recurring effect, a relationship condition, or a maintained (Concentration) effect commits that outcome on each caught creature it selects, and GM undo removes it from every one.
- AC 2: every SRD breath weapon that leaves a condition (the 21 shaped non-damage breaths, such as Silver Dragon Wyrmling Paralyzing Breath, and Gorgon Petrifying Breath with its printed repeat save authored) is offered and resolves through the area executor; the SPELLS-21 corpus test's list of non-compiling breaths is empty.
- Reuse the single-target condition and effect commit and undo paths; no area-specific copies. Authored from core options with a parity proof (ADR 0038).
- First step: split into vertical tasks with WSJF and send them to the main session for registration before coding.
- Iterate in CI (`ci/spells-19`).

Base: `origin/ci/merge-batch-y` (`162ca6870`), branch `claude/spells-19`, CI branch `ci/spells-19`. Decision numbers: `D-pending-spells-19`.

## Findings from reading the code (2026-10-16)

- **The area commit already builds per-creature effects, but creates only the actor link.** `planNativeLiveEncounterAreaCommit` (`nativeEncounterAreaRules.ts` ~1394) calls `prepareNativeActionEffectsPlan` per kept creature, then `refuseAreaEffectOutcomes(prepared, effects)`, and creates only `effects.recurringEffect`. The single-target settlement (`planNativeLiveEncounterSettlement`, `nativeEncounterSettlement.ts`) also creates `stateEffect`, applies `relationshipConditionApplications` to the mechanics batch, builds the maintained state and its transition, and projects maintenance owners. Area targets persist through `targets[].createdEffects`; `maintainedState`/`maintenanceTransition` are hard-coded `null` in the per-creature stored execution.
- **Open-time refusal** reads `leadActiveEffectPlan(prepared)`: any plan without an `actorLinkContribution` refuses.
- **The breaths are blocked twice.** Before the area refusal matters, the dnd5e System compiler (`effectActionCompiler.ts`, `supportedTestPhaseKind` ~3862) must compile the Effect. SPELLS-21 recorded the compile errors of the 22 non-compiling breaths:
  - Brass x4 Sleep and the Dust Mephit's Blinding Breath: "paths must be unique direct outcomes". The path carries a `duration`; timed conditions compile only in the immediate-follow-up form (`timedImmediateConditionPlan`).
  - Bronze x4 Repulsion: "outcome is not supported". The path is `FORCED_MOVEMENT` (`AWAY_FROM_SOURCE`, 30 ft) plus a `CLOSED_RULE`.
  - Copper x4 Slowing, Gold x4 Weakening, Silver x4 and the Silver Dragon Wyrmling Paralyzing: "unsupported bounded shape". The Silver Wyrmling's second Effect is shaped like Hold Person (condition + `FOLLOW_UP_SAVE`, `FIXED_DC`) but its path `groupType` is `SEQUENTIAL` where Hold Person's is `SINGLE`; the exact cause is not pinned (the red corpus test pins it per row). Copper and Gold also carry a `CLOSED_RULE` beside the follow-up save.
  - Gorgon: a lone `ON_SAVE_FAIL` `RESTRAINED` with no repeat save and no petrify stage authored; left unshaped by SPELLS-21.
- **Corpus test:** `packages/rules-runtime/src/__tests__/srdBreathWeaponAreas.test.ts` pins the non-compiling set (21 shaped non-damage breaths + the Gorgon). AC 2 empties it.

## Proposed tasks (vertical; each closes named ACs)

| Task | Title | Closes | bv | tc | rr | size | Depends on |
| ---- | ----- | ------ | -- | -- | -- | ---- | ---------- |
| T1 | A point-area outcome commits conditions, lasting/recurring effects and relationship conditions on each caught creature through the single-target settlement path; GM undo removes them | AC 1 (condition, lasting/recurring, relationship) | 8 | 3 | 5 | 5 | none |
| T2 | One maintained (Concentration) effect spans every caught creature of an area | AC 1 (maintained) | 8 | 3 | 5 | 3 | T1 |
| T3 | Timed and repeat-save condition breaths compile and resolve in the area: Silver x5, Dust Mephit, Brass x4 Sleep, Copper x4 Slowing, Gold x4 Weakening, Gorgon (repeat save authored, 30 ft cone shaped) | AC 2 except Bronze | 8 | 3 | 3 | 8 | T1 |
| T4 | Bronze x4 Repulsion Breath: an area pushes each failed creature 30 ft away from the breather | AC 2 (Bronze) | 5 | 2 | 3 | 3 | T1 |

T3 may split once the red corpus test pins each row's compile error.

## Red-first checklist (T1; later tasks added when registered)

1. Executor test: a point-area action whose per-creature outcome applies a condition (and a lasting effect, and a relationship condition) is offered, opens without `TARGET_UNAVAILABLE`, and commits the condition on each selected creature. Fails on base.
2. Undo: the GM's undo removes the effect from every creature.
3. Single-target parity: the area uses the same record preparation and transition projection as the single-target settlement.
4. Authoring parity (ADR 0038): the same area-plus-condition action built from core options in the real form publishes the SRD row's structure.
5. Regression: `nativeRoomDirectedAreaAction`, `nativeRoomAreaJourney`, `nativeRoomAreaAction` and the SPELLS-21 journey unchanged and green.

## Log

- 2026-10-16: task split proposed to main; waiting for registration.
