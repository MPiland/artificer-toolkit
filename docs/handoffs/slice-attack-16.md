# Slice ATTACK-16: Massive damage system shock

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Re-planned in 15237fada for full system-shock automation (user ruling, +15). The ACs are unchanged.

- T1a (8): kernel ROLL_TABLE execution. It is generic: rows by range, each row is an ordinary compiled outcome graph, and the roll and the selected row go into trace and replay. The parity proof is a homebrew table.
- T1a2 (3, after T1a, user ruling a98cf8818): row-scoped timed CONDITION and APPLY_GRANT plans, so a row's outcome can last past its OUTCOME phase.
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
- Publication refuses a table whose rows leave a gap, overlap, or fall outside the die. The compiler refuses REPEAT_TABLE rows, a row that lasts past its OUTCOME phase (until T1a2), a row with a rider, and a die that is not one plain supported term. Repeat saves inside rows and Prismatic Spray are SPELLS-4.T2ps.
- A table resolves only a saving throw's result path; tables on attack or check paths are refused at compile.
- Rows that apply the same condition share its immunity fact, so a table applies at most four distinct conditions per path.
