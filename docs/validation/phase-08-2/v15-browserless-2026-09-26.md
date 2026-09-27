# V15 browserless load check, 2026-09-26

**Status:** diagnostic evidence for decision D49 in the
[open questions](../../handoffs/phase-08-2-open-questions.md). This is not V15 acceptance, and the ledger
is unchanged. Both runs completed the full frozen schedule and then failed the command p95 threshold.

## Method

- **Target.** Local backend `phase82-local-linux` (`127.0.0.1:3210`). It had been reset, deployed, seeded
  and audited at `813a7512b` (branch `fix/d50-rules`, clean tree). The local Worker was started from
  `127.0.0.1:8787` the documented way (`local-validation/v15-browserless/devWorker.mjs`, a copy of the
  R08-prep helper) and stopped afterwards. The container fixtures (`scripts/localConvexFixtures.ps1 -Action
  start`) were already running and were left running. No web app or browser ran.
- **Workload.** The frozen V15 workload is `developmentDrafts.ts --encounter-v15-workload`, run through
  `scripts/runLocalConvexProof.ps1`, which also collects the native function log. It uses one GM and five
  players as room-socket and Convex-subscription clients, two concurrent Campaigns with 11 actors each,
  and 8 rounds. Each turn has two actions, then a bound move that provokes a reaction, with its response
  and the end of the turn. Players issue commands for their own actors. The V15.1 preflight ran and passed
  in both runs.
- **Browser requirement.** A Node load hook lifts the six-browser guard in memory only
  (`local-validation/v15-browserless/register.mjs`, `patchHook.mjs`). No source file was edited. This
  replaces the reverted `R08_V15_DIAGNOSTIC` edit used before.
- **Module-reuse probes** ran against the idle backend (`probe.mjs`, `probe2.mjs`) with an admin acting
  identity. Each call used a fresh subject, so no call hit the query cache. Each call either failed its
  first handler check or read nothing.
- **Runs.** `v15bl-r1` took 1,251 s and `v15bl-r2` took 1,490 s. Both exited 1 on the command p95
  assertion, which comes after the measurement is logged.
- **Evidence.** Disposable evidence is under ignored `local-validation/v15-browserless/` (analyses, probe
  output, `docker-stats.log`) and `local-validation/local-convex-proofs/v15bl-r*.*` (driver logs, native
  logs).

## V15.2 numbers against budget

Each value is run 1 / run 2, in ms. There were 848 command samples per run.

| Measure | p50 | p95 | p99 / max | Budget | Result |
| --- | --- | --- | --- | --- | --- |
| Gameplay command, all | 896 / 809 | **2,785 / 2,528** | max 4,328 / 4,038 | p95 ≤ 1,000 | **Missed** (2.5–2.8×) |
| `RESOLVE_ACTION` (n=352) | 810 / 753 | 1,021 / 852 | | | Borderline |
| `ADVANCE_TURN` (n=176) | 862 / 773 | 1,318 / 1,071 | | | Missed |
| `SCENE_MOVE` (n=160) | 2,168 / 1,997 | 3,051 / 2,611 | | | Missed |
| `REACTION_RESPONSE` (n=160) | 2,605 / 2,404 | 3,283 / 2,948 | | | Missed |
| Reaction composite (move → response → end) | 6,576 / 6,013 | 7,934 / 7,058 | | | (no budget) |
| Warm durable convergence (n=688) | 158 / 145 | **281 / 258** | 308 / 271 | p95 ≤ 250, p99 ≤ 500 | p95 **missed** narrowly; p99 met |
| Ephemeral preview | | | | p95 ≤ 150 | **Not measured** |

**Previews.** The harness cannot drive previews without a browser: `DevelopmentHttpClient` has no preview
frame, and the workload only measures previews through `v15WorkloadBrowser`. Previews are Worker-only
fan-out that does not execute Convex functions, so D49 does not depend on them.

## Per-function native execution

Values are `executionTime` / `userExecutionTime` in ms, run 2. Run 1 was about 5–10% slower throughout.

| Function | n | exec p50 / p95 | user p50 / p95 | Reads p50 | Calls per command |
| --- | --- | --- | --- | --- | --- |
| `encounters/projectionReads:get`, subscription | 3,525 | 128 / 153 | 116 / 140 | 7 docs / 33 KB | about 6 per commit |
| `encounters/projectionReads:get`, HTTP (driver reread) | 694 | 144 / 166 | 131 / 151 | 7 / 33 KB | 1 per command (driver) |
| `liveSessions/encounterCaptureBundle:capture` | 890 | 270 / 310 | 239 / 268 | 57 / 259 KB | 1 per action or turn; about 2 per move |
| `liveSessions/encounterRulesCapture:capture` | 439 | 189 / 210 | 167 / 184 | 40 / 82 KB | move and reaction steps |
| `liveSessions/encounterActionCommit:commit` | 355 | 271 / 316 | 250 / 283 | 62 / 428 KB | 1 per `RESOLVE_ACTION` |
| `liveSessions/encounterTurnCommit:commit` | 211 | 290 / 338 | 267 / 314 | 109 / 692 KB | 1 per `ADVANCE_TURN` |
| `liveSessions/encounterRoute:route` | 161 | 162 / 174 | 151 / 162 | | 1 per move |
| `liveSessions/encounterMovement:begin` | 322 | 232 / 255 | 210 / 228 | | per move |
| `liveSessions/encounterMovement:observe` | 322 | 225 / 246 | 205 / 223 | | per move |
| `liveSessions/encounterMovement:prepare` | 322 | 259 / 296 | 232 / 257 | | per move |
| `liveSessions/encounterMovement:commit` | 322 | 326 / 423 | 282 / 354 | | per move |
| `encounters/pendingReads:pendingRuleOccurrence` | 322 | 122 / 137 | 112 / 126 | 7 / 33 KB | driver, per reaction |
| Reference: `adapter:findOne` (auth component) | 78 | 12 / 17 | 10 / 15 | 1 | |
| Reference: `campaigns/deletion:status` | 1,330 | 28 / 49 | 22 / 25 | 4 | |

- **Where the time goes.** Each Convex HTTP route adds about 5 ms beyond its child function. Actions and
  turns each make 2 serial Convex round trips (bundle, then commit), about 700–800 ms. A bound move makes
  about 7 serial round trips: route, movement begin, observe, bundle, rules capture, prepare and commit, at
  250–450 ms each. That is about 2.0–2.2 s, which matches the `SCENE_MOVE` p50. The reaction response
  chains bundle, rules and commit steps the same way. These chains come from time-ordered traces of
  top-level calls in `v15bl-r1.native-executions.jsonl`.
- **Subscription fan-out.** Each commit re-executes `projectionReads:get` once per subscribed player on
  that Run: p50 5, p95 20 (bursts that span several commits), mean 6.0. At about 116–128 ms each, that is
  about 0.6–0.7 s of backend JavaScript per commit, on top of the command path. It competes for the same
  isolates as the next command.
- **No cache hits.** None of these functions produced a cached result.

## Module reuse (the D49 question)

**Answer:** the self-hosted backend does not keep module state between query and mutation executions.
Every call pays a fixed setup cost of about 55–160 ms, depending on the function, before its handler does
any work. That cost does not shrink when the function is called repeatedly.

The evidence:

1. **No warm-up curve under load.** A cold-per-module backend would make the first executions slow and
   the later ones fast. Instead, the first five executions of every function were as fast as the rest or
   faster:

   | Function | First five executions | Later p50 |
   | --- | --- | --- |
   | `encounterCaptureBundle:capture` | 195–203 | 239 |
   | `encounterRulesCapture:capture` | 140–156 | 167 |
   | `encounterActionCommit:commit` | 224–250 | 250 |

   Executions later in a same-function burst were no faster than the first one in the burst. For example,
   `projectionReads:get` measured 108 compared with 117 over 3,080 samples.
2. **Idle probe with minimal handler work** (`probe.json`). `projectionReads:get` with an unknown
   Encounter authenticates, reads at most one index entry and throws. Over 30 back-to-back calls its user
   time was 131, 102, then **53–78 ms steady**. It was 55–115 ms after 3 s idle. `account:session`, on
   the same identity path in a small module, ran in 6–10 ms. So about 55–65 ms of every
   `projectionReads:get` is fixed per-call setup, which is about half of its 116–131 ms steady-state
   time under load.
3. **Probe that fails at the handler's first input parse** (`probe2.json`). This probe read 0 documents
   and wrote 0. Each function got 20 back-to-back calls, and the values below are user time in ms:

   | Function | User time, ms | Share of its workload p50 |
   | --- | --- | --- |
   | `encounterCaptureBundle:capture` | 264, then 147–184 | about 65% |
   | `encounterRulesCapture:capture` | 119–137 | about 74% |
   | `encounterActionCommit:commit` | 155–201 | about 64% |
   | `encounterMovement:commit` | 156–223 | about 58% |

   Only the first call is higher (for example 264 compared with about 155). That fits a one-time compile
   or code cache, while module evaluation repeats on every call.

This matches D49's hypothesis: handler work is small, and per-call module evaluation dominates. The
measured setup is somewhat larger than D49's estimate of about 75 ms for `projectionReads:get` and about
150 ms for the capture: about 60 ms and about 150 ms, plus the handler's own schema parsing. The practical
consequence is that shrinking each function's module graph, including top-level Zod schema construction,
reduces every call, subscription re-execution and commit directly. Warm isolates will not reduce it.

## Resources

- `docker stats` for the Convex container: 5.78 GiB before, 5.84 GiB after run 1, 5.59 GiB before run 2
  and 5.66 GiB after, of 7.35 GiB. There was no growth trend across the runs. The baseline was already
  high after the reset and seed.
- The host had 1.9 GB free at the start and 1.4 GB at the end, of 15 GB. Container CPU was idle between
  runs.
- **Cleanup.** In run 1, workload Campaign deletion timed out at `DELETING`, as seen before in
  [V15 local](v15-local-2026-09-26.md). The deletion jobs kept running for about 5 minutes after the
  schedule, overlapping nothing measured.

## Recommendation

**A 6-browser run is not justified now.** Without any browser, the workload already misses the command
budget by 2.5–2.8×. Browsers only add load: before, six tabletops pushed the same functions past the 1 s
query limit. Fix these first, in this order:

1. **Shrink per-call setup (D49 option), now justified by measurement.** About 50–75% of every
   projection, capture and commit execution is fixed setup. Start with the modules behind
   `encounterCaptureBundle:capture`, the commit mutations, `encounterMovement:*` and
   `projectionReads:get`. Prefer lazy or narrower imports and no top-level construction of large Zod
   schemas. The subscription fan-out benefits from the same work, since it re-executes
   `projectionReads:get` 5–6 times per commit.
2. **Collapse the bound-move and reaction chains.** Seven serial Convex round trips per move cannot meet
   1 s even at half the current per-hop cost (7 × about 150 ms, plus the Worker). Merge
   route/begin/observe/prepare/commit, and the bundle and rules captures, into one or two calls per
   step. This is an architecture change (room ↔ Convex transport), so it needs an architect ruling.
3. **Re-run this browserless check** after (1) and (2). Run the 6-browser V15 only when the browserless
   command p95 is clearly under 1 s and the durable p95 is clearly under 250 ms.

Both fixes change backend or transport code and are outside this measurement slice.

## D52 follow-up: per-call setup and the move chain (2026-09-26)

Implementation evidence, measured in process only; the browserless re-run (D52 ruling 3) is still
to do. Disposable harnesses and output are under ignored `local-validation/d52/`.

- **Method.** `importCost.mjs` bundles every Convex function module together the way `convex deploy`
  does (esbuild, ESM, code splitting into `_deps` chunks, the `convex` condition) and evaluates one
  function's entry and chunk closure in fresh V8 contexts with compiled code cached, as the backend
  does per call. The warm numbers track the measured fixed cost above (for example
  `projectionReads:get` about 50–60 ms against 53–78 ms, the capture bundle about 120–145 ms against
  147–184 ms).
- **What dominates.** Zod schema construction in `packages/schema` contract modules (about
  75–80% of each target's evaluation), then `packages/shared` domain modules. Zod itself, the
  profanity list, polygon clipping and the zod locales are each a few ms or less.
- **Why narrowing imports barely helps.** esbuild code splitting is file-level: a function loads
  every file its import graph reaches, and each file carries the union of the parts any function
  uses. Marking schema construction pure, or `sideEffects: false`, changed the loaded bytes by under
  1% in the split build (single-function bundles would have dropped 30–45%). The targets' graphs are
  the contracts they parse (stored Run, Character and Scene documents, route inputs), so cutting them
  needs the schema package split into smaller files or lazy schema accessors, a cross-package change.
- **Cut in D52.** The caller identity schema moved to its own module and `requireLiveMember` out of
  the movement module: the Encounter binding commit fell 29% (146 to 104 ms, 3.1 to 1.8 MB) and small
  functions about 13% (`campaigns/deletion` 16 to 14 ms); the target functions stayed within ±3%.
- **Chain collapse.** A bound move now takes two Convex calls, the stage (route, begin, observe and
  capture bundle, including the first Scene spatial effect page) and the commit (freeze, fog and
  publish), down from six or more (begin, observe, bundle, spatial effects, prepare, one fog stage
  per owner, commit). A held movement decision's answer or GM void also takes two, down from seven
  (with the route). Each removed call saved its whole per-call setup, about 100–150 ms.
