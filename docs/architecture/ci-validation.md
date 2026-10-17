# CI validation and affected-test selection

**Status:** current (PLATFORM-23, 2026-10-16).

Slices validate on GitHub runners by pushing to `ci/<slice>` (AGENTS.md Validation). `.github/workflows/tests.yml` builds the packages once, typechecks everything, and runs only the Vitest files the slice can affect. `.github/workflows/live-backend.yml` is unchanged by this guide.

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
- Workspace package `exports` and `imports` resolve to the `src` file their `dist` target is compiled from. That is why Vitest's `--changed` and `vitest related` were not used: tests import packages through `dist` behind `node_modules` symlinks, which Vitest's module graph does not trace back to source, and a package change must also reach the other configs' suites (Convex, Worker, web). If a target cannot be mapped, the whole package is the dependency.
- `tsconfig.json` `paths` (the web `#app/*` aliases).
- `new URL('./file', import.meta.url)` file references (a Worker module, the SRD corpus text).
- `import.meta.glob` patterns: every non-test module a glob matches. convex-test globs every Convex module and runs the ones a test reaches through `ctx.run*` by name at run time, so any Convex module change selects every Convex test that globs the modules (most of the suite), not only the tests that call it.
- Uncommitted generated modules (`GENERATED`) depend on their generator, e.g. the SRD manifest on `apps/apis/scripts/generateSrdManifest.ts`.
- A relative import that no longer resolves depends on the deleted path, so deleting a module selects its importers.

Two rules widen the selection for tests the graph cannot see into:

- A test or test helper (`isTestPath` in `redProof.mjs`: a `.test.`, `.testUtils.` or `.fixtures.` file, or a file under a test directory) that imports `node:fs` reads files itself, for example a boundary scan or the web route tests reading `routeTree.gen.ts`. Every change under `apps/`, `packages/` or `scripts/` selects the tests that reach it. So the Convex, packages and web jobs run some tests for almost any source change.
- A suite whose setup file is reached runs in full.

Known blind spots, each covered elsewhere: a file URL built from a template literal (only quoted literals are read), and a deleted module that was imported through a `#` alias or package subpath (only relative specifiers are tracked). The always-full typecheck catches a deleted import. A non-test helper that reads files at run time is not followed: name it `*.testUtils.*` or put it under a test directory.

The selection decides what a slice's green run proves. The phase branch itself only runs in full through a `ci/merge-*` batch, a push of its tip to a `ci/` branch, or a `full: true` dispatch. A single slice that already contains the phase tip merges on its own green runs (the fast path in AGENTS.md), which ran only its affected tests, so every fast-path merge gets a non-blocking full-run backstop: after pushing the merge to the phase branch, the orchestrator pushes the same merge commit to `ci/merge-m<N>`, which runs every test, watches that run, and fixes a failure there first, ahead of other work.

A changed `__snapshots__/<test>.snap` selects its test. A change outside the source roots (docs, the ledger) selects nothing.

## Outputs

The `build` job runs the selector after the build and exposes, per suite, `run-<suite>` and `<suite>-files` (paths relative to the directory that suite's Vitest runs from), plus `full` and `convex-shards`. Convex spreads any selection over one shard per selected file, up to 4: one Convex file can take as long as a hundred others, so a count budget left 112 heavy files on 2 shards for 18 minutes. A suite with no selected files skips its job, and the step summary lists the counts. `node scripts/affectedTests.mjs --base origin/<phase-branch>` prints the same selection locally.

## Red proof

The `red` job (PLATFORM-22) runs the slice's added and modified test files against the merge base's production code (`scripts/redProof.mjs`). The selector owns its inputs from the same diff: `merge-base`, `red-files` (every added or modified test file and test helper, which the job checks out from the tip) and `red-suites` (per suite, its config, root and the changed test files it includes, from the same Vitest config resolution). A slice that adds or changes no test file skips the job, and merge batches skip it too. The job runs whatever the selection, so a full run still proves red.
