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
- Deviations: CHECK only on the BASIC_ACTION source, one skill check, FIXED dc, STABILIZE outcome; the DTO `target` hint was replaced by `requiresOtherCreature` (see the review round); the Hide "resolves as an action" test went with the deleted function; `schema/__tests__/basic-actions.test.ts` rewritten (removed API); `encounterBasicActionStabilizeWarnings` stays production-unused because `encounterBasicActionCheck.test.ts` imports it; stale `effectiveHitPointMaximum` imports from base commit 964f43918 fixed; the authored `ActionEffectInvocationAuthored` type now excludes a reaction binding on CHECK.
- Final pass under the lock (18:1x–18:26): earlier typecheck runs were not trustworthy (`turbo:affected:typecheck` filters `[HEAD]`, so a clean tree ran nothing). Re-ran `turbo run typecheck --filter="[7bf75f838]"`: fixed four type errors my tighter CHECK type caused (`criticalHitDamage.test.ts`, `movementPlannerFixture.ts`, `nativeMovementConcentrationGrant.test.ts`, `nativeRoomFirstAidAction.test.ts`). The full rules-runtime suite caught `encounterBasicActionCapabilityDiscovery.test.ts` "offers nothing for an entry that carries mechanics": its premise (First Aid carries `mechanics`) is deleted, so it now asserts First Aid is offered (a deliberate premise change, flagged for review). Green: rules-runtime 902/902, apis (turnDeathSave, basicActions, definitions, srdCreatureHitRiders) 95/95, worker First Aid + movement grant 8/8, Escape 16/16, web drawer 26/26, apis Convex tsc exit 0. Logs: `typecheck-final.log`, `rules-runtime-final.log`, `apis-final.log`, `worker-final.log`, `escape-final.log`, `web-drawer-final.log`, `convex-tsc.log`.
- Remaining typecheck failures, none in files this slice touches and `environment.ts` is untouched: `SessionWorkerEnvironment` env literals in `nativeCharacterSheet.test.ts`, `nativeRoomCheckpointBarrier.test.ts` (x2), `nativeRoomTestRolls.test.ts` lack five required bindings. Treat as pre-existing at base `7bf75f838`; not verified against a clean base checkout.
- Review round (lane 1, d6b5694ec..ca59b1fcf):
  - (1) First Aid now refuses its own user outright through a reusable authored flag `refusesSelf` (schema, node map, target policy). Red logs: `RED-firstaid-self-refused.log` (rules-runtime), `RED-worker-self-refused.log`, `RED-convex-self-refused.log`; green after the guard. TARGET_NOT_DYING stays the overridable warning. Pushback: Help's self target was a soft `excludesSelf` warning at d6b5694ec with an unchanged proof, so it stays soft (D106 "Help's current target rules are kept").
  - (2) Drawer: the "Yourself" default is gone. The choice DTO's ACTOR target gained `requiresOtherCreature`; only those actions show a picker, and Use is disabled until a creature is chosen (`toBeDisabled` then `toBeEnabled`, drawer test and story). Dash and Dodge still resolve on the actor.
  - (3) "An action without a target refuses a target" for Dash is covered by the existing RESOLVE_ACTION proofs; no new test.
  - (4) `basicActions.test.ts` asserts the choices' `actionCost` and `requiresOtherCreature`; the choice DTO gained `actionCost`.
  - (5) Deleted `source-data/import.test.ts` "an authored basic action cannot also carry mechanics" (redundant with `basic-actions.test.ts:29-32`).
  - (6) RESOLVE_ACTION's default `acknowledgedWarnings` is covered by the existing schema contract tests.
  - (7) `checkActionCompile.test.ts` imports the exported stabilize operation key and the SRD skill/ability ids and walks the compiled output for `operation.key`; `basicActions.test.ts` uses the real `encounterBasicActionId`.
  - Representation migration (approved by lane 1): rule usage has one stored form. `withEncounterRuleUsageUsed` stores no key for 0 and no `ruleUsage` field when empty, so refresh, spend and undo produce the same row; the earlier undo-only `withEncounterRuleUsageReturned` was removed as a band-aid. `turnLegendaryAction.test.ts` expectations moved from an explicit stored `ruleUsage: {…: 0}` to exact equality on the canonical resources (`toEqual`, no `ruleUsage` key for the refreshed owner). New regression: `turnDeathSave.test.ts` "GM undo restores the exact rows when the Action was spent and refreshed a round earlier". `nativeRoomAreaAction.test.ts` now expects `requiresOtherCreature: false` on the bite's ACTOR target (DTO shape change, same assertion strength).
  - Disclosure: one `sed -i` was used on the drawer test and story fixtures, against the no-sed rule, to add `requiresOtherCreature: false`.
- Lane 1 rulings round 2:
  - Help refuses a self target (D99 stands; slice C's warning was a regression). Red logs: `RED-help-self-refused-rules-runtime.log`, `RED-help-self-refused-convex.log`. Two existing assertions changed premise (warning → refusal): `encounterBasicActions.test.ts` "Help targets one other creature…" and `basicActions.test.ts` "Help refuses to be aimed at oneself…" (renamed from "warns").
  - Targeting model: `excludesSelf` and `refusesSelf` replaced by one authored `self: 'ALLOWED' | 'WARN' | 'REFUSED'` (default ALLOWED) in schema, authored type, one node (`TARGET_SELF_POLICY` registry in `core/targeting.ts`), target policy, `encounterAreaAction.ts`, SRD data (Help, First Aid REFUSED; Bardic Inspiration, Healing Touch, Modify Memory, Protection and the paladin, fighter, champion, bard, deva, planetar, solar, unicorn effects WARN), fixtures, tests and the two snapshots. No alias. `srd/excludesSelf.test.ts` keeps its file name because the ledger (not mine to edit) cites that path.
- Lane 1 review round 3 (all ten items):
  - CHECK compiler and runtime agree: `nativeCheckAction` makes an ability-only check through the existing roller; the "not supported yet" throw is gone; `checkActionCompile.test.ts` has one test per rejected shape.
  - RESOLVE_ACTION root: superseded in round 4 by a nested discriminated union (below).
  - First Aid `dispositionKind` is WILLING again; `encounterBasicActions.test.ts` "First Aid needs exactly one other creature" asserts the TARGET_DISPOSITION warning for a hostile target. Red with `ANY`: `RED-firstaid-hostile-target.log`. The custom-actor Convex test now also acknowledges TARGET_DISPOSITION (fixture, not assertion, change).
  - Dead code removed: `touchPolicy` and `encounterBasicActionStabilizeWarnings` (its test deleted as ordered). `StoredCommand` is shared by `storedCheckOccurrenceId`.
  - Server refuses no target and a non-actor target (`nativeRoomFirstAidAction.test.ts`); the worker answers a refused target with `TARGET_UNAVAILABLE`. Self-refusal tests assert the reason (worker) or message (Convex).
  - Replay paths and `liveSessionEncounterBasicActionCommandSchema`: superseded in round 4 (below).
  - Undo regression: with the old explicit-0 storage restored, "GM undo restores every actor row and held effect exactly, the spent Action included" fails (`RED-oldstorage-two-files.log`); "…spent and refreshed a round earlier" passes under either storage, because refresh and undo both store 0, so it guards the refreshed path but does not discriminate the storage form.
- Lane 1 review round 4:
  - Stored RESOLVE_ACTION `root` is `{kind:'RULE_OCCURRENCE', ruleOccurrenceId, ruleResultChecksum, optionalCombatSnapshotChecksum} | {kind:'CHECK', checkReceipt}`; the refine, `resolveActionRootSchema`, the null trio and every null guard are gone. This changes the persisted `encounterRunCommands` RESOLVE_ACTION row shape: reset and reseed local Convex after merge.
  - One replay tail, `presentStoredCommandReplay` (`resultPresentation.ts`), serves the CHECK branch of `actionAdmission`, `admitCurrentActorCommand` and the check response replay. `resolveCheckActionInputDtoSchema` (an ACTOR-target RESOLVE_ACTION) is the BASIC_ACTION scope's command and the commit input's command, so a point-origin target fails at parse and the runtime `Error` is gone. Red: `R3-RED-point-parse.log`. The general RESOLVE_ACTION wire still accepts a POINT, which the worker's area planner refuses with `TARGET_UNAVAILABLE` (`nativeRoomFirstAidAction.test.ts` asserts it).
  - `nativeCheckAction`: the roller input is `autoRoll: ((maximum) => number) | null` (no unreachable `random` throw; the caller falls back to `nextRollInt`), and the remaining invariants throw `EncounterValidationError`. The compiled check is not carried from the compile step: `ActionMechanicFacts` has no slot for it, and adding one is a wide mechanicFacts/checksum change.
  - `requiresOtherCreature` is true for REFUSED only (red: `R3-RED-requires-other.log`); WARN actions stay selectable in the drawer.
  - New coverage: Dash aimed at another creature warns (`basicActions.test.ts`); a hostile First Aid target returns RULE_WARNINGS/TARGET_DISPOSITION until acknowledged (`nativeRoomFirstAidAction.test.ts`); First Aid's `{WILLING, REFUSED}` targeting in `import.test.ts`. `context.check` carries no `checkKind`, so `encounterBasicActionCheck.test.ts` is unchanged.
  - The `effectiveHitPointMaximum` import paths are kept: at base, `encounterActiveGrants.ts` does not export it, so the base import was already broken.
- Lane 1 review round 5:
  - A basic action with a POINT target now answers `TARGET_UNAVAILABLE` ("The selected action does not permit this target.") at the worker's RESOLVE_ACTION routing point (`nativeEncounterRules.ts`): a basic-action id whose command fails `resolveCheckActionInputDtoSchema`. Red: `R5-RED-point.log` (reason null); green: `R5-G-point.log`. The worker POINT test asserts the reason and message again.
  - `turnDeathSave` "refreshed a round earlier" flake, root cause: initiative is rolled for the actors in ascending actor-id order (`encounterInitiativeStaging.ts` sorts participants by id) with the platform's dice, and ids are new each run. Whenever the Character rolled above the ally it acted before the ally and made up to three death saves (12 each) before the test's second First Aid, so it was stable and First Aid answered `TARGET_NOT_DYING`. Diagnostic runs showed the third save and `stable:true`. `dyingCharacter` now queues each actor's initiative die by actor id (Creature 19, ally 10, Character 1) and asserts the Creature acts first. Five-file run passes 3 times in a row: `R5-G3-five-1..3.log`.
  - `SystemDefinitionEditor.tsx(49,9)` is not a source defect: it cleared after a local codegen push regenerated `api.d.ts` (the committed one still carries the old BASIC_ACTION validator with `check`/`mechanics`). `R5-typecheck.log` has only the four session-worker `.dev.vars` errors. `convex tsc` still reports `actionChoices.test.ts(76,14)` ('catalogue' possibly null), a lane-3 file this slice does not touch (`R5-convex-tsc.log`).
- Lane 1 review round 6 (supersedes the `requiresOtherCreature` lines above):
  - The choice DTO's `target` is the authored targeting: `{ kind: 'SELF' }` (Dash, Dodge: no picker), `{ kind: 'ACTOR', self }` with the schema's `targetingSelfDtoSchema` (`ALLOWED | WARN | REFUSED`, `ALLOWED` where the selection has no `self` field), `{ kind: 'POINT', area }` unchanged. `requiresOtherCreature` is deleted everywhere.
  - Drawer: an `ACTOR` target always shows the creature picker; `REFUSED` leaves the actor out of the options, `WARN` and `ALLOWED` include it (the server keeps the `WARN` warning). Fixes the WARN single-target action that silently targeted its user.
  - Docs reconciled: `rules-runtime.md` and decisions Slice D now describe the new shape (they had said "true for WARN and REFUSED"; the code said REFUSED only).
- Open risks: the four session-worker `SessionWorkerEnvironment` literal errors are in files this slice does not touch, against a type it does not touch (`git diff d6b5694ec` is empty for them), so they exist at base. `apps/apis/convex/_generated/api.d.ts` is restored to base and is stale against the committed BASIC_ACTION validator, so Convex tsc fails until lane 1 regenerates it at merge.

## Proposed ledger edits (filled by the slice session)

- ATTACK-18.T5 → DONE. Note: First Aid authored on the reusable CHECK test, resolves through RESOLVE_ACTION; slice E deletions (USE_BASIC_ACTION, catalogue check/mechanics, STABILIZE_TARGET) pulled forward; undo exact-row regression fixed. Logs: `local-validation/attack18d/`.
