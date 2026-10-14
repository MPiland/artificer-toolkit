# PLATFORM-13.T1: per-file test timings (baseline 2026-10-14, partial)

**Status:** partial baseline. The parallelism trial and the full-suite timing record are deferred to the end of Phase 8.2 (user ruling 2026-10-14: timing baselines run once, at the end, unless a single test shows a real Convex or Cloudflare platform issue). The per-file fixes in this note are done.

## Machine and commands

- Windows 11, 8 physical cores / 16 logical, 15.5 GB RAM, vitest 4.1.11. The machine is shared with Docker (local Convex) and other slice sessions; every run held `local-validation/.validation.lock`, so no other validation batch ran at the same time. Background load from Docker and idle sessions was still present.
- Reporter: `--reporter=default --reporter=json --outputFile.json=<file>`. Per-file figures are vitest's per-file test time (module import is reported separately in the run summary).
- Raw logs and JSON: `local-validation/platform-13-t1/` (untracked, not committed).

| Suite | Command | Result | Wall |
| --- | --- | --- | --- |
| Root packages | `yarn vitest run --config vitest.config.ts` | 279/280 files, 2635/2636 tests; 1 failure (see below) | 86 s (vitest 78 s) |
| Session worker | `yarn workspace @artificer-toolkit/session-worker test` | 49/49 files, 603/603 tests | 222 s |
| Convex (serial, current config) | `yarn workspace @artificer-toolkit/apis test:convex` | 380/380 files, 2278/2278 tests | 3604 s (vitest 3599 s; summed test time 2808 s, import 688 s) |

Package build before the runs: 20 s (`yarn turbo run build --concurrency=1 --env-mode=loose` over schema, shared, rules-runtime, authoring, encounter-persistence, source-data).

## Convex suite: slowest 20 files (serial, 3604 s)

The suite is dominated by a few journey-style tests. The top 11 files hold 970 s of 2808 s of test time; every one has a single test of 40 to 120 s.

| Test s | Tests | Mean s | Slowest s | File |
| --- | --- | --- | --- | --- |
| 150.5 | 17 | 8.9 | 24.4 | `media/authoredAssets.test.ts` |
| 124.6 | 2 | 62.3 | 119.5 | `content/equipmentLimits.test.ts` (full-SRD 500-visible-option capacity journey) |
| 110.6 | 1 | 110.6 | 110.6 | `encounters/developmentLifecycleProof.test.ts` |
| 102.0 | 2 | 51.0 | 100.2 | `characters/commitReferencedContext.test.ts` (S5 corpus) |
| 85.2 | 7 | 12.2 | 39.4 | `campaigns/developmentCustody.test.ts` |
| 81.7 | 3 | 27.2 | 42.4 | `content/equipmentCharacter.test.ts` |
| 76.9 | 2 | 38.4 | 75.2 | `content/seed.test.ts` (seeds and replays the whole canonical corpus; calls `prepareSrdImport()` per assertion) |
| 64.5 | 1 | 64.5 | 64.5 | `content/seedAudit.test.ts` (stale or partial corpus; calls `prepareSrdImport()`) |
| 61.6 | 3 | 20.5 | 61.0 | `characters/builderSnapshotParity.test.ts` (SRD, Homebrew and lost-content parity) |
| 51.7 | 5 | 10.3 | 18.3 | `media/library.test.ts` |
| 41.7 | 1 | 41.7 | 41.7 | `content/catalogueReadBudget.test.ts` |
| 35.4 | 28 | 1.3 | 3.5 | `campaigns/vehicleCleanup.test.ts` |
| 34.3 | 19 | 1.8 | 4.6 | `encounters/turnDeathSave.test.ts` |
| 32.4 | 7 | 4.6 | 14.1 | `media/avatar.test.ts` |
| 28.9 | 11 | 2.6 | 6.5 | `content/classPublication.test.ts` |
| 27.2 | 3 | 9.1 | 14.5 | `media/characterPortrait.test.ts` |
| 25.1 | 21 | 1.2 | 6.5 | `encounters/srdCreatureHitRiders.test.ts` |
| 24.5 | 22 | 1.1 | 4.7 | `encounters/basicActions.test.ts` |
| 24.4 | 12 | 2.0 | 5.0 | `encounters/actionDisarm.test.ts` |
| 23.2 | 9 | 2.6 | 6.8 | `encounters/turnConcentration.test.ts` |

What the numbers show (causes inside each file are not yet profiled, so these are leads, not findings):

- Rows 1 to 11 are corpus-scale journeys (full SRD seed, 500-option capacity, snapshot parity, lifecycle proofs). A faster suite needs smaller fixtures or cheaper seeding for these, not parallelism alone.
- `media/*` files average 5 to 9 s per test with 17 and 7 tests: per-test fixture setup (convex-test instance over every module, local R2, image processing) is the likely cost. `authoredAssets.test.ts` builds its fixture in `beforeEach`.
- `seed.test.ts` and `seedAudit.test.ts` re-run the full `prepareSrdImport()` inside assertions.
- Module import adds 688 s across 380 files (about 1.8 s per file) on top of the 2808 s of test time.

## Root package suite: slowest files (loaded run, 8 files in parallel)

| Test s | Tests | File |
| --- | --- | --- |
| 62.6 | 2 | `rules-runtime/src/__tests__/srdCreatureAttackSweep.test.ts` |
| 21.8 | 2 | `schema/src/__tests__/lazy-schemas.test.ts` |
| 20.9 | 6 | `source-data/src/srd/import.test.ts` (1 test timed out at 5 s) |
| 15.0 | 9 | `rules-runtime/src/__tests__/contentSnapshots.test.ts` |
| 11.9 | 10 | `rules-runtime/src/__tests__/builderCatalogueAssembly.test.ts` |
| 9.9 | 48 | `session-worker/src/roomEncounterStore.test.ts` |
| 7.1 | 2 | `rules-runtime/src/__tests__/creatureSrdArmorClass.test.ts` |
| 7.0 | 3 | `session-worker/src/deployedEnvironmentGuard.test.ts` |
| 6.5 | 15 | `rules-runtime/src/__tests__/srdCreatureHitRiders.test.ts` |
| 4.3 | 19 | `session-worker/src/roomCheckpoints.test.ts` |
| 3.8 | 1 | `source-data/src/__tests__/cloneAuthoredItem.test.ts` |
| 3.7 | 24 | `rules-runtime/src/__tests__/encounterLegendaryAction.test.ts` |

Total summed per-file test time 231 s over 280 files. Run in isolation the same three heaviest touched files take 16.5 s (sweep), 3.2 s (contentSnapshots) and 3.8 s (import), so the loaded figures above are dominated by CPU contention between parallel threads, not by the files' own work.

## Worker suite: slowest files (49 files, summed test time 192 s)

| Test s | Tests | File |
| --- | --- | --- |
| 32.8 | 76 | `test/nativeRoomAreaAction.test.ts` |
| 22.4 | 123 | `test/nativeLiveSessionRoom.test.ts` |
| 20.2 | 28 | `test/nativeCharacterSheet.test.ts` |
| 11.7 | 32 | `test/nativeTransientFanout.test.ts` |
| 9.0 | 17 | `test/nativeRoomHitRiders.test.ts` |
| 7.8 | 17 | `test/nativeRoomChosenConcentrationEnd.test.ts` |
| 7.8 | 16 | `test/nativeMovementEvidence.test.ts` |
| 6.2 | 16 | `test/nativeRoomEscapeAction.test.ts` |
| 6.1 | 19 | `test/nativeRoomConcentration.test.ts` |
| 5.3 | 8 | `test/nativeRoomAntitoxinGrant.test.ts` |

The worker suite runs with `--maxWorkers=1 --no-isolate`, as configured.

## Fix: `import.test.ts` 5 s timeout under load

The loaded root run timed out `canonical Convex import preparation > publishes the canonical concentration maintenance definition with its damage graph link` at the default 5 s. It called the full `prepareSrdImport()` (every authored subject, all kinds) only to read two reusable definitions and the catalogue's `gameSystemId`. PLATFORM-13.6 (ed74dea56) bounded the Q11 test to `prepareSrdDefinitions` but left this test on the full path. It now shares a `preparedDefinitions()` helper with the Q11 test and reads `SRD_RULES_CATALOGUE.gameSystemId` directly. No timeout was changed. Product code is unchanged.

The existing 20 s timeout on `preserves every authored root and separate policy definition deterministically` was not touched: it prepares the full corpus twice by design (reordered determinism check).

## Module-load `prepareSrdImport()`: tried, no gain, reverted

Three files prepare the full SRD at module load: `contentSnapshots.test.ts`, `srdCreatureAttackSweep.test.ts` and the web `builderSnapshot.fixtures.ts`. A trial change (commit 7a4495546) made each lazy or bounded to the kinds it reads, using `prepareSrdImport`'s existing bundle and definitions parameters (`prepareSrdDefinitions` does not apply: these files read authored subjects). The measurements below showed no gain, and the sweep and fixture changes stopped preparing the full seeded corpus that those files say they read "the way Blueprint creation reads them". The three files were restored to base; only the `import.test.ts` fix stays. The module-load item moves to the end-of-phase speed work.

### Before and after the trial change (touched files only, run serially, warm transform cache)

Before is base `754a44402`; after is the trial commit 7a4495546 (now reverted for the three module-load files; the `import.test.ts` row is the kept fix). Each cell is the file's test time from the default reporter. The very first "after" run was cold-cache and is excluded from the table (62 s root, 54 s web wall); two warm "after" runs are shown.

| File | Before | After (run 1 / run 2) |
| --- | --- | --- |
| `srdCreatureAttackSweep.test.ts` | 16.5 s | 17.4 s / 15.6 s |
| `contentSnapshots.test.ts` | 3.2 s | 4.7 s / 4.4 s |
| `import.test.ts` | 3.8 s | 3.0 s / 2.8 s |
| Root invocation, three files (wall) | 36.3 s | 47.7 s / 33.8 s |
| Web invocation, two files using the fixtures (wall) | 21.8 s | 24.7 s / 20.5 s |
| Web invocation, import time (sum) | 38.4 s | 38.8 s / 36.0 s |

Reading: the module-load removal does not make these files measurably faster. Collection no longer pays for the preparation, but the work moves into the first test that needs it (`contentSnapshots` +1.2 s in test time, as expected, since its round-trip test needs all eight kinds). The sweep's time is its own 2 tests, not preparation. The web fixture still builds `srdSnapshot` at module load by design; narrowing it to five kinds saved little. Decision: no gain, reverted. The real gain from this slice is the `import.test.ts` timeout fix (3.8 s to 2.8 to 3.0 s isolated, and a bounded path that no longer scales with the full corpus under load).

## Deferred to the end of Phase 8.2

- Parallelism trial for the Convex suite (2, 4, then the physical-core cap of 8; three consecutive clean runs for the kept setting; free memory and paging recorded; a run that swaps or times out is a rejection). A first 8-way run was queued and cancelled before it started; no parallel data exists yet.
- Full-suite timing record, including a loaded root-package run as proof that the `import.test.ts` fix holds at the default 5 s timeout.
- Convex suite speed work, starting from the top-20 table above.
- Module-load `prepareSrdImport()` in the three files above: revisit only with a change that keeps the full seeded corpus (for example a shared, cached prepared corpus), since subsetting gained nothing.
