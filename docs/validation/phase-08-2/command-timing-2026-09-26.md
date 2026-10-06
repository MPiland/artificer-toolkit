# Encounter command timing, 2026-09-26

**Status:** diagnostic measurement. This is not V15 acceptance. It repeats the
[2026-09-25 bundle timing](bundle-timing-2026-09-25.md) after the performance fixes and the room ownership work
(`276ad42d1`). The typical size was measured end to end in two runs. `runs:create` now succeeds at the
100-actor cap, but **a Run with more than 64 actors cannot START** (see "Cap"). Warm commands were therefore
measured at 64 actors, the largest size that starts.

## Method

- **Target.** Self-hosted local Convex (`phase82-local-linux`), freshly restarted, reset, deployed, seeded and
  audited at `276ad42d1`. The local Worker was started with the documented command
  (`yarn workspace @artificer-toolkit/session-worker dev --local --ip 127.0.0.1 --port 8787 --env-file <.dev.vars> --types=false`)
  from a clean working tree, and was stopped afterwards. There was no reset and no backend change. Fixture data
  only: accounts, Characters, Campaigns, listings, a policy import, one Creature, Runs.
- **Driver.** This is the same disposable driver as the previous run: `local-validation/perf-bundle/bundleTiming.ts`,
  `run.ps1` and `analyze.mjs`. The fixture is also the same: a GM-tier owner; players admitted through a listing
  invitation, each assigning a fighter; `ASSISTED` automation with an AUTO_ROLL initiative policy; Creatures with
  10,000 HP and a fixed one-point action. The driver changed in three ways:
  - Measured commands go through one raw Session room socket that speaks the browser protocol (AUTHENTICATE,
    STATE_SYNC, then COMMAND with `scope: 'ENCOUNTER'`). Setup and START still use `DevelopmentHttpClient`, which
    now reaches Encounter commands only through the room.
  - The driver records `runs:create` wall-clock and its native execution.
  - `analyze.mjs` now assigns every room-originated HTTP action (`POST /live-sessions/*`) to a command by time
    window. Child functions join through `parentExecutionId`, so any extra route, such as roll dice, route or
    void, would be counted. All 54 commands in each run were attributed, with a container-clock offset of 0.
- **Command load.** After START and 6 warm-up commands, 48 measured commands run sequentially as the GM. On a
  Creature's turn this is `RESOLVE_ACTION` against another Creature, then `ADVANCE_TURN`. A Character's turn gets
  `ADVANCE_TURN` only. Wall-clock runs from COMMAND sent to COMMAND_COMMITTED received.
- **Direct bundle.** Each admission kind (`TURN_COMMAND`, `ACTION_COMMAND`) gets 40 warm calls at 11 actors and
  20 at 64, after 5 unmeasured calls. Each call goes to `liveSessions/encounterCaptureBundle:capture` with the
  admin key, acting as the GM, with a fresh `commandId`. None of these calls was cached.
- **Bound token move: not measured.** The harness can drive it: it creates a square-grid Scene, presents it,
  binds the Run and one token per actor, and sends `MOVE_SCENE_TOKEN` with `scope: 'SCENE'`. The map upload
  failed, though. The local R2 helper that the container should serve on `127.0.0.1:8026` did not answer after
  the container restart (the connection was closed with no response). Starting it would have been an
  infrastructure change, so all measured runs used `-Moves 0`. The first smoke attempt left one Campaign with an
  unfinished map upload intent.

## Results: typical size (5 Characters + 6 Creatures = 11 actors)

Each value is run 1 / run 2, in ms.

| Measure                                        | p50       | p95       | max       |
| ---------------------------------------------- | --------- | --------- | --------- |
| Room command wall-clock, all (n=48)            | 689 / 695 | 752 / 777 | 760 / 965 |
| `RESOLVE_ACTION` wall-clock (n=17)             | 695 / 687 | 752 / 819 |           |
| `ADVANCE_TURN` wall-clock (n=31)               | 689 / 697 | 753 / 770 |           |
| Sum of Convex HTTP actions per command         | 654 / 659 | 715 / 719 |           |
| Bundle HTTP action (`encounter-bundle`)        | 315 / 319 | 345 / 368 |           |
| Bundle query                                   | 260 / 263 | 281 / 300 |           |
| Bundle query, JavaScript time only             | 226 / 229 | 244 / 258 |           |
| Action commit HTTP action (`encounter-action`) | 336 / 336 | 391 / 365 |           |
| Action commit mutation                         | 244 / 251 | 287 / 276 |           |
| Turn commit HTTP action (`encounter-turn`)     | 343 / 339 | 386 / 355 |           |
| Turn commit mutation                           | 254 / 255 | 285 / 272 |           |
| Worker/DO and transport outside Convex HTTP    | 28 / 28   | 52 / 111  |           |
| Direct bundle, `TURN_COMMAND`, client (n=40)   | 274 / 269 | 295 / 286 |           |
| Direct bundle, `ACTION_COMMAND`, client (n=40) | 267 / 267 | 283 / 295 |           |

Each command made exactly one bundle call and one commit call. No other route ran during the measured
action or turn commands.

- **Bundle size.** 91 documents / 190 KB read (79 / 182 KB for an action), returning 133 KB in 24 encounter parts
  and 5 Character parts. Before the fixes it was 145 documents / 204 KB, returning 286 KB in 25 + 5 parts.
- **Commit size.** 78–108 documents and 337–385 KB read per commit, which is more bytes than the bundle.
- **`runs:create`.** 374–641 ms (the first call was cold), reading 256 documents / 0.84 MB and writing 14. Before
  the fixes it read 289 documents / 1.06 MB in 432 ms.

## Results: 64 actors (12 Characters + 52 Creatures)

These are single-run values in ms. 64 is the largest Run that can START; see "Cap".

| Measure                                                        | p50             | p95             | max   |
| -------------------------------------------------------------- | --------------- | --------------- | ----- |
| Room command wall-clock, all (n=48)                            | 936             | 1,029           | 1,101 |
| `RESOLVE_ACTION` (n=22) / `ADVANCE_TURN` (n=26)                | 925 / 945       | 981 / 1,050     |       |
| Bundle HTTP action / query / JavaScript only                   | 487 / 427 / 345 | 569 / 492 / 394 |       |
| Turn commit HTTP action / mutation                             | 394 / 324       | 409 / 337       |       |
| Action commit HTTP action / mutation                           | 371 / 305       | 433 / 355       |       |
| Worker/DO and transport outside Convex HTTP                    | 61              | 86              |       |
| Direct bundle `TURN_COMMAND` / `ACTION_COMMAND`, client (n=20) | 448 / 420       | 500 / 456       |       |

- **Bundle size.** 306 documents / 949 KB read, returning 562 KB in 130 encounter parts and 12 Character parts.
- **Commit size.** Turn commits read 333 documents / 1.6 MB; action commits read 205 documents / 1.26 MB.
- **`runs:create`.** 633–663 ms, reading about 618 documents / 2.28 MB.

## Cap (12 Characters + 88 Creatures = 100 actors)

- **`runs:create` now succeeds**, in 747 ms client / 727 ms native. It reads 653 documents / 2.74 MB (16% of the
  16 MiB limit) and writes 103 documents / 710 KB. Before the fixes it read 16.96 MB and failed with "Too many
  bytes read".
- **START fails** with room `COMMAND_REJECTED UNAVAILABLE` ("The Encounter command could not be completed."). The
  room's capture bundle is valid; the in-Node planner harness reproduces the failure as a Zod error in the
  initiative rule-execution context:
  - `applicationContext.root.initiativeBeforePin.actorIds`: at most 64 items;
  - `applicationContext.phase.evidence.primaryResults`: at most 64 items;
  - `applicationContext.phase.order.laterSegments`: at most 63 items.

  These arrays are bounded by `RULE_GRAPH_LIMITS.NODES` (64) in
  `packages/schema/src/shared/ruleExecutionInitiative.ts`, while `MAX_ENCOUNTER_ACTORS` is 100. The boundary was
  confirmed: 64 actors START, 65 actors are rejected. This is a cutover defect, not a harness limit. Warm
  commands at 100 actors cannot be measured until it is fixed.

## Comparison

| Threshold / measure                           | Previous (2026-09-25)         | Now, 11 actors                                                              | Now, 64 actors           | 100 actors                     |
| --------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- | ------------------------ | ------------------------------ |
| Command p50                                   | 927 / 953                     | 689 / 695 (−26%)                                                            | 936                      | START fails                    |
| Command p95                                   | 1,185 / 1,082                 | 752 / 777 (−30 to −35%)                                                     | 1,029                    | START fails                    |
| Authoritative gameplay command p95 ≤ 1,000 ms | Missed                        | **Met**                                                                     | **Missed** (by about 3%) | Not reachable                  |
| Rule-bound host p95 < 250 ms                  | Missed (bundle alone 529–575) | **Missed**: Convex HTTP total p95 715–719; bundle query alone p50 about 260 | Missed                   | Not reachable                  |
| Bundle query p50                              | 448 / 463                     | 260 / 263 (−43%)                                                            | 427                      |                                |
| Commit mutation p50                           | 294 / 305                     | 244–255 (−15%)                                                              | 305–324                  |                                |
| Worker/DO outside Convex p50                  | 28                            | 28                                                                          | 61                       |                                |
| `runs:create` at 100 actors                   | Fails (17.0 MB)               |                                                                             |                          | **Succeeds** (2.74 MB, 727 ms) |

## Where the remaining time goes (typical, p50 of about 690 ms)

1. **Bundle, about 315 ms (46%).** The query takes about 260 ms, and about 226 ms of that is JavaScript. It reads
   only 91 documents / 190 KB, so the cost is CPU (per-part capture builders, authorization, Zod parsing and
   checksums), not I/O. It grows with actors: from 11 to 64 actors, the query p50 rose by about 167 ms and the
   response by about 8 KB per actor.
2. **Commit, about 340 ms (49%).** The mutation takes about 250 ms, about 230 ms of it JavaScript. It reads 337–385 KB,
   more than the bundle, so re-reading or re-validating the Encounter aggregate on commit is worth profiling next.
3. **HTTP action wrappers, about 145 ms combined (about 21% of wall-clock).** This is time inside the HTTP action but
   outside its child function: about 55 ms for the bundle and about 90 ms for the commit. The likely costs are
   `ctx.auth.getUserIdentity()`, `jsonObjectSchema.parse` of the whole request body, runMutation argument
   validation of the large commit input, and serialization of the 133 KB bundle response. These were not
   profiled individually; that is a hypothesis to test.
4. **Worker/DO planning and transport, about 28 ms (4%)** at 11 actors, rising to about 61 ms at 64 actors (parsing
   and planning over the 562 KB bundle). This is still minor.

The bundle and the commit are strictly serial, so the rule-bound host budget (under 250 ms) needs both calls to
shrink substantially, or the two calls to be merged. Removing the wrapper overhead alone would not be enough.

## Resources

Container memory, from `docker stats`, is logged per run in `local-validation/perf-bundle/docker-stats.log`:

- 3.50 GiB before the first run, 3.83–3.90 GiB after the typical runs, and 4.10 GiB after the cap attempts, all
  of 7.35 GiB. That is about +0.6 GiB over all fixtures. The previous session's container was at 6.2 GiB.
- Container CPU was idle (under 5%) between runs.
- The host had about 1.1 GB free of 15.5 GB at the end.

## Caveats

- **Hardware.** Everything ran on one dev laptop (Ryzen 7 7840HS, 15 GB RAM). Absolute numbers are likely inflated
  compared with hosted Convex. Relative costs and read sizes are not affected.
- **Scope of the load.** The load is a single GM socket with no player sockets and no reactions. There were no
  Scene binding and no moves, because the local R2 helper was down. Initiative auto-rolls happened only at START,
  which was not measured. This is not the frozen V15 workload (one GM, five players, eight rounds, up to two
  actions plus one reaction per turn).
- **Sample sizes.** The 64-actor result is a single run. Two typical runs agree within about 3% at p50. The p95
  spread (752 compared with 777) comes from occasional Worker-side outliers of up to 155 ms.
- **Attribution.** Route attribution is by time window. It is exact here because commands are serial and every
  command had exactly one bundle and one commit call.

Disposable evidence is under ignored `local-validation/perf-bundle/`:

- driver logs `driver-*.log`;
- raw samples `raw-*.json`;
- native logs `native-executions-*.jsonl`;
- analyses `analysis-typical-r1.json`, `analysis-typical-r2.json` and `analysis-cap64-r1.json`;
- Worker log `worker-2026-09-26.log`;
- `docker-stats.log`.
