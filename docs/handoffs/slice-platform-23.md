# Slice workbook: PLATFORM-23 (CI runs exactly the tests a change can affect)

**Status:** T1-T4 done; synced with the phase tip `7ee2382fc` (2026-10-17) and pending CI.
**Base:** `codex/phase-08-2-convex-cutover` (merged at `cb19518ea`).
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0038](../adr/0038-rules-authored-from-core-options.md) (authoring parity).

## ACs

- **23.1** (T2) Each slice runs only the test files whose imports reach its changed files, across all packages, with no hand-kept list; merge batches run every test.
- **23.3** (T3) A local typecheck lane typechecks the changed workspaces and their dependents before every push.
- **23.4** (T4) The runner builds the dependencies of named test files before running them, and agents run the touched test files locally before every push.
- **23.2** (T1) The 12 failing authoring parity tests are fixed at their cause and the ACs that cite them are re-verified, with no weakened assertions.

## T1: the 12 authoring failures

All 12 tests were added 2026-10-14..16 and never ran in CI: `tests.yml` looped over a hand-kept package list without `authoring` (and without `design-system`; `emails` was added by PLATFORM-22). No assertion changed.

| Test (count)                                                                                                                                   | Cause                                                                                                                                                                                                                                                                                             | Kind         | Fix                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| creatureFormAuthoringParity (2), offHandAttackAuthoringParity (4), conditionSourceAuthoringParity "dragon" (1), escapeDcOptions "fixed DC" (1) | The tests built a reader with `readAuthoredRows: () => []`, so every reference to an authored root (creatures, equipment, rules, capability definitions, class ids) was missing from its options and cleared. Production (`createSystemSourceReader`) and the web harness read the authored rows. | Test fixture | The web harness's in-memory SRD reader moved to `packages/authoring/src/nodeRuntime/srdSourceReader.ts` (subpath export); the authoring tests and web tests share it. |
| concealmentAuthoringParity (2)                                                                                                                 | ATTACK-10.T1's check map selects table `passives` (`CHECK_DC_NODE_MAP`, PASSIVE DC), which was neither a trusted source table nor System vocabulary: resolving it threw `Untrusted node runtime table: passives`. An author choosing a PASSIVE DC would hit the same throw in production.         | Product bug  | `passives` added to `nodeRuntimeSourceManifest` and to `systemCoreCodeRows`.                                                                                          |
| systemVocabularyOptions "selects the description" (1)                                                                                          | SPELLS-28.T4 (`5a24c22ad`) added `excludedSpeedIds` selecting `speeds` without `description` (AUTHORING-18 rule).                                                                                                                                                                                 | Product bug  | `description` added to that select.                                                                                                                                   |
| conditionSourceAuthoringParity "clears fleesSource" (1)                                                                                        | SPELLS-29.T2 (`841de7cfc`) gave `fleesSource` a `showIf` on `recordsSource` but the default `hiddenBehavior` is `KEEP`, so a hidden `fleesSource: true` survived.                                                                                                                                 | Product bug  | `hiddenBehavior: 'CLEAR'`.                                                                                                                                            |

Ledger items that cite these tests (orchestrator to re-verify): AUTHORING-18.1, AUTHORING-19.1 (systemVocabularyOptions), ATTACK-9.5 (offHandAttackAuthoringParity), SPELLS-29.2 (conditionSourceAuthoringParity, reopened). By behavior, not file name: ATTACK-10.T1 (concealment, escapeDcOptions) and SPELLS-28.T2/T4 (creatureFormAuthoringParity, the speeds select).

Also found: `packages/authoring` typechecks with `tsconfig.build.json`, which excludes `*.test.ts`, so authoring tests are not typechecked. PLATFORM-22 adds `tsconfig.tests.json` for packages on `ci/platform-22`; not touched here.

## T2: affected-test selection

`scripts/affectedTests.mjs` with `scripts/affectedTests.test.mjs`; design and rules in [CI validation](../architecture/ci-validation.md). Why not Vitest `--changed`/`related`: tests import workspace packages through `dist` behind `node_modules` symlinks, which Vitest's graph does not map back to source, and one package change must select tests in four configs. turbo affected is package-granular, so it would run whole package suites.

Also found by the suite guard and the root config now running whole: `apps/apis/src` (1 file) and `scripts/*.test.mjs` (3) tests were never run in CI; they pass (light lane: 6 files, 42 tests with the selector and design-system tests).

Full-run baseline (T1, run 38999517415): 15m19s wall; Convex shards 9:03-13:39, packages and Worker 8:30, web 9:18.

Proof runs (Tests workflow wall time, created to last job):

| Run                         | Commit / branch                                                                                                          | Selection                                                          | Wall   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ |
| Config change, 39002759057  | `1b43bbe30` on `ci/platform-23` (the slice changes `turbo.json`, `package.json`)                                         | full                                                               | 19m40s |
| Merge batch, 39004192086    | `b2326ce1b` on `ci/merge-platform-23-proof` (not a real batch)                                                           | full (`ci/merge-*`), red job skipped                               | 17m43s |
| Single package, 39004159064 | `b2326ce1b` (one line in `packages/authoring/src/nodeRuntime/srdSourceReader.ts`), dispatched with `base=ci/platform-23` | packages 11/366, Convex 112/397, Worker 0/99 (skipped), web 22/296 | 20m43s |

The single-package run selected 145 of 1158 files but was the slowest: the selector gave Convex one shard per 100 selected files, so its 112 files (the Convex tests whose helpers read source files, among the heaviest) ran on 2 shards for 13 and 18 minutes. Convex now spreads any selection over one shard per file, up to 4 (`convexShards`, regression test in `affectedTests.test.mjs`). Rerun 39005767036 (`d4798b8ba` on `ci/platform-23-single-2`, same one-line change on `49d227a06`, same selection): 12m54s wall, Convex 4 shards 6:42-10:31, web 4:39, packages 0:59. The remaining Convex time is the 112 tests that reach the change through `apps/apis/tests` helpers that read source files (ci-validation.md, blind spots).

## T3: local typecheck lane

`-Lane typecheck` in `scripts/withValidationLock.ps1` runs one fixed command (no `-Script`): Turbo `typecheck` and `typecheck:convex` with `--filter=...[<merge-base with origin/codex/phase-08-2-convex-cutover>]` (web excluded, since its `typecheck` is its `typecheck:app`), then web's `typecheck:app`/`tests`/`stories` with the same filter; `GOMAXPROCS=2`, `--concurrency=1`, `--env-mode=loose`, `--continue`. `turbo.json` gives web's typecheck tasks `^build`, as `typecheck` already had, so the lane builds what they read. `yarn turbo:affected:typecheck` (`--filter=[HEAD]`, empty after a commit) is removed.

Measured in the heavy lane (`local-validation/platform-23/measure-*.ps1`), the lane's two Turbo commands for one changed package. Peak is the batch's process tree, sampled every 0.5 s.

| Change                             | Cold (`--force`, tsbuildinfo deleted) | Warm (one source edit) | Cached                      | Peak private |
| ---------------------------------- | ------------------------------------- | ---------------------- | --------------------------- | ------------ |
| `apps/session-worker` (4 tasks)    | 196 s                                 | 74 s                   | 3 s                         | 2.0 GB       |
| `packages/shared` (all dependents) | 431 s                                 | 225 s                  | 5 s (lane, every workspace) | 2.0 GB       |

The CI fail-fast gate reports a type error in about 6 minutes, plus the push and queue. A one-package change is reported locally in about a minute warm; a `shared` change takes as long as CI cold and less warm. Free physical memory fell to 0 to 8 MB in every run while commit headroom stayed above 13.8 GB, so the gate is commit headroom: 4 GB, twice the peak. `--concurrency=1` keeps one compiler alive at a time, which is why the peak does not grow with the number of dependents.

Proof (`local-validation/platform-23/lane-proof.txt`): the slice changes root config, so every workspace is in scope. Clean pass 108 s (exit 0, 17 of 19 tasks cached); then a `string` assigned to a `number` in `apps/session-worker/src/index.ts`: exit 1 in 45 s, printing `src/index.ts(143,14): error TS2322`, with no push or CI run; reverted, clean pass 5 s, all cached.

## T4: scoped build before local test files

A light batch takes `-BuildFor <test files>`. Before it queues for a light slot, the runner maps each file to the workspace that owns it and runs `turbo run build --filter=<workspace>^...` (that workspace's dependencies, Turbo-cached, `--concurrency=1`) as a typecheck-lane batch: same lock, same 4 GB commit-headroom gate, one compile at a time. The light lane still refuses scripts that build.

Proof (`local-validation/platform-23/build-proof.txt`): a comment added to `packages/rules-runtime/src/index.ts`, then `apps/session-worker/src/roomEncounterMechanics.test.ts` with `-BuildFor` that file.

| Run                | Build (7 tasks)           | Test  | Total |
| ------------------ | ------------------------- | ----- | ----- |
| After the change   | 6.1 s (2 rebuilt, 5 hits) | 20 s  | 45 s  |
| Again, nothing new | 0.9 s (all cached)        | 3.4 s | 12 s  |

`tsc` builds incrementally from `tsconfig.build.tsbuildinfo`, so a source change rebuilds in seconds. A build with no tsbuildinfo and no cache (fresh checkout) is part of the cold typecheck times in T3.

## Review fixes (2026-10-17)

- Phase-branch gap ruling: the single-slice fast path stays, with a non-blocking full-run backstop (the orchestrator pushes the merge commit to `ci/merge-m<N>`, watches it and fixes a failure first), in AGENTS.md and ci-validation.md.
- `yarn turbo:affected:test` (`--filter=[HEAD]`, empty after a commit) is removed rather than refiltered: against the merge-base it would run whole workspace suites (all of Convex for an `apis` change), which the local rules forbid; the light lane runs the touched files and CI's selector runs the affected ones. Historical roadmap and audit mentions are left as records.

## Status log

- 2026-10-16: local red (12 failed / 16 passed in the six files) reproduced after building packages. Green: `packages/authoring/src` 15 files, 104 tests passed (light lane).
- 2026-10-16: T1 green on CI at `e9f6c14b2` (live-backend auto-fix of `_generated/api.d.ts` on top of `ffb666a9e`): Tests 38999517415, Live backend 38999518771.
- 2026-10-17: T2 green with review fixes; T3 green at `f61638758`/`1b43bbe30` (Tests 39002759057, Live 39002758996); T4 green at `daf82d84f` (Tests 39004035025); Convex shard fix green at `49d227a06` (Tests 39005736388).

## Proposed ledger edits

- PLATFORM-23.2 and T1 DONE: green at `e9f6c14b2` (Tests 38999517415, Live 38999518771).
- PLATFORM-23.1 and T2 DONE: proof runs 39002759057 (config, full), 39004192086 (merge batch, full), 39005767036 (single package, 145 of 1158 files); green at `49d227a06` (Tests 39005736388).
- PLATFORM-23.3 and T3 DONE: lane proof in T3 above; green at `1b43bbe30`.
- PLATFORM-23.4 and T4 DONE: build proof in T4 above; green at `daf82d84f` (Tests 39004035025).
