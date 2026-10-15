# PLATFORM-5.T1: seed mutation margin under the 1 s limit (2026-10-15)

Closes AC PLATFORM-5.7. Source: `apps/apis/convex/content/import.ts` (`importSubjects`) and `apps/apis/convex/content/importBatches.ts`.

## Cause

`content/seed:seed` failed on 2026-10-15 at about 74% host CPU with `Function execution timed out (maximum duration: 1s)`; the unchanged rerun passed. The limit applies to a mutation's `userExecutionTime`. `Date.now` is frozen inside a mutation, so the numbers below come from the backend's own function log (`/api/stream_function_logs`: `userExecutionTime`, `usageStats`), captured by `local-validation/platform-5-t1/run.mjs`.

`importSubjects` was the only seed mutation near the limit. On an idle host it ran a 377 ms maximum; on a loaded host it hit 1005 ms and timed out. Two causes:

- Per record it ran about five full canonicalize, hash and `jsonValueSchema` passes over the document (`validateDocument`: a JSON round trip, three `jsonValueSchema.parse` calls and three canonicalize-and-hash passes), on top of its database work.
- Batching bounded only record count (10) and payload (128 KiB) and gave each Class its own batch. A 10-record batch of ordinary records cost about 250 ms idle, which a loaded host stretches 4 to 6 times.

Idle fit before the fix, from `usageStats` regression: about 25 ms per record plus about 1 ms per KiB of document.

## Fix

- `validateDocument` (used by `importSubjects`, `importDefinitions` and `bootstrap`) canonicalizes the document once. That one string serves the parse-parity check, the checksum check and, in `importSubjects`, storage. The same two errors in the same order (`Canonical content conflict.`, then `Canonical checksum mismatch.`), still raised only for a new subject; a replay is still proved by the exact comparison with the stored root and version. One difference: canonicalizing throws on an `undefined`-valued key that the old JSON round trip silently dropped. Zod keeps absent optional keys absent and Convex arguments cannot carry `undefined`, so no corpus or test document hits it.
- `sourceImportBatches` packs records to a cost budget (25 per record plus 1 per KiB, budget 100, in idle milliseconds) instead of a fixed count. A Class always gets a batch alone: its document is the largest, and a Subclass re-reads and parses its parent Class document.
- No limit raised, no retry, no catch, no smaller corpus. The manifest, the import contract in `packages/schema`, and the idempotency and atomicity behaviour (PLATFORM-5.2, 5.3) are untouched; batches still commit independently and an exact rerun inserts nothing.

## Measurements (backend execution records, 1057 subjects and 60 definitions, fresh backend each run)

Maximum `userExecutionTime` per mutation, in ms. Limit 1000.

| Mutation | Before idle | Before loaded (16 burners) | After idle | After loaded (12 burners) |
| --- | --- | --- | --- | --- |
| `bootstrap` | 199 | 322 | 76 | 160 |
| `importSubjects` | 377 | **1005, timed out** | 151 | 308 |
| `importDefinitions` | 101 | not reached | 85 | 98 |
| `syncClassDerived` | 60 | not reached | 37 | 53 |
| `raceRelationships.syncDerived` | 85 | not reached | 60 | 93 |
| `syncEquipmentDerived` | 212 | not reached | 97 | 222 |

- **Margin reached:** the largest mutation after the fix is `importSubjects` at 151 ms idle (6.6 times under the limit, from 377) and 308 ms loaded (3.2 times under; the loaded run completed and audited green).
- **Before, loaded:** 16 busy-loop processes on 16 logical CPUs. The seed failed at the 121st `importSubjects` call.
- **After, loaded:** 12 busy-loop processes on 16 CPUs (about 75% load, the incident's level). The 16-process run cannot finish a seed within the 300 s limit of the HTTP call that `convex run` makes, independent of the mutation limit.
- **Same 16-process load on the final code** (`fix2-loaded`, same batching as the final code): every one of the 385 `importSubjects` calls finished, maximum 717 ms (a single 155 KiB base Class document, also its OCC retry at 661 ms), 1005 ms before. That is the tightest margin seen and it is under a deliberately oversubscribed host. Every non-Class batch stayed at or under 480 ms there.
- **Idle `importSubjects` calls before the fix** were 136 and are now 390; the seed's wall time is unchanged (128 s before, 117 s after idle).

## Proofs

- Red: `local-validation/platform-5-t1/base-loaded.run.log` and `base-loaded.summary.txt` (timeout at 1005 ms); `red-importBatches.log` (an earlier draft of the batching tests, which imported the new cost exports; four of its five tests failed on the old batcher). In the final tests, "packs records to the cost budget", "isolates a record costing more than the budget" and "weights by UTF-8 bytes" need the new exports and fail on the old code; "isolates every Class record" and the order test pass on both, as they pin behaviour the change keeps.
- Green: `fix5-idle.summary.txt` and `fix5-loaded.summary.txt` on the final code (seed success, audit exit 0 in `fix5-audit.log`; the table above). `fix4-*` is the same measurement before the post-review `validateDocument` reshape (idle 179 ms, loaded 343 ms); `green-import-tests.log` (`importBatches`, `import`, `importSpell`, `importCreatureVehicle`, `seed`, `seedAudit`: 29 tests pass).
- CI: `ci/platform-5-t1`, see the workbook status log.

## Observed, outside this slice

- `contentSnapshots/heads:readScopeKind` (a query) timed out at 1000 ms in `fix1-idle` (once), `fix1-loaded` and `fix2-loaded` (three times each); `contentSnapshots/actions:build` then errors and is retried by its schedule. It runs after seed writes, not inside the seed. It needs its own measurement; follow-up registered in the workbook.
- `content/import:readSubjects`, used by the seed audit, peaked at 540 ms in the 12-process loaded run (168 ms idle); a query has the same 1 s limit.
- `convex codegen`'s schema evaluation timed out once at about 71% ambient host CPU (`fix2-idle.run.log`); the measurement script now waits for the host to calm below 35%.
- `convex run content/seed:seed` gives up client-side after about 300 s, so a seed on a heavily loaded host can fail there with no server error; the harness calls the same action over `node:http` to avoid that.
