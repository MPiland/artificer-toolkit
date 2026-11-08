# PERF-6.T1 hot Convex function profile (2026-11-07)

PERF-6.T1 builds the evidence for AC PERF-6.1 (hot Convex functions stay small and fast). It
profiles; it changes no product code. The timing targets are query p95 ≤ 250 ms and mutation p95 ≤
500 ms on CI. The hard gate will be deterministic read budgets in convex-test.

## Sources and method

- **Timings.** Tests runs use in-process convex-test and record no Convex timings, so the timings
  come from the native execution capture (`*.native-executions.jsonl`) of the last three Browser
  journeys merge runs on the phase branch:

  | Batch | Run         |
  | ----- | ----------- |
  | m650  | 42419796742 |
  | m651  | 42423317835 |
  | m652  | 42434982477 |

  Together they hold 228 capture files and 182,687 completions. Cached results and duplicate
  execution ids are skipped. `executionTime` is total time; `userExecutionTime` is the time spent
  in the isolate's JS. A timeout is an error matching "Function execution timed out". The capture
  reports zero reads for a timed-out call.

- **Contention caveat.** The Browser journeys stack (Convex backend, Session Worker, web app,
  browsers) shares 4 vCPUs. Execution time includes CPU queueing: `account:session` reads 3
  documents at a user p50 of 20 ms but reaches an execution max of 1,698 ms. User time is the better
  cost signal, and it is inflated too. Of the 89 queries and mutations with an execution max over
  500 ms, 17 are trivial (user p95 < 250 ms and fewer than 50 documents) and are contention only.
- **Module floor.** Convex evaluates a function's whole module graph on every call (D59). Each
  module is bundled with the Convex bundler's options (`functionBundleBudget.test.ts`). The bundle
  is then evaluated 12 times in fresh `vm` contexts with a warm code cache, and its evaluation is
  CPU-profiled. These local floors match the CI minimum user times closely, which validates the
  method (table below).
- **Reads and compute.** User time is bucketed by documents read per call, from the same capture.
  For the Sheet functions, a local convex-test harness times the product functions directly. It
  also counts their reads with `tests/fixtures/databaseIo.ts` and CPU-profiles them by package.
  The harness was run locally and not committed, because the CI read counts already exist.

## Hot list

These are the queries and mutations with a timeout, or with user time large enough to miss the
target outside contention. Columns:

- **exec** and **user** are p50 / p95 / max in ms.
- **docs** and **KB** are p50 / max reads per call.
- **TO** is the number of timeouts.

| Function                                     | Kind         |    n | exec              | user              | docs       | KB         |  TO |
| -------------------------------------------- | ------------ | ---: | ----------------- | ----------------- | ---------- | ---------- | --: |
| `campaigns/characterSheet:basics`            | Q            |  186 | 719 / 1910 / 2149 | 644 / 1213 / 1342 | 54 / 55    | 93 / 94    |  72 |
| `characters/sheetSlices:get`                 | Q            | 1928 | 209 / 766 / 2596  | 168 / 577 / 1219  | 26 / 363   | 70 / 843   |  22 |
| `characters/sheetSectionDerivation:store`    | M            | 1218 | 306 / 747 / 1476  | 264 / 643 / 1274  | 58 / 342   | 142 / 779  |  20 |
| `content/classPublication:readSourceRows`    | Q (internal) |  580 | 136 / 797 / 1324  | 124 / 675 / 1003  | 4 / 750    | 33 / 790   |   2 |
| `campaigns/accountDeparture:step`            | M            |  378 | 224 / 346 / 1132  | 220 / 342 / 1008  | 3 / 666    | 1 / 901    |   2 |
| `authoring/nodeRuntime:resolve`              | Q            |  190 | 424 / 939 / 1235  | 287 / 675 / 971   | 714 / 1460 | 790 / 2106 |   0 |
| `encounters/activeReads:active`              | Q            |  342 | 314 / 718 / 1111  | 259 / 599 / 970   | 67 / 103   | 121 / 302  |   0 |
| `campaigns/queries:get`                      | Q            | 1355 | 148 / 914 / 2118  | 82 / 515 / 958    | 12 / 25    | 5 / 9      |   0 |
| `contentSnapshots/heads:readScopeKind`       | Q (internal) | 2934 | 172 / 343 / 1026  | 167 / 333 / 954   | 1 / 61     | 0 / 256    |   0 |
| `contentSnapshots/heads:readBuildStart`      | Q (internal) |  786 | 199 / 331 / 984   | 195 / 321 / 758   | 2 / 2      | 1 / 2      |   0 |
| `campaigns/membershipDeparture:leave`        | M            |   36 | 258 / 1009 / 1031 | 234 / 844 / 859   | 6 / 1506   | 2 / 2165   |   0 |
| `campaigns/membershipDeparture:removeMember` | M            |   51 | 257 / 827 / 997   | 244 / 679 / 806   | 7 / 1585   | 3 / 2300   |   0 |
| `characters/development:sheetSectionsState`  | Q            |  716 | 145 / 545 / 1119  | 127 / 473 / 902   | 31 / 57    | 77 / 137   |   0 |
| `campaigns/assignments:assign`               | M            |  172 | 416 / 570 / 658   | 311 / 451 / 509   | 484 / 1415 | 717 / 2106 |   0 |
| `campaigns/characterSheet:execute`           | M            |   78 | 446 / 540 / 641   | 403 / 489 / 570   | 90 / 96    | 219 / 226  |   0 |
| `characters/sheetCommands:execute`           | M            |  669 | 279 / 473 / 709   | 245 / 408 / 612   | 92 / 372   | 216 / 1018 |   0 |
| `content/publication:publishDraft`           | M            | 1122 | 199 / 367 / 814   | 154 / 306 / 544   | 43 / 1584  | 86 / 2634  |   0 |
| `campaigns/contentShares:unshare`            | M            |   54 | 229 / 519 / 714   | 28 / 40 / 45      | 19 / 1765  | 8 / 2881   |   0 |
| `campaigns/characterSheet:get`               | Q            |  180 | 148 / 324 / 763   | 134 / 294 / 698   | 20 / 73    | 24 / 112   |   0 |

- `campaigns/queries:get` has no timeouts. Its 360 errors are "Campaign not found" reads after a
  journey removes its campaign.
- `contentShares:unshare` has a user p95 of 40 ms. Its execution time is contention, but it reads
  up to 1,765 documents through the same share-removal path as the two departure mutations.
- The full list of 89 queries and mutations with an execution max over 500 ms is in the appendix.
  Actions and HTTP actions are excluded, because their time limit is different.

## Where the time goes

### Module floor per call

| Module                              | Bundle KB | Local eval p50 / min (ms) | CI min user (ms) |
| ----------------------------------- | --------: | ------------------------- | ---------------: |
| `campaigns/characterSheet`          |     3,160 | 144 / 104                 |               80 |
| `campaigns/accountDeparture`        |     3,713 | 153 / 137                 |              111 |
| `contentSnapshots/heads`            |     1,518 | 110 / 83                  |               65 |
| `content/classPublication`          |     2,036 | 47 / 41                   |               43 |
| `characters/sheetSlices`            |     1,922 | 42 / 37                   |               32 |
| `characters/sheetSectionDerivation` |     2,518 | 36 / 31                   |               42 |
| `authoring/nodeRuntime`             |     1,152 | 34 / 27                   |                – |
| `characters/sheet`                  |     1,908 | 30 / 26                   |                – |
| `campaigns/queries`                 |     1,259 | 14 / 13                   |               19 |
| `encounters/activeReads`            |     2,155 | 10 / 9                    |               29 |
| `account`                           |       416 | 5 / 4                     |                – |
| the app `schema.ts` alone           |     1,385 | 58 / 43                   |                – |

The profile spreads the floor across these costs:

- zod core initialisation and zod mini/core schema construction;
- the convex-helpers `zodToConvexCommon` and `zodToConvexInner` calls that module top levels make
  for `args` and `returns`;
- Convex validator construction;
- garbage collection.

Bundles also carry two copies of zod: the root `node_modules/zod` and
`apps/apis/node_modules/zod`.

Two causes stand out:

- **The app schema in function modules.** `contentSnapshots/heads.ts:20` imports `../schema` for the
  convex-helpers `stream` at `heads.ts:256`. `campaigns/vehicleCleanup.ts:2` imports it for
  `paginator` at `vehicleCleanup.ts:115`. `accountDeparture` reaches `vehicleCleanup` through
  `contentShareRemoval` → `contentRemovalFinalization` → `vehicleCleanup`. Evaluating the app schema
  costs 43–58 ms per call. `readScopeKind` reads one document at a user p50 of 167 ms, and
  `readBuildStart` reads two at 195 ms. They are almost all floor, and they run thousands of times.
- **The Sheet command and panel validators in `campaigns/characterSheet`.** `basics` shares its
  module with `get`, `panel`, `preparationOptions` and `execute`. The bundle holds rules-runtime
  (1,051 KB) and schema (1,104 KB). The largest project contributors to its evaluation are:
  - the schema modules `api/characterSheet.ts`, `characterSheetPanel.ts`, `characterSheetData.ts`
    and `characterSheetCommandInputs.ts`;
  - `characters/sheetCommandValidator.ts`.

  Each costs about 4–5 ms locally.

### Local convex-test split (Sheet functions)

The harness ran each product function 8 times after a warm-up and took the median. The CPU
profile (`--cpu-prof`, 500 µs sampling) is split into each scenario's time window. There are two
fixtures:

- **SRD Cleric:** a level 1 Life Domain Cleric with the whole SRD imported, as in
  `sheetReadBudget.test.ts`. It has no campaign.
- **Run:** `setupCharacterRun()`, a small Character in a campaign with a GM and an active Run.

convex-test emulates the database in JS. Its read path (the `convex-test` and `convex-lib` buckets)
therefore overstates the cost of reads relative to a real backend. The product-compute buckets
(rules-runtime, shared, schema, zod and apis) are the comparable part.

| Scenario                              | Wall p50 (ms) | CPU per call (ms) | Reads                      | Writes           | Product compute (ms)                                 |
| ------------------------------------- | ------------: | ----------------: | -------------------------- | ---------------- | ---------------------------------------------------- |
| SRD derivation (`loadCharacterSheet`) |           131 |               115 | 274 docs / 485 KB          | –                | ~25: prepare 13–16, zod 10, projection 1             |
| SRD first `store` (no derivation row) |           146 |               129 | 276 docs / 485 KB          | 49 docs / 175 KB | ~30: as above, plus `writeCharacterSheetSections` 10 |
| SRD `store` over current inputs       |             4 |                 3 | 11 docs / 55 KB            | –                | < 1                                                  |
| SRD slice hit (COMMON / SPELLS)       |        9 / 15 |            9 / 13 | 12 docs / 66–79 KB         | –                | ~2                                                   |
| SRD slice miss (COMMON)               |           142 |               124 | the derivation's           | –                | ~25                                                  |
| Run `basics` (GM / player)            |       20 / 18 |           18 / 16 | 43 docs / 84 KB            | –                | ~14: prepare 7–8, zod 4–5                            |
| Run `characterSheet:get`              |            23 |                21 | about the same as `basics` | –                | ~14                                                  |
| Run slice hit / miss (COMMON)         |       10 / 24 |            9 / 21 | –                          | –                | ~2 / ~14                                             |
| Run first `store`                     |            53 |                47 | 125 docs / 278 KB          | 89 docs / 201 KB | `writeCharacterSheetSections` 23                     |

What the harness shows:

- **Projection is cheap.** `projectCharacterSheetFacts` takes about 1 ms per call. Running it
  once per viewer in `store` costs little.
- **The derivation's cost is its reads, then `prepareCharacterSheetFromContext`.** On the SRD
  Cleric, 111 `authoredRoots` documents (296 KB) and 105 `authoredSpellClasses` documents (18 KB)
  make up the Cleric Spell list. That is 61% of the bytes and 79% of the documents.
- **Rules-runtime re-validates its own data with zod on every derivation.**
  `characterRulePolicyOutputSchema.parse` (`rules-runtime/src/systems/dnd5e/characterPolicy.ts:154`)
  costs about 5 ms. `characterGrantFoldInputSchema.parse` and `characterGrantFoldOutputSchema.parse`
  (`characterGrantFold.ts:102` and `:557`) cost 2–3 ms. Together they are about a third of product
  compute.
- **A stored hit reads the 34 KB System document.** That is about half of a hit's bytes, read for
  the fingerprint. The other reads are the Character rows, the derivation row and the section.
- **A first store of a campaign Character writes 88 sections.** These cover the owner, the GM and
  party views, slices and panels. Later stores rewrite only the sections that changed.

The harness is a lower bound: CI Characters differ, and the CI isolate pays the module floor on
every call. Local per-call cost is the floor plus CPU, and CI user time is about 3–4 times that
under contention:

| Function  | Local floor + CPU (ms) | CI user p50 (ms) |
| --------- | ---------------------- | ---------------: |
| slice hit | 37–42 + 9–13           |              168 |
| `basics`  | 104–144 + 16–18        |              644 |

### Per function

- **`campaigns/characterSheet:basics` (72 timeouts, the worst function).**
  - **What it does.** It returns four identity fields (label, class summary, total level, Sheet
    visibility), yet `campaigns/characterSheet.ts:97` calls `readCampaignCharacterSheetForMember`
    (`:61`). That runs `loadCharacterSheet` (`characters/sheetPreparation.ts:11`), a full rules
    derivation, and never reads a stored section.
  - **Per call.** The 104–144 ms module floor of the 3.2 MB `campaigns/characterSheet` bundle is
    about 85% of a local call. The derivation is 16–18 ms CPU over 43 documents and 84 KB, close to
    CI's 54 documents and 93 KB.
  - **Fan-out.** `CampaignParty.tsx:66` subscribes one `basics` query per assigned Character for
    every member. Each one reads the System, sources and effects, so any write to them reruns every
    one at once, beside the COMMON slice reads on the same page. Bursts of concurrent calls then
    contend for the same CPUs. `characterSheet:get` runs in the same module and does the same
    derivation, yet its CI user p50 is 134 ms against `basics`' 644 ms. The burst is the difference.
  - **Dominant cost.** The module floor, multiplied by the fan-out burst. The derivation is
    secondary.
- **`characters/sheetSlices:get` (22 timeouts).**
  - **Stored hit.** `sheetSlices.ts:97` serves a stored section through
    `readStoredCharacterSheetSection` (`sheetSections.ts:183`). That reads the authorized state, the
    derivation row and the section row. It also reads the full fingerprint
    (`readCharacterSheetFingerprint`, `sheetSections.ts:83`: the System, sources, active and carried
    effects, content heads, campaign state and currency options), then checksums it and runs
    `JSON.parse`. At 10–40 documents, user time is p50 160 ms and p95 366 ms.
  - **Miss.** On a miss it falls back to `loadCharacterSheet` (`sheetSlices.ts:105`), the same full
    derivation as `basics`. At 40–80 documents, user time is p50 224 ms and p95 861 ms; at 80–200 it
    is p50 515 ms. The 45 timeouts across all runs sit at about 70 documents. The heavy tail is the
    miss path: a read that lands between a write and its scheduled `store`.
  - **Harness.** A hit costs 7–13 ms of CPU over 12 documents. A miss costs 124 ms on the SRD
    Cleric.
  - **Dominant cost.** On misses, the derivation's reads. On hits, the 32–42 ms module floor, with
    the fingerprint's System read second.
- **`characters/sheetSectionDerivation:store` (20 timeouts).**
  - **Steps.** `deriveAndStoreCharacterSheet` (`sheetSectionDerivation.ts:129`) checks the
    fingerprint. It then derives once and runs `storeCharacterSheetSections` (`:58`), which does the
    following for each viewer context (the owner, plus the GM when the GM is a different user):
    - runs `projectCharacterSheetFacts` again (`:90`), which evaluates the active grant rules and
      projects the bundle;
    - projects every slice;
    - projects every panel target for a referenced Spell (`:93`);
    - awaits `projectCharacterPreparationOptions` (`:106`);
    - projects the slices a second time for the party view when it is on (`:108`).

    `writeCharacterSheetSections` (`sheetSections.ts:267`) then hashes the `JSON.stringify` of
    every section.

  - **Timings.** Early returns, at 0–10 documents, run at p50 91 ms. Full stores at 40–80 documents
    run at p50 286 ms and p95 645 ms; at 200–500 documents, p50 704 ms. The 39 timeouts across all
    runs read about 37 documents.
  - **Harness.** Projection is about 1 ms per viewer. A first store costs 129 ms of CPU on the
    SRD Cleric, almost all of it the derivation. `writeCharacterSheetSections` adds 10–23 ms. An
    early return costs 3 ms.
  - **Dominant cost.** The derivation's reads (the class Spell list roots) and
    `prepareCharacterSheetFromContext`, on top of the floor. Section writes come next. The
    per-viewer projection is not a cause.
- **`content/classPublication:readSourceRows` (2 timeouts).**
  - **Steps.** `classPublication.ts:63` reads a Class's source rows and returns
    `canonicalizeRuleDocument` over all of them (`:74`).
  - **Timings.** At 0–10 documents, user time is p50 113 ms and p95 663 ms; the p95 is contention on
    a 43 ms floor. At 500+ documents (n 81, about 790 KB), it is p50 310 ms and p95 839 ms. These
    are the large class Spell lists: 353 Spell references at two documents each, the residual left
    after PERF-5.
  - **Dominant cost.** Reads and canonicalisation on large lists.
- **`campaigns/accountDeparture:step`, `membershipDeparture:leave` and `removeMember` (2 timeouts).**
  - **Steps.** `accountDeparture.ts:127` calls `departAccountCampaignMembership` (`:22`). When the
    membership is active or holds direct shares, that runs `removeCampaignSharesAndReconcile`
    (`contentShareRemoval.ts:202`), which does the following in one transaction:
    - walks the dependent shares;
    - reads every member, assignment and vehicle;
    - retains campaign equipment rules (`:258`) and per-character equipment rules (`:262`);
    - reads the owner's current publication per share and character (`:276`);
    - runs `reconcileAssignedCharacterSourceLoss` per character (`:281`), which is a rules
      evaluation;
    - finalises the removal (`:291`).
  - **Timings.** At 0–10 documents, user time is p50 214 ms, which is the 111–153 ms module floor.
    At 500+ documents it is p50 728 ms. The four timeouts read 549–613 documents. `leave` and
    `removeMember` reach 1,506 and 1,585 documents.
  - **Dominant cost.** Reads plus rules evaluation in one transaction, on top of the module floor.
- **`authoring/nodeRuntime:resolve`.**
  - **Timings.** Reads 714 documents (790 KB) at p50 and up to 1,460. At 500+ documents, user time
    is p50 308 ms.
  - **Dominant cost.** Reads. The floor is small (27–34 ms).
- **`encounters/activeReads:active`.**
  - **Timings.** 67–103 documents and 121–302 KB, at user p50 259 ms and p95 599 ms, on a 10 ms
    floor.
  - **Dominant cost.** Compute over a moderate read set, with contention on top. It needs a CPU
    profile before a fix is sized (open item).
- **`contentSnapshots/heads:readScopeKind`, `readBuildStart` and `readAbsentObjectKeys`.**
  - **Timings.** 0–2 documents at user p50 159–195 ms.
  - **Dominant cost.** Floor: the app schema import above.
  - **History.** The RELIABILITY-20.T3 note recorded a `readScopeKind` timeout on 100-root pages.
    The pages are smaller now (p50 one document), and the remaining cost is the floor.

## Proposals, ranked by impact × likelihood

Sizes: S is under a day, M is one to three days, L is more than three days. Budgets are what the
regression test should assert.

|   # | Function                                                                                           | Fix at the cause                                                                                                                                                                                                                                                                                                                                                                                    | Budget                                                                                                                                                         | Size                    |
| --: | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
|   1 | `characterSheet:basics`                                                                            | Move `basics` into its own small module, so it does not pay the 3.2 MB `campaigns/characterSheet` floor. Serve its four fields without a derivation: from Character row fields that Builder commit writes, or from a stored `identity` section that `store` writes. Its read set then excludes the System, sources and effects, so the party page stops rerunning every subscription on each write. | ≤ 6 documents and ≤ 10 KB in convex-test; module floor ≤ 20 ms in `functionBundleBudget.test.ts`; CI user p95 ≤ 100 ms; 0 timeouts                             | S–M                     |
|   2 | `heads.ts` and `vehicleCleanup.ts` app-schema imports                                              | Replace the convex-helpers `stream` (`heads.ts:256`) and `paginator` (`vehicleCleanup.ts:115`) calls with index range reads, or pass them a schema holding only the one table they page. That removes the app schema (43–58 ms) from `heads`, `vehicleCleanup` and everything that imports them: `accountDeparture`, the departure mutations and content removal.                                   | Module floor −40 to −55 ms; add `heads` and `accountDeparture` to `functionBundleBudget.test.ts`; CI user p50 for `readScopeKind` and `readBuildStart` ≤ 80 ms | S                       |
|   3 | `sheetSlices:get` miss path, and `characterSheet:get`                                              | A miss returns a `pending` result and schedules `store`, instead of deriving live (`sheetSlices.ts:105`). The client keeps its last value. Move `characterSheet:get` onto stored slices like `panel`.                                                                                                                                                                                               | Miss ≤ 20 documents and no derivation; CI user p95 ≤ 250 ms; 0 timeouts                                                                                        | M                       |
|   4 | Class Spell list reads in every derivation (`store`, slice misses, `basics`, `characterSheet:get`) | `readClassListSpellRoots` (`characters/context.ts:272`) reads the full root of every Spell on the Character's class lists. Carry the list fields the Sheet needs on `authoredSpellClasses`, written at publication. Read full roots only for the Spells the Character references.                                                                                                                   | SRD Cleric derivation ≤ 170 documents and ≤ 250 KB, from 274 and 485 KB, in a `sheetReadBudget.test.ts` case; CI `store` p95 ≤ 500 ms                          | M                       |
|   5 | Departure and unshare (`removeCampaignSharesAndReconcile`, `contentShareRemoval.ts:202`)           | Split the reconcile into a scheduled step per Character: an equipment retain plus a source-loss reconcile. The transaction that removes the membership only removes the shares and queues the steps.                                                                                                                                                                                                | ≤ 200 documents per transaction; CI p95 ≤ 500 ms; 0 timeouts                                                                                                   | M                       |
|   6 | Rules-runtime internal re-validation                                                               | `characterPolicy.ts:154` and `characterGrantFold.ts:102`/`:557` zod-parse data that rules-runtime itself built, on every derivation. That is 7–8 ms of about 25 ms of product compute. Validate at the package boundary or in tests instead. First check whether a contract (an ADR or a System module rule) requires the runtime check.                                                            | Derivation product CPU −25 to −30% in the harness                                                                                                              | S                       |
|   7 | `readSourceRows` on large Spell lists (`classPublication.ts:63`)                                   | Read Spell labels from the same per-list rows as fix 4, not two documents per Spell. Canonicalise only the rows the commit compares (`:74`).                                                                                                                                                                                                                                                        | ≤ 100 documents and ≤ 200 KB for the largest SRD list; CI p95 ≤ 250 ms                                                                                         | M (shares fix 4's data) |
|   8 | `sheetSlices:get` stored hit                                                                       | The fingerprint reads the 34 KB System document on every hit (`sheetSections.ts:83`). Use a stored System checksum or head instead, and keep the other inputs as they are.                                                                                                                                                                                                                          | Hit ≤ 40 KB, from 66–79 KB                                                                                                                                     | S–M                     |
|   9 | Module floors in general                                                                           | Build zod-to-Convex validators lazily, on the first call, instead of at module top level. Deduplicate the two zod copies.                                                                                                                                                                                                                                                                           | −20 to −40% on 2–3 MB bundles in `functionBundleBudget.test.ts`                                                                                                | M                       |
|  10 | `nodeRuntime:resolve` and `activeReads:active`                                                     | Profile first. `resolve` reads 714 documents at p50, so it needs a read budget. `active` needs a CPU profile.                                                                                                                                                                                                                                                                                       | To be set after profiling                                                                                                                                      | S (profile)             |

Rejected after measurement: projecting the bundle once per Character in `store`, instead of once
per viewer (`sheetSectionDerivation.ts:90`). Projection costs about 1 ms.

Fixes 1, 3 and 4 address 114 of the 118 timeouts in the three runs:

| Function          | Timeouts |
| ----------------- | -------: |
| `basics`          |       72 |
| `sheetSlices:get` |       22 |
| `store`           |       20 |

Fix 2 is the cheapest change with the widest reach. Fix 4 lowers the cost of every Sheet
derivation.

## Uncertainty

- **CI timings.** The timings are shared-runner timings under contention. The deterministic budgets
  are read counts and local CPU time. CI p95 is a secondary check.
- **Timed-out reads.** Timeouts report zero reads, so their read sizes are inferred from completed
  calls with the same arguments and phase.
- **Local floors.** The module floors are local `vm` measurements with a warm code cache. Convex's
  isolate reuse may differ. The CI minimums agree within about 30%.
- **Harness fixtures.** The convex-test harness uses this repo's fixtures (an SRD Cleric with the
  whole SRD imported, and the encounter Run fixture). The journeys run other Characters, so the
  harness's absolute numbers are a lower bound. The split between costs is the finding.

## Evidence

- Native capture for the three runs: `local-validation/perf-6-t1/{42419796742,42423317835,42434982477}/`.
  This is ignored. Re-download it with
  `gh run download <run> -n <proof>-native-executions`.
- Aggregate: `local-validation/perf-6-t1/last3.json` (per-function n, percentiles, reads, errors,
  timeouts).
- Earlier surveys: `local-validation/timeout-survey/{42378663354,42399914940,42415263727}/` and
  `local-validation/m650-backstop/` in the main checkout.
- Harness output (ignored): `local-validation/perf-6-t1/profile.log` holds the PERF6 timing, read
  and window lines. `local-validation/perf-6-t1/cpu-windows.txt` holds the per-scenario CPU split.
  The `cpuprof/` folder holds the raw profiles.
- Tools are kept in the orchestrator's shared notes folder under `perf-6-t1-tools/`. They are not
  in the repo:
  - `aggregate.mjs` aggregates the native capture.
  - `bundles.mjs` reports bundle size and package composition.
  - `moduleEval.mjs` measures the warm-cache module floor.
  - `evalProfile.mjs` CPU-profiles module evaluation.
  - `cpuwin.mjs` splits a profile by the harness's windows.
  - `perf6Profile.test.ts.txt` is the convex-test harness. To rerun it, copy it to
    `apps/apis/convex/characters/` and run `profile-batch.ps1` through the light lane.

  The read-budget tests that the fixes above add should become the committed form of this
  harness.

## Appendix: queries and mutations with an execution max over 500 ms (m650–m652)

| Function                                            | Kind |    n | exec p50 / p95 / max | user p50 / p95 / max | docs p50 / max |  TO |
| --------------------------------------------------- | ---- | ---: | -------------------- | -------------------- | -------------- | --: |
| `characters/sheetSlices:get`                        | Q    | 1928 | 209 / 766 / 2596     | 168 / 577 / 1219     | 26 / 363       |  22 |
| `developmentAccountDeletionRollback:forceRollback`  | M    |    3 | 2149 / 2150 / 2150   | 100 / 101 / 101      | 1044 / 1044    |   0 |
| `campaigns/characterSheet:basics`                   | Q    |  186 | 719 / 1910 / 2149    | 644 / 1213 / 1342    | 54 / 55        |  72 |
| `campaigns/queries:get`                             | Q    | 1355 | 148 / 914 / 2118     | 82 / 515 / 958       | 12 / 25        |   0 |
| `media/characterPortraitAssets:bindingForCharacter` | Q    |  161 | 275 / 1718 / 1961    | 188 / 559 / 742      | 8 / 8          |   0 |
| `account:session`                                   | Q    |  586 | 107 / 556 / 1698     | 20 / 102 / 283       | 3 / 3          |   0 |
| `media/assets:avatar`                               | Q    |  461 | 96 / 374 / 1549      | 77 / 269 / 714       | 3 / 3          |   0 |
| `campaigns/queries:liveAuthority`                   | Q    |  289 | 185 / 870 / 1534     | 156 / 564 / 797      | 6 / 7          |   0 |
| `characters/sheetSectionDerivation:store`           | M    | 1218 | 306 / 747 / 1476     | 264 / 643 / 1274     | 58 / 342       |  20 |
| `notifications:feed`                                | Q    |  518 | 44 / 241 / 1327      | 26 / 117 / 301       | 3 / 5          |   0 |
| `content/classPublication:readSourceRows`           | Q    |  580 | 136 / 797 / 1324     | 124 / 675 / 1003     | 4 / 750        |   2 |
| `authoring/nodeRuntime:resolve`                     | Q    |  190 | 424 / 939 / 1235     | 287 / 675 / 971      | 714 / 1460     |   0 |
| `campaigns/clock:get`                               | Q    |  233 | 116 / 661 / 1219     | 80 / 349 / 548       | 6 / 6          |   0 |
| `campaigns/clock:recoveryPrompts`                   | Q    |  137 | 152 / 596 / 1214     | 101 / 345 / 408      | 6 / 8          |   0 |
| `social/listings:getOwned`                          | Q    |   44 | 58 / 219 / 1149      | 46 / 176 / 343       | 11 / 12        |   0 |
| `campaigns/accountDeparture:step`                   | M    |  378 | 224 / 346 / 1132     | 220 / 342 / 1008     | 3 / 666        |   2 |
| `characters/development:sheetSectionsState`         | Q    |  716 | 145 / 545 / 1119     | 127 / 473 / 902      | 31 / 57        |   0 |
| `encounters/activeReads:active`                     | Q    |  342 | 314 / 718 / 1111     | 259 / 599 / 970      | 67 / 103       |   0 |
| `campaigns/partyInventory:items`                    | Q    | 1076 | 56 / 294 / 1055      | 40 / 199 / 457       | 16 / 108       |   0 |
| `campaigns/membershipDeparture:leave`               | M    |   36 | 258 / 1009 / 1031    | 234 / 844 / 859      | 6 / 1506       |   0 |
| `contentSnapshots/heads:readScopeKind`              | Q    | 2934 | 172 / 343 / 1026     | 167 / 333 / 954      | 1 / 61         |   0 |
| `authInvitations:redeem`                            | M    | 1032 | 556 / 811 / 1025     | 219 / 345 / 441      | 12 / 12        |   0 |
| `content/systems:capability`                        | Q    |  497 | 84 / 380 / 1005      | 66 / 295 / 701       | 3 / 3          |   0 |
| `campaigns/membershipDeparture:removeMember`        | M    |   51 | 257 / 827 / 997      | 244 / 679 / 806      | 7 / 1585       |   0 |
| `contentSnapshots/heads:readBuildStart`             | Q    |  786 | 199 / 331 / 984      | 195 / 321 / 758      | 2 / 2          |   0 |
| `liveSessions/admission:authorize`                  | M    |  402 | 196 / 480 / 971      | 163 / 407 / 828      | 11 / 12        |   0 |
| `campaigns/vehicles:definitionOptions`              | Q    |  279 | 179 / 545 / 960      | 140 / 430 / 816      | 11 / 31        |   0 |
| `account:rollPreferences`                           | Q    |  207 | 48 / 237 / 958       | 25 / 121 / 261       | 3 / 3          |   0 |
| `characters/builder:activeCharacter`                | Q    |  541 | 91 / 366 / 945       | 63 / 262 / 510       | 11 / 22        |   0 |
| `encounters/sceneBindings:get`                      | Q    |  204 | 190 / 613 / 942      | 147 / 499 / 856      | 16 / 17        |   0 |
| `encounters/projectionReads:pendingPrepared`        | Q    |  127 | 238 / 752 / 895      | 197 / 588 / 852      | 6 / 33         |   0 |
| `content/details:get`                               | Q    | 1265 | 61 / 469 / 894       | 51 / 408 / 841       | 8 / 28         |   0 |
| `content/definitions:list`                          | Q    |    3 | 624 / 891 / 891      | 611 / 871 / 871      | 33 / 33        |   0 |
| `campaigns/inventoryOwners:version`                 | Q    | 1430 | 33 / 294 / 887       | 22 / 201 / 503       | 9 / 30         |   0 |
| `contentSnapshots/heads:readAbsentObjectKeys`       | Q    |  467 | 164 / 309 / 882      | 159 / 303 / 864      | 0 / 15         |   0 |
| `developmentAccountDeletion:inspect`                | Q    |  148 | 283 / 629 / 865      | 71 / 181 / 295       | 19 / 169       |   0 |
| `scenes/presentations:get`                          | Q    |  245 | 123 / 401 / 854      | 77 / 276 / 732       | 7 / 7          |   0 |
| `characters/drafts:get`                             | Q    |  275 | 158 / 482 / 833      | 128 / 392 / 695      | 9 / 21         |   0 |
| `liveSessions/roomInputs:read`                      | Q    | 2588 | 66 / 209 / 829       | 59 / 194 / 799       | 7 / 85         |   0 |
| `campaigns/developmentLifecycle:inspect`            | Q    |  173 | 255 / 450 / 822      | 100 / 168 / 202      | 217 / 356      |   0 |
| `content/publication:publishDraft`                  | M    | 1122 | 199 / 367 / 814      | 154 / 306 / 544      | 43 / 1584      |   0 |
| `loot/tables:live`                                  | Q    |   48 | 121 / 690 / 811      | 91 / 630 / 710       | 6 / 6          |   0 |
| `campaigns/ownership:accept`                        | M    |   38 | 85 / 787 / 807       | 50 / 760 / 768       | 53 / 81        |   0 |
| `campaigns/vehicleInventory:currencies`             | Q    |  923 | 58 / 214 / 803       | 41 / 150 / 446       | 14 / 37        |   0 |
| `liveSessions/checkpoint:publish`                   | M    |  509 | 141 / 323 / 801      | 134 / 295 / 711      | 25 / 463       |   0 |
| `campaigns/partyInventory:currencies`               | Q    |  621 | 73 / 350 / 767       | 52 / 255 / 450       | 13 / 35        |   0 |
| `campaigns/characterSheet:get`                      | Q    |  180 | 148 / 324 / 763      | 134 / 294 / 698      | 20 / 73        |   0 |
| `campaigns/vehicleInventory:items`                  | Q    | 1102 | 46 / 174 / 763       | 32 / 131 / 479       | 14 / 23        |   0 |
| `content/deletion:accountDeletionStep`              | M    |  388 | 188 / 271 / 749      | 185 / 268 / 727      | 2 / 44         |   0 |
| `encounters/runs:create`                            | M    |  124 | 274 / 509 / 748      | 245 / 448 / 637      | 29 / 94        |   0 |
| `encounters/projectionReads:get`                    | Q    |  402 | 92 / 431 / 748       | 76 / 362 / 646       | 30 / 46        |   0 |
| `content/equipmentOptions:list`                     | Q    |   47 | 173 / 668 / 726      | 89 / 399 / 487       | 376 / 505      |   0 |
| `campaigns/conversations:list`                      | Q    |   59 | 79 / 591 / 722       | 56 / 450 / 607       | 15 / 18        |   0 |
| `campaigns/chat:list`                               | Q    |  109 | 92 / 643 / 718       | 78 / 478 / 622       | 11 / 16        |   0 |
| `campaigns/vehicles:list`                           | Q    |  501 | 101 / 442 / 715      | 73 / 330 / 556       | 7 / 8          |   0 |
| `campaigns/contentShares:unshare`                   | M    |   54 | 229 / 519 / 714      | 28 / 40 / 45         | 19 / 1765      |   0 |
| `characters/sheetCommands:execute`                  | M    |  669 | 279 / 473 / 709      | 245 / 408 / 612      | 92 / 372       |   0 |
| `campaigns/contentShares:list`                      | Q    |  147 | 215 / 504 / 706      | 170 / 417 / 562      | 6 / 20         |   0 |
| `campaigns/sessionReferences:list`                  | Q    |   36 | 161 / 601 / 698      | 123 / 510 / 596      | 7 / 9          |   0 |
| `campaigns/notebooks:list`                          | Q    |   68 | 115 / 591 / 696      | 88 / 313 / 377       | 7 / 16         |   0 |
| `adapter:updateMany`                                | M    | 6614 | 29 / 76 / 692        | 24 / 62 / 369        | 2 / 2          |   0 |
| `campaigns/rolls:executePrivate`                    | M    |    2 | 632 / 664 / 664      | 527 / 572 / 572      | 18 / 18        |   0 |
| `campaigns/assignments:assign`                      | M    |  172 | 416 / 570 / 658      | 311 / 451 / 509      | 484 / 1415     |   0 |
| `scenes/definitionReads:list`                       | Q    |  164 | 34 / 335 / 650       | 25 / 219 / 557       | 6 / 8          |   0 |
| `encounters/projectionReads:list`                   | Q    |   27 | 327 / 588 / 648      | 280 / 464 / 504      | 6 / 7          |   0 |
| `media/vttMapAssets:readDelivery`                   | Q    |  192 | 121 / 285 / 642      | 91 / 218 / 485       | 5 / 15         |   0 |
| `campaigns/characterSheet:execute`                  | M    |   78 | 446 / 540 / 641      | 403 / 489 / 570      | 90 / 96        |   0 |
| `scenes/showings:current`                           | Q    |  115 | 119 / 426 / 636      | 62 / 226 / 532       | 6 / 6          |   0 |
| `campaigns/inventoryAudit:list`                     | Q    |  793 | 55 / 218 / 626       | 36 / 151 / 508       | 15 / 56        |   0 |
| `campaigns/clock:advance`                           | M    |   27 | 43 / 608 / 612       | 28 / 45 / 49         | 7 / 130        |   0 |
| `campaigns/sessionNotes:list`                       | Q    |   33 | 180 / 539 / 606      | 144 / 426 / 478      | 7 / 11         |   0 |
| `content/classPublication:commitDraft`              | M    |  167 | 122 / 483 / 606      | 103 / 337 / 426      | 40 / 855       |   0 |
| `content/systems:list`                              | Q    |   92 | 81 / 175 / 601       | 73 / 165 / 567       | 3 / 5          |   0 |
| `content/systems:get`                               | Q    |   49 | 178 / 476 / 600      | 161 / 433 / 574      | 1 / 1          |   0 |
| `campaigns/rolls:execute`                           | M    |    5 | 181 / 595 / 595      | 133 / 515 / 515      | 52 / 52        |   0 |
| `content/drafts:list`                               | Q    |  820 | 60 / 101 / 584       | 14 / 28 / 77         | 3 / 4          |   0 |
| `campaigns/vehicleCleanup:run`                      | M    |  189 | 254 / 420 / 575      | 118 / 188 / 331      | 10 / 21        |   0 |
| `content/drafts:save`                               | M    | 1200 | 75 / 144 / 573       | 15 / 35 / 211        | 20 / 23        |   0 |
| `campaigns/inventoryCleanup:pending`                | Q    |   84 | 137 / 422 / 573      | 81 / 272 / 452       | 7 / 10         |   0 |
| `characters/accountDeletion:step`                   | M    |  376 | 102 / 145 / 571      | 100 / 141 / 498      | 2 / 294        |   0 |
| `content/deletion:deleteActive`                     | M    | 1205 | 214 / 303 / 550      | 198 / 277 / 414      | 41 / 1116      |   0 |
| `contentSnapshots/heads:commitBuild`                | M    |  853 | 169 / 289 / 545      | 161 / 276 / 527      | 8 / 34         |   0 |
| `campaigns/queries:list`                            | Q    |  196 | 58 / 355 / 526       | 48 / 285 / 423       | 10 / 27        |   0 |
| `campaigns/queries:settings`                        | Q    |   46 | 239 / 415 / 513      | 201 / 347 / 448      | 5 / 9          |   0 |
| `campaigns/developmentLifecycle:assertRemoved`      | Q    |   57 | 140 / 458 / 512      | 32 / 96 / 248        | 8 / 8          |   0 |
| `characters/panels:get`                             | Q    |   54 | 227 / 463 / 510      | 186 / 404 / 437      | 19 / 54        |   0 |
| `authRecovery:execute`                              | M    |   18 | 160 / 509 / 509      | 48 / 215 / 215       | 2 / 15         |   0 |
| `characters/commit:commit`                          | M    |  194 | 193 / 372 / 503      | 170 / 311 / 442      | 47 / 151       |   0 |
| `characters/developmentReceiptLedgers:page`         | Q    |   18 | 333 / 501 / 501      | 295 / 448 / 448      | 23 / 23        |   0 |
