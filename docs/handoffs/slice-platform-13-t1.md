# Slice workbook: PLATFORM-13.T1 (test speed: per-file timings and the parallelism trial)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
