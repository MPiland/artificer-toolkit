# Phase 8.2 foundation progress — 2026-09-29

**Status:** focused local foundation and Sheet acknowledgement checks passed, including the native active-handler concurrency proof. This is not an acceptance decision or final-source release lifecycle. The [acceptance JSON](../roadmap/08-2-convex-cutover-acceptance.json) remains authoritative at 51/75 accepted. Source identity at the recorded HEAD was `33b34e19019726bbf1cacf234499050e4172546b`; the working tree was dirty and no final source manifest was frozen.

## Implemented foundation

- Character play state now uses typed `CharacterPlayStates.state` in place of `playJson`, while retaining the canonical checksum.
- Typed operational storage is implemented as a head plus build, play, and nine owned collections. Assembly, row, and head checksums are canonical; list reads use head and play records.
- The active Sheet path no longer queries the full Builder draft.
- Local R2 snapshot tests use a fixture bridge with the existing scope token, raw gzip payloads, and loopback-only enforcement.
- Test runner shards were kept serial, with `GOMAXPROCS=2`.

## Sheet acknowledgement and notes slice

The public personal and Campaign command contract now uses the strict compact acknowledgement `{ characterId, streamVersion, historyEntry?, result? }`. Full Sheet state remains only in the private transitional Encounter execution path. Six private note/group commands use the shared reducer and canonical writer without rules or source hydration; they preserve mechanical values, clocks, replay, privacy, and the implicit Campaign lifecycle fence. Rollback and deletion-fence regressions cover those boundaries. The unused `getCharacterSheetActions` full-query selector was removed.

The serial focused batch passed **160 API tests across 28 files**, **13 web tests across 3 files**, and **18 reducer tests in 1 file**. The final serial native Convex and web-config compiler passed 12 Turbo tasks. Analysis/codegen passed, then a separate explicit local deploy activated the handlers; codegen alone does not activate functions.

The first native concurrency attempt failed because it reached old handlers that returned full Sheet state. That result is retained as a superseded failure. After the explicit local deploy, the active-handler proof passed concurrent writes, exact replay, SDK resubscription at `streamVersion` 6, fixture cleanup, and stale-JWT denial. Source parity reports `matches: true`, with 5,326 entries and no changed or added paths: `local-validation/local-convex-proofs/phase82-sheet-ack-concurrency-active-20260929.source-parity.json`.

For eight baseline behaviors, local instrumentation against a mocked Convex internal transaction recorded about **75–80 KB / 39–41 documents**. A compact HP acknowledgement measured **288 B** versus **18.3 KB** for internal execution. The new public note path measured **15 documents, 13,066 UTF-8 JSON bytes, a 279 B acknowledgement, and 3.6 ms** in local instrumentation. These figures exclude actual billed overhead and are not production latency or billing claims. Aggregate baseline data: `local-validation/phase82-sheet-access/baseline.json`.

Logs are retained under ignored `local-validation/phase82-sheet-ack/`: `transactions-final.log`, `web-final.log`, `reducer-final.log`, `typecheck-final.log`, `local-codegen.log`, `local-deploy.log`, `native-concurrency.log` (superseded failure), and `native-concurrency-active.log` (passing proof). The earlier compiler log is `typecheck-2.log`. Full native proof artifacts are under `local-validation/local-convex-proofs/phase82-sheet-ack-concurrency-active-20260929.*`.

## Earlier typed-storage verification

The typed-storage batch passed **6 shared contract tests across 2 files** and **68 API tests across 12 files**. Rules and Encounter runtimes were rebuilt. Its serial native Convex and web-config compiler passed 10 tasks, and local analysis/codegen completed. Its initial native concurrency proof reached the previously deployed handlers, so it did not prove the new typed storage. The later explicit deploy and active-handler concurrency proof above provide that evidence. The snapshot bridge focused test passed. The existing local Docker Convex container and volume were reused.

The local database was reseeded and audited: **1,057 subjects, 59 definitions, and one System**. Its seed manifest SHA-256 is `50737e51d18ec58badb8226c454c971df3c3b05fe6f716683d85b661a11119f2`.

Complete logs are retained under ignored `local-validation/`:

- `phase82-character-persistence/{build-final-foundation,operational-contracts-final,operational-transactions-final,typecheck-operational-convex-4,local-operational-codegen,local-operational-seed,local-operational-audit,local-operational-concurrency}.log`
- `phase82-local-snapshots/delivery.log`
- `local-convex-proofs/phase82-typed-character-concurrency-20260929.*`

The guarded reset removed 22 nonempty tables. Its before-state archive remains `local-validation/convex-reset/phase82-typed-character-20260929.before.zip`.

## Remaining boundary

Focused Sheet DTOs and component subscriptions are implemented locally: COMMON is visible state;
ACTIONS, SPELLS, INVENTORY, EXTRAS, FEATURES and NOTES load for their active surfaces and release
inactive subscriptions. NOTES reads only its owned families and validates complete counts recorded
atomically on the checksummed Build record. Tests reject missing first, last and all note/group rows.
Mechanical queries still assemble the complete Character; HP's narrow read gate remains open.

The room's S10 foundation loads authorized SOURCE/CAMPAIGN index and document objects from R2 before
SQLite hydration. Scope, hash, canonical JSON, UTF-8/gzip, size, row count/order and document System
checks fail closed. Matching cached SQLite inputs can reload content after hibernation with zero
Convex calls, then serve repeated reads without either content or Convex calls. Native rules planning
still uses captures, so S10 remains open. System/vocabulary keep their revision-bound input path.

Focused checks passed 19 Convex tests in 3 files, 44 Worker/delta tests in 4 files, the web app/test/story
typechecks, Convex typechecks, and the repaired Worker typecheck (7 Turbo tasks). The frontend batch
passed 167 of 168 tests; its unobserved-cache receipt harness was corrected to hold a real subscription,
and all 6 tests in that file then passed. The native Durable Object batch initially passed 96 of 99
tests; the three failures identified missing/new-epoch room-input fetch fixtures. After repair, all
99 tests in its 2 files passed, including replacement-epoch hydration and authorization revocation.
Logs are retained under `local-validation/phase82-sheet-slices/` and
`local-validation/phase82-room-content/`; complete failing logs are retained alongside repaired runs.
Shared delta contracts now live in schema, preserving the existing pending-snapshot codec and raw own
JSON keys. Its strict validation and round-trip tests are included in the 44-test batch.

Snapshot browser proof, native S10 planning, checkpoints, live authority, budgets and the full lifecycle
remain required. These focused checks accept no ledger case. The HEAD remains
`33b34e19019726bbf1cacf234499050e4172546b`, the working tree is dirty, and no final release source manifest
was frozen. This provides no managed promotion, production or retirement evidence.

## Later focused local evidence

The native Character slice concurrency/reconnect proof passed exact replay, SDK resubscription at
streamVersion 6, fixture cleanup and stale-JWT denial. Its source-parity record reports 5,336 entries,
`matches: true`, and no changed or added paths. Evidence:
`local-validation/phase82-sheet-slices/native-character-slices.log` and
`local-validation/local-convex-proofs/phase82-sheet-slices-character-20260929.{source-parity.json,exit.txt}`.

The focused NOTES query measured 6 documents and 3,984 UTF-8 JSON bytes. It read no inventory,
currency, spell, extra or authored-content families. This is local instrumentation, excluding billed
overhead and hosted latency. Evidence: `local-validation/phase82-sheet-access/baseline.json`
(`focusedQueryMeasurements`) and `local-validation/phase82-sheet-slices/baseline-notes-query.log`.

Original publication pins are retained in v2 content snapshot contracts. Focused contract/runtime
checks passed 28 tests across 5 files, and API build/input checks passed 33 tests across 3 files:
`local-validation/phase82-content-snapshot-v2/{contract-runtime-tests,api-build-inputs-tests}.log`.

Room Character preparation and parent access checks passed 6 tests across 2 files. Coverage includes
capture-equivalent source identities/numeric versions, private source ownership, wrong-epoch refusal
and source invalidation. Repeated preparation after warm hydration adds no Convex, HTTP capture,
content-loader or R2 object reads. Evidence:
`local-validation/phase82-room-character-parity/preparation-and-parents.log`.

Checkpoint journal checks passed 30 unit tests and 8 native Durable Object tests after the minimum
byte budget was corrected to 2, the size of an empty JSON array. Evidence:
`local-validation/phase82-integrated-contracts/{journal-unit,journal-native}.log`.

These focused records accept no additional ledger case: acceptance remains 51/75. The final source
is not frozen. Broader S3/S5/S6 integration, HP query narrowing, budgets and the complete local
lifecycle remain open.

## Checkpoint records and local seed repair

The shared Encounter table contracts now live in Schema. The room can read its verified SQLite
checkpoint baseline and derive public-identity deltas plus immutable history from the committed
journal. Focused checks passed 19 record-builder tests, 47 store/delta tests and 7 database-schema
boundary tests. Integrated Schema, Encounter persistence, API, Worker and web typechecks passed.
Logs: `local-validation/phase82-checkpoint-records/` and
`local-validation/phase82-checkpoint-records-integrated/`. The checkpoint backend writer and live
authority switch remain unfinished.

[D70](../adr/0035-room-authoritative-live-encounters.md#d70-packed-history-with-indexed-receipt-headers--2026-09-29)
records **Codex as the decision maker**, with user approval on 2026-09-29: pack immutable history
payloads in checksummed ledgers and retain small indexed receipt headers. It preserves current replay,
collision checks, privacy and UUID timeline pagination. Ledger/header I/O remains in Q16.

The first v2 seed attempt failed with Equipment-derived writes contending on the same snapshot head
and exceeding Convex's mutation execution limit. Full failure logs remain under
`local-validation/phase82-integrated-contracts/`; the safe function-metadata projection is
`v2-seed-function-metadata.json`. Serializing those writes fixed the root cause. After local codegen
and an explicit local deploy, a fresh guarded reset and the first seed attempt passed with 1,119
inserted records and zero reused records. Audit confirmed 1,057 subjects, 59 definitions and one System,
with the same canonical manifest checksum above. Logs and exit codes:
`local-validation/phase82-seed-repair/{local-codegen,local-deploy,reset,seed,audit}.{log,exit}`.
The backup remains `local-validation/convex-reset/phase82-seed-serial-20260929.before.zip`.

The reused UTF-8 payload chunk helper now lives in Shared. Focused import/schema tests passed 29 tests
in three files, and API/Worker typechecks passed ten Turbo tasks. Canonical JSON now preserves own
`__proto__` fields and refuses enumerable accessors without executing them; all six focused tests
passed (`local-validation/phase82-canonical-integrity/canonical-json-retry.log`). These later helper
changes still require the next integrated build and native push. No final-source lifecycle or managed
promotion evidence is claimed.

The D70 codec foundation passed canonical inline and oversized binary round-trips, pointer identity,
corruption, scope and stable tombstone checks. The focused codec/contract batch passed 66 tests in five
files, and integrated Schema, Encounter persistence, API and Worker typechecks passed 12 Turbo tasks.
Logs: `local-validation/phase82-ledger-codec/{codec-and-contracts,typecheck}.log`. This implements no
Convex ledger/header writer or cleanup yet.

The first browser-preparation deploy failed before browser execution because native schema evaluation
exceeded one second. Inspection found four rules-barrel imports in the full database schema graph.
They now use existing constants/checksum leaves; the complete schema loads no executable rules kernel.
All eight schema-boundary tests passed, and the exported database schema remains byte-identical:
465,417 bytes, SHA-256 `dbaa946c6bbeb38dbc0368ec8d072fc29764b640e3fa8c9d36a28c7a4f58dd7a`.
The failed deploy remains `local-validation/phase82-snapshot-browser/local-deploy.log`; repaired
profiling and test evidence is under `local-validation/phase82-ledger-codec/`. A new native deploy
and the snapshot browser journey remain required.

## Receipt headers and later native failures

The four scalar receipt-header contracts and codec header projection passed focused builds,
Schema/Encounter persistence typechecks, and 26 tests across two files. Coverage includes all Run
command tags, existing indexed fields, body exclusion, pointer identity/checksums, Character UUID
validation, and preallocation bounds of 4 MiB, 16,000 slots and 18 parts. Logs and exit codes:
`local-validation/phase82-receipt-headers/{build,typecheck,tests}.{log,exit}`. Native storage, adapter
and Character call-site drafts remain ignored review artifacts; the physical database cutover has
not landed.

The schema import repair subsequently passed local codegen and an explicit local deploy:
`local-validation/phase82-snapshot-browser-repaired/{local-codegen,local-deploy}.{log,exit}`.
Worker startup then found an invalid local snapshot-token secret. It was provisioned in memory on
the local deployment; only variable names and validity booleans were retained in
`local-validation/phase82-local-secret-repair/metadata.json`.

Later native pushes failed the four-second module evaluation limit. The failures remain in
`local-validation/phase82-snapshot-browser-provisioned/local-deploy.log` and
`local-validation/phase82-snapshot-browser-load-recheck/local-codegen.log`. Comparing current bundles
with the active local functions found zero changed modules among 1,001 current modules; this is
handler identity evidence, not a replacement for a successful final native push.

The first active-source Builder browser run failed before Character Name appeared. Its screen showed
"Preparing content", and cleanup hit a native query timeout. Source parity passed with 5,348 entries.
Evidence: `local-validation/phase82-snapshot-browser-active-source/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-matched-20260929.*`.
The test's readiness helper now waits for the rendered panel within its existing 60-second allowance,
instead of treating the navigation-shell timing mark as content readiness. The rerun failed before
browser startup: concurrent invitation redemption returned 200/500 instead of 200/400 after native
timeouts. Active module comparison again found zero changes, and source parity passed with 5,350
entries. Evidence: `local-validation/phase82-snapshot-browser-panel-ready/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-panel-ready-20260929.*`.

Safe resource inspection found approximately 6 GB resident backend memory, 2 GB swapped, about
112 MiB available in WSL and no free swap. This supports memory pressure as a local validation risk;
it does not establish an application fix. Automatic approval review rejected the proposed existing
container restart and R2 fixture preservation/restoration because of service interruption and
potential in-memory fixture loss under the release runbook. The recovery command did not run.
The user subsequently approved one restart with R2 preservation/restoration. The existing container
was restarted once on 2026-09-30; its identity and mounts were preserved and the database was not reset.
All 51 referenced R2 objects (2,096,529 bytes) were backed up, restored and verified by checksum and
metadata. The original recovery runner failed its readiness probe; the backend later became ready at
`/instance_name`. Evidence: `local-validation/phase82-backend-memory-recovery/recovery.json`.

The recovered-source local codegen and explicit deploy both passed. The Builder proof then timed out
after 50 minutes before Chromium started; invitation redemption and exact fixture cleanup passed.
Source parity passed with 5,350 entries. Evidence:
`local-validation/phase82-snapshot-browser-recovered/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-recovered-20260930.*`.
Source inspection found Playwright's initial existing-server probe outside its web-server timeout.
The local readiness probe now requests the existing static bootstrap asset; application navigation
remains part of the browser journey. The next proof verified HTTP 200 within 36 ms and reached
Chromium, then failed at the content-loading boundary. All eight public SOURCE indexes returned
503; native manifest/System queries succeeded and fixture cleanup and source parity passed.
Evidence: `local-validation/phase82-snapshot-browser-static-ready/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-static-ready-20260930.*`.

A minimal real-workerd probe isolated the cause: the installed runtime rejects `redirect: 'error'`,
which the Node fixture test accepted. Changing local fixture fetches to `manual` retains rejection
of non-200 responses and prevents redirects. The same probe then read the stored gzip object
successfully (200, 240 bytes). Evidence: `local-validation/phase82-snapshot-delivery-probe/`.
The eight focused native snapshot tests passed, including native Request validation, exact raw gzip
delivery and redirect rejection. The serial Turbo Worker typecheck passed. Logs and exit codes:
`local-validation/phase82-snapshot-redirect/{native-tests,typecheck}.{log,exit}`.
The next complete Builder attempt still received 503s for public indexes; cleanup and source parity
passed. Evidence: `local-validation/phase82-snapshot-browser-redirect-fixed/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-redirect-fixed-20260930.*`.
Repeating the real-workerd probe with the repository configuration isolated a second cause:
Wrangler rewrites local request hostnames to the configured production route. The loopback-only
fixture guard correctly refused that hostname. The development command now uses `--host localhost`;
the same configured probe then returned 200 with hostname `localhost`. The guard stays intact.
Evidence: `local-validation/phase82-snapshot-delivery-probe/probe-host-fixed.exit` and `result.json`.
The next Builder attempt delivered all 12 requested public SOURCE index/document objects with
HTTP 200 and completed the multiclass selections and ready-to-activate review. It then timed out
waiting for a redirect after Save Draft. ADR 0036 S8 now opens the draft and navigates on entry;
manual saves flush the existing draft without navigation. The test expectation requires repair.
Exact fixture cleanup and source parity (5,350 entries) passed. Evidence:
`local-validation/phase82-snapshot-browser-host-fixed/` and
`local-validation/local-convex-proofs/phase82-snapshot-v2-builder-host-fixed-20260930.*`.
The complete Builder journey remains pending.
Acceptance remains 51/75; no final-source lifecycle or managed promotion evidence is claimed.
