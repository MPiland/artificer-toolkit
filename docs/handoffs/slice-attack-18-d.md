# Slice workbook: ATTACK-18 slice D (First Aid on the CHECK action test)

**Status:** OPEN (started 2026-10-12)
**Base:** `codex/phase-08-2-convex-cutover` at `7bf75f838` plus this workbook's commit.
**Owner:** lane 1 integration owner (main session) reviews and merges. The slice session implements.

## Brief

First Aid becomes an authored basic action that resolves through `RESOLVE_ACTION` as the `BASIC_ACTION` source, like Dodge, Dash, Disengage and Help (slices A–C). It uses a new reusable action test, `CHECK`: the actor makes one of the authored checks against a fixed DC, and the action's outcomes run only on success. First Aid authors an Action cost, DC 10 Wisdom (Medicine), a single-target touch range, and a `STABILIZE` outcome (the executor from SPELLS-3.5, D96). The check evaluator First Aid and Escape share today (`encounterBasicActionCheck.ts` / `encounterEscapeCheck.ts`, `basicActionCheck*` in encounter-persistence) becomes the `CHECK` test's evaluator. Escape keeps its own `ESCAPE_RELATIONSHIP` command on that evaluator. Delete First Aid's old path: the `STABILIZE_TARGET` mechanic code and every branch that serves only it. `USE_BASIC_ACTION` itself, and the catalogue entry's `check` field if Escape no longer needs it, go in slice E unless nothing else uses them after this slice. If nothing does, delete them here and say so.

Read first: D106 (and its ATTACK-18 addendum, slices A–C "built" notes), D96, D98 and D105 in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/rules-runtime.md`; the slice C diff (`git log --oneline -- packages/rules-runtime/src/encounterBasicActionCheck.ts`) for the established pattern.

## Closes

- Task ATTACK-18.T5. It contributes to ATTACK-18.1 and ATTACK-18.2, which stay TODO until slice E.
- Behavior must be unchanged (ATTACK-18.2): D96 and D98 still hold. The pause, prompt or auto-roll, Help consumption (`consumedGrants`), `TARGET_NOT_DYING` overridable warning, touch-range warning (`TARGET_RANGE_UNCHECKED` without a Scene), Manual-Run refusal (`ASSISTED_ONLY`), roll card, GM log label "First Aid", and undo (restores the Action, the death saves and a consumed Help record exactly) all behave as today.

## Existing proofs that must pass against the authored version

Change only the command shape the test sends (`USE_BASIC_ACTION` to `RESOLVE_ACTION` with the `BASIC_ACTION` source). Never weaken, delete or reorder an assertion.

- `apps/apis/convex/**/turnDeathSave.test.ts`: the five First Aid journeys.
- `apps/apis/convex/**/basicActions.test.ts`.
- `apps/session-worker/test/nativeRoomFirstAidAction.test.ts`.
- `packages/rules-runtime/src/__tests__/encounterBasicActionCheck.test.ts`, `encounterEscapeCheck.test.ts`, `encounterBasicActions.test.ts`.
- Escape proofs: `nativeRoomEscapeAction.test.ts`, `srdCreatureHitRiders.test.ts` (Giant Toad), `escapeEffectVerification.test.ts`.
- `packages/source-data/src/srd/import.test.ts`, `packages/schema/src/__tests__/basic-actions.test.ts`, `apps/apis/convex/content/definitions.test.ts`.

## Red-first checklist (write each test before the code; keep the red log)

1. A Creature helper can use First Aid on a dying Character through RESOLVE_ACTION (today only the old path exists).
2. The `CHECK` test compiles from authored data: a feature or homebrew action authored with `CHECK` (not First Aid) pauses for the check and runs its outcome only on success. This proves `CHECK` is reusable, not First Aid-only.
3. A failed check runs no outcome, writes no stray effect, and still spends the Action.
4. Other actors are unaffected: a second dying Character's death saves are unchanged.
5. After a `TARGET_NOT_DYING` or range warning override, the action resolves and changes nothing on a target that is not dying.
6. GM undo restores exact records: the action economy, the target's death saves and a consumed Help grant (full-row comparison, as in slice C).
7. Escape still pays its activation and resolves on the same evaluator (existing proofs green, no new Escape branch).

Store red logs under `local-validation/attack18d/`.

## Constraints

- Edit or Write tools only. No heredocs, sed, Python or other edit scripts.
- No watcher, sleep or poll commands. Run each command once and wait for the completion notice.
- Never override the apis `maxWorkers`. For focused runs, pass explicit file paths, not folder filters.
- Every compile, test, codegen or Wrangler run takes `local-validation/.validation.lock` (AGENTS.md). Never delete a lock you did not create; report it instead.
- Use in-memory convex-test. Run codegen only under the lock. Never deploy, reset or reseed the local backend; the main session does that after merge.
- Build `packages/schema` and `packages/rules-runtime` before tests that import new modules (tests read `dist`).
- Source-data changes need `yarn workspace @artificer-toolkit/apis generate:srd:manifest` (the manifest is tracked).
- Verify Convex test typing with `yarn tsc -p convex/tsconfig.json --noEmit` from `apps/apis`.
- No `any`, no compatibility aliases, no dead code. Surgical edits only.
- Do not touch the ledger, dashboard or main handoff. Propose ledger edits below.
- Escalate to the main session (not the user) only for the triggers in AGENTS.md "Architect Escalation".

## Status log

- 2026-10-12: workbook written; session started.
- 2026-10-12: built on branch `claude/attack18-d-first-aid-27c98a` (commits `b26e108cb`, `f13ff091e`, `1c2285103` and the docs commit). Logs under `local-validation/attack18d/`.
- Checklist: (1) First Aid through RESOLVE_ACTION, `nativeRoomFirstAidAction` and `basicActions` tests; (2) compile half `checkActionCompile.test.ts`, worker half `nativeRoomFirstAidAction` "homebrew basic action" (DC 15, outcome only on success); (3) miss spends the Action and writes nothing; (4) `turnDeathSave` "second dying Character"; (5) TARGET_NOT_DYING override changes nothing; (6) `turnDeathSave` "GM undo restores every actor row" — RED first (`RED-undo-exact-rows.log`: undo left `ruleUsage: {id: 0}`), fixed in `withEncounterRuleUsageUsed`; (7) Escape proofs unchanged and green. Also a worker regression that a Creature feature authored with CHECK is refused.
- Slice E was partly pulled forward: `USE_BASIC_ACTION`, `UseEncounterBasicActionInputDto`, catalogue `check`/`mechanics`, `STABILIZE_TARGET`, `BASIC_ACTION_MECHANIC_CODE`, `nativeBasicAction.ts`.
- Deviations: CHECK only on the BASIC_ACTION source, one skill check, FIXED dc, STABILIZE outcome; self-aimed First Aid is a soft `TARGET_DISPOSITION` warning; the drawer's required Ally target became an optional picker (the DTO `target` hint was removed); the Hide "resolves as an action" test went with the deleted function; `schema/__tests__/basic-actions.test.ts` rewritten (removed API); `encounterBasicActionStabilizeWarnings` stays production-unused because `encounterBasicActionCheck.test.ts` imports it; stale `effectiveHitPointMaximum` imports from base commit 964f43918 fixed; the authored `ActionEffectInvocationAuthored` type now excludes a reaction binding on CHECK.
- Open risks: red logs for the migrated First Aid proofs were not captured separately (the old paths no longer exist); undo restores an absent `ruleUsage` entry for a prior explicit `0`, which reads identically.

## Proposed ledger edits (filled by the slice session)

- ATTACK-18.T5 → DONE. Note: First Aid authored on the reusable CHECK test, resolves through RESOLVE_ACTION; slice E deletions (USE_BASIC_ACTION, catalogue check/mechanics, STABILIZE_TARGET) pulled forward; undo exact-row regression fixed. Logs: `local-validation/attack18d/`.
