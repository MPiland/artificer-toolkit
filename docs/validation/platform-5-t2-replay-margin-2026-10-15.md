# PLATFORM-5.T2: reseed over a seeded backend stays under the 1 s limit (2026-10-15)

Closes the replay half of AC PLATFORM-5.7 (the fresh-backend half is [PLATFORM-5.T1](platform-5-t1-seed-mutation-margin-2026-10-15.md)). Staging and production releases reseed by replay: `content/seed:seed` over an already-seeded backend takes the `current` branch of `importSubjects` and the `current` branches of `bootstrap` and `importDefinitions`.

## Method

Same harness and load profile as T1: `local-validation/platform-5-t1/run.mjs` (the backend's own function log, `userExecutionTime`), one fresh reset and seed, then three reseeds of the unchanged backend: idle, 12 busy-loop processes (about 75% of 16 CPUs, the incident's load) and 16 busy-loop processes (full saturation). Driver: `local-validation/platform-5-t2/measure-replay.ps1`, heavy lane. 1057 subjects and 60 definitions, so 379 `importSubjects` batches on replay and on a fresh seed alike (the fresh-seed function logs show 389 or 390 entries, probably retried executions).

## Measurements

Maximum `userExecutionTime` per mutation, in ms. Limit 1000. "Before" is the T1 code (`base-*` logs), "after" the final T2 code (`final-*` logs).

| Mutation (replay) | Before idle | Before 12 burners | After idle | After 12 burners |
| --- | --- | --- | --- | --- |
| `bootstrap` | 68 | 65 | 47 | 59 |
| `importSubjects` | 174 | 221 | 138 | 208 |
| `importDefinitions` | 70 | 99 | 121 | 88 |
| `syncClassDerived` | 29 | 53 | 32 | 44 |
| `raceRelationships.syncDerived` | 71 | 66 | 50 | 184 |
| `syncEquipmentDerived` | 86 | 170 | 140 | 289 |

- **Margin reached on replay:** every mutation is at most 289 ms at 12 burners (3.5 times under the limit; `syncEquipmentDerived`), `importSubjects` at most 208 ms. A fresh seed on the same code peaked at 167 ms for `importSubjects` (`final-fresh`).
- **Run-to-run noise is as large as the differences above.** A maximum over 20 to 379 calls moves by 50 to 100 ms between identical runs (for example `importDefinitions` 70 to 121 ms idle, `syncEquipmentDerived` 86 to 140 ms idle). `importSubjects` per-call distribution, replay (ms):

  | Run | calls | sum | p50 | p90 | p99 | max |
  | --- | --- | --- | --- | --- | --- | --- |
  | before, idle | 379 | 24281 | 55 | 97 | 155 | 174 |
  | after, idle | 379 | 24010 | 58 | 92 | 114 | 138 |
  | before, 12 burners | 379 | 31757 | 75 | 123 | 186 | 221 |
  | after, 12 burners | 379 | 31598 | 74 | 121 | 174 | 208 |

## What the replay path costs, and what did not help

The brief proposed comparing a replayed subject by stored checksum instead of the whole-document `exact()` (stored-document read, two schema parses, two canonicalizations) and skipping the canonicalize at `import.ts:219-222`. Measured:

- **Skipping the canonicalize on replay** is kept: `documentJson` is now computed only when a subject is inserted (`validateDocument` moved into the insert branch). It is pure waste on replay. Moving the validation changes one thing: for a new subject that is invalid in two ways, the parent, orphan or route-id error can now precede the content or checksum error. Atomicity and idempotency are unchanged.
- **Dropping the stored-document comparison did not lower the replay time**, so it was reverted. Variant measured (`fix-*` logs): the replay hashed the incoming document against its checksum and compared nothing else of the stored document. The slowest base-idle call read 45 KB, and the variant's largest read was still 253 KB, so the read volume did not drop where it mattered, and the distribution did not move: idle sum 24213 ms against 24281 ms, p50 57 against 55 ms; at 12 burners sum 34218 against 31757 ms, p50 81 against 75 ms. Replay time is dominated by the derived-fact work that every replay still does (schema parse, compilation, authoring-source and catalogue facts, each compared with the stored value), not by the document comparison. The variant also removed the check that the stored document equals the incoming one. With no measured gain, the stronger check stays.
- The new test "refuses a replayed subject whose document changed, under its old or a new checksum" (`import.test.ts`) pins the contract that a changed document is refused on replay (`Canonical content conflict.`) and writes nothing. It passes on the old and the new code: the change keeps behaviour, so there is no red run for it. **It does not isolate the stored-document `exact()`:** with that line removed the test still passes (`pin-green.log`, `pin-red.log`), because the root comparison (new checksum) and the stored compilation, authoring-source and catalogue comparisons (old checksum) refuse the change first. The stored-document comparison is therefore redundant for the cases tested, and no test shows it firing alone. It stays (it costs no measurable time and is the direct statement of the invariant); whether it can be dropped is an open question for a follow-up, not decided here. A red run existed only for the reverted variant (`red-import.log`: the stale-checksum case answered `Canonical content conflict.` instead of `Canonical checksum mismatch.`).

## Proofs

- Baseline (before): `local-validation/platform-5-t2/base-replay-idle.summary.txt`, `base-replay-loaded12.summary.txt`.
- Final (after): `final-replay-idle.summary.txt`, `final-replay-loaded12.summary.txt`, `final-fresh.summary.txt`; audit exit 0 in `final-audit.log`; `final-measure.summary.log` lists the exits. Scoped tests: `green-final.log` (`import.test.ts`, `importBatches.test.ts`: 24 pass).
- Variant evidence: `fix-*.summary.txt`, `red-import.log`, `green-import.log`.
- CI: `ci/platform-5-t2` run 38835861992 (commit 4e1ec51b0) green.

## Observed, outside this slice

- **16 busy-loop processes** (full saturation): the reseed cannot finish within the harness's 300 s limit (empty error at 300 s, before and after the change); the mutations that ran stayed at or under 630 ms before (`importSubjects`; `syncEquipmentDerived` 410) and 608 ms after (`syncEquipmentDerived` 382). In the variant run one `importSubjects` call timed out at 1012 ms: an ordinary three-record batch that read 42 KB and 17 documents, not a Class. At that load a host stall can hit any call whatever the batch size, so this is a tail risk of the oversubscribed profile (T1 had no timeout at 16 burners on a fresh seed, maximum 717 ms), not a property of the replay path. The T1 and T2 acceptance profile is 12 burners.
- `content/import:readSubjects` (the audit query the seed runs last) appears in the idle and 12-burner replay summaries with a maximum identical to the fresh seed's and an `executionTime` of 0, which marks entries not recorded in that window; this record does not use them. At 16 burners it reached 683 ms (`final-replay-loaded16`); its 12-burner value is in the T1 record (248 ms). A query has the same 1 s limit.
- `contentSnapshots/heads:readScopeKind` hit 1000 ms in the fresh seeds again (`base-fresh`, `fix-fresh`), and 1002 ms with one error in `final-fresh` (also one error in `contentSnapshots/actions:build`); follow-up already registered by T1.
- Replay writes nothing: `databaseWriteDocuments` sums to 0 in the replay execution logs, and the audit ends green against the manifest checksum (`final-audit.log`).
- Replay compares the parsed document, not the raw one (pre-existing, unchanged).
