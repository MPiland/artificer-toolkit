# Slice SPELLS-29: Frightened follows its source

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md) (soft enforcement), [ADR 0038](../adr/0038-rules-authored-from-core-options.md) (core options), D94, D100, D116 and D131 in [phase-08-2-decisions.md](phase-08-2-decisions.md). Builds on [SPELLS-19.T2](slice-spells-19.md) (one Concentration spans an area; Fear-shaped proof).

Base: `3ce5883f1` (SPELLS-19.T2, merged locally), branch `claude/bold-chaplygin-b95f96`, CI branches `ci/spells-29-t1-red` (red) and `ci/spells-29-t1` (green). Decision numbers: `D134`.

## Scope (T1, closes AC 29.1)

- **AC 29.1** (user-confirmed): a Frightened condition applied by an action records the creature that frightened it, authored from core options (no Fear-specific kind). The frightened creature has disadvantage on ability checks and attack rolls only while that source is within its line of sight, and a move that ends closer to the source is a soft-enforcement warning the GM can override (ADR 0034). A Frightened with no recorded source keeps its present always-on disadvantage. Proved for Fear, including GM undo.
- Ledger task text: "A condition application carries an optional source actor; Frightened's check and attack contributors read line of sight to it; the movement planner warns on a move that ends closer; SRD Fear and every SRD action that frightens authors the source; authoring parity from core options."
- Out of scope: the flee-from-source rider (Dash away) is SPELLS-29.T2; the out-of-sight turn-end save moved to T1a.

## Scope (T1a: Fear's out-of-sight repeat save; closes AC 29.1 with T1, plus the out-of-sight save half of AC 29.2)

- Ruling (orchestrator, 2026-10-16, ledger successor of `7d0df8a5e`): ruling A. T1a is Fear's out-of-sight repeat save. Add a generic perception gate on `FOLLOW_UP_SAVE`: the attempt is allowed only when the target can't see its source. Model it on `repeatRollInfluence` `PERCEPTION`, authorable from core options with a parity proof, and author it on SRD Fear, which then compiles through the existing repeating-save plan. T2 keeps only the flee/Dash rider and follows T1a. Red on `ci/spells-29-t1a-red`, failing on the Fear compile and perception-gate assertions.
- Withdrawn by the ruling: the first T1a approach (a timed save condition joining TEST/OUTCOME through `supportedTestPhaseKind`), reverted in `d42974a57`; Ray of Sickness (not SRD 5.1); the Gorgon row; this branch's Brass/Dust Mephit authoring and corpus edits, superseded by SPELLS-19.T3 (merged through `ci/merge-batch-aq`). T3's authored-`endOnTriggers` rule stays the single rule and every T3 pin is unchanged (Charm, Dominate ×3 and Hold Monster stay refused).
- Proof: real SRD Fear in the Worker room journey `nativeRoomFearSource.test.ts` (in sight: no save is requested and the effect continues; out of sight: the save is rolled and a success ends Frightened for that creature only; GM undo), the compiler on the real cast path, schema refusals, and authoring parity.

## Design (T1a)

- **Authored (core option, ADR 0038):** `FOLLOW_UP_SAVE.repeatAttemptGate?: { allow: 'WHEN_MET' | 'WHEN_UNMET', when: PERCEPTION }`, sharing the `when` shape (`kind`, `observer: TARGET`, `subject: SOURCE`, `requirement`) with `repeatRollInfluence`. The schema requires a repeated save at the end of the target's turn and refuses a gate combined with `repeatRollInfluence`. The effect node map gains a `Repeat Attempt Gate` group (`Attempt`: Only When Met / Only When Unmet) beside the influence group; both use one shared perception map. SRD Fear authors `allow: 'WHEN_UNMET'`, `requirement: 'SEE'`.
- **Compiled:** `repeatingDirectFollowUpSavePlan` pins the gate as adapter facts (`dnd5e.active-effect-repeat-save-attempt-gate` plus the existing perception requirement). A gated graph's `repeat-save-d20` node is `evidence.optional-integer-range`, enabled by the bound fact `dnd5e.repeat-save-attempt-allowed`; the kernel settles a disabled node with no roll request. The schema accepts a gate only on a save first made at the end of the target's turn; `repeatingImmediateFollowUpSavePlan` still refuses one defensively.
- **Bound:** the repeat-save binding resolves the same holder→source perception as `repeatRollInfluence`. The attempt is allowed when `satisfied === (allow === 'WHEN_MET')`; a refused attempt binds no evidence policy, so nobody is asked to roll.
- **Interpreted:** a refused attempt is `ATTEMPT_REFUSED`: the effect continues unchanged, or, on its last tick, expires with null paths. The turn-result schema accepts exactly these refused-attempt shapes (`refusedRepeatSave`, its continuation and its terminal expiry).

## Findings

- A CONDITION outcome has no optional fields today (`packages/schema/src/effects/condition.ts`); the compiler's four condition plans (`effectActionCompiler.ts` `repeatingImmediateFollowUpSavePlan`, `timedImmediateConditionPlan`, `timedConditionPlan`, `repeatingDirectFollowUpSavePlan`) build `conditionContribution`, and `prepareRecurringActiveEffect` turns it into a `CONDITION_OWNERSHIP` contribution. The active effect's origin already carries the acting actor (`origin.sourceActorId`).
- Condition contributors read `MovementTarget.conditionMechanics` (D94): attacks at `encounterActionMechanicsPreparation.ts:446`, checks in passage contests and Disarm. Sight is D100's `resolveEncounterAttackPerception` (true sight, Scene placement or the neutral environment).
- **Premise change:** the ledger text says "reuse the movement-warning machinery", but movement has no soft enforcement today (ADR 0034: movement "shown but not enforced"; `MOVE_SCENE_TOKEN` has no `acknowledgedWarnings`; the only refusals are hard). T1 adds the first movement soft warning by extending the action pattern (warning code, `RULE_WARNINGS` rejection, `acknowledgedWarnings`, "Do it anyway" in the web), not a new mechanism.

## Design

1. **Authored source (core option, ADR 0038):** CONDITION outcome gains optional `recordsSource: boolean` ("the creature taking the action is this condition's source"); schema, shared authored/compiled types, compiler and an effect node-map toggle. SRD Fear and every SRD creature action that frightens author `recordsSource: true`; Phantasmal Killer and Weird stay unsourced (their source is an illusion).
2. **Runtime source:** the compiler carries `recordsSource` on `conditionContribution`; the room records `sourceActorId` (the acting actor) on that effect's `CONDITION_OWNERSHIP` contribution.
3. **Mechanics (D94 extension):** `D20_ROLL_MODE` gains optional `requiresHolderSeesSource` (not allowed on SAVES, which fold at load); new mechanic `APPROACH_SOURCE_FORBIDDEN`. SRD Frightened authors both. A held condition's sources are the recorded `sourceActorId`s of the effects that own it; a holding with no recorded source (baseline, manual, unsourced effect) makes it unsourced, which keeps the gated mechanics always on (AC: "no recorded source keeps its present always-on disadvantage").
4. **Sight gate:** a pure filter drops a sight-gated mechanic when its condition has recorded sources and the holder sees none of them; the room resolves holder→source true sight (Scene placement when the action has one, neutral environment otherwise) for single-target actions before preparation, so attack and check contributors read the filtered mechanics unchanged. A source with no token beside the holder's on the Scene is out of sight.
5. **Movement warning:** a voluntary move whose end is closer to a recorded source of an `APPROACH_SOURCE_FORBIDDEN` condition than its start raises warning `CONDITION_SOURCE_APPROACH`; `MOVE_SCENE_TOKEN` gains `acknowledgedWarnings`; unacknowledged is a `RULE_WARNINGS` rejection; acknowledged commits; GM undo reverts the move as today. The move receipt does not record the override (no history badge yet; proposed as a follow-up below).

## Checklist (red first)

- [x] Red: rules-runtime unit (sources from effects; sight filter; approach warning), compiler unit (`recordsSource` → contribution → `CONDITION_OWNERSHIP.sourceActorId`), authoring parity (Fear and a homebrew condition keep `recordsSource`), room journey (Fear: attack disadvantage only in sight, move-closer warning + Do it anyway, GM undo), web unit (move warning prompt).
- [x] Schema + shared + compiler + node map + SRD authoring (Fear + 29 Creature frighten outcomes; Phantasmal Killer and Weird unsourced). Manifest via CI artifact.
- [x] Runtime gate + room wiring: `prepareEncounterActionMechanics` filters both sides' mechanics through the injected `loadSourcesSeen` (Worker `readNativeLiveSourcesSeen`), wired for RESOLVE_ACTION attacks and Disarm.
- [x] Movement warning (schema, room `prepareNativeLiveMovement` initial branch, web `CampaignVttStage` "Do it anyway"). Forced moves never warn; teleports do (a willing move).
- [x] Docs: rules-runtime.md condition mechanics; D94 limits note; ADR 0034 movement line; `D134`; Deferred edge cases.
- [x] T1 red CI run; T1 opus review, triaged (see Log). Green runs are shared with T1a below.
- [x] T1a red (`c5e34a53d`) on `ci/spells-29-t1a-red`: Worker Fear journey (in-sight no save, out-of-sight save ends it), compiler (Fear and a homebrew gated plan on the optional d20 node; Hold Person ungated), schema (gate accepted; refused without a turn-end repeat or with influence), shared compiler (gate preserved), authoring parity (Fear's gate; a homebrew `WHEN_MET` `DETECT` gate).
- [x] T1a gate (`68d01628f`): schema, shared types and node map, compiler, binding, interpretation, turn-result schema, SRD Fear authoring.
- [x] Merged `ci/merge-batch-aq` (includes SPELLS-19.T3).
- [ ] Generated files via the CI artifact; green Tests + Live backend; opus review, triage.

## Log

- 2026-10-16: merged `3ce5883f1` (fast-forward); read AGENTS.md, ADR 0034, ADR 0038, D94, D100, D116, D131, slice-spells-19.md and the SRD Frightened (line 17053) and Fear (line 7026) text.
- 2026-10-16: red tests written (rules-runtime unit, compiler, authoring parity, room journey, web move warning). The worktree has no `node_modules`, so the red run is CI only (`ci/spells-29-t1-red`).
- 2026-10-16: red Tests run [38924777168](https://github.com/MPiland/artificer-toolkit/actions/runs/38924777168) failed as expected:
  - Packages: `encounterConditionMechanics.test.ts` "a condition that follows its source (SPELLS-29)", all five tests (sourced only when every holding records it; move closer warns, equal or farther doesn't; no approach mechanic never warns; disadvantage only while a source is in sight; unsourced keeps disadvantage).
  - Packages: `encounterAreaActionCompilation.test.ts` "plans the Frightened of SRD Fear as recording its caster; Phantasmal Killer records none". **Correction:** this one failed for the wrong reason. The harness compiled Fear without its Concentration, and the test-phase compiler refused it ("D&D test action paths must be unique direct outcomes") before the `recordsSource` assertion ran. The test now runs on the real spell-cast compile path (see attempt 5).
  - Web: `CampaignVttStage.moveWarning.test.tsx`, both tests ("sends nothing more when the mover keeps to the rule"; "shows the warning on a refused move and resends it acknowledged on Do it anyway").
  - Both typecheck jobs: the missing exports, plus the unknown warning code `CONDITION_SOURCE_APPROACH` in `nativeRoomFearSource.test.ts` and the web test.
  - The Worker room journey did not reach execution: the Packages and Worker job stopped at the failing rules-runtime step.
  - The red Live backend run, 38924777274, succeeded.
- 2026-10-16: green attempt 1 (`751692f2b`, after merging `ci/merge-batch-ak`) failed in Build packages. The SRD Frightened spread onto a widened `ConditionMechanicRule`, and the journey read `rollMode` on an un-narrowed roll request. Fixed in `3cbe4f781`.
- 2026-10-16: green attempt 2 (`3cbe4f781`) failed in the rules-runtime build: `encounterConditionSources` read `stateContributions` from version-one effect definitions. Fixed in `b49c24bf6`.
- 2026-10-16: green attempt 3 (`b49c24bf6`) built, then failed two checks:
  - Typecheck: the `acknowledgedWarnings` default made the field required on every output-typed `MOVE_SCENE_TOKEN` test fixture. It is now `z.optional`, like `carefully`, and absent means none.
  - Generated Convex validators lacked `APPROACH_SOURCE_FORBIDDEN`. That drift is fixed via the Live backend `generated-files` artifact.
- 2026-10-16: independent opus review, triaged:
  - **Fix now, B1** (source-data build): done in `3cbe4f781`.
  - **Fix now, B2** (a source other than the action's actor or target was always unseen, so the room's in-sight test could not pass): `loadSourcesSeen` now passes source actor ids. The Worker loads any Encounter actor as a source; one no longer in the Encounter is unseen. Disarm shares one target loader.
  - **Fix now, B3** (`acknowledgedWarnings` required on output-typed commands): now optional.
  - **Fix now, S1** (docs claimed the override is recorded): the handoff, the decision and rules-runtime.md now say the move receipt records no override. The badge is a proposed follow-up.
  - **Fix now, S4** (forced and teleport moves unproved): room test "warns on a teleport that ends closer to the caster, never on a forced move".
  - **Defer, S2** (one Scene read per source) and **S3** (a source bound on another Scene fails as stale): both in Deferred edge cases.
  - **Stands, S4** (check gating, room proof):
    - The sight filter runs once in `prepareEncounterActionMechanics`, before both attack and check contributors.
    - The attack journey proves the room wiring.
    - The unit test "disadvantage on attacks and checks only while it sees a source" proves checks against real code.
  - **Stands, MANUAL mode** (no move warning, since nothing tracks rules there; ADR 0034).
  - **Stands, raw `scene.grid` in the move gate** (the movement planner beside it uses the same grid).
  - **Stands, a second refusal replacing the open dialog** (the latest refusal is the current one).
- 2026-10-16: green attempt 4 (`0c56ffa47`, review fixes):
  - Live backend [38928338274](https://github.com/MPiland/artificer-toolkit/actions/runs/38928338274) reported generated-file drift only; its artifact is committed in `9742efe1e`.
  - Tests [38928338187](https://github.com/MPiland/artificer-toolkit/actions/runs/38928338187) failed both typechecks on that same drift.
  - It also failed one shared test, `effect-compiler.test.ts` "compiles exact roll-table condition paths through the effect result wrapper". The compiler states `recordsSource: false` on every compiled condition outcome, so the expected compiled shape gains the field.
- 2026-10-16: merged `ci/merge-batch-al` (`5e9dc541d`). The only conflict was the decisions log, where D133 and this slice's pending entry are both kept. The batch's Counterspell reaction preparation passes no `loadSourcesSeen`, so reactions keep the always-on modes, as deferred.
- 2026-10-16: green attempt 5 (`377625d81`), Tests [38929512127](https://github.com/MPiland/artificer-toolkit/actions/runs/38929512127), failed only the Fear compile test, with the same harness error as the red run. In `ba1a43619` the test moved to `characterSpellCastActions.test.ts` "plans the Frightened of SRD Fear as recording its caster; Hold Person records none (SPELLS-29)". It runs on the compile path the room uses (`compileCharacterActionEntryPoints` over discovered spell-cast candidates).
  - Hold Person replaces Phantasmal Killer as the unsourced case. Hold Person is already proved on this path, through a different condition plan (repeating save) from Fear's timed plan.
  - Phantasmal Killer has no proved cast compile path. Its unsourced Frightened is an authored-data choice, not compiler logic.
- 2026-10-16: green attempt 6 (`ba1a43619`): Live [38932320629](https://github.com/MPiland/artificer-toolkit/actions/runs/38932320629) green; Tests [38932320622](https://github.com/MPiland/artificer-toolkit/actions/runs/38932320622) failed the moved test: `compiledCast(FEAR)` is null.
  - **Finding (blocks the AC's "proved for Fear"):** SRD Fear compiles as MANUAL on the Character cast path. Its shape is a save trigger, then an `ON_SAVE_FAIL` Frightened with a one-minute duration under Concentration, with no repeat save.
  - `compileExecutionPlan` routes a save to the TEST/OUTCOME template, and that template refuses an entry with a duration unless a recurring-save plan owns it. In `compileCharacterActionEntryPoints`, only grant and repeated-save plans join two-phase execution.
  - SPELLS-19.T2 proved the area Concentration with a "Fright Sphere" fixture that has a repeating save, not real Fear. The Gorgon's lone `ON_SAVE_FAIL` Restrained is the same unsupported shape (slice-spells-19.md).
  - The Worker room journey, which casts real SRD Fear, has not run yet: every Packages failure stopped the job before the Worker step. It will fail the same way.
  - Escalated to the orchestrator: closing the gap means a new compiler shape, a timed-condition plan joining a save's TEST/OUTCOME execution, single-target and area.
- 2026-10-16: ruling A, task SPELLS-29.T1a (see Scope T1a). Options B (a separate slice) and C (narrowing the AC) were rejected. T1a red tests written in `characterSpellCastActions.test.ts`; pushed to `ci/spells-29-t1a-red`.
- 2026-10-16: first T1a approach (timed save condition joining TEST/OUTCOME) in `79855ebd9`; merged `ci/merge-batch-an` (`1e94a69a9`). Its red runs ([38936167659](https://github.com/MPiland/artificer-toolkit/actions/runs/38936167659), Live 38936167769) belong to the withdrawn approach.
- 2026-10-16: ruling A replaced T1a with the repeat attempt gate (see Scope T1a). Reverted `79855ebd9` in `d42974a57`; new red tests in `c5e34a53d`, pushed to `ci/spells-29-t1a-red`; gate implemented in `68d01628f`; merged `ci/merge-batch-aq` (SPELLS-19.T3) cleanly and pushed to `ci/spells-29-t1`.
- Red Live backend [38939462297](https://github.com/MPiland/artificer-toolkit/actions/runs/38939462297) failed only on generated-file drift (the SRD manifest and `_generated`), which the green tip regenerates.
- T1a red Tests [38939462225](https://github.com/MPiland/artificer-toolkit/actions/runs/38939462225) (`c5e34a53d`) failed as expected:
  - Packages: `effect-schema-parsing.test.ts` "accepts a repeat attempt gate only on a target-turn-end repeated save with no roll influence (SPELLS-29.T1a)".
  - Typecheck: `characterSpellCastActions.test.ts` reads `repeatAttemptGate`, which `FollowUpSaveAuthored` lacked.
  - Convex 1/4: `seed.test.ts` manifest drift (incidental).
  - The job stopped at the schema step, so the Fear compile tests and the Worker journey did not reach execution.
- 2026-10-16: green attempt 7 (`cf8f1f9af`):
  - Live [38940757701](https://github.com/MPiland/artificer-toolkit/actions/runs/38940757701) reported manifest drift only; its artifact is committed in `81e68bc6c`.
  - Tests [38940757748](https://github.com/MPiland/artificer-toolkit/actions/runs/38940757748) failed Convex 1/4 on that drift.
  - It also failed every Fear room test that changes turns: "Encounter initiative actor source identity is stale". The fixture's caster lacked the Character snapshot identity a turn change checks. It now carries one, as in `nativeRoomGiantInsect.test.ts` (`fece0e8f6`). Before this, the journey's turn path had never run in CI.
- 2026-10-16: T1a opus review (no blockers), triaged:
  - **Fix now:**
    - The schema accepted a gate on an immediate save that repeats at turn end, but that plan carries no gate. The schema now requires `timing: TARGET_TURN_END`.
    - Runtime unit tests on the real executor: allowed and refused for `WHEN_UNMET` (Fear) and `WHEN_MET` (homebrew), and the last tick ending Fear when the gate refuses.
    - The stale compiled-type comment.
  - **Defer** (future-enhancements):
    - A refused attempt's graph still reports the save-test outputs; only `ATTEMPT_REFUSED` counts.
    - The immediate plan drops roll influence (pre-existing).
  - **Documented:** unresolvable perception counts as unmet (rules-runtime.md).
  - **Stands:**
    - The refused branch adds no new undo state. It writes only the timed tick's `UPDATE` lifecycle, the same write an ungated timed effect makes, and the room journey "makes no repeat save … while it sees the caster" proves that receipt. The AC's GM undo is proved on the cast and the move.
    - SEE matches the ruling's "can't see".
    - The generic stale-evidence error and the absent refusal reason in the UI are nits.
- 2026-10-16: merged `ci/merge-batch-as` (`0d51570d4`). The only conflict was the generated manifest, which CI regenerates.
- 2026-10-16: green attempt 8 (`55712a2fa`), Tests [38942823081](https://github.com/MPiland/artificer-toolkit/actions/runs/38942823081):
  - Convex 2/4 `encounterStoreConformance.test.ts` "voids a paused action": the frozen fact contracts gain `dnd5e.repeat-save-attempt-allowed`. Snapshot taken from the `updated-snapshots` artifact.
  - **Bug (pre-existing, found by the Fear journey):** the five Fear room tests that change turns failed with "Maintained turn effect source binding is stale". An area cast binds its Concentration state to the area's occurrence, while each creature's effect is bound to its own save occurrence (`encounterAreaTargetOccurrenceId`). So the turn check refused every turn of a creature holding an area Concentration effect. No earlier room test advanced a turn under one.
  - Fix: `requireTurnMaintainedStates` takes the turn actor and accepts the area-derived occurrence. Regression: `encounterTurnEffectState.test.ts` "requireTurnMaintainedStates", plus the Fear journey.
- 2026-10-16: green attempt 9 (`1241e5331`), Tests [38946749183](https://github.com/MPiland/artificer-toolkit/actions/runs/38946749183). Live was green, and both T1a out-of-sight save journeys passed. Three Fear journey tests failed on fixture gaps that only surfaced once turns could change:
  - Both Bite tests were refused with `TARGET_RANGE_UNCHECKED`: the Bite names no Scene context. They now acknowledge it, as `nativeRoomGiantInsect.test.ts` does.
  - The acknowledged move reused the Scene version from before the sideways move.
- 2026-10-16: merged `ci/merge-batch-av` (`27de27fde`); Tests [38951912964](https://github.com/MPiland/artificer-toolkit/actions/runs/38951912964) failed (red proof): the Fear out-of-sight save journey ("The active-effect resolution does not answer its pending request"). SPELLS-20's `isDamageDieRequest` read Fear's gated d20 (also an optional 1..N range) as a damage die. Fixed in `df9d20bb5`: a policy's own request node is never a damage die. The only other failure was a Web `window is not defined` teardown error in `AuthForms.test.tsx` (all tests passed), which did not recur.
- 2026-10-16: green on `df9d20bb5`: Tests [38956790464](https://github.com/MPiland/artificer-toolkit/actions/runs/38956790464), Live backend [38956790334](https://github.com/MPiland/artificer-toolkit/actions/runs/38956790334).
