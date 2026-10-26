# Slice ATTACK-16: Massive damage system shock

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Re-planned in 15237fada for full system-shock automation (user ruling, +15). The ACs are unchanged.

- T1a (8): kernel ROLL_TABLE execution. It is generic: rows by range, each row is an ordinary compiled outcome graph, and the roll and the selected row go into trace and replay. The parity proof is a homebrew table.
- T1a2 (5, after T1a, user rulings a98cf8818 and 72374e8f2): row-scoped timed CONDITION and APPLY_GRANT plans, so a row's outcome can last past its OUTCOME phase.
- T1b (5): a rule-owned action source for Creatures and Characters.
- T1c (5, after T1a2 and T1b): MASSIVE_DAMAGE on the D167 damage-save chain, plus a self-targeted SYSTEM root that runs the table.
- T1d (2, after T1c): migrate the seed and delete the five executor-less primitives and outcome kinds.
- T2 (1, after T1d): the settings gate and the journey test.

Base: `origin/codex/phase-08-2-convex-cutover`. CI branch `ci/attack-16`.

## Rulings

- This is the 2014 DMG variant, not the D96 SRD instant-death rule.
- Result table: option A. It is an ordinary authored ROLL_TABLE path, and the closed `bands` and their five primitives are deleted. Nothing is restored from 65672a89e.
- Drop to 0 HP stays out of scope. Those rows ship as MANUAL_ADJUDICATION GM rulings inside the automated table, with their row text kept, unless T1b's outcomes already give exactly the right result: dying, not dead, and unaffected by resistance. ATTACK-16 is listed under the deferred REDUCE_TO_ZERO_HIT_POINTS entry in `future-enhancements.md`.
- Settings gate: MASSIVE_DAMAGE goes in `INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES`, and `DND5E_MASSIVE_DAMAGE_POLICY_MODULE` in `dnd5ePolicyModuleRegistration`, following the Morale precedent.
- Prismatic Spray is not built here. Its conversion size goes to the orchestrator with the T1a design note, and it becomes a separate SPELLS task.
- Design notes are sent before T1a and before T1b. Each task is one CI-green increment.
- T1a design, option 2 (approved): the table die is rolled in the save's OUTCOME phase. A generic row-gate operation (`dnd5e.roll-table-row-gate`) authorizes each row's outcomes, following the nested-save band pattern, so the persisted TEST evidence contract is unchanged. Only the rolled row's own dice are requested.
- Publication refuses a table whose rows leave a gap, overlap, or fall outside the die. The compiler refuses REPEAT_TABLE rows, a row that lasts past its OUTCOME phase without a timed plan that holds it, a row with a rider, and a die that is not one plain supported term. Repeat saves inside rows and Prismatic Spray are SPELLS-4.T2ps.
- A table resolves only a saving throw's result path, or (T1c2a) a test-less action's one path; tables on attack or check paths are refused at compile.
- T1c2 split (orchestrator ruling A, 2026-10-26): T1c1 records the massive-damage save, so the raised Effect cannot author a second save. T1c2a (5) adds the direct-phase table: a test-less action rolls its ON_USE table in its single DIRECT graph, reusing the T1a table graph and the T1a2 row plans. The proofs are `rollTable.test.ts` (homebrew self Effect) and the Character room journey in `nativeRoomRollTable.test.ts`. T1c2b (5, fresh session after T1c2a merges) adds the SYSTEM root: `systemTrigger.trigger: 'RULE'`, an optional MASSIVE_DAMAGE `failedSaveEffectId`, RULE-arm admission from the parent receipt's SAVE_FAILURE, the room hook after RESOLVE_RULE_OCCURRENCE, a `nativeEncounterRules.ts` split, and Creature and Character journeys. Options B (replaying the TEST from the save's d20) and D (moving the save into the root) were rejected.
- Rows that apply the same condition share its immunity fact, so a table applies at most four distinct conditions per path.
- T1a2 design (approved): per-row plans follow the hit-point-tier pattern. The plan gains an optional `rollTableRow: { min, max }`, and the compilation gains `rollTableRowPlans` (max 20). The runtime selects the row's plan by the OUTCOME phase's `rollTableRoll`, and a multi-creature action's lead plan refuses row plans. Row and tier narrowing share `narrowedActions`. The contract is recorded in [rules-runtime.md](../architecture/rules-runtime.md).
