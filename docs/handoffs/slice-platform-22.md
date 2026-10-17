# Slice PLATFORM-22.T1: fail-fast typecheck and room errors with their cause

Workbook for PLATFORM-22.T1 (Phase 8.2). Rules: [slice-workbook-rules.md](slice-workbook-rules.md). The lane 1 orchestrator owns the ledger, the merge and PLATFORM-22.3 (single-slice merge rule, already done).

## Resume here

- Branch `claude/hungry-germain-d180cf`; CI branch `ci/platform-22`. Throwaway proof branches go under `ci/platform-22-*`; delete each after recording it.
- State:
  - T1 (22.1, 22.2) is green on f826a6429. The orchestrator merges it.
  - T3 (22.4) is green on 32d3ee876, and every proof is recorded.
  - The final push merges the phase branch and m63.
- Next: wait for Tests and Live to go green on the final tip, then report.

## ACs (ledger text is the orchestrator's)

- **22.1 Fail-fast typecheck.** A push with a type error in any workspace, test files included, fails its Tests run within about five minutes and stops the run's remaining jobs. `scripts/watchCi.ps1` reports the type error. A green run is no slower than today.
- **22.2 Room errors carry their cause in tests.** A room command that fails inside the Worker test harness reports the underlying error in the test failure. A production rejection stays the generic UNAVAILABLE with no internal detail sent to clients.

## Baseline timings (before, green Tests runs, 2026-10-16)

From `gh run view <id> --json jobs` (minutes; jobs after Build start together):

| Run | Wall | Build | Typecheck Convex/Worker/packages | Typecheck web | Packages and Worker | Web tests | Convex 1-4 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 38987673112 (merge-m60) | 17 | 1.7 | 3.5 | 1.8 | 12.6 | 8.8 | 8.0 / 14.0 / 15.1 / 14.8 |
| 38987280345 (spells-28-t4b) | 18 | 1.2 | 3.2 | 1.9 | 11.6 | 10.2 | 10.7 / 16.3 / 15.2 / 14.8 |
| 38986336204 (spells-20-t3) | 19 | 2.0 | 2.5 | 1.3 | 12.6 | 10.1 | 8.1 / 16.6 / 15.7 / 15.4 |
| 38984324373 (room-6-budget) | 19 | 2.0 | 2.2 | 1.7 | 10.7 | 10.1 | 13.0 / 17.1 / 14.8 / 11.5 |

Green wall clock today: 17-20 min. A type error failed the run only when the slowest Convex shard finished (~17-19 min), because watchCi waits for the run to complete. Typechecks themselves finish 3.5-5.5 min after the run starts.

## Design

- **22.1:** a typecheck gate in front of the test jobs would add ~2-4 min to every green run, so it is rejected. Instead a tiny `cancel-on-type-error` job needs both typecheck jobs and runs only when one failed; it cancels this run only (`gh run cancel ${{ github.run_id }}`), with `actions: write` on that job alone (no checkout). Waiting for both typecheck jobs means one run lists every type error. A green run skips the job, so it is no slower. `watchCi.ps1` treats a cancelled run with a failed job as a failure and prints the `error TS` lines from `--log-failed`; a superseded run (cancelled, no failed job) still exits 2.
- Test-file coverage: authoring, source-data and emails typechecks excluded their tests; each gains a `tsconfig.tests.json` (the rules-runtime pattern) in its `typecheck` script. Emails and design-system join the CI Packages typecheck.
- Live backend unchanged: it runs no typecheck, and its build step already fails fast on a compile error.
- **22.2:** test-only harness `apps/session-worker/test/roomFailureLog.ts` (a vitest setup file): tests and the room share one workerd isolate, so it records each test's `console.error` calls and appends them to a failing test's errors (`onTestFailed`). No client-visible field and no env binding. Production change: the room command paths that refused with UNAVAILABLE without logging (five bare `catch {}` blocks, the fog-stroke chain and the command chain's catch-all) now go through `#rejectRoomFailure`, which logs the cause (server log only) and sends the same code and message as before, so every room-internal UNAVAILABLE reaches the harness.

## Checklist

| Test | Red | Green |
| --- | --- | --- |
| `nativeLiveSessionRoom.test.ts` "logs a room failure behind a generic retry for the test harness and tells the member nothing" (cause in harness log; member sees only UNAVAILABLE + retry message; nothing written) | red: run 38990052509 (`ci/platform-22-red`, d9c9b9a30: harness and tests without the room change), the only Worker failure, `expected [] to deep equally contain … "harness-visible cause"` | green: Tests 38993716147 |
| `nativeLiveSessionRoom.test.ts` "sends an expected domain rejection and keeps an unexpected failure generic" (existing production-behaviour proof, plus the harness sees the logged cause) | n/a (already logged path) | green: Tests 38993716147 |
| 22.1 proof: `ci/platform-22-typefail` type error in a test file | run 38995237121 (7a7df49ea = f826a6429 + a type error in `apps/session-worker/test/roomFailureLog.ts`) cancelled 6.5 min after start; watchCi printed `error TS2322`. Branch deleted. | n/a |

## Status log

- 2026-10-16: baseline timings recorded; design chosen (cancel job, not a gate).
- 2026-10-16: run 38989496620 (de1a944a1) was cancelled 6.1 min after it started, on 84 latent type errors in authoring, source-data and emails test files that nothing had typechecked. They were fixed without changing any assertion; the only stale fixture field was `sourcePublicId` in the emails CAMPAIGN_ANNOUNCEMENT input. After merging the phase branch and `ci/merge-m61`, run 38990590658 (978b0bb7a) was cancelled 7.9 min after it started on m61's new test errors. Of that, 2.5 min was waiting for a runner between Build and the typecheck job, and the typecheck itself took 3.5 min. watchCi printed the `error TS` lines both times.
- 2026-10-16: 22.2 red captured on run 38990052509. The branch was then deleted.
- 2026-10-16: run 38991294793 (810ab59f9) was cancelled 4.7 min after it started. Time to failure is therefore 4.7-7.9 min and depends on runner queueing: about 5 min of compute, plus any wait for a runner.
- 2026-10-16: an independent review (opus) was triaged:
  - Fixed:
    - `#rejectRoomFailure` skips logging an expected `LiveSessionRouteError`;
    - the cancel job uses `!cancelled()`;
    - a single-use wrapper was inlined;
    - an import was reordered;
    - the AGENTS.md wording;
    - emails tests joined the CI package loop.
  - Accepted: the `Object.keys` cast idiom.
  - Reported: time to failure depends on runner queueing.
- 2026-10-16: authoring tests in the CI loop fail 12 tests. Base run 38992508732 (throwaway, from `ci/merge-m61` c8b723448) fails the same 12, so they predate this slice:
  - files: concealment, conditionSource, creatureForm, escapeDcOptions, offHandAttack, systemVocabularyOptions;
  - errors: `Untrusted node runtime table: passives` and non-empty `clearedPaths`.

  Authoring stays out of the loop; see follow-ups.
- 2026-10-16: harness proof run 38993725207 (throwaway `ci/platform-22-harness`, deliberate failure). The Worker failure output read "RoomFailureLog: The room logged 1 failure(s) during this test: … RoomStoreCorruptError: Room store is corrupt: harness-visible cause". The branch was deleted.
- 2026-10-16: T1 green on f826a6429:
  - Tests 38993716147: 18.9 min wall, within the 17-20 min baseline;
  - Live 38993716121: green.
- 2026-10-16: T3 (PLATFORM-22.4) added:
  - `scripts/redProof.mjs`, unit-tested in `scripts/redProof.test.mjs`;
  - the `red` job in `tests.yml`;
  - a Package tests step that runs the `scripts/*.test.mjs` files, which CI previously never ran;
  - updates to AGENTS.md and the workbook rules that retire separate red pushes.

  Known limit: when the slice has merged a `ci/merge-m*` batch that the phase branch does not yet have, that batch's changed tests also run against the phase branch and show as RED.
- 2026-10-17: first T3 run 38995072518 (570f25b09). The red job failed in its build: package builds compile `src/__tests__`, so the tip's tests broke tsc. Fix: build at base first, then check out the tip's test files.
- 2026-10-17: independent review (opus) of T3, triaged:
  - Fixed:
    - build before the tip's tests join;
    - rebuild a package whose `dist` carries a changed helper (rules-runtime `src/testing`);
    - skip unless a `.test.` file changed;
    - `runnerFor` mirrors the root include list;
    - `*.fixtures.*` count as test helpers;
    - RED rows list the failing test titles;
    - `persist-credentials: false`;
    - the scripts step names `scripts/*.test.mjs`, because Vitest filters match substrings;
    - apis and design-system tests joined the package loop, so the files the red job runs also run green.
  - Recorded in a `tests.yml` comment: the red job holds one of the 20 job slots, so with two other runs in flight it can queue a third run's jobs.
- 2026-10-17: T3 green on 32d3ee876:
  - Tests 38995460725: 19.2 min wall, within the 17-20 min baseline.
  - The red job took 3.3 min beside the build, so it is off the critical path.
  - Its summary (saved under `local-validation/platform-22/red-summary-38995460725.md`) lists 35 files. Among them, the 22.2 test in `nativeLiveSessionRoom.test.ts` is RED ("1 of 126 failing: logs a room failure …"), matching the separate red push 38990052509.
  - The other RED rows come from two sources:
    - the m62 batch's tests, because the phase branch did not yet have m62 (the known limit above);
    - the 12 authoring failures that predate this slice.
  - Worker files resolve correctly (host-absolute paths).
- 2026-10-17: ALREADY-PASSING proof run 38995465195 (throwaway `ci/platform-22-passing`: the phase branch, the T3 files and one test-only change):
  - `scripts/snapshotDrift.test.mjs` ALREADY-PASSING;
  - `scripts/redProof.test.mjs` RED-IMPORT ("Cannot find module './redProof.mjs'");
  - the job passed;
  - the branch was deleted.
- 2026-10-17: merged the phase branch (4d634cfc7) and `ci/merge-m63` for the final green push.

## Proposed ledger edits

- PLATFORM-22.1: done.
  - Proofs: runs 38989496620, 38990590658, 38991294793 and 38995237121 were cancelled 4.7-7.9 min after they started, which is about 5 min of compute plus any wait for a runner.
  - Green no slower: 38993716147 took 18.9 min against the 17-20 min baseline.
  - Suggested AC wording: "within about five minutes of compute (plus runner queue)".
- PLATFORM-22.2: done.
  - Red: 38990052509.
  - Green: 38993716147.
  - Harness proof: 38993725207.
- PLATFORM-22.4 / T3: done.
  - RED in-run: 38995460725.
  - ALREADY-PASSING and RED-IMPORT: 38995465195.
  - Green no slower: 19.2 min.
- New follow-up: fix the 12 authoring test failures (they predate this slice; base run 38992508732), then add authoring to the Package tests loop.

## Follow-ups noticed (out of scope)

- The `tests.yml` Package tests loop still skips `authoring`, because 12 of its tests fail on the phase branch (run 38992508732). Emails, design-system and apis now run. Until authoring joins the loop, the red job can report an authoring failure that predates the slice as RED.
