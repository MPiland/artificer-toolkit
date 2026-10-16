# Slice workbook: PLATFORM-13.T5 (Convex suite speed: the heavy journeys)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

The Convex suite is the longest CI job: each of 4 shards takes about 14 minutes with one file worker.

On 2026-10-15 a CI trial with 3 file workers per shard (run 38775641398) cut a shard to 7-8 minutes. The trial was rejected, because `campaigns/developmentCustody.test.ts` › "runs the public mixed Character custody driver and validates historical Vehicle removal before cleanup" timed out at its 30 s limit. That test takes 23 s even with one worker (run 38769788109). Per PLATFORM-13.T4, a setting that times out is rejected and no per-test timeout is raised.

This slice makes the heaviest files do less work, so that every test has a clear margin under its timeout and the 3-worker setting can be adopted.

Targets, from the serial baseline in [platform-13-t1-test-timings-2026-10-14.md](../validation/platform-13-t1-test-timings-2026-10-14.md):

- **Corpus-scale journeys:**
  - `content/equipmentLimits.test.ts`
  - `encounters/developmentLifecycleProof.test.ts`
  - `characters/commitReferencedContext.test.ts`
  - `campaigns/developmentCustody.test.ts`
  - `content/equipmentCharacter.test.ts`
  - `content/seed.test.ts`
  - `content/seedAudit.test.ts`
  - `characters/builderSnapshotParity.test.ts`
  - `content/catalogueReadBudget.test.ts`
- **`media/*`:** per-test fixture setup (`authoredAssets`, `library`, `avatar`, `characterPortrait`). Profile first.
- **Module import:** about 688 s across 380 files. Profile what each test file imports, and cut it only where a file pulls in modules it does not use.

Rules:

- **Profile before changing.** Record where each target spends its time: fixture setup, SRD preparation, repeated corpus work inside assertions, or the product path itself.
- **Proofs keep running real code.** Never replace a product call with a stub, a copy of product logic or a hand-built result. The real-code-proof rule in AGENTS.md and the user's Definition of Done apply.
- Allowed cuts:
  - shared fixtures built once per file instead of per test, where the tests do not mutate shared state;
  - computing an SRD preparation once instead of inside assertions;
  - asserting the same behavior on the smallest corpus that still exercises it, but only where the AC does not name full-corpus scale (the 500-visible-option capacity journey must stay full-scale);
  - removing work a test does that no assertion reads.
- If profiling shows the product itself does unnecessary work (for example a redundant corpus read), fix the product with a test that fails before the fix. Report it in the status log as a product change.
- Never weaken, delete or reorder an assertion. Never raise a per-test or global timeout. Never change `apps/apis/vitest.config.ts` `maxWorkers`.
- Other slice sessions may edit some of these test files (for example `developmentLifecycleProof.test.ts`). Merge the base before each CI push and keep your edits surgical.

Escalate (`SendMessage` to the main session) only if:

- a target can only be made faster by shrinking what an AC requires it to prove; or
- the product fix changes a public or persisted contract.

## Closes

- AC PLATFORM-13.7.
- AC PLATFORM-13.9 (task T7).

## File scope

- Test files and fixtures under `apps/apis/convex/**` and `apps/apis/tests/fixtures/**`, plus `apps/apis/tests/localAuth.ts` (T7).
- Product code only for a profiled, tested product inefficiency (see above).
- `docs/validation/`: a new timing record for this slice, `platform-13-t5-test-timings-2026-10-15.md`, with before and after per-file figures.

## Checklist

1. **Before:** per-file timings for the targets, serial, from a CI run of your branch head before changes. Use the JSON reporter as the T1 baseline did, and keep the JSON under `local-validation/platform-13-t5/`.
2. **Changes:** one commit per target file or fixture, each with that file's tests green and unchanged in what they assert.
3. **After:**
   - per-file timings for the same targets from a CI run, recorded in the timing record;
   - the slowest test in each target, with its share of its timeout.
   - Goal: no Convex test above 50% of its timeout serially.
4. **3-worker trial:** run the workflow by dispatch on your CI branch with 3 Convex workers:
   ```bash
   gh workflow run tests.yml --ref ci/platform-13-t5 -f convex_workers=3
   ```
   Read it with `gh run watch <id> --exit-status --interval 120`. Record the shard times. A timeout or failure there is a finding to fix in this slice, not to rerun.

## Also in this slice: PLATFORM-13.T7 (AC PLATFORM-13.9)

CI run 38778258014 (attempt 1, Convex 1/4) failed `accountJourneys.test.ts:97`. It got `INVALID_USERNAME` instead of `EMAIL_PASSWORD_SIGN_UP_DISABLED`. `signupInput()` builds `Journey_<12 random hex>`, and `validateUsername` (`packages/shared/src/domains/account/usernamePolicy.ts`) rejects any name containing a profanity substring, also after swapping digits for letters (`a55` reads as "ass"). `apps/apis/tests/localAuth.ts` builds `Auth_<12 hex>` the same way.

- Make every generated username valid under the real policy: import `validateUsername` and draw again until it accepts, or use a suffix that cannot spell words. Never copy the policy into the test.
- Red first: a test of the generator with a suffix the policy rejects (for example `a55b…`) shows the old shape fails.
- The policy itself is product question Q22 in [phase-08-2-open-questions.md](phase-08-2-open-questions.md). Do not change it here.

## Custody split: assertion map (main-session ruling (b), 2026-10-15)

Old test: `developmentCustody.test.ts` "mixed Character custody driver" (one test, 30 s). The 32-item bounded-cleanup proof made the party hold 37 items for every later read, so the Vehicle lifecycle proof paged it five times per read.

| Old assertion                                                                                                                                                            | Now proved by                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory proof prefix: carts, shares, transfers, currency systems, lossy-scale refusal, player/owner views (`verifyCampaignInventory`)                                  | Both new tests and `developmentInventoryProof.test.ts` (unchanged code)                                                                                                                                                                          |
| Bounded tail: 32 ITEM_ADDs, player unshare refusal, `evacuatedVehicles` empty, one `pendingVehicleCleanupIds`, durable cleanup, party = party + Vehicle A cargo, replays | `verifyCampaignInventory` with `boundedCleanup` true (default): the new durable-receipt test and `developmentInventoryProof.test.ts`. Unchanged assertions                                                                                       |
| Character custody, Vehicle lifecycle, shared Equipment retention, sheet reads                                                                                            | Mixed-driver test, now with `boundedCleanup: false` for the inventory step: Vehicle A is empty, so the unshare evacuates it at once (`evacuatedVehicles` is `[Vehicle A]`, no `pendingVehicleCleanupIds`) and the later reads page a small party |
| Lifecycle receipt actor tamper: remove refuses `lifecycle audit mismatch`, state unchanged, restore equals before                                                        | Mixed-driver test, unchanged                                                                                                                                                                                                                     |
| Evacuation payload tamper: remove refuses `durable Vehicle evacuation receipt mismatch`, state unchanged, restore equals before                                          | Durable-receipt test, unchanged message. The mixed-driver test tampers the immediate evacuation event instead and expects `Vehicle evacuation identity mismatch` (same helper `expectTamperedEvacuationRefused`)                                 |
| Removal resolves; items, events, vehicles, balances, inventories empty; only the first Character stays assigned                                                          | Both tests                                                                                                                                                                                                                                       |

Nothing is deleted or weakened. Reviewer findings (independent read-only review, 2026-10-15) and how they are recorded:

- The mixed driver no longer sees a durable source-loss receipt; that check lives only in the durable-receipt test (both tests keep a 30 s timeout). The Vehicle lifecycle proof's oversized background Vehicle is a manual removal (`VEHICLE_LIFECYCLE` event), not a source-loss evacuation, so it does not replace that check.
- The live `developmentDrafts.ts --campaign-custody` proof now runs the immediate tail. The bounded tail still runs in `--campaign-inventory` and `developmentInventoryProof.test.ts`, but that proof's fixture removal is `developmentInventory:removeFixtureState`, not `developmentCustody`. So the durable receipt check in `developmentCustody.ts` is covered only in convex-test. Follow-up if wanted: a live custody proof with a durable evacuation.
- The party in the mixed driver now fits one page until the lifecycle proof's background Vehicle returns, so the cursor-advance assertions in `verifyCharacterCustody` read are not exercised there. Multi-page party reads stay covered in `verifyCampaignInventory` (all three callers).
- No cohort holds both a durable source-loss evacuation and a durable lifecycle cleanup in one `remove` validation any more.

## Also in this workbook: PLATFORM-13.T10 (AC PLATFORM-13.12)

Branch `ci/platform-13-t10`. Base synced from `codex/phase-08-2-convex-cutover` before the push.

| Scope item                                                                              | Change                                                                                                                                                                                                                                                              | Proof                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validatePreStagingLocal.mjs` builds child environments through `convexCliEnvironment`  | `localChildEnvironment` and the Session Worker environment start from `convexCliEnvironment()`, so `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` never reach a child. The script is import-safe (main guard) and exports `localChildEnvironment`.                     | `scripts/validatePreStagingLocal.test.mjs`. Red: `red-env.log` (child still received `CONVEX_DEPLOYMENT`). Green: `green-scripts.log`.                                                   |
| `validatePreStagingLocal.mjs` passes the target through `convexCliArguments`            | `localConvexEnvironmentValue` and the Convex stages build `--url`/`--admin-key` with `convexCliArguments`. No behaviour change, so no red test.                                                                                                                     | Same argument shape as before; covered by the next full `validate:pre-staging:local` run (not run here).                                                                                 |
| Drift check uses `git status --porcelain`, untracked included                           | New `scripts/generatedDrift.mjs` (`generatedStatus`). The live-backend workflow step runs it. The `generated-parity` stage compares the porcelain status of the generated roots before and after codegen, besides the content checksums (a dirty tree stays valid). | `scripts/generatedDrift.test.mjs`. Red: `red.log` (naive `git diff --name-only`: modified file reported without its status, untracked file missed). Green: `green-scripts.log`.          |
| `developmentDrafts.ts`, `developmentCampaignMembershipLifecycle.ts` username draws      | Both call `generateValidUsername`. `usernameFor` keeps its deterministic suffix order from the user id.                                                                                                                                                             | No new test: `generatedUsername.test.ts` (T7) covers the generator. The live proofs that call these were not run here.                                                                   |
| Durable Vehicle receipt check restored to the live `--campaign-custody` proof           | `verifyCampaignCustody(cohort, anonymous, boundedCleanup = true)` passes the flag to `verifyCampaignInventory`; the live proof now takes the bounded (durable) path. The convex-test mixed driver passes `false` and keeps the immediate path.                      | Mixed-driver test (`false`) and durable test in `developmentCustody.test.ts`, green in `green-custody.log`. The live `--campaign-custody` run itself is for the main session.            |
| `verifyCharacterCustody` cursor-advance assertions get a caller with more than one page | `verifyCharacterCustody` is exported. The durable test asserts the party's first page of 8 is not done, then runs it.                                                                                                                                               | "validates a durable bounded Vehicle cleanup receipt and pages the Character custody driver before removing the cohort" in `green-custody.log` (isDone is false before the driver runs). |

Not in scope, noted: other harnesses with their own env guards (`developmentCli*.ts`, `developmentConvexEnvironment.ts`, the `.ps1` runners).

## Status log

- 2026-10-15: workbook written.
- 2026-10-15 T7 done (5ec76403f): `generateValidUsername` redraws until the imported `validateUsername` accepts; red run (naive shape) 3 failed, green 3 passed; used by `accountJourneys.test.ts` and `apps/apis/tests/localAuth.ts`.
- 2026-10-15 T5 profile: CI baseline run 38792840212. Media fixtures are already cheap on CI (authoredAssets 8.7 s for 17 tests, avatar 1.85 s); the 6 s avatar stall is local Windows only.
- 2026-10-15 T5 cuts: 3485f1d72 (builder snapshot parity reads each scope once; 65.4 s to 39.6 s serial) and 40310628f (custody step loop reuses the previous replay read; 4 of about 18 reads). Seed sharing in `equipmentCharacter`, `seed` action cost, the 500-option journey and the page size of 8 were ruled out; see the timing record.
- 2026-10-15 CI: 1-worker run 38814606154 green. 3-worker trial 38812568410 green (before cuts). 3-worker trial 38816855225 (after cuts) failed on one test: `developmentCustody` mixed driver timed out, 38.7 s against 30 s. Timing record: `docs/validation/platform-13-t5-test-timings-2026-10-15.md`.
- 2026-10-15 Escalated to the main session: the mixed driver cannot be made 2 times cheaper within the allowed cuts (see the timing record). Ruling (b): split the bounded-cleanup proof from the Vehicle lifecycle proof. Done; assertion map above.
- 2026-10-15 CI at 32c544804: 1-worker run 38821517298 green (mixed driver 8.6 s, 29% of 30 s; new bounded test 2.8 s). 3-worker trial 38823259068 green (wall about 9 m 43 s; mixed driver 14.5 s, bounded test 5.3 s). Timing record updated with final figures.
- 2026-10-15 T10 (698195f38): red `red.log` / `red-env.log` (3 failed), green `green-scripts.log` (5 passed) and `green-custody.log` (8 passed), all in the light lane under `local-validation/platform-13-t10/`. Independent review triage: fixed `CONVEX_DEPLOY_KEY` (refused in the local env file, deleted from `process.env` after load), added `betterAuth/_generated` to the drift roots and the workflow paths, fixed a stale `boundedCleanup` doc comment. Deferred: dirty generated file outside the checksum list (future-enhancements). Stands: the `CONVEX_DEPLOYMENT` branch in `assertLocalLifecycleTarget` is unreachable for `process.env` callers (it predates this slice), `numItems: 8` in the durable test repeats the driver's page size, and the Vehicle inventory branch of the cursor loop is still one page.

## Proposed ledger edits (filled by the slice session)

- AC PLATFORM-13.12: done. CI at bc75a872c: Tests run 38829445183 green (includes `scripts/**/*.test.mjs` and the Convex shards), live-backend dispatch 38829450540 green (new drift step with `betterAuth/_generated`). Evidence: `generatedDrift.test.mjs` and `validatePreStagingLocal.test.mjs` red then green; `developmentCustody.test.ts` green. Not run here, for the main session: live `developmentDrafts.ts --campaign-custody` (now takes the durable path, then Character custody on a multi-page party, then the Vehicle lifecycle), the full `yarn validate:pre-staging:local`, and a local `live-backend` run.

- AC PLATFORM-13.9: done (T7, 5ec76403f). Evidence: `generatedUsername.test.ts` red then green; CI 1-worker run 38814606154.
- AC PLATFORM-13.7: done. Evidence: serial CI run 38821517298 (no Convex test above 50% of its timeout once runner speed is normalised; the custody mixed driver is 29%), 3-worker trial 38823259068 green after the custody split (ruling (b), 3d6276ab0, 32c544804). Timing record: `docs/validation/platform-13-t5-test-timings-2026-10-15.md`. Follow-ups: other username redraw loops (`developmentDrafts.ts`, `developmentCampaignMembershipLifecycle.ts`); live `--campaign-custody` proof now covers the immediate evacuation tail only (durable receipt covered in convex-test).
