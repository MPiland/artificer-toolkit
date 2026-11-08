# PERF-6.T9: `encounters/activeReads:active` and `authoring/nodeRuntime:resolve` profiles (2026-11-07)

Status: current. Base `ff1fc5c3f` (phase branch). Evidence is the m654 Browser journeys failure capture
(`local-validation/m654-fail/j6/`, native execution logs from the T8 run 42440987364 and merge batch
42443398777), plus a local convex-test harness timing the real functions over `tests/fixtures/databaseIo.ts`.
The harness and analysis scripts were scratch files and are not committed. They used the PERF-6.T1 method.

## `encounters/activeReads:active`

### Where the time goes in CI

There were 31 uncached completions across 4 journeys. User time by documents read:

| Docs read | Calls | User p50 / p95 (ms) | KB p50 |
| --------- | ----- | ------------------- | ------ |
| 0-20      | 9     | 66 / 747            | 2      |
| 20-50     | 2     | 169 / 1002          | 73     |
| 50-80     | 10    | 341 / 663           | 113    |
| 80-120    | 10    | 220 / 620           | 198    |

Two movement calls failed:

- The timeout (1002 ms user, 29 docs, 73 KB) ran inside the `removeMember` invalidation herd. One
  mutation commit re-ran about 19 subscribed queries at once on the 4-vCPU runner.
- A `CAMPAIGN_NOT_FOUND` rejection that read 6 documents still took 747 ms user in the same herd.

So the tail does not scale with reads. A 6-document call costs as much as a 100-document one when it lands
in a herd. CPU contention sets the p95, and a per-call floor sits under every call: module-graph evaluation
on every run (D59), shared by every hot query and tracked by PERF-6.T1's module-floor proposal. Other queries
in that herd timed out too (`characters/sheetSectionDerivation:store`).

What this query adds on top of the floor is its own read and derive work. Measured on the
`activeReadBudget` fixture, with the 2026-11-07 code:

| Member         | Reads | Distinct docs | KB  | Session-state handler p50 (local) | `active` p50 (local) |
| -------------- | ----- | ------------- | --- | --------------------------------- | -------------------- |
| GM, before     | 89    | 28            | 78  | 23.3 ms                           | 38.7 ms              |
| Player, before | 81    | 28            | 73  | 20.0 ms                           | 34.0 ms              |
| GM, after      | 30    | 28            | 50  | 16.6 ms                           | -                    |
| Player, after  | 30    | 28            | 50  | 15.5 ms                           | -                    |

Before the change, two of every three reads were repeats:

| Table                        | GM reads (distinct), before | After |
| ---------------------------- | --------------------------- | ----- |
| campaignCharacterAssignments | 16 (2)                      | 4     |
| characterPlayStates          | 14 (2)                      | 2     |
| authoredRouteIds             | 13 (3)                      | 3     |
| campaignMemberships          | 10 (2)                      | 2     |
| characters                   | 8 (2)                       | 2     |
| encounterRunActors           | 6 (3)                       | 3     |
| campaigns                    | 5 (1)                       | 1     |
| characterBuildStates         | 4 (2)                       | 2     |
| campaignCharacterStates      | 4 (2)                       | 2     |
| systems                      | 1 (1), 33.6 KB              | 1     |

### Cause

`readEncounterSessionState` (`packages/encounter-persistence/src/sessionReads.ts:72`) calls these readers:

- the pending decision;
- the presented Run, with each Character's Campaign conditions (`sessionReads.ts:58`);
- spatial rows;
- waiting-on;
- turn movement;
- auras;
- movement-cost zones.

Each port they reach re-checks what it depends on: the Campaign, the member's membership, the
Character's assignment, its head, its play record and its build checksum
(`apps/apis/convex/encounters/encounterReadPorts.ts`). That is correct per port, but the query never shared
those reads.

`docs/architecture/persistence.md` said a Convex query caches reads per transaction through
`memoizeTransactionReads`. No query did. Because no query did, `deriveOnce`'s parse-and-checksum cache had
no shared scope either, so every repeated read was parsed and verified again.

### Fix

`readActiveEncounterSession` (`apps/apis/convex/encounters/activeReads.ts`) runs authorization, the active
Run read and the session read model over `memoizeTransactionReads(ctx.db)`. Each identical read is served
once per transaction, deeply frozen, and `deriveOnce` derives each document once.

What stays the same:

- The result and the authorization checks. The same code runs over a reader that returns the same
  snapshot.
- The reactive read set. Every index range and every `get` is still issued once against the real db. A
  repeated `get` of a document an earlier range returned is covered by that range.

The room's pushed session already shares documents by identity (`sharedReads`), so this brings Convex in
line with it.

`decisionSettlement` reads two documents and is unchanged. Mutations must not memoize, because their own
writes would leave the cache stale. `persistence.md` now says which reads memoize.

### Budget

`apps/apis/convex/encounters/activeReadBudget.test.ts` runs the real `readActiveEncounterSession` for the GM
and a player over a counting db. It now allows at most 34 documents and 56,000 bytes, replacing the old
90,000-byte limit. On the base code the same reads were 89/81 documents and 78/73 KB, so both new limits
fail before the fix.

The test imports the new function, so CI's red-proof job will label it RED-IMPORT. The numbers above are
the assertion-level red.

There is no compute budget. Local handler time is about 16 ms against a CI tail set by the herd and the
module floor, so a timing assertion here would measure the runner, not this function.

### Expected effect and what it does not fix

The fix cuts per-call reads by two thirds (about 30 KB less) and handler compute by about 25-30%. The herd
p95 is fleet-wide. It falls only as the module floor (PERF-6.T1) and the herd size fall. The CI Browser
journeys dispatch on this slice judges the p95 ≤ 250 ms and zero-timeout target for this function.

Possible follow-ups, not in this slice's scope:

- `encounters/projectionReads:get` and `pendingPrepared` and `scenes/sceneBindings:get` compose the same
  ports and could share the memo.
- Narrowing the session read set would make the herd less frequent. That means fewer tables
  subscribed per member, for example not resubscribing every member on a membership change.
- The System document (33.6 KB) is read in full for speeds and condition types.

## `authoring/nodeRuntime:resolve`

### CI (publication journey, 16 uncached calls)

| Docs read                        | Calls | User p50 / p95 (ms) | KB p50 |
| -------------------------------- | ----- | ------------------- | ------ |
| 0-20 (skill and small maps)      | 8     | 239 / 407           | 33     |
| 1460 (class map, full catalogue) | 8     | 298 / 554           | 2105   |

A 4-document call costs 239 ms user at p50, and the 1460-document class call costs only about 60 ms more.
Like `active`, resolve is bound by the per-call floor and contention, not by its reads. There were no
timeouts in this capture. RELIABILITY-21.T1 measured the warm handler at about 300 ms for a Fighter class,
with reads about 25% of it.

### Local read profile (seeded SRD equipment and classes, `nodeRuntime.test.ts` fixture)

For a Fighter class map over all 371 SRD equipment items and 12 classes, through `createSystemSourceReader`
and `resolveNodeRuntime` and then compacted:

- 818 reads, 1,296 KB in total:
  - `authoredRoots`: 419 reads of 396 distinct roots, 621 KB;
  - `authoredSourceFacts`: 396 reads of 396 distinct facts, 641 KB;
  - `systems`: 1 read, 34 KB;
  - `contentSources`: 2 reads.
- The real `caller.query`, warm, had p50 459 ms and min 396 ms locally.

Only 23 of the 818 reads repeat, so a transaction memo would save about 3% here. Unlike the session read, this
function's reads are distinct catalogue rows, so memoizing them is not the fix.

### Proposed budget (not added in this slice)

Add a read budget beside the existing response-bytes budget in `authoring/nodeRuntime.test.ts`:

- Fighter class map, the fixture above: at most 900 documents and 1,450,000 bytes (measured 818 and
  1,327,000).
- A small map, such as `skillInput`: at most 10 documents (CI shows 4).

This budget guards against regressions. It does not prove a fix. It would catch a resolver that reads
another whole kind (for example spells) for the class map.

Cutting reads further is PERF-5.T1's keyed-reads design. It changes the source reader's contract and how
the publication checksum is fingerprinted, so it is not a small change for this slice. It is also not where
resolve's time goes (see CI above). The larger lever is the shared module floor.

## Local commands

- Budget and convex-test callers (light lane): activeReadBudget, queries, zoneConcealmentReads,
  readModuleBoundary and `lib/transactionReads`. 5 files and 11 tests pass.
- Worker-backed callers fail locally in this worktree on a stale `encounter-persistence/dist`
  (`effectReads.js` missing), before reaching product code. These are activeReads, characterConditionReads,
  roomEncounterSession, campaignPlay and heldAccountDeletion. CI builds the packages and runs them.
