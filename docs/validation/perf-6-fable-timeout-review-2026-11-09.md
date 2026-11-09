# Convex 1 s timeouts: read-only performance review (2026-11-09)

Reviewer: Fable 5.2, medium effort. Source read from the working tree at `f96d2537d` (`codex/phase-08-2-convex-cutover`). Nothing was edited, built, tested or run
against a backend. Evidence is source at file:line, the T1 profile, the T6 report, and the m671
movement journey's execution log (`local-validation/m671-bj-6/movement/movement-ci.native-executions.jsonl`),
which I summarised with three throwaway Node scripts (method in the appendix).

Correction to the brief: `scenes/sceneBindings.ts` does not exist. The function is
`encounters/sceneBindings:get` in `apps/apis/convex/encounters/sceneBindings.ts`.

## Headline

**The functions are not slow. They time out because they all run at once.** One membership write
starts about 20 executions within 25 ms on a 4-vCPU runner that also hosts Chromium, the Session
Worker and the web app. Convex's 1 s limit is wall-clock time in user JavaScript (it pauses only for
syscalls), so time-slicing counts against it. A query that costs 49 ms alone costs 690 ms in the
burst.

The current working theory, "cold module load of a large bundle", fits the same data less well, and
on CI the two are confounded: every departure step runs inside the burst the departure causes. I
think the bundle-size work (ADR 0042, T6, T11, T12) is past its useful return for these timeouts
until the burst is cut. Details under "Where I disagree".

### The m671 burst (run 42685527484, movement journey)

Times are ms; offsets are seconds from the reconcile step's start.

| Offset           | Function                                            | User      | Docs            | Result                                |
| ---------------- | --------------------------------------------------- | --------- | --------------- | ------------------------------------- |
| −0.507           | `campaigns/queries:get` (before the write)          | 49        | 17              | ok                                    |
| −0.136           | `membershipDeparture:removeMember`                  | 89        | 66 (10 writes)  | ok                                    |
| −0.017 to +0.008 | 16 queries start together                           | 111–1,003 | 6–17            | 7 CAMPAIGN_NOT_FOUND, 8 ok, 1 timeout |
| 0.000            | `characterReconcileSteps:run` (scheduled at 0 ms)   | 1,029     | 7               | **timeout**                           |
| −0.007           | `encounters/activeReads:active`                     | 1,003     | 12              | **timeout**                           |
| +0.190           | `liveSessions/admission:authorize` (evicted client) | 891       | 8               | CAMPAIGN_NOT_FOUND                    |
| +0.199           | `characters/sheetSectionDerivation:store`           | 1,003     | 38              | **timeout**                           |
| +2.035           | `characterReconcileSteps:run` (re-queued)           | 384       | 432             | ok                                    |
| +2.311           | `sheetSectionDerivation:store` (re-queued)          | 301       | 147 (55 writes) | ok                                    |

- Peak overlap: 21 executions. User time in the ±2 s window: 17.6 s.
- The departure mutation itself is cheap (89 ms, 66 documents).
- `encounters/projectionReads:pendingPrepared` read 6 documents and took 831 and 842 ms.
- The timed-out reconcile step had read 7 documents; the re-queued run read 432 and took 384 ms.
- Across the whole log, query and mutation user time by how many executions overlapped:

| Overlap | n   | p50 | p90 | max   |
| ------- | --- | --- | --- | ----- |
| 1–2     | 214 | 30  | 77  | 507   |
| 3–4     | 135 | 43  | 72  | 154   |
| 5–8     | 175 | 62  | 155 | 588   |
| 9–16    | 75  | 141 | 429 | 791   |
| 17+     | 83  | 24  | 794 | 1,029 |

Of the 16 burst queries, 7 belonged to the removed player (4.5 s user, all ending
CAMPAIGN_NOT_FOUND) and 9 to the remaining member (5.7 s user).

## Findings, ranked by expected effect on the timeouts

### 1. Scheduled mutations start inside the burst they cause (S)

**Cause.**

- `campaigns/characterReconcileSteps.ts:35` schedules the reconcile `run` with `runAfter(0, …)`. It
  starts in the same 25 ms as the invalidated queries (offset 0.000 above).
- `characters/sheetSectionStores.ts:24` gives the Sheet store 300 ms
  (`CHARACTER_SHEET_STORE_DELAY_MS`), which is still inside the burst (+0.199 above).
- Both are the heaviest modules in the burst (2,829 KB and about 2,500 KB) and both are mutations,
  so a timeout loses work and needs the `verify` re-queue.

**Fix.** The step is already asynchronous with a documented reader window (T6 report, "Reader
window"), so schedule it after the subscribers have settled: a delay of about 1.5–2 s for `run`,
with its check at delay + `CHARACTER_RECONCILE_CHECK_MS`. Give Campaign-scope Sheet store chains
(`scheduleCampaignCharacterSheetSections`, `sheetSectionStores.ts:154`) the same delay; keep 300 ms
for a single Character's own writes. A scheduler delay is the tool Convex provides for this. It is a
tuning constant, not structure: finding 2 is what shrinks the burst.

**Expected effect.** The step's first attempt should cost what the re-queue costs today: 149–384 ms
user (T6 report and the table above) instead of 1,000+. It is also the cheapest experiment that
separates contention from cold load: if a first attempt 2 s later still costs about 1 s, the cold-load
theory is right and I am wrong.

**Measure.** Dispatch the membership and movement proofs several times; record exec and user of the
first `characterReconcileSteps:run` and `sheetSectionDerivation:store` after each departure, and
count timeouts and `verify` re-queues (target: zero).

**Risk.** The D81 settlement and source-loss reconcile land about 2 s later. Tests that fire timers
in order (`deletionCustody.test.ts`) need the new delay. Low.

### 2. Every Campaign-scoped read depends on the whole `campaigns` document, and departure patches it (M–L)

**Cause.**

- `campaigns/authority.ts:76–80` reads the full `campaigns` document in `readCampaignAuthority`.
  `requireCampaignAuthority` has 132 call sites in 71 files, so nearly every Campaign subscription
  has that document in its read set.
- `campaigns/contentRemovalFinalization.ts:164–167` patches `version` and `updatedAt` on every
  departure and unshare. `removeCampaignSharesAndReconcile` calls it unconditionally
  (`contentShareRemoval.ts:290`), including when the departing member shared nothing.
- Convex invalidates by document, not by field, so that patch reruns every Campaign subscription of
  every member.
- The same mechanism fires on other writes: `lib/mutations.ts:351–362` patches
  `campaigns.notebookRevision` on every notebook section write; `campaigns/archive.ts:28`,
  `campaigns/update.ts:67` and `campaigns/ownership.ts:110` patch it too.

**Fix.** Convex's own guidance is to split a document into rarely-changing and frequently-changing
parts ("Queries that scale": move the hot fields to their own table). Keep identity and settings on
`campaigns` (what authority needs: owner, System, status). Move `version`, `updatedAt` and
`notebookRevision` to a one-row-per-Campaign revision document, read only by the queries that return
them (`campaigns/queries:get`, `settings`, notebook reads) and by mutations that check the version.
Pre-launch, so migrate dev data in the same change. 31 references in 17 files touch those three
fields.

A smaller variant: stop bumping the Campaign version on a departure that removes no shares. That
changes what `campaignVersion` in the removal receipt means, so it needs a ruling.

**Expected effect.** Remaining members stop rerunning queries that read nothing else the departure
wrote. In the m671 burst the candidates are `loot/tables:live`, `campaigns/queries:liveAuthority`,
`scenes/showings:current`, `scenes/presentations:get` and `projectionReads:pendingPrepared`
(6–7 documents each, 2.5 s of the remaining member's 5.7 s). The saving grows with party size: it is
per remaining member. It also removes the notebook-write fan-out, which no journey measures today.

**Measure.** Count executions in the ±2 s window after `removeMember` and `leave` in the
native-executions log, per identity, before and after. A deterministic guard: a convex-test that
fails if a departure writes the `campaigns` table.

**Risk.** Persisted-contract change across campaigns, copy, archive, ownership and deletion. Each
candidate query needs its read set checked: the departure also refreshes `sceneVisionRevisions`
(`lib/mutations.ts:344–348`), marks the CAMPAIGN content head (`:300–305`), deletes the assignment
and freezes Run actors, and any query reading those still reruns, correctly. I did not trace all
five candidates.

### 3. A player's departure queues Sheet stores and content marks for the whole Campaign (S–M)

**Cause.**

- `characters/sheetFingerprintInputs.ts:148–153` queues `{ campaignId }` on any membership status or
  role change. Its own comment says the Sheet input is the owner's membership ("Campaign authority
  reads the owner's membership").
- `lib/mutations.ts:312–319` turns that into `scheduleCampaignCharacterSheetSections`: one
  `sheetSectionDerivation:store` per assigned Character, chained. Each is a 2.5 MB module, about
  300 ms warm, and writes about 55 section documents, which reruns every open Sheet subscription.
- `lib/mutations.ts:300–305` marks the CAMPAIGN content head on any membership status change; the
  `contentSnapshotHeads` Sheet input (`sheetFingerprintInputs.ts:158–166`) queues the Campaign again.

**Fix.** Queue from a membership change only when that membership is one a Sheet reads: the owner's
(ownership transfer), not a player's status change. The departing Character is already queued by its
own assignment delete (`campaignCharacterAssignments: allFields`). Check whether the content-head
mark is needed when the member shared nothing: the share deletes carry their own trigger.

**Expected effect.** Removes N−1 store mutations and their section-write reruns from each
departure, and the +0.199 s timeout above.

**Measure.** Count `sheetSectionDerivation:store` executions and `characterSheetSections` writes
after a departure in the membership proof.

**Risk.** The fingerprint must still cover everything the derivation reads. I did not read the
derivation to confirm that only the owner's membership is read (party view rules may read more), so
this needs that check and the existing fingerprint-input test. Medium.

### 4. The removed player's subscriptions rerun to an error, more than once (S for `leave`)

**Cause.** The membership patch (`membershipDeparture.ts:114`) correctly invalidates every query of
the departing user, since authority reads their membership (`authority.ts:82–88`). Each rerun loads
its whole module to throw CAMPAIGN_NOT_FOUND after 6 documents. In the burst that is 7 of 16 queries
and 4.5 s of user time. They rerun again on later commits (+0.948 `scenes/recipientReads:header`,
+2.608 `campaigns/queries:get`), so the client keeps the subscriptions after the first refusal. The
T1 profile has 360 "Campaign not found" errors in 1,355 `campaigns/queries:get` executions.

**Fix.**

- `leave`: drop the Campaign subscriptions before the mutation (call it from, or navigate first to,
  a route that holds none). `CampaignParty.tsx:48` calls it from inside the Campaign page.
- Both paths: on the first CAMPAIGN_NOT_FOUND, unmount the Campaign subtree so later commits rerun
  nothing.
- `removeMember`: one rerun per subscription is inherent. Its cost is the module floor (finding 6).

**Expected effect.** `leave` loses the departing half of the burst. `removeMember` keeps one wave
but loses the repeats.

**Measure.** CAMPAIGN_NOT_FOUND count per departure in the log.

**Risk.** Web-only. I did not trace the web error handling, so the "keeps subscriptions" reading
rests on the log alone.

### 5. CI runs the backend with default concurrency on a shared 4-vCPU runner (S, environment)

**Cause.**

- `.github/workflows/browser-journeys.yml:106–110` starts the container with no tuning.
- Open-source backend `crates/isolate/src/timeout.rs`: user time is `monotonic_now() − start −
  pauses`, with pauses only for async syscalls. It is wall-clock, not CPU.
- `crates/common/src/knobs.rs`: `APPLICATION_MAX_CONCURRENT_QUERIES` and `_MUTATIONS` default to 16;
  `DATABASE_UDF_USER_TIMEOUT_SECONDS` defaults to 1. Both are `env_config` knobs.

**Fix.** Set the two concurrency knobs near the runner's core count (try 4) on the CI container, so a
burst queues for a slot instead of time-slicing. Queue time is not user time, so the 1 s limit keeps
meaning "this function used 1 s". I would not raise the user timeout except as a one-off diagnostic:
it hides real regressions.

**Expected effect.** Burst executions should cost close to their solo time (30–200 ms). This fixes
the CI flake, not the product cost: Convex Cloud will still bill and run every rerun.

**Measure.** One Browser journeys dispatch with the knobs set; compare the overlap table above.

**Risk.** Unverified: that the self-hosted image honours these env vars, and that a request at the
limit queues rather than fails. Check both in one dispatch before relying on it. Queued queries add
latency to the journeys.

### 6. Encounter read modules carry every port's reach (M, effect uncertain)

**Cause.** `encounters/encounterReadPorts.ts:40–75` builds every port in one object literal, so each
module that calls `encounterReadTransaction` bundles all of them: Character build verification
(`liveSessions/characterRulesCapture.ts:43–52`), Sheet state, definition roots, System documents,
roll preferences. `encounters/sceneBindings:get` reads 16 documents and
`projectionReads:pendingPrepared` reads 6, in the same 1.8 MB class as `activeReads`. This is the
shape ADR 0042 removed from the System tiers and T6 removed from the effects write path.

**Fix.** Give narrow reads a narrow transaction: the Scene binding read and `pendingPrepared` bind
only the ports they call. Add bundle bars for `encounters/sceneBindings.ts`,
`encounters/projectionReads.ts`, `scenes/presentations.ts` and `campaigns/queries.ts` in
`functionBundleBudget.test.ts` (none exists today). `sideEffects: false` (ADR 0042, −222 KB) and the
two zod copies (T1 profile) are the package-wide versions of the same lever.

**Expected effect.** Only helps if burst executions really compile cold. Warm, the module floor is
10–29 ms whatever the size (T1 profile), so the gain could be near zero. Do findings 1 and 5 first
and re-measure.

**Measure.** Bundle KB per module against its user time inside the burst. If small modules
(`scenes/showings:current`, 111–154 ms in the burst) track size, cold load is real.

**Risk.** More binding code; low behavioural risk.

### 7. `activeReads:active` does avoidable work per run (S–M, unmeasured)

**Cause.** Its best CI user time is 184 ms against a 29 ms floor, so about 150 ms is handler work.

- `encounters/activeReads.ts:35` zod-parses the whole DTO (121–302 KB), and Convex then validates
  it again against `returns` (`:28–30`). `projectionReads.ts:55` does the same.
- For each Character actor, `readCampaignCharacterConditions` (`encounterReadPorts.ts:58–61`)
  re-authorises the assignment (`campaigns/characterState.ts:12–47`) and reads and parses the
  Character's play and build rows (`characters/stateDocuments.ts:65–79`) to return its Campaign
  conditions.
- `characterMaximumHitPoints.ts:13–22` lists each Character's active effects per run.

**Fix.** Validate the output once (keep `returns`, drop the zod parse where the schema has no
transforms). Read Campaign conditions without the build verification, which protects rules reads the
projection does not make.

**Expected effect.** Unknown until profiled; T1 already lists the CPU profile as an open item. This
is the only finding about the function's own cost.

**Measure.** A local CPU profile of the replayed query, then user p50 at overlap 1–2 in CI.

**Risk.** The build verification may be a deliberate integrity fence; needs a ruling if so.

## Where I disagree with the framing

- **"Cold load is about half of a cold run."** That was measured locally on a replayed step. On CI,
  three things say contention dominates:
  1. `campaigns/queries:get` took 49 ms, then 672–694 ms half a second later, with its module
     already loaded.
  2. T6's "rejoin departure, cold, 34 s later" cost 840 ms user. With isolate reuse (`REUSE_ISOLATES`
     defaults to true, idle timeout 600 s) a module should not be cold again after 34 s. It was
     inside another departure burst.
  3. The step went from 3,190 to 2,829 KB and still times out.

  I cannot rule out that concurrent executions get fresh isolates that recompile. Finding 1 or 5
  settles it in one CI dispatch.

- **Gating on wall time.** A 1 s wall-clock limit on a shared 4-vCPU runner is stricter than the same
  limit in production. Each timeout costing a merge batch is partly a CI design cost. Gate on what is
  deterministic (executions per departure, documents read, bundle bars) and record wall time, which
  matches D210's "latency recorded, not gated".
- **No dynamic `import()`:** agree.
- **No `ctx.runQuery` inside queries to split work:** agree. Note that every function already makes
  one: identity goes through the better-auth component (`lib/authUserReads.ts:51–60`). Convex's docs
  list components as the accepted exception. `account:session` (3 documents, user p50 20 ms) bounds
  its cost, so it is not worth changing.

## What I am unsure of

- Whether the burst cost is CPU time-slicing or fresh-isolate compilation. Both come from
  concurrency; they differ in whether bundle size matters (finding 6).
- Whether the concurrency knobs queue or reject at the limit, and whether the pinned image reads them.
- Which of the remaining member's queries read something else the departure writes (finding 2).
- Whether the Sheet derivation reads only the owner's membership (finding 3).
- The web client's behaviour after CAMPAIGN_NOT_FOUND (finding 4).
- The brief's "about 20 queries per member, about 50 executions": the m671 log shows 16 queries in
  the first wave and 53 executions of all kinds (queries, mutations, actions, HTTP actions, auth
  component calls) in ±2 s. I analysed one burst in one run.
- I did not read `turnMovement.ts`, `pendingReads.ts`, `sourceLoss.ts` or the rules-runtime modules
  under the reconcile, so finding 7 and the step's own 384 ms are not broken down.

## Suggested order

1. Finding 1 and finding 5 together in one dispatch: small, and they test the diagnosis.
2. Finding 3 (drops whole mutations) and finding 4's `leave` change.
3. Finding 2, as its own PBI with a ruling on the receipt's `campaignVersion`.
4. Findings 6 and 7 only if the re-measured burst still shows module-size or handler cost.

## Appendix: method

- Log: `*.native-executions.jsonl` rows with `kind: "Completion"`, using `executionTimestamp`,
  `executionTime`, `userExecutionTime`, `usageStats.databaseReadDocuments`, `error`.
- Burst: rows whose `executionTimestamp` falls within ±2 s of a row whose error contains
  "timed out"; grouped by `identifier`.
- Overlap: for each row, the number of rows whose `[executionTimestamp, +executionTime]` interval
  intersects it.
- Backend facts: `crates/common/src/knobs.rs`, `crates/isolate/src/timeout.rs` and
  `crates/isolate/src/module_cache.rs` on `get-convex/convex-backend` main, read through a fetch
  summary, not line by line. Docs: docs.convex.dev (limits, best practices, scheduled functions,
  React client) and stack.convex.dev/queries-that-scale.
