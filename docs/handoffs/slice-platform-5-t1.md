# Slice workbook: PLATFORM-5.T1 (SRD seed mutations stay under the 1 s limit)

**Status:** done (green)
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
- Deploy and seed with the pattern in `scripts/liveBackendValidation.mjs` (CI runs it; see `.github/workflows/live-backend.yml`). The admin key is generated inside the container and never printed, logged or written.
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
- 2026-10-15: measured on the local backend (backend execution records, base code). `importSubjects` is the only mutation near the limit: idle max 377 ms, loaded (16 busy-loop processes on 16 CPUs) 1005 ms and a timeout. Others: `bootstrap` 199/322 ms, `syncEquipmentDerived` 212 ms, `importDefinitions` 101 ms, `syncClassDerived` 60 ms, `raceRelationships.syncDerived` 85 ms (idle). Red: `local-validation/platform-5-t1/base-loaded.run.log`.
- 2026-10-15: fix in `import.ts` (one canonicalize per subject instead of about five hash and parse passes) and `importBatches.ts` (cost-budget batching, Class always alone). Import contract, atomicity and idempotency unchanged. Red-first unit log: `red-importBatches.log`.
- 2026-10-15: green on a fresh backend, `fix4-idle` and `fix4-loaded` (12 busy-loop processes, about 75% load): `importSubjects` max 179 ms idle and 343 ms loaded; every other mutation at most 256 ms; seed success and audit green, backend left seeded and audited. Same 16-process load as the red run: all 385 `importSubjects` calls finished, max 717 ms (`fix2-loaded`). Re-measured on the final code after review (`fix5-idle`, `fix5-loaded`, 12 burners): `importSubjects` max 151 ms idle, 308 ms loaded; every mutation at most 308 ms, audit green. Scoped tests (`importBatches`, `import`, `importSpell`, `importCreatureVehicle`, `seed`, `seedAudit`): 29 pass, `green-import-tests.log`. Record: [platform-5-t1-seed-mutation-margin-2026-10-15.md](../validation/platform-5-t1-seed-mutation-margin-2026-10-15.md).
- 2026-10-15: independent review (opus, read-only). Fixed: (1) red evidence now states which final tests are red on the old code; (2) the reviewer asked for a test of the new-subject `Canonical content conflict.` branch; no input reaches it, because the strict schema parse rejects an extra key first (`unrecognized_key`), so the branch is defence in depth. Added `import.test.ts` "rolls back a whole batch when a later new document has a key its schema does not define", which pins that admission and the rollback (passes before and after); (3) restored the old check order (content conflict, then checksum); (4) one `validateDocument` now serves `importSubjects`, `importDefinitions` and `bootstrap`; (5) `apps/apis/README.md` batching paragraph updated, ledger line number corrected; (6) removed the no-op `KIB_COST`, the Class comment now says the Class path is the floor batching cannot lower; (7) the packing test asserts order for mixed sizes. Stands: canonicalizing rejects `undefined`-valued keys that the old JSON round trip dropped (latent, documented in the record); the 308 ms headline is at 12 burners and 717 ms at 16, both recorded; `sourceImportRecordCost` stays exported because the tests import it.
- 2026-10-15: CI `ci/platform-5-t1` run 38825767175 (commit eb483df41) green: build, all four Convex shards, all typechecks, web and package/Worker tests. The first run (38823715173) failed only on a TS2698 in my new test, fixed in eb483df41. The base defects (developmentLifecycleProof, accountJourneys INVALID_USERNAME) did not appear in this run.`n- Follow-up (not this slice): `contentSnapshots/heads:readScopeKind` (a query) hits the 1 s limit under load, `content/import:readSubjects` reaches 540 ms loaded; see the record's "Observed" section.

## Proposed ledger edits (filled by the slice session)

- AC PLATFORM-5.7: mark met. Evidence: [the validation record](../validation/platform-5-t1-seed-mutation-margin-2026-10-15.md): loaded seed on a fresh backend, every seed mutation at most 308 ms (limit 1000 ms), idle `importSubjects` maximum 151 ms.
- AC PLATFORM-5.5 text ("using 128 KiB input batching", `08-phase-ledger.json:204`): the batching is now cost-budgeted (25 per record plus 1 per KiB, budget 100, Class alone); reword to "cost-budgeted input batching" or leave as history.
- Register a follow-up item for the `contentSnapshots` read and build timeouts under load (`readScopeKind`, `actions:build`), and the audit query `readSubjects` at 540 ms loaded.
