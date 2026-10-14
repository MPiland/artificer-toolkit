# Slice workbook: PLATFORM-13.T1 (test speed: per-file timings and the parallelism trial)

**Status:** `import.test.ts` FIX DONE, module-load change reverted; AC PLATFORM-13.3 stays open pending the end-of-phase trial and full timing record (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Close AC PLATFORM-13.3. The convex-test 0.0.60 upgrade is done (6507a4678). Two things remain:

- per-file timings are unrecorded;
- the parallelism trial has not run (the Convex vitest config is still serial).

Then remove the module-load `prepareSrdImport()` calls (about 1.2 s per process) from:

- `contentSnapshots.test.ts`;
- `srdCreatureAttackSweep.test.ts`;
- the web builder fixtures.

Use the bounded `prepareSrdDefinitions` path PLATFORM-13.6 added (merge 6bbbf7f62), or prepare lazily inside the tests that need it.

1. Record per-file timings for the Convex suite (`yarn workspace @artificer-toolkit/apis test:convex`), the worker suite and the root package suite on this machine. Use vitest's JSON or verbose reporter output saved under `local-validation/platform-13-t1/`. Put a durable summary (top 20 files, totals) in `docs/validation/`.
2. Parallelism trial for the Convex suite: run it serial and with file parallelism at 2 and at the physical-core cap. Keep the setting only if three consecutive runs pass with no failures and the wall time drops. Otherwise record why it stays serial. Never raise a per-test timeout to make it pass.
3. Remove the module-load SRD preparations listed above and record the before/after timings.

All runs are local only, under the validation lock (create it with `New-Item -ErrorAction Stop` and retry every 30 s; never delete a lock you did not create). Set `$env:GOMAXPROCS='2'` for TypeScript, and never run tsc alongside vitest. Build the packages first: `yarn turbo run build --concurrency=1 --env-mode=loose --filter=@artificer-toolkit/schema --filter=@artificer-toolkit/shared --filter=@artificer-toolkit/rules-runtime --filter=@artificer-toolkit/authoring --filter=@artificer-toolkit/encounter-persistence --filter=@artificer-toolkit/source-data`. The full suites are justified here because timing them is the deliverable. Run each full suite as few times as the trial needs.

## Closes

- AC PLATFORM-13.3.

## File scope

Vitest configs (`apps/apis`, `apps/session-worker`, root), the three named test files, the web builder fixtures, and `docs/validation/`. Change no product code. If a test fails under parallelism because of shared state, that is a finding: report it with the evidence. Do not paper over it.

## Checklist

1. The timings summary is in `docs/validation/` with the commands and machine notes.
2. The trial result is recorded: kept and proved by three clean runs, or rejected with the reason.
3. The module-load preparations are gone, with before/after per-file timings.

## Status log

- 2026-10-14: workbook written; session started.
- 2026-10-14: worktree was cut from `main`; reset to `codex/phase-08-2-convex-cutover` (754a44402) before any edit.
- 2026-10-14: baseline timings recorded (root 86 s, worker 222 s, Convex serial 3604 s); summary in [platform-13-t1-test-timings-2026-10-14.md](../validation/platform-13-t1-test-timings-2026-10-14.md). Convex serial run held the lock for 60 min (before the 10-minute rule).
- 2026-10-14: loaded root run timed out `import.test.ts` (concentration test) at 5 s; fixed by bounding it to `prepareSrdDefinitions` (commit 7a4495546). No timeout changed.
- 2026-10-14: module-load `prepareSrdImport()` made lazy or bounded in `contentSnapshots.test.ts`, `srdCreatureAttackSweep.test.ts` and `builderSnapshot.fixtures.ts` (trial, 7a4495546). Isolated warm before/after timings showed no measurable gain, and the sweep and fixture subsets stopped preparing the full seeded corpus those files claim to read. Main session review: no gain, reverted. The three files are back at base `754a44402`; only the `import.test.ts` fix stays. Measurements are in the validation note.
- Storybook note: the fixture is back at base, so the stories file no longer needs a post-merge Storybook run for this slice.
- 2026-10-14: user ruling (via main session): parallelism trial and full-suite timing record deferred to the end of the phase. Queued 8-way and 2-way runs were cancelled before taking the lock; no parallel data exists.
- Typecheck: `rules-runtime` (build + tests) exit 0 in 43 s; web `typecheck:app` passed. Web `typecheck:tests` fails with two TS2345 errors in `apps/web/src/domains/campaigns/vtt/vttSceneRenderer.model.test.ts` (lines 206 and 233: a `SpatialAreaShape` passed where a point or directed shape union is required). That file is outside this slice and untouched by it; it is a base-branch breakage (likely from the SPELLS-13 directed-area merge) for the main session to route. None of the four files this slice touched appear in the errors.
- Typecheck note: the web `typecheck:tests` failure above was a stale base, fixed on the current base tip (main session).
- Not run: a loaded root-package proof of the `import.test.ts` fix (deferred with the full-suite record), a typecheck of `import.test.ts` (source-data excludes `*.test.ts` from its tsconfig).

## Proposed ledger edits (filled by the slice session)

Close here (per-file work, done):

- PLATFORM-13.T1: close the `import.test.ts` 5 s timeout regression of PLATFORM-13.6 (concentration test bounded to `prepareSrdDefinitions`).
- PLATFORM-13.T1: module-load `prepareSrdImport()` item tried and reverted (no measurable gain; subsetting traded fidelity for nothing). Measurements in the validation note. Not closed; moved to end-of-phase speed work below.
- Baseline timings recorded as "baseline 2026-10-14, partial; trial deferred to end of phase".

Do not close AC PLATFORM-13.3 yet: it needs the parallelism trial decision and the full timing record. Register as end-of-phase task (PLATFORM-13.T2 or equivalent):

- Convex parallelism trial: 2, 4, then 8 file workers, one run each, then three consecutive clean runs for the kept setting; record wall time, failures, peak memory and paging; a run that swaps or times out rejects the setting. Never raise a per-test timeout.
- Full-suite timing record (Convex, worker, root) plus a loaded root-package run proving `import.test.ts` passes at the default 5 s.

Register as Convex-suite speed work (input: the top-20 table in the validation note). Highest-value leads, all measured on the 3604 s serial run:

1. Corpus-scale journeys: `equipmentLimits` (119.5 s), `developmentLifecycleProof` (110.6 s), `commitReferencedContext` (100.2 s), `seed` (75.2 s), `seedAudit` (64.5 s), `builderSnapshotParity` (61.0 s), `equipmentCharacter`, `catalogueReadBudget`, `developmentCustody`: 970 s of the 2808 s of test time sit in these top 11 files.
2. `media/*` per-test fixture setup: `authoredAssets` 17 tests at 8.9 s mean, `library` 5 at 10.3 s, `characterPortrait` 3 at 9.1 s (profile first; setup cost is a lead, not a finding).
3. Module import: 688 s across 380 files (about 1.8 s per file).
4. Module-load `prepareSrdImport()` in `contentSnapshots.test.ts`, `srdCreatureAttackSweep.test.ts` and the web `builderSnapshot.fixtures.ts`: subsetting gained nothing (sweep 16.5 s to 15.6–17.4 s; contentSnapshots 3.2 s to 4.4–4.7 s; web fixtures 21.8 s to 20.5–24.7 s). Revisit only with a shared, cached full corpus.
