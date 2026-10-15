# PLATFORM-13.T5: corpus-scale Convex journey timings (2026-10-15)

**Status:** done for AC PLATFORM-13.7. Two cuts landed (builder snapshot parity, custody step loop). Every other target was already below 50% of its timeout on a serial CI run; no further cut removes work an assertion reads.

## Machine and commands

- CI (GitHub-hosted `ubuntu-latest`, `.github/workflows/tests.yml`, 4 Convex shards). Local Windows timings were not used: other sessions' load inflated them 2 to 3 times.
- Figures are per-test durations from the vitest `✓` lines of each shard's job log (`local-validation/platform-13-t5/`, untracked).

| Run | Ref | Workers | Purpose | Result |
| --- | --- | --- | --- | --- |
| 38792840212 | `ci/platform-13-t5` at the base before any cut (67435d6cd) | 1 | Before | Wall 14 m 57 s; `developmentLifecycleProof` failed on a base defect that the merged base later fixed |
| 38814606154 | `ci/platform-13-t5` at 3485f1d72 (both cuts) | 1 | After | Green; wall 17 m 16 s; Convex shards 11 m 37 s, 15 m 29 s, 12 m 14 s, 7 m 36 s |
| 38812568410 | `ci/platform-13-t5` before the cuts, merged base | 3 | Trial, before cuts | Green; wall 10 m 42 s; Convex shards 7 m 23 s, 4 m 41 s, 7 m 23 s, 7 m 33 s |
| 38816855225 | `ci/platform-13-t5` at 40310628f (both cuts) | 3 | Trial, after cuts | **Red:** one timeout (custody mixed driver, 38.6 s against 30 s); wall 10 m 02 s; Convex shards 7 m 30 s, 5 m 20 s, 6 m 36 s, 7 m 54 s |

## Runner noise

Hosted runners vary a lot between runs. Against the baseline, the median per-job ratio of file times in run 38814606154 ranged from 0.58 to 1.76 across the four shards. The merged base also carries other slices' product changes (for example `seed.audit` now reads `readClassDerived` for every Class), so only the two files this slice edited (`builderSnapshotParity`, `developmentCustody`) compare cleanly between 38792840212 and 38814606154. Raw "after" figures for the others (seedAudit, catalogueReadBudget, equipmentLimits) rose because of the slow shards and the base, not because of this slice. A single CI run cannot prove "below 50% serially" for a test near the limit; the judgement below normalises for the shard.

## Per-test figures (ms)

Slowest test per target, with its share of its timeout. "Before" is run 38792840212; "After" is 38814606154 (1 worker); "Trial" is 38812568410 (3 workers, before the cuts).

| Test | Timeout | Before | After | Share (after) | Trial | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `builderSnapshotParity`, parity test | 240 s | 65428 | 39640 | 17% | 110682 | **Cut:** 40% faster serially |
| `developmentCustody`, mixed driver | 30 s | 11926 | 20770 | 69% raw | 24155 | Shard ran 1.76 times slower than the baseline; normalised about 11.8 s (39%). Cut saves 4 of about 18 full custody reads; see below |
| `developmentCustody`, currency lifecycle | 120 s | 20870 | 39508 | 33% | 40656 | Same slow shard |
| `equipmentLimits`, 500-option journey | 240 s | 67000 | 132223 | 55% raw | 154847 | Stays full scale (AC). Slow shard; normalised about 75 s (31%) |
| `commitReferencedContext`, S5 corpus | 300 to 600 s | 100578 | 54081 | 9 to 18% | 171290 | |
| `equipmentCharacter`, Equipment loss | 240 s | 44844 | 24220 | 10% | 74687 | |
| `equipmentCharacter`, independent fixtures | 240 s | 42120 | 22831 | 10% | 53202 | |
| `seed` | 240 s | 79343 | 80287 | 33% | 84474 | Cost is the `seed` action itself (about 45 s in convex-test) |
| `seedAudit` | 240 s | 43260 | 77540 | 32% | 82878 | Base now also audits every Class's derived data |
| `catalogueReadBudget` | 900 s | 26833 | 47490 | 5% | 50150 | |
| `developmentLifecycleProof` | 180 s | failed (base defect) | 75388 | 42% | 74608 | Fixed by the merged base |
| `commitReadBudget` | 600 s | 17883 | 18082 | 3% | 27639 | |
| `encounterWriteSets`, START | 1200 s | 17793 | 10288 | 1% | 31888 | |

Media: `authoredAssets` (17 tests) takes 8.7 s on CI, `avatar` 1.85 s. The 6 s avatar stall seen locally is a Windows artefact, so there is no media fixture cut.

## Cuts made

1. **`builderSnapshotParity`** (3485f1d72): `evaluateBuilderCandidate` takes an optional memo of scope reads, so the parity test reads each scope's stable data once instead of once per scenario. Only callers whose content is unchanged between scenarios share the memo; `sourceChangeJourney` and the other callers read afresh. Assertions unchanged.
2. **`developmentCustody`** (40310628f): `verifyCharacterCustody` starts each step from the state the previous step's replay read already proved unchanged, instead of re-reading it. Every assertion is kept, including each replay `deepEqual`.

## Cuts ruled out

- **`equipmentCharacter` seed sharing:** test 1 asserts six receipts across the database, so a shared seed would make it order dependent.
- **`seed` / `seedAudit`:** `prepareSrdImport()` is already computed once per file. The remaining cost is the CLI-only `seed` action, which a test cannot skip; speeding it up is a product change and would need its own failing test.
- **`equipmentLimits`:** the 500-visible-option capacity journey must stay full scale.
- **Development harness page size:** `numItems: 8` is shared with live local-Convex proofs and kept.
- **Media fixtures:** already cheap on CI.

## Remaining risk

The custody mixed-driver test (30 s timeout, set in the test) runs about 12 s serially on an average runner (40%) but 21 s on a slow 1-worker shard and 24 to 39 s with three workers. The goal "green 3-worker trial" is **not met** until that test is either given more time, split, or made cheaper in product code (cheaper party item pages). Each needs a ruling outside T5's allowed cuts; see the escalation in the workbook status log.

## 3-worker trial

| Run | Cuts | Result | Wall | Convex shards 1 to 4 |
| --- | --- | --- | --- | --- |
| 38812568410 | none | Green | 10 m 42 s | 7 m 23 s, 4 m 41 s, 7 m 23 s, 7 m 33 s |
| 38816855225 | both | **Failed**: `developmentCustody` mixed driver timed out (38657 ms, 30 s timeout); 551 of 552 tests in shard 3 passed | 10 m 02 s | 7 m 30 s, 5 m 20 s, 6 m 36 s, 7 m 54 s |

The mixed-driver test (24.2 s in the first trial, 38.7 s in the second) is not stable under three workers on a 4-vCPU runner. It is a real finding, not a rerun candidate.

### Where the mixed-driver time goes

- Stages (local, relative only): inventory proof 4.5 s, character custody 4.4 s, Vehicle lifecycle the remaining and largest share.
- By query (profile): `partyInventory:items` 260 calls, 13.2 s (about 40% of the test); `vehicleInventory:items` 117 calls, 4.5 s; `vehicleInventory:currencies` 102 calls, 4.2 s; `inventoryAudit:list` 115 calls, 3.6 s.
- Why the party read is the largest: the inventory proof adds 32 Vehicle items to prove the bounded-cleanup path (`vehicleCleanup.ts` treats a Vehicle as ordinary only up to 32 rows). Unsharing then returns that cargo to the party, which holds 36 to 38 items for every later read. The product pages at most 8 rows (`maximumRowsRead: 8` in `readCampaignItemPage`), so each full party read is 5 sequential page queries, and the Vehicle lifecycle proof runs about 30 full reads.
- Not cuttable under T5's rules: the 32 adds (the AC is the bound), the page size (the product caps it at 8), and any read whose result an assertion compares. Reusing a read proven equal by the preceding replay (done in `verifyCharacterCustody`) saves one read in the lifecycle harness, which is under 4%.
