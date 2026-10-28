# CI validation and affected-test selection

**Status:** current (PLATFORM-23, 2026-10-16; auto-fix and approved merges PLATFORM-25, 2026-10-18; parallelism and shard balance PLATFORM-13.T4, 2026-10-18; ledger guard PLATFORM-13.T14, 2026-10-18; browser journeys RELIABILITY-20.T2, 2026-10-27).

Slices validate on GitHub runners by pushing to `ci/<slice>` (AGENTS.md Validation). `.github/workflows/tests.yml` builds the packages once, typechecks everything, and runs only the Vitest files the slice can affect. `.github/workflows/browser-journeys.yml` runs the browser journeys the slice reaches ([Browser journeys](#browser-journeys)). `.github/workflows/live-backend.yml` is unchanged by this guide.

## Suites

Every Vitest run CI makes is one suite in `SUITES` (`scripts/affectedTests.mjs`). Vitest's own config resolution lists each suite's test files and setup files, so the include globs live only in the configs.

| Suite      | Config                                 | Runs from             | Job                                                   |
| ---------- | -------------------------------------- | --------------------- | ----------------------------------------------------- |
| `packages` | `vitest.config.ts`                     | repo root             | Package tests (Worker `src` tests one file at a time) |
| `convex`   | `apps/apis/vitest.config.ts`           | repo root             | Convex suite, 1 to 4 shards                           |
| `worker`   | `apps/session-worker/vitest.config.ts` | `apps/session-worker` | Worker tests (workerd)                                |
| `web`      | `apps/web/vitest.config.ts`, `unit`    | `apps/web`            | Web tests                                             |

The selector fails the run when a tracked `*.test.*` or `*.spec.*` file belongs to no suite. Only `apps/web/tests/**` (Playwright, run locally) is exempt. This replaces the hand-kept package list, which left the `apps/apis/src` and `scripts/*.test.mjs` tests unrun.

## Full runs

Every test file runs when:

- the branch is a merge batch (`ci/merge-*`);
- the commit is already on the phase branch (no change since the merge base);
- the run is dispatched with `full: true`;
- a change touches a dependency or toolchain file (`package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/`, `turbo.json`, `tsconfig*.json`), a Vite or Vitest config, `wrangler.json[c]`, `tests.yml`, a composite action, the selector or `redProof.mjs`, or a file a Vitest config names (a setup file or the Worker test entry).

Typechecks always run in full, and `cancel-on-type-error` still ends the run early on a type error.

## Selection

Otherwise the changed files are `git diff --name-only --no-renames <merge-base with origin/$PHASE_BRANCH> HEAD`, the whole slice and not only its last push. A test file is selected when the static import graph reaches a changed file from it. The graph is built from tracked source under `apps/`, `packages/` and `scripts/`:

- `import`, `export … from`, dynamic `import()`, `require()` and `vi.mock()` specifiers. Matching is textual, so a specifier in a comment only adds tests.
- Workspace package `exports` and `imports` resolve to the `src` file their `dist` target is compiled from. That is why Vitest's `--changed` and `vitest related` were not used: a package change must also reach the other configs' suites (Convex, Worker, web). If a target cannot be mapped, the whole package is the dependency.
- `tsconfig.json` `paths` (the web `#app/*` aliases).
- `new URL('./file', import.meta.url)` file references (a Worker module, the SRD corpus text).
- `import.meta.glob` patterns: every non-test module a glob matches. convex-test globs every Convex module and runs the ones a test reaches through `ctx.run*` by name at run time, so any Convex module change selects every Convex test that globs the modules (most of the suite), not only the tests that call it.
- Uncommitted generated modules (`GENERATED`) depend on their generator, e.g. the SRD manifest on `apps/apis/scripts/generateSrdManifest.ts`.
- A relative import that no longer resolves depends on the deleted path, so deleting a module selects its importers.

Two rules widen the selection for tests the graph cannot see into:

- A test or test helper (`isTestPath` in `redProof.mjs`: a `.test.`, `.testUtils.` or `.fixtures.` file, or a file under a test directory) that imports `node:fs` reads files itself, for example a boundary scan or the web route tests reading `routeTree.gen.ts`. Every change under `apps/`, `packages/` or `scripts/` selects the tests that reach it. So the Convex, packages and web jobs run some tests for almost any source change.
- A suite whose setup file is reached runs in full.

Known blind spots, each covered elsewhere: a file URL built from a template literal (only quoted literals are read), and a deleted module that was imported through a `#` alias or package subpath (only relative specifiers are tracked). The always-full typecheck catches a deleted import. A non-test helper that reads files at run time is not followed: name it `*.testUtils.*` or put it under a test directory.

The selection decides what a slice's green run proves. The phase branch itself only runs in full through a `ci/merge-*` batch, a push of its tip to a `ci/` branch, or a `full: true` dispatch. A single slice that already contains the phase tip merges on its own green runs (the fast path in AGENTS.md), which ran only its affected tests, so every fast-path merge gets a non-blocking full-run backstop: after pushing the merge to the phase branch, the same merge commit goes to `ci/merge-m<N>` (by [the merge workflow](#approved-merges) or by hand), which runs every test; the orchestrator watches that run and fixes a failure there first, ahead of other work.

A changed `__snapshots__/<test>.snap` selects its test. A change outside the source roots (docs, the ledger) selects nothing.

## Outputs

## Tests resolve packages from source

Every workspace package's `exports` and `imports` carry a `source` condition (listed first) pointing at the `src` file the `dist` target is compiled from. Every Vitest config spreads `sourceResolve` from `scripts/vitestSource.mjs`, which prepends `source` to Vite's resolve conditions, and inlines `@artificer-toolkit/*` so Vitest transforms the TypeScript instead of handing it to Node. `tsc`, production builds, `tsx` without `--conditions source` and Node never set the condition, so they keep resolving `dist`. A local test file therefore runs with `yarn vitest run <file>`, with no package build and no lock. `apps/apis`'s `generate:srd:manifest` also runs `tsx --conditions source`, and `schemaBoundary.test.ts` bundles with esbuild `conditions: ['source']`. `scripts/vitestSource.test.mjs` and `apps/apis/convex/workspaceSource.test.ts` prove the resolution against real package code.

The `build` job still builds first: the typecheck jobs and production builds resolve `dist`, so the artifact stays; the test jobs download it but no longer read it. Dropping the build from the test path later is a CI-speed follow-up, not part of this guarantee.

The `build` job runs the selector after the build and exposes, per suite, `run-<suite>` and `<suite>-files` (paths relative to the directory that suite's Vitest runs from), plus `full` and `convex-shards`. Convex spreads any selection over one shard per selected file, up to 4: one Convex file can take as long as a hundred others, so a count budget left 112 heavy files on 2 shards for 18 minutes. A suite with no selected files skips its job, and the step summary lists the counts. `node scripts/affectedTests.mjs --base origin/<phase-branch>` prints the same selection locally.

## Parallelism and shard balance

Settings from the PLATFORM-13.T4 trial ([record](../validation/platform-13-t4-ci-parallelism-2026-10-18.md)). The job count stays the same, because the account runs at most 20 jobs at once.

- **Convex:** 2 Vitest file workers per shard (`convex_workers`, default `2`). 4 workers timed out `campaigns/developmentCustody.test.ts`, so that setting was rejected. 3 workers ran clean after the PLATFORM-13.T17 parse memo but gave no wall-time gain, so it was not kept.
- **Worker:** 4 file workers (`worker_workers`, default `4`), still `--no-isolate`. The local `test` script stays at one worker.
- **Web:** the config's `maxWorkers: '50%'` (2 on CI), isolated. `web_workers` overrides it for a trial. 3 workers was no faster and `isolate:false` leaks mocks between files (PLATFORM-13.T15).
- **Shards:** `apps/apis/vitest.config.ts` uses `DurationSequencer`, which overrides Vitest's path-hash shard. Each file, longest first, goes to the shard with the least recorded time (`scripts/convexShards.mjs`). Each shard then runs its files longest first. A file with no record counts as the median file. Every file lands on exactly one shard, and that holds for an affected-only selection too.
- **Refresh:** a full run uploads each shard's JSON report as `convex-report-<n>`. When shard times drift apart, refresh the durations:
  ```bash
  gh run download <run> -p 'convex-report-*' -D local-validation/convex-reports
  node scripts/convexShards.mjs local-validation/convex-reports/*/vitest-convex.json
  ```
  This rewrites `apps/apis/tests/convexFileDurations.json`.
- **Changing a setting:** dispatch `-f full=true -f convex_workers=N` (or `worker_workers=N`, `web_workers=N`) on your own `ci/` branch. Keep a new setting only after three consecutive clean full runs. A timeout rejects the setting, and per-test timeouts are never raised to make one pass.

## Lint

The `lint` job runs `yarn lint` on every run, whatever the selection: oxlint with `--deny-warnings` (`.oxlintrc.jsonc`), then the repo check scripts it chains: `lint:schemas` (`scripts/lazySchemas.mjs`), `lint:casts` (`scripts/doubleCasts.mjs`) and `lint:ratchets` (`scripts/sourceRatchets.mjs`). `lint:casts` fails on any `as unknown as` outside tests and generated modules, except the per-file counts in its `ALLOWED` list, which only shrink. Any finding fails the run.

`lint:ratchets` holds the two shrink-only ratchets of [ADR 0039](../adr/0039-composable-system-neutral-rules-engine.md) decision 6 (RULES-2.T1, superseding QUALITY-3.T1d). It checks every tracked module under `apps/`, `packages/` and `scripts/` except tests and test helpers (`isTestPath`), `.d.ts` files and generated modules (`_generated/`, `*.gen.*`, `*.generated.*`):

- **File size.** A module over 1,500 code lines (non-blank lines outside comments) fails unless `scripts/fileSizeBudget.json` lists it. An entry's cap is the file's size: growth past it fails, a file that shrank fails until its cap is lowered to the new size, and a file back within 1,500 lines fails until its entry is removed. Split a module rather than list it.
- **Import fence.** A module under `packages/rules-runtime/src` outside `systems/` and `character/` never imports `systems/*` (an import, re-export or dynamic import that resolves there), and since RULES-2.T11e neither does a module of a rules-runtime consumer (`packages/encounter-persistence`, `apps/session-worker/src`, `apps/apis/convex`, `apps/web/src`) through `@artificer-toolkit/rules-runtime/systems/*`. It reaches System behaviour through a capability registry. `scripts/systemsImportAllowlist.json` names the `compositionRoots` that install System adapters, each with its reason, and lists the `importers` that still import `systems/`; an entry that no longer imports `systems/` fails until it is removed. Since RULES-2.T9b the `--base` check keeps `importers` shrink-only and accepts a new composition root only when it is a `packages/rules-runtime/src/platform*.ts` module with a non-empty reason.

A step after the format check runs `node scripts/sourceRatchets.mjs --base "$MERGE_BASE"`, which also compares both lists with the ones at the merge base: a raised cap or a new entry in either list fails, so a slice cannot buy itself room. Run the same locally with `--base origin/codex/phase-08-2-convex-cutover`.

The job then runs oxfmt in check mode on the files the branch changed since its merge base with the phase branch (`scripts/formatChanged.mjs`, deleted files skipped, `.oxfmtrc.jsonc` ignore patterns applied). Only those files: the phase branch is not oxfmt-clean, and a repo-wide format would rewrite other slices' files. Before a push, `node scripts/formatChanged.mjs --base origin/codex/phase-08-2-convex-cutover` formats the same files locally.

The job then fails a slice branch that changed `docs/roadmap/08-phase-ledger.json` since that merge base (`scripts/ledgerUntouched.mjs`, PLATFORM-13.T14), naming the commits. The ledger is the orchestrator's and is edited on the phase branch; a slice commit that rewrites it, whether as a stale copy or a reformat, would revert those edits at merge. Ledger edits that a merge of the phase branch brings in move the merge base, so they do not count. `ci/merge-*` batches skip the check. Restore the file from the merge base (`git checkout <merge-base> -- docs/roadmap/08-phase-ledger.json`) and commit.

## Auto-fix

When Lint is the only failing job of a `ci/<slice>` Tests run, the `auto-fix` job applies `oxlint --fix` (its safe fixes) and `formatChanged.mjs`, reruns `yarn lint` and the format check, and, when both pass, commits the fixes to the same branch with the trailer `Generated-By: tests auto-fix` and dispatches Tests and Live on the new commit. It is the counterpart of `live-backend.yml`'s auto-fix for `_generated` drift (`Generated-By: live-backend auto-fix`). Its guards:

- `ci/**` slice branches only: never the phase branch, main or a `ci/merge-*` batch;
- every other job passed or was skipped (it waits for them, so a run with a real failure fails as before);
- HEAD is not already a Tests auto-fix commit, so it never commits twice in a row;
- the branch left the ledger alone: it runs `ledgerUntouched.mjs` first, since formatting a rewritten ledger would hide the rewrite;
- a plain push, so a branch that moved meanwhile rejects it and the run fails;
- write permission only on this job, and the token reaches only its push step, not the install or the fix commands. A fix that would change a file under `.github/workflows` is refused, since `GITHUB_TOKEN` cannot push workflow changes.

A finding `--fix` cannot apply, a `lint:schemas` or `lint:casts` finding, or a fix that changes nothing fails the job, and the run fails as before. A dispatched Tests run queues behind the running one rather than cancelling it, so the auto-fix run ends as a failure; a push still cancels the older run. `scripts/watchCi.ps1` prints `AUTO-FIX <sha>` and follows the new commit for either auto-fix; pull the branch (`git pull --ff-only`) before pushing again.

## Approved merges

After the orchestrator reviews a slice tip and approves it, `.github/workflows/merge-slice.yml` does the merge mechanics (`scripts/mergeSlice.mjs`). Dispatch it from the phase branch, so the merge logic is the phase branch's and not the slice's:

```
gh workflow run merge-slice.yml --ref codex/phase-08-2-convex-cutover -f branch=ci/<slice> -f sha=<tip> -f title='Merge <PBI>.<task>: <summary>'
```

1. It refuses unless the branch is a `ci/<slice>` branch still at that SHA. It waits for the newest non-cancelled Tests and Live runs on the SHA and refuses unless both succeeded; a cancelled duplicate does not hide a green run, but a workflow with only cancelled runs is red (re-dispatch it). Browser journeys gate only where they ran (`WHEN_RAN`): every non-cancelled Browser journeys run on the SHA must succeed, so a newer dispatch does not hide a red run, and a SHA with none (an auto-fix commit, a batch) is not dispatched one ([Browser journeys](#browser-journeys)). A workflow with no run there (Live is path-filtered) is dispatched on the branch once; the script then polls that run by its id (`gh run view <id>`), taken from the run URL `gh workflow run` prints, or, when gh prints none, from a branch-and-workflow listing of `workflow_dispatch` runs created after the dispatch. It does not look a dispatched run up by commit again: the commit-filtered listing lagged past 5 minutes on runs that existed within a second (runs 39798992843, 39802995621, 39805154563), so a dispatched run is never refused as "not appeared". Each wait has one overall timeout of 90 minutes. GitHub's filtered run listings (`--commit`, `--branch`) also intermittently return no runs for runs that exist (3 of 10 back-to-back calls), which refused merges m336–m339 and re-dispatched green slices, so an empty listing is retried 4 times, 5 seconds apart, and only a listing that stays empty counts as missing and triggers a dispatch.
2. `N` is one more than the highest `ci/merge-m<N>` branch, and the merge title gets ` (m<N>)`.
3. Fast path: when the phase branch has changed nothing outside `docs/` since the slice's merge base (none at all when the slice contains the phase tip), the slice merges `--no-ff` onto the phase tip. The merge must differ from the slice tree only under `docs/`, so the slice's green runs prove it. It is pushed to the phase branch, then to `ci/merge-m<N>` with Tests and Live dispatched as the full-run backstop, which the workflow does not wait for.
4. Batch path: otherwise the phase tip merges `--no-ff` into the slice, the merge goes to `ci/merge-m<N>`, and the workflow dispatches Tests and Live there and waits. When both are green it fast-forwards the phase branch to the merge, or merges `--no-ff` once more if the phase branch moved meanwhile under `docs/` only.
5. Size-budget conflicts: every slice that shrinks a listed file lowers its cap line in `scripts/fileSizeBudget.json`, so two such slices conflict there (three of four m442 attempts). When that file is a merge's only conflict, in any of the merges above, the script resolves it three-way: each entry takes the lower cap of the two sides, and an entry that either side removed stays removed. When both sides shrank the same file, the merged file can end up below both caps (SPELLS-31.T5b and T4k2d1, run 40262719408): `shrunkCaps` from `scripts/sourceRatchets.mjs` finds each entry whose merged file is under its cap and still over 1,500 lines, and the script lowers that cap to the merged code-line count. It then runs `ratchetProblems` on the merged tree and commits only when it reports none; the ADR 0039 shrink-only ratchet is unchanged. Any other conflicting file, a side that deleted the budget, or a remaining ratchet problem (a merged file that grew past its resolved cap, or one back within 1,500 lines whose entry must go) refuses the merge and names the files or problems. The workflow installs dependencies for this, because the ratchet parses modules with oxc-parser.

**Batching several slices.** Pass `-f slices='ci/<a>@<tip> ci/<b>@<tip>'` (space or comma separated, merged in this order) instead of `branch` and `sha`. A single `branch@sha` pair behaves exactly as above. With two or more:

- Every tip must still be unchanged and green on its own Tests and Live runs, exactly as for one slice.
- The slices merge `--no-ff`, in order, onto the phase tip into one batch commit. That commit goes to `ci/merge-m<N>`; Tests and Live run there once, and the phase branch moves once, on green, as in the batch path above. There is no fast path for a batch, because no slice's own runs prove the combination.
- A conflict, a moved tip or a slice that is not green refuses the whole batch and names that slice (`ci/<slice>: ...`), and nothing is pushed to the phase branch. A red run on the batch commit cannot be attributed to one slice: the refusal names the run, and only the `ci/merge-m<N>` branch remains.
- Dispatch a batch only for slices that were reviewed together. A slice that changes `.github/workflows` still merges by hand.

A conflict, a red or cancelled run, a moved slice tip, or a phase branch that moved outside `docs/` during a batch fails the job with the reason; the phase branch is never pushed then (a red batch leaves only its `ci/merge-m<N>` branch). Every push is a plain push, never main. Merge commits carry the `Co-Authored-By: Claude Opus 5.5` trailer. One merge runs at a time per target. GitHub keeps one pending run per concurrency group and cancels an older pending one, so dispatch an approval after the previous one has started, and re-dispatch a cancelled one. A slice that changes `.github/workflows` cannot be pushed with `GITHUB_TOKEN`; merge it by hand. The `target` and `batch_prefix` inputs exist only to prove the workflow on a scratch branch and `ci/p25-merge-m<N>` batches.

To take the fast path, a slice merges the current phase tip into itself (`git fetch origin; git merge --no-edit origin/codex/phase-08-2-convex-cutover`) right before the push it reports as ready to merge, then lints and pushes. Its own green runs then prove the merge, and the merge queue is not held up by a rerun. A phase merge that lands while the slice's CI runs sends it down the batch path, which stays correct.

## Browser journeys

Browser journeys gate in CI (RELIABILITY-20). `.github/workflows/browser-journeys.yml` starts a throwaway self-hosted Convex container (the image `live-backend.yml` pins), the Session Worker under local `wrangler dev` and the web app, with configuration `scripts/throwawayConvexStack.mjs` generates; it uses no repository secret and reaches neither Cloudflare nor Convex Cloud. The selected proofs run in shards ([Shards](#shards)), each proof through `scripts/runLocalBrowserProof.mjs` and `scripts/runLocalConvexProof.ps1`. A shard's evidence uploads as `<shard> evidence` after a scan for the generated secrets. Inside it, each proof's evidence is in its own `<proof>/` folder, and the stack's Convex logs are at the top.

- **Push.** Every `ci/**` push runs the `select` job, `scripts/affectedBrowserJourneys.mjs`. It reuses the Tests selector's import graph, merge-base diff and dependency triggers (`buildImportGraph`, `affectedFiles`, `changesSince`, `fullRunReason` from `scripts/affectedTests.mjs`) rather than a second selection. The CI proofs, every `*-browser` proof in the `-Proof` ValidateSet of `scripts/runLocalConvexProof.ps1` (the one proof list), run when a changed file's importers reach a deployed Convex module (any non-test module under `apps/apis/convex`, since the generated `api` is a static spec that imports none) or a journey entry (`JOURNEY_ENTRIES`: the proof driver `apps/apis/tests/developmentDrafts.ts`, the web app's TanStack Start entries `client.tsx`, `server.ts`, `router.tsx` and `start.ts`, the Worker's `src/index.ts`, and the stack scripts). The Tests rule that a file-reading test helper depends on every source file is left out here: the driver reads only fixtures and evidence, and the rule would select the journeys for any change. They also run when a change touches a stack file the graph cannot see (this workflow, `live-backend.yml`, the PowerShell proof runner and fixtures, the selector), a served non-code file under the web app, the Worker or `apps/apis/convex`, or a dependency or toolchain file from [Full runs](#full-runs). Otherwise the run passes with no proof, and the step summary says why.
- **Dispatch.** `gh workflow run browser-journeys.yml --ref ci/<slice> -f proof=<name>` runs one proof that `runLocalConvexProof.ps1` names; the selector refuses any other name. With no `proof`, every CI proof runs in shards. `-f reverse=true` runs each shard's proofs in reverse order. A named or reversed dispatch has its own concurrency group, so it never cancels the push run.
- **Known bugs.** `KNOWN_BUG_PROOFS` in the selector maps each CI proof that has never passed in CI to the registered task that fixes it (RELIABILITY-20.3). That proof runs and uploads evidence in the known-bug shard, which is `continue-on-error`, so its failure leaves the run green, and the step summary labels it `KNOWN-BUG <task>`. Every other proof gates. The selector refuses an entry that names no registered task, or whose task is DONE, so a fix task removes its entries and the proof gates again.
- **Gate.** `scripts/watchCi.ps1` follows the run beside Tests and Live. Merge-slice requires every non-cancelled Browser journeys run on a tip green (see [Approved merges](#approved-merges)); a flaky job is rerun in place with `gh run rerun <id> --failed`. It never dispatches the workflow, so a tip with no run (an auto-fix commit, a merge batch) is not gated by it.

Because the web app's route tree imports almost every web module, and the driver reaches every Convex module, most product slices run the journeys; docs, ledger, test-only and unrelated script changes do not. The local runner (`scripts/runLocalBrowserProof.mjs` in the heavy lane) remains only for the user's review data.

### Shards

Booting a stack (checkout, setup, Chromium, the Convex container, deploy, seed and Content snapshots) takes about 6 minutes, longer than most proofs. So a run packs its proofs onto a few stacks (RELIABILITY-21.18). `shardProofs` in the selector puts every known-bug proof in one non-gating shard, so a known bug never reddens or hides a gating proof. It spreads the gating proofs over at most `GATING_SHARDS` (5) shards, longest first onto the least-loaded shard, by the seconds in `scripts/browserJourneyDurations.json`.

- **Membership.** Shard membership comes from the runner's proof list and the labels, so a new proof joins a shard with no list to edit. A proof with no recorded seconds counts as the median proof.
- **Running.** A shard boots one stack and runs its proofs in name order. Each proof starts its own Worker and web app. A failed proof does not stop the shard: the step summary reports each proof as passed or failed, with its seconds, and the shard fails if any of its proofs failed.
- **Independence.** Proofs create their own accounts and records, as they do on the long-lived local container. A reversed dispatch (`-f reverse=true`) proves that no proof passes or fails because of what an earlier one left.
- **Durations.** To refresh the recorded seconds, take the `<proof> passed in <n> s` lines from a full run's log (`gh run view <id> --log | grep -oE '[a-z0-9-]+ (passed|FAILED) in [0-9]+ s'`) and update the JSON. Stale seconds only unbalance the shards; they never drop a proof.

**Measured (RELIABILITY-21.T20, the 32 `ci/**` push runs from 2026-10-27 to 2026-10-28).**

- **Before:** 29 of the 32 runs selected all 25 CI proofs, one runner each. The other 3 were cancelled during selection. That is 760 proof jobs, 26 concurrent jobs per run with `select`.
- **Run 40742903035:** the proof jobs took 13,154 runner-seconds (about 219 minutes). The proofs' own steps took 4,305 seconds, so each job spent about 354 seconds booting its stack; for `auth-browser` that was 284 of 327 seconds.
- **Per-proof selection, considered and rejected:**
  - Re-running reach on each run's change showed that 22 of the 27 runs with changes reach the shared driver (it imports the SRD corpus to seed), `routes/__root.tsx` or `apps/apis/convex/schema.ts`. Dropping type-only imports did not change that.
  - The 5 web-only runs reached the campaign and tabletop routes that most campaign and encounter proofs drive.
  - A sound per-proof rule would have saved about 45 of 760 jobs (6%).
- **Independence:** reversed run 40753154902 passed all 20 gating proofs with every shard's order flipped. In the known-bug shard, `vtt-browser` and `character-sheet-browser` failed as they do alone; the other three passed.
- **Built-output hashing, considered and rejected:** skipping a run whose web, Convex and Worker builds are byte-identical to the merge base's.
  - Every one of the 24 runs that change a reached file still differs after type and comment stripping, so their builds would differ too. The other 3 selected runs changed stack files, which run every proof by design.
  - It would have skipped none of the 32 runs beyond the 5 the graph already skips.
  - It would add an install and three builds to every `select` job.
- **After:** a full run uses 6 proof jobs (5 gating, 1 known-bug), 7 concurrent jobs with `select`, which is 73% fewer slots. Runner time drops to about 6 × 354 + 4,305 ≈ 6,430 seconds (about 107 minutes, 51% less). Wall-clock time stays about the same: the longest shard is `scene-live-browser` alone, at about 22 minutes against 23 before.

## Red proof

The `red` job (PLATFORM-22) runs the slice's added and modified test files against the merge base's production code (`scripts/redProof.mjs`). The selector owns its inputs from the same diff: `merge-base`, `red-files` (every added or modified test file and test helper, which the job checks out from the tip) and `red-suites` (per suite, its config, root and the changed test files it includes, from the same Vitest config resolution). A slice that adds or changes no test file skips the job, and merge batches skip it too. The job runs whatever the selection, so a full run still proves red. Each suite has an 8-minute wall-clock budget, well under the job's cap, because against old code a workerd test can hang instead of failing. A suite killed at the budget, or one that writes no report, labels its files RED-TIMEOUT (weaker evidence, like RED-IMPORT: it shows only that the old code does not finish) instead of failing the job. The labels are RED, RED-IMPORT, RED-TIMEOUT, ALREADY-PASSING and NOT-RUN.
