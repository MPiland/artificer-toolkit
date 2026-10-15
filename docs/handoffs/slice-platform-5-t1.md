# Slice workbook: PLATFORM-5.T1 (SRD seed mutations stay under the 1 s limit)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md), with one exception below.

## Brief

During the SPELLS-17.T4 merge (2026-10-15), `content/seed:seed` failed on the local backend at about 74% host CPU:

```text
Uncaught Error: Function execution timed out (maximum duration: 1s)
```

The audit then reported "Missing platform content source", so the failure came before `bootstrap` committed. The unchanged rerun at 71% CPU passed. Logs: `local-validation/merge-s17t4/deploy-seed.log` (failure) and `deploy-seed-2.log` (pass).

The seed is `apps/apis/convex/content/seed.ts` (`seed` action). It calls these mutations in `apps/apis/convex/content/import.ts` and `raceRelationships.ts`:

- `bootstrap` (systems, content source, catalogue);
- `importSubjects` and `importDefinitions` in `sourceImportBatches` (128 KiB input batches, PLATFORM-5.5);
- the per-subject derived syncs: `syncClassDerived`, `raceRelationships.syncDerived`, `syncEquipmentDerived`.

One of them runs close enough to the 1 s execution limit that machine load pushes it over. The same seed provisions staging and production, so this is a real provisioning bug, not a test flake.

- **Measure first.**
  - Record each seed mutation's execution time on a fresh local backend: one run at idle and one while the machine is loaded.
  - Use what the Convex backend reports (function logs or execution records), not wall-clock around the action.
  - Keep the numbers in `local-validation/platform-5-t1/` and summarize them in the status log.
- **Fix the cause.** Cut the work of the mutation(s) near the limit: a smaller or split bootstrap payload, smaller batches, fewer reads per derived sync, or whatever the measurements show.
  - Keep the import atomic where PLATFORM-5.3 requires it.
  - Keep reruns idempotent (PLATFORM-5.2: an identical rerun inserts nothing and matches the manifest checksum).
  - Do not raise a limit, add a retry, or catch the timeout.
- **Prove it.**
  - A loaded seed run on a fresh backend in which every mutation has a clear margin under 1 s; state the margin you reached.
  - Then the existing import and audit tests.

**Exception to the workbook rules:** this slice may reset, deploy and seed the local Docker backend. Do it only inside heavy-lane batches (`withValidationLock.ps1` without `-Lane light`).

- Reset with `scripts/resetLocalConvex.ps1 -Name platform-5-t1`.
- Deploy and seed with the pattern in `local-validation/codex-batch/deploy-seed.mjs`. The admin key is generated inside the container and never printed, logged or written.
- Leave the backend deployed from your branch, seeded and audited green at the end of every batch, because other sessions use it.
- Never reset, prune or delete Docker containers, volumes or settings.

Your worktree's code is what gets deployed during your batches. The main session redeploys the lane branch at its next merge.

Escalate (`SendMessage` to the main session) only if:

- the fix needs a change to the import's atomicity or idempotency contract (PLATFORM-5.2 or 5.3); or
- the import input contract in `packages/schema` must change.

Read first:

- PLATFORM-5 ACs in `docs/roadmap/08-phase-ledger.json`.
- ADR 0035 and any import or seed entries in `docs/handoffs/phase-08-2-decisions.md`.
- `seed.ts`, `import.ts` and their tests under `apps/apis/convex/content/`.

## Closes

- AC PLATFORM-5.7.

## File scope

- `apps/apis/convex/content` (the seed, import and derived-sync mutations) and their tests.
- `packages/schema` and `packages/source-data` only if batching helpers live there (for example `sourceImportBatches`).

## Red-first checklist

1. **Measure (red):** per-mutation durations from a loaded seed run on a fresh backend, showing which mutation is near or over the limit. Keep the log.
2. **Fix:** the change, with existing import tests green (atomic rollback, idempotent rerun, manifest checksum).
3. **Prove (green):** a loaded seed run on a fresh backend with the per-mutation durations, every one clearly under 1 s, then the audit green.
4. Run the apis `content` folder (one folder-filter run) on CI via `ci/platform-5-t1`.

## Status log

- 2026-10-15: workbook written.

## Proposed ledger edits (filled by the slice session)
