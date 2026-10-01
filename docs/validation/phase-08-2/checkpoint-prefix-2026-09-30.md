# Acknowledged checkpoint prefix — 2026-09-30

**Status:** focused local foundation proof passed. S3 publication, Scene/fog integration,
shadow parity, live authority and the final-source lifecycle remain pending. The acceptance ledger
remains 51/75; these checks accept no new case.

The shared acknowledgement contract carries epoch, sequence and checksum. `RoomEncounterStore.compact`
requires that acknowledgement and verifies it against the retained snapshot and committed journal.
It creates a snapshot at that prefix and deletes only covered journal rows in one SQLite transaction.
Later commands, live state, opaque records and identity counters remain intact. The checkpoint caller
must supply the authenticated Convex acknowledgement; this internal method does not publish to Convex.

An exact acknowledgement retry writes no rows. Foreign epochs, stale/out-of-range sequences,
invalid checksums, an open command and corrupt snapshot/journal data fail without compaction.
Hydration replaces all previous-epoch logs. `checkpointSnapshot` also returns defensive copies of
the opaque records required to reconstruct the base.

All commands ran serially under `local-validation/.validation.lock`, with `GOMAXPROCS=2`.
Full output, native exit codes and scoped source hashes are retained under
`local-validation/phase82-checkpoint-prefix/`.

| Order | Command | Result | Retained log |
| --- | --- | --- | --- |
| 1 | `yarn build:schema --concurrency=1 --env-mode=loose` | Exit 0; 3/3 tasks | `schema-build.log` |
| 2 | `yarn vitest run --config vitest.config.ts apps/session-worker/src/roomEncounterStore.test.ts apps/session-worker/src/roomCheckpointRecords.test.ts --maxWorkers=1 --no-file-parallelism` | Exit 0; 58/58 tests | `unit-tests.log` |
| 3 | `yarn workspace @artificer-toolkit/session-worker test test/nativeRoomEncounterStore.test.ts` | Exit 0; 10/10 tests on real workerd SQLite | `native-tests.log` |
| 4 | `yarn turbo run typecheck --filter=@artificer-toolkit/session-worker --concurrency=1 --env-mode=loose` | Exit 0; 7/7 tasks | `typecheck.log` |

The native proof exercises 11 and 100 actors: acknowledge command 1 after commands 2 and 3,
retain the suffix, evict, recover the exact current aggregate, continue with command 4, acknowledge
the final state and recover again. Unit checks additionally cover opaque record updates/deletion,
more than one journal page, SQLite rollback during snapshot replacement, invalid fences, corruption
and replacing a partially compacted epoch. Existing identity-counter and row-write proofs pass.

`source-and-commands.json` records HEAD `33b34e19019726bbf1cacf234499050e4172546b`, the dirty tree,
the four changed contract/store/test file hashes and ordered commands. Its SHA-256 is
`b69a9961c5e2c351c4bb9facdc174ede29e9128f5343c38b34d1184509ac8984`.
This scoped proof is not the final release manifest. The new contract has no Convex imports and
changes no database schema or deployed Convex function.

Compaction verifies the retained journal in bounded pages, so total work scales with retained rows.
The native row thresholds pass; V15/Q16 must still measure integrated checkpoint CPU and I/O.
The existing third-party profanity sourcemap warning and Turbo typecheck-output configuration warning
remain in the logs. No touched-code type or test warning was introduced.
