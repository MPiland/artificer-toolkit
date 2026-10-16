# RELIABILITY-13.T1: lifecycle proof fixture cleanup no longer fails on a racing presentation

Slice workbook. Rules: [slice-workbook-rules.md](slice-workbook-rules.md). The stub was not on the phase branch when this slice started (8cfb36601), so this workbook was created from the rules.

## Brief

`encounters/developmentLifecycleProof.test.ts` failed intermittently with "Fixture Scene bounds or ownership mismatch." from `removeFixtureState` ([developmentScene.ts](../../apps/apis/convex/scenes/developmentScene.ts)) after the test body passed (CI run 38848532122, Convex shard 3/4, `ci/attack-17-t2` at 3c20a8a0d).

## Root cause

`removeFixtureState` read the Campaign's events with `.take(6)` and refused more than five. Every applied `scenes.presentations.setLive` writes one `SESSION_SCENE_PRESENTATION_SET` receipt, and the cleanup requires one receipt per presentation version (0..N). The proof applies five presentation changes deterministically (two in `developmentEncounterLifecycle.ts`, one in `developmentEncounterAutomation.ts`, one racing call in `developmentEncounterTransactions.ts`, one in `developmentEncounterCutover.ts`). `developmentEncounterTransactions.ts` presents the bound Scene a sixth time when the racing `setLive` landed after the bind and left a different Scene presented. That ordering is nondeterministic, so the proof leaves five or six receipts, and six tripped the hard-coded bound of five.

Not a product bug: the bound belongs to the fixture-cleanup mutation, a development-only internal mutation. Production `setLive` is unaffected.

## Fix

The events read now takes 17 and refuses more than 16 (one receipt per presentation change; sixteen is the same bound the file already uses for runs, entities and fog rows). Receipt validation, the version-completeness check and every other bound are unchanged, so a history beyond sixteen still fails without deleting anything.

## ACs

| AC | Proof |
| --- | --- |
| Cleanup removes a fixture whose presentation history holds six receipts, the proof's racing case | `developmentScene.test.ts` "removes a presentation history of 6 changes" |
| Cleanup removes a history at the bound (16) | "removes a presentation history of 16 changes" |
| A history beyond the bound is refused with nothing deleted | "rejects a presentation history beyond sixteen changes without partial deletion" |

## Red-first checklist

| Test | Red log | Green log |
| --- | --- | --- |
| `developmentScene.test.ts` (the three rows above) | `local-validation/reliability-13/red.log` (2 failed: 6 and 16 changes, "Fixture Scene bounds or ownership mismatch."; the 17-change row already passed at base because the base bound is stricter) | `local-validation/reliability-13/green.log` (20 passed) |

## Status log

- 2026-10-16: read `removeFixtureState` and its callers (`developmentLifecycleProof.test.ts`, which calls `encounters/developmentRuns:removeFixtureState` then this one after `closeRoom`). Counted setLive calls in the proof helpers; the sixth is conditional on the race, which matches an intermittent failure. The other bounds (definitions, live Scenes: two each in the proof) are not at risk.
- Red 2 failed / 18 passed, green 20 passed, light lane.
- Independent review (opus, read-only) confirmed the cause: the proof leaves five or six receipts, no other count feeding the throw is nondeterministic, and no assertion was weakened. Triage:
  - Fix now: the production comment explained the bound by the proof's race instead of the invariant (one receipt per change, bounded like the other fixture rows); reworded.
  - Stands: the new history tests repeat the existing exact-history test's body and the alternating-history builder (test-only, clearer inline); the new `!` on `liveSceneId` follows the file's existing pattern; the 17-change row is a bound pin, not a regression proof.
  - Stands: the bound counts every Campaign event type, not only receipts. The proof writes no other type (cleanup of the Campaign refuses any other), so it cannot cause this failure.
- Cannot reproduce the race itself in convex-test, so the proof seeds the receipt history directly through `seedPresentation`, the same rows the race leaves.

- CI on `99cf4b438` failed in "Build packages": `rules-runtime` `src/testing/plannedTimedCondition.ts(46,5)` TS2741, `resources` missing from `SpellPolicyOutput`. Cause is a base interaction, not this slice: SPELLS-8.T8 added `resources` to `SpellPolicyOutput` and the SPELLS-5.T9 helper (merged separately) builds that output without it. `origin/codex/phase-08-2-convex-cutover` (8cfb36601) does not yet carry T8's `SpellPolicyOutput` change, so the same break appears wherever T8 and the helper meet. Fixed in the helper (`resources: []` and the `satisfies` Pick), so this branch's build can pass.

## Proposed ledger edits (main session applies)

- RELIABILITY-13.T1: status DONE, `note`: "Fixture cleanup bound raised from 5 to 16 presentation receipts; the lifecycle proof presents five or six times depending on the racing setLive."
- ATTACK-17.T2 adds bound counts to the same error message; the two edits touch neighboring lines in `developmentScene.ts` and may conflict textually.
