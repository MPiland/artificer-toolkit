# PLATFORM-13.T5: corpus-scale Convex journey timings (2026-10-15)

**Status:** done for AC PLATFORM-13.7. Three changes landed (builder snapshot parity, custody step loop, custody test split under the main-session ruling). Serial CI (run 38821517298, green) has no Convex test above 50% of its timeout once runner noise is normalised (see below), and the 3-worker dispatch trial 38823259068 is green. No further cut removes work an assertion reads.

## Machine and commands

- CI (GitHub-hosted `ubuntu-latest`, `.github/workflows/tests.yml`, 4 Convex shards). Local Windows timings were not used: other sessions' load inflated them 2 to 3 times.
- Figures are per-test durations from the vitest `✓` lines of each shard's job log (`local-validation/platform-13-t5/`, untracked).

| Run         | Ref                                                        | Workers | Purpose            | Result                                                                                                                                 |
| ----------- | ---------------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 38792840212 | `ci/platform-13-t5` at the base before any cut (67435d6cd) | 1       | Before             | Wall 14 m 57 s; `developmentLifecycleProof` failed on a base defect that the merged base later fixed                                   |
| 38814606154 | `ci/platform-13-t5` at 3485f1d72 (both cuts)               | 1       | After              | Green; wall 17 m 16 s; Convex shards 11 m 37 s, 15 m 29 s, 12 m 14 s, 7 m 36 s                                                         |
| 38812568410 | `ci/platform-13-t5` before the cuts, merged base           | 3       | Trial, before cuts | Green; wall 10 m 42 s; Convex shards 7 m 23 s, 4 m 41 s, 7 m 23 s, 7 m 33 s                                                            |
| 38816855225 | `ci/platform-13-t5` at 40310628f (both cuts)               | 3       | Trial, after cuts  | **Red:** one timeout (custody mixed driver, 38.6 s against 30 s); wall 10 m 02 s; Convex shards 7 m 30 s, 5 m 20 s, 6 m 36 s, 7 m 54 s |
| 38821517298 | `ci/platform-13-t5` at 32c544804 (all three changes)       | 1       | After, final       | Green; per-test figures in the second table                                                                                            |
| 38823259068 | `ci/platform-13-t5` at 32c544804                           | 3       | Trial, final       | **Green;** wall about 9 m 43 s; Convex shards about 5 m 20 s to 8 m 02 s                                                               |

## Runner noise

Hosted runners vary a lot between runs. Against the baseline, the median per-job ratio of file times in run 38814606154 ranged from 0.58 to 1.76 across the four shards. The merged base also carries other slices' product changes (for example `seed.audit` now reads `readClassDerived` for every Class), so only the two files this slice edited (`builderSnapshotParity`, `developmentCustody`) compare cleanly between 38792840212 and 38814606154. Raw "after" figures for the others (seedAudit, catalogueReadBudget, equipmentLimits) rose because of the slow shards and the base, not because of this slice. A single CI run cannot prove "below 50% serially" for a test near the limit; the judgement below normalises for the shard.

## Per-test figures (ms)

Slowest test per target, with its share of its timeout. "Before" is run 38792840212; "After" is 38814606154 (1 worker); "Trial" is 38812568410 (3 workers, before the cuts).

| Test                                       | Timeout      | Before               | After  | Share (after) | Trial  | Note                                                                                                                                |
| ------------------------------------------ | ------------ | -------------------- | ------ | ------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `builderSnapshotParity`, parity test       | 240 s        | 65428                | 39640  | 17%           | 110682 | **Cut:** 40% faster serially                                                                                                        |
| `developmentCustody`, mixed driver         | 30 s         | 11926                | 20770  | 69% raw       | 24155  | Shard ran 1.76 times slower than the baseline; normalised about 11.8 s (39%). Cut saves 4 of about 18 full custody reads; see below |
| `developmentCustody`, currency lifecycle   | 120 s        | 20870                | 39508  | 33%           | 40656  | Same slow shard                                                                                                                     |
| `equipmentLimits`, 500-option journey      | 240 s        | 67000                | 132223 | 55% raw       | 154847 | Stays full scale (AC). Slow shard; normalised about 75 s (31%)                                                                      |
| `commitReferencedContext`, S5 corpus       | 300 to 600 s | 100578               | 54081  | 9 to 18%      | 171290 |                                                                                                                                     |
| `equipmentCharacter`, Equipment loss       | 240 s        | 44844                | 24220  | 10%           | 74687  |                                                                                                                                     |
| `equipmentCharacter`, independent fixtures | 240 s        | 42120                | 22831  | 10%           | 53202  |                                                                                                                                     |
| `seed`                                     | 240 s        | 79343                | 80287  | 33%           | 84474  | Cost is the `seed` action itself (about 45 s in convex-test)                                                                        |
| `seedAudit`                                | 240 s        | 43260                | 77540  | 32%           | 82878  | Base now also audits every Class's derived data                                                                                     |
| `catalogueReadBudget`                      | 900 s        | 26833                | 47490  | 5%            | 50150  |                                                                                                                                     |
| `developmentLifecycleProof`                | 180 s        | failed (base defect) | 75388  | 42%           | 74608  | Fixed by the merged base                                                                                                            |
| `commitReadBudget`                         | 600 s        | 17883                | 18082  | 3%            | 27639  |                                                                                                                                     |
| `encounterWriteSets`, START                | 1200 s       | 17793                | 10288  | 1%            | 31888  |                                                                                                                                     |

Media: `authoredAssets` (17 tests) takes 8.7 s on CI, `avatar` 1.85 s. The 6 s avatar stall seen locally is a Windows artefact, so there is no media fixture cut.

## Cuts made

1. **`builderSnapshotParity`** (3485f1d72): `evaluateBuilderCandidate` takes an optional memo of scope reads, so the parity test reads each scope's stable data once instead of once per scenario. Only callers whose content is unchanged between scenarios share the memo; `sourceChangeJourney` and the other callers read afresh. Assertions unchanged.
2. **`developmentCustody`** (40310628f): `verifyCharacterCustody` starts each step from the state the previous step's replay read already proved unchanged, instead of re-reading it. Every assertion is kept, including each replay `deepEqual`.
3. **Custody split** (3d6276ab0, 32c544804; main-session ruling (b)): the 32-row bounded-cleanup proof moved out of the mixed driver into its own test, "validates a durable bounded Vehicle cleanup receipt before removing the cohort". `verifyCampaignInventory` takes `boundedCleanup` (default true, so the live `--campaign-inventory` proof and `developmentInventoryProof.test.ts` are unchanged); `verifyCampaignCustody` passes `false`, so the Vehicle lifecycle proof runs against a party that holds a handful of items instead of 36 to 38. Every assertion survives in one of the two tests; the map is in the workbook ("Custody split: assertion map").

## Cuts ruled out

- **`equipmentCharacter` seed sharing:** test 1 asserts six receipts across the database, so a shared seed would make it order dependent.
- **`seed` / `seedAudit`:** `prepareSrdImport()` is already computed once per file. The remaining cost is the CLI-only `seed` action, which a test cannot skip; speeding it up is a product change and would need its own failing test.
- **`equipmentLimits`:** the 500-visible-option capacity journey must stay full scale.
- **Development harness page size:** `numItems: 8` is shared with live local-Convex proofs and kept.
- **Media fixtures:** already cheap on CI.

## Final figures (ms)

"Split after" is run 38821517298 (1 worker, final head); "Trial" is 38823259068 (3 workers, final head). Share is of the test's timeout, serial.

| Test                                             | Timeout      | Before               | Split after | Share     | Trial (3 workers) |
| ------------------------------------------------ | ------------ | -------------------- | ----------- | --------- | ----------------- |
| `builderSnapshotParity`, parity test             | 240 s        | 65428                | 30397       | 13%       | not parsed        |
| `developmentCustody`, mixed driver               | 30 s         | 11926                | 8614        | 29%       | 14499             |
| `developmentCustody`, durable bounded test (new) | 30 s         | n/a                  | 2841        | 9%        | 5258              |
| `developmentCustody`, currency lifecycle         | 120 s        | 20870                | 32490       | 27%       | 49350             |
| `equipmentLimits`, 500-option journey            | 240 s        | 67000                | 118614      | 49% raw   | 168002            |
| `commitReferencedContext`, S5 corpus             | 300 to 600 s | 100578               | 108302      | 18 to 36% | 121226            |
| `equipmentCharacter`, Equipment loss             | 240 s        | 44844                | 43956       | 18%       | 56878             |
| `equipmentCharacter`, independent fixtures       | 240 s        | 42120                | 40614       | 17%       | 41503             |
| `seed`                                           | 240 s        | 79343                | 65734       | 27%       | 65009             |
| `seedAudit`                                      | 240 s        | 43260                | 68573       | 29%       | 86267             |
| `catalogueReadBudget`                            | 900 s        | 26833                | 42217       | 5%        | 70715             |
| `developmentLifecycleProof`                      | 180 s        | failed (base defect) | 73176       | 41%       | 75734             |

The custody mixed driver is the only test that was near its limit; it is 29% serially and 48% with three workers. The 500-option journey is 49% serially on a slow shard (about 31% when normalised for the shard, see Runner noise) and 70% with three workers; it stays under its limit in both runs and must stay full scale (AC).

## 3-worker trial

| Run         | Head            | Result                                                                                                               | Wall           | Convex shards 1 to 4                   |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------- |
| 38812568410 | before the cuts | Green                                                                                                                | 10 m 42 s      | 7 m 23 s, 4 m 41 s, 7 m 23 s, 7 m 33 s |
| 38816855225 | 40310628f       | **Failed:** `developmentCustody` mixed driver timed out (38657 ms, 30 s timeout); 551 of 552 tests in shard 3 passed | 10 m 02 s      | 7 m 30 s, 5 m 20 s, 6 m 36 s, 7 m 54 s |
| 38823259068 | 32c544804       | **Green**                                                                                                            | about 9 m 43 s | about 5 m 20 s to 8 m 02 s             |

The failure at 40310628f was a real finding, not a rerun candidate: the mixed driver ran 24 to 39 s with three workers on a 4-vCPU runner. The split removed the 32 added Vehicle items from the lifecycle proof's reads (the page size is a product bound of 8 rows, so each full party read was 5 sequential queries over 36 to 38 items). The mixed driver now takes 14.5 s with three workers and the new bounded test 5.3 s.

### Where the mixed-driver time went (before the split)

- By query (local profile): `partyInventory:items` 260 calls, 13.2 s (about 40% of the test); `vehicleInventory:items` 117 calls, 4.5 s; `vehicleInventory:currencies` 102 calls, 4.2 s; `inventoryAudit:list` 115 calls, 3.6 s.
- Not cuttable under T5's rules: the 32 adds (the AC is the bound; kept in the new test), the page size (the product caps it at 8), and any read whose result an assertion compares.

## Remaining risk

- Serial CI figures move with runner speed (median per-job ratios 0.58 to 1.76); only files this slice edited compare cleanly with the baseline.
- The live `--campaign-custody` proof (`tests/developmentDrafts.ts`) now covers the immediate Vehicle evacuation tail only; the durable-receipt check in `convex/campaigns/developmentCustody.ts` is exercised by the convex-test bounded test, not the live proof. The live `--campaign-inventory` proof still runs the bounded path.
- The `seed` action costs about 45 s per file that calls it (CLI-only provisioning); a faster seed is a product change.
- Other username redraw loops (`developmentDrafts.ts`, `developmentCampaignMembershipLifecycle.ts`) do not use the validated generator yet (T7 covers `accountJourneys.test.ts` and `localAuth.ts`).
