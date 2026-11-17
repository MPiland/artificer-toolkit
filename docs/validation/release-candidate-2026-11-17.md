# Release candidate 2026-11-17: CI evidence record

**Status:** closes PERF-3.T2 and PERF-1.T1 evidence for the release candidate. Per D213 the pre-staging correctness gate is one full CI run on the RC tip. Per D210 latency is recorded here and never gated on CI; it gates on staging (PERF-2). No product code changed to produce this record.

## Source identity

- RC branch: `ci/rc-2026-11-17`, sha `a48a45c282007c24e3750f872f646e567fee0048` ("Ledger: close PLATFORM-28; start RELEASE-1.T2, RELEASE-7.T3, PERF-3.T2 (release candidate)").
- Product source on the RC tip is the phase branch product source. The phase tip has since gained only the docs-only merge m868 (`6ecc333a3`, RELEASE-1.T2).
- V15 needed proof-side fixes, so its green run is on branch `ci/rc-evidence`, whose product source equals the RC. The changes are runner script, lifecycle script and test-harness files only (see [V15](#v15-native-workload)). Runner-script commit: `430d839f4`. Green V15 tip: `fa4949c93ac37382b0484637da9d0d114a655473`.

## Runs on the RC sha

| Workflow            | Run                                                                                  | Result                                                                      |
| ------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Tests (`full=true`) | [44128880788](https://github.com/MPiland/artificer-toolkit/actions/runs/44128880788) | green, 795 package + 460 Convex + 311 Worker + 358 web + 26 Storybook files |
| Live backend        | [44128900702](https://github.com/MPiland/artificer-toolkit/actions/runs/44128900702) | green, deploy, seed and audit on the ephemeral backend 460 s                |
| Browser journeys    | [44128891317](https://github.com/MPiland/artificer-toolkit/actions/runs/44128891317) | green on attempt 2 (see flake below)                                        |

### Browser journeys shard 2 rerun and flake diagnosis

Attempt 1 failed only "Journeys 2 of 8", proof `storybook-backend-browser`, after 560 s: "Storybook backend stories failed; see .../playwright.log". The CI log shows one "Auth rate limit on /sign-in/email: waiting 10s before retry 1." before the failure. Attempt 2 reran the failed job only and passed (1,303 s). The other seven shards passed on attempt 1.

Diagnosis: not confirmed. The `playwright.log` that names the failing story was not in the retained step log, so the cause is unproven. The auth rate-limit retry is the only anomaly in the log and is a candidate; the same message also appears in the green V15 run without failure. The pass on a failed-only rerun with no change matches a timing flake, not a regression. No product or proof change was made for it.

## Timing table (Tests run 44128880788, runner wall time)

Job wall time (all jobs ran in parallel):

| Job                                   | Wall    |
| ------------------------------------- | ------- |
| Build packages and select tests       | 117 s   |
| Typecheck Convex, Worker and packages | 286 s   |
| Typecheck web                         | 149 s   |
| Lint                                  | 96 s    |
| Convex suite 1/4                      | 818 s   |
| Convex suite 2/4                      | 1,009 s |
| Convex suite 3/4                      | 725 s   |
| Convex suite 4/4                      | 863 s   |
| Worker tests                          | 736 s   |
| Package tests (root)                  | 735 s   |
| Web tests                             | 428 s   |
| Storybook tests                       | 184 s   |
| Storybook e2e                         | 128 s   |

Vitest per-suite figures from the same run:

| Suite         | Files | Vitest Duration | Summed test time | Import time |
| ------------- | ----- | --------------- | ---------------- | ----------- |
| Root packages | 795   | 620.25 s        | 523.77 s         | 1234.60 s   |
| Convex 1/4    | 116   | 801.48 s        | 664.42 s         | 114.51 s    |
| Convex 2/4    | 116   | 737.61 s        | 587.16 s         | 127.68 s    |
| Convex 3/4    | 114   | 670.06 s        | 560.02 s         | 91.20 s     |
| Convex 4/4    | 114   | 938.83 s        | 759.80 s         | 152.29 s    |
| Worker        | 311   | 672.14 s        | 2520.32 s        | 64.57 s     |
| Web           | 358   | 374.28 s        | 285.79 s         | 225.15 s    |
| Storybook     | 26    | 100.06 s        | 73.74 s          | 8.95 s      |

One further 39-file suite in the log finished in 47.97 s. The Worker suite runs `--maxWorkers=1 --no-isolate` as configured, so its summed test time exceeds its wall time by the harness's accounting; wall time is the Duration column.

Browser journeys (run 44128891317, final attempt) shard wall time: 1,397 s (1), 1,303 s (2), 1,137 s (3), 1,079 s (4), 1,206 s (5), 1,107 s (6), 1,098 s (7), 1,208 s (8); select job 16 s. Compare the serial local Convex suite of 3,604 s recorded in [PLATFORM-13.T1](platform-13-t1-test-timings-2026-10-14.md): four shards now finish between 725 s and 1,009 s each.

### `import.test.ts` finding

Labelled "root run on the runner, default 5 s for that test": `packages/source-data/src/srd/import.test.ts` (7 tests) passed in 6,601 ms in the root run under 8-way parallel load, and every test in it passed at the default 5 s timeout. This is the file whose canonical-concentration test timed out at 5 s in the 2026-10-14 loaded run; the PLATFORM-13.T1 fix (bounded `preparedDefinitions()` path, no timeout change) holds on the runner. The 6.6 s is the file's total, not one test. The Convex file `apps/apis/convex/content/import.test.ts` (30 tests) took 7,566 ms in its shard; it is a different file.

### Peak memory and paging

Not instrumented in CI. The workflows do not record runner memory or paging, so no figure exists for any suite. PLATFORM-13.T1's rule that a run which swaps is a rejection cannot be checked from CI; every suite passed without a timeout or out-of-memory failure.

## V15 native workload

`v15-workload` is not in the CI proof list. It runs with `gh workflow run browser-journeys.yml --ref ci/<branch> -f proof=v15-workload`, through `scripts/runLocalConvexProof.ps1` and `apps/apis/tests/developmentDrafts.ts`. The run on the RC itself (44138469448) was record-only and failed for a runner reason, below. Eight runs failed on four causes; run 44152282986 passed.

Workload: 11 tokens on a 700 px ring, 8 rounds, 2 actions and 1 reaction per turn, 5 players and a GM, 848 timed commands.

### Failures and fixes (all proof-side drift)

| #   | Run(s)                                                                | Failure                                        | Cause                                                                                                                                                                                      | Fix                                                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 44138469448                                                           | proof did not run its browser path             | the CI runner never set `V15_BROWSER_PROOF` for `v15-workload`                                                                                                                             | `scripts/runLocalConvexProof.ps1` sets it in the driver environment and command; `scripts/validatePreStagingLocal.mjs` drops its now-redundant value (430d839f4)    |
| 2   | 44139984503, 44141270116                                              | reaction answer asserted the old occurrence id | D219: a chosen reaction is a child action and the answer returns the child's occurrence; the proof still expected the parent's                                                             | `developmentEncounterCutover.ts` asserts the child `COMPLETE` and waits for the offered decision to settle (fa17a0075)                                              |
| 3   | 44142724273 (+ diagnostic runs 44144700318, 44146643457, 44148571949) | `TARGET_UNAVAILABLE`                           | ATTACK-17.3: players target only creatures their map draws; the Scene's default `PER_PLAYER` fog hid every other token and the workload has no exploration                                 | the workload Scene sets `fogMode: 'OFF'` (f1bce5c2d). Diagnostics: the command-rejection cause now names step, actors and command (762c4b7e6, 62f5fa1f9, df204d850) |
| 4   | 44150387784                                                           | `MOVEMENT_BLOCKED`                             | the voluntary-movement passage rule: the mover's swept body may not cross a hostile footprint without a passage choice; for movers 6 to 10 the fixed `+100` reach cell crossed a neighbour | the reaction mover steps to the reactor's near cell toward its origin (fa4949c93)                                                                                   |

Evidence per cause: the failing command and actors in the run logs, the passage rule in `encounterMovementPassageBoundary.ts` and `encounterMovementPassageContacts.ts`, fog in `targetVisibility.ts` and `sceneReducer.ts`, and a geometry check of the ring layout. No product code and no public contract changed.

Diff summary on `ci/rc-evidence`: `scripts/runLocalConvexProof.ps1`, `scripts/validatePreStagingLocal.mjs`, `apps/apis/tests/developmentEncounterCutover.ts`, `apps/apis/tests/developmentHttpClient.ts`, and this record plus the runbook link.

### Green run: 44152282986 (tip fa4949c93), 617 s

All values in milliseconds, recorded and not gated (D210):

| Measure                           | Samples        | p50    | p95             | Max          | Limit             | Within             |
| --------------------------------- | -------------- | ------ | --------------- | ------------ | ----------------- | ------------------ |
| Authoritative command, all        | 848            | 282.0  | 576.3           | 1516.0       | 1000 (p95)        | yes                |
| RESOLVE_ACTION                    | 352            | 253.7  | 326.7           | 1516.0       | 1000 (p95)        | yes                |
| SCENE_MOVE                        | 160            | 226.0  | 576.3           | 717.2        | 1000 (p95)        | yes                |
| REACTION_RESPONSE                 | 160            | 391.4  | 693.9           | 1417.2       | 1000 (p95)        | yes                |
| ADVANCE_TURN                      | 176            | 297.3  | 507.8           | 641.6        | 1000 (p95)        | yes                |
| Reaction composite (two commands) | 160            | 1048.8 | 1227.0          | not recorded | none              | not a gated figure |
| Durable peer convergence, session | 688            | 8.2    | 21.1 (p99 26.6) | 31.6         | 250 p95 / 500 p99 | yes                |
| Command committed                 | 688            | 2.9    | 6.9 (p99 8.5)   | 14.2         | none              | not gated          |
| Room previews                     | 360, dropped 0 | 2.2    | 4.5 (p99 41.1)  | 41.3         | 150 p95           | yes                |

Combat window 163,135 ms (workload maximum 163,133 ms). The reaction composite adds two commands, so its p50 sits above 1000 ms by construction; the 1000 ms limit applies per authoritative command, and the composite is recorded only.

## PERF-1.T1 journey ruling

The `v15-workload` proof counts as PERF-1.T1's end-to-end journey, alongside `cutoverConcurrency.test.ts`. Latency is recorded, not gated (D210); staging is the gate (PERF-2). D213's full CI run is the final-source correctness run, and the three RC runs above are that run.

## Figures not found

- Peak memory and paging for every suite: not instrumented in CI.
- The `storybook-backend-browser` Playwright failure detail for the shard-2 attempt 1: not retained in the step log.
- A maximum for the reaction composite: not emitted by the measurement.
