# Slice SPELLS-29: Frightened follows its source

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md) (soft enforcement), [ADR 0038](../adr/0038-rules-authored-from-core-options.md) (core options), D94, D100, D116 and D131 in [phase-08-2-decisions.md](phase-08-2-decisions.md). Builds on [SPELLS-19.T2](slice-spells-19.md) (one Concentration spans an area; Fear-shaped proof).

Base: `3ce5883f1` (SPELLS-19.T2, merged locally), branch `claude/bold-chaplygin-b95f96`, CI branches `ci/spells-29-t1-red` (red) and `ci/spells-29-t1` (green). Decision numbers: `D-pending-spells-29`.

## Scope (T1, closes AC 29.1)

- **AC 29.1** (user-confirmed): a Frightened condition applied by an action records the creature that frightened it, authored from core options (no Fear-specific kind). The frightened creature has disadvantage on ability checks and attack rolls only while that source is within its line of sight, and a move that ends closer to the source is a soft-enforcement warning the GM can override (ADR 0034). A Frightened with no recorded source keeps its present always-on disadvantage. Proved for Fear, including GM undo.
- Ledger task text: "A condition application carries an optional source actor; Frightened's check and attack contributors read line of sight to it; the movement planner warns on a move that ends closer; SRD Fear and every SRD action that frightens authors the source; authoring parity from core options."
- Out of scope: the flee-from-source rider (Dash away, turn-end save) is SPELLS-29.T2.

## Findings

- A CONDITION outcome has no optional fields today (`packages/schema/src/effects/condition.ts`); the compiler's four condition plans (`effectActionCompiler.ts` `repeatingImmediateFollowUpSavePlan`, `timedImmediateConditionPlan`, `timedConditionPlan`, `repeatingDirectFollowUpSavePlan`) build `conditionContribution`, and `prepareRecurringActiveEffect` turns it into a `CONDITION_OWNERSHIP` contribution. The active effect's origin already carries the acting actor (`origin.sourceActorId`).
- Condition contributors read `MovementTarget.conditionMechanics` (D94): attacks at `encounterActionMechanicsPreparation.ts:446`, checks in passage contests and Disarm. Sight is D100's `resolveEncounterAttackPerception` (true sight, Scene placement or the neutral environment).
- **Premise change:** the ledger text says "reuse the movement-warning machinery", but movement has no soft enforcement today (ADR 0034: movement "shown but not enforced"; `MOVE_SCENE_TOKEN` has no `acknowledgedWarnings`; the only refusals are hard). T1 adds the first movement soft warning by extending the action pattern (warning code, `RULE_WARNINGS` rejection, `acknowledgedWarnings`, "Do it anyway" in the web), not a new mechanism.

## Design

1. **Authored source (core option, ADR 0038):** CONDITION outcome gains optional `recordsSource: boolean` ("the creature taking the action is this condition's source"); schema, shared authored/compiled types, compiler and an effect node-map toggle. SRD Fear and every SRD creature action that frightens author `recordsSource: true`; Phantasmal Killer and Weird stay unsourced (their source is an illusion).
2. **Runtime source:** the compiler carries `recordsSource` on `conditionContribution`; the room records `sourceActorId` (the acting actor) on that effect's `CONDITION_OWNERSHIP` contribution.
3. **Mechanics (D94 extension):** `D20_ROLL_MODE` gains optional `requiresHolderSeesSource` (not allowed on SAVES, which fold at load); new mechanic `APPROACH_SOURCE_FORBIDDEN`. SRD Frightened authors both. A held condition's sources are the recorded `sourceActorId`s of the effects that own it; a holding with no recorded source (baseline, manual, unsourced effect) makes it unsourced, which keeps the gated mechanics always on (AC: "no recorded source keeps its present always-on disadvantage").
4. **Sight gate:** a pure filter drops a sight-gated mechanic when its condition has recorded sources and the holder sees none of them; the room resolves holder→source true sight (Scene placement when the action has one, neutral environment otherwise) for single-target actions before preparation, so attack and check contributors read the filtered mechanics unchanged. A source with no token beside the holder's on the Scene is out of sight.
5. **Movement warning:** a voluntary move whose end is closer to a recorded source of an `APPROACH_SOURCE_FORBIDDEN` condition than its start raises warning `CONDITION_SOURCE_APPROACH`; `MOVE_SCENE_TOKEN` gains `acknowledgedWarnings`; unacknowledged is a `RULE_WARNINGS` rejection; acknowledged commits and is recorded as an override; GM undo reverts the move as today.

## Checklist (red first)

- [x] Red: rules-runtime unit (sources from effects; sight filter; approach warning), compiler unit (`recordsSource` → contribution → `CONDITION_OWNERSHIP.sourceActorId`), authoring parity (Fear and a homebrew condition keep `recordsSource`), room journey (Fear: attack disadvantage only in sight, move-closer warning + Do it anyway, GM undo), web unit (move warning prompt).
- [x] Schema + shared + compiler + node map + SRD authoring (Fear + 29 Creature frighten outcomes; Phantasmal Killer and Weird unsourced). Manifest via CI artifact.
- [x] Runtime gate + room wiring: `prepareEncounterActionMechanics` filters both sides' mechanics through the injected `loadSourcesSeen` (Worker `readNativeLiveSourcesSeen`), wired for RESOLVE_ACTION attacks and Disarm.
- [x] Movement warning (schema, room `prepareNativeLiveMovement` initial branch, web `CampaignVttStage` "Do it anyway"). Forced moves never warn; teleports do (a willing move).
- [x] Docs: rules-runtime.md condition mechanics; D94 limits note; ADR 0034 movement line; `D-pending-spells-29`; Deferred edge cases.
- [ ] Red CI run, green Tests + Live backend, opus review, triage.

## Log

- 2026-10-16: merged `3ce5883f1` (fast-forward); read AGENTS.md, ADR 0034, ADR 0038, D94, D100, D116, D131, slice-spells-19.md and the SRD Frightened (line 17053) and Fear (line 7026) text.
- 2026-10-16: red tests written (rules-runtime unit, compiler, authoring parity, room journey, web move warning). The worktree has no `node_modules`, so the red run is CI only (`ci/spells-29-t1-red`).
