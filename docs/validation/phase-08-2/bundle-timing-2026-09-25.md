# Capture bundle and room command timing, 2026-09-25

**Status:** diagnostic measurement. This is not V15 acceptance. The typical size was measured end to end. The cap size could not be measured, because at 100 actors the Run cannot be created (see below). A near-cap retry was blocked when the Worker stopped building on concurrent working-tree edits.

## Method

- **Target.** Self-hosted local Convex (`phase82-local-linux`, deployed and seeded at `dd074aef`) and the local Worker, started with the documented command (`wrangler dev --local --port 8787`, `.dev.vars` pointing at `127.0.0.1:3211`). No reset and no backend change. The only data added was fixture accounts, Characters, Campaigns, a Creature and a policy import.
- **Driver.** A disposable driver lives at `local-validation/perf-bundle/bundleTiming.ts`. It reuses `developmentHttpClient.ts` (room commands over the browser WebSocket protocol), `developmentCharacterFixture.ts`, `developmentCli.ts` and `fixtures/encounterInitiative.ts`, plus a copy of the V15 workload Creature without its movement reaction. The fixture:
  - GM account on the GM tier;
  - players admitted through a real listing invitation, each assigning their own fighter Character;
  - `ASSISTED` automation with an AUTO_ROLL initiative policy;
  - Creatures with 10,000 HP and a fixed one-point action;
  - Run started through the room.
- **Command load.** After START and 6 warm-up commands, 40 measured room commands run sequentially as the GM. On a Creature's turn this is `RESOLVE_ACTION` against another Creature, then `ADVANCE_TURN`; a Character's turn gets `ADVANCE_TURN` only.
- **Wall-clock.** Measured from the client sending COMMAND until it receives COMMAND_COMMITTED.
- **Direct bundle calls.** 40 warm calls (after 5 unmeasured) per admission kind (`TURN_COMMAND`, `ACTION_COMMAND`). Each calls `liveSessions/encounterCaptureBundle:capture` with the admin key, acting as the GM, against the live `DO_ACTIVE` epoch. Each call uses a fresh `commandId` so Convex's query cache cannot answer; the logs confirm 0 cached results.
- **Server times.** Native Convex function logs (`/api/stream_function_logs`: `executionTime`, `userExecutionTime`, usage stats) are joined to commands by sequence. Commands are strictly serial, and each command has exactly one bundle and one commit.

## Results: typical size (5 Characters + 6 Creatures = 11 actors)

There were two independent runs. Each value is run 1 / run 2, in ms.

| Measure                                        | p50       | p95           | max           |
| ---------------------------------------------- | --------- | ------------- | ------------- |
| Room command wall-clock, all (n=40)            | 927 / 953 | 1,185 / 1,082 | 1,450 / 1,420 |
| `RESOLVE_ACTION` wall-clock (n=14)             | 908 / 936 | 1,211 / 1,043 |               |
| `ADVANCE_TURN` wall-clock (n=26)               | 950 / 972 | 1,146 / 1,124 |               |
| Bundle query, in-room (n=40)                   | 448 / 463 | 575 / 529     | 696 / 771     |
| Bundle query, JavaScript time only             | 317 / 330 | 427 / 370     |               |
| Bundle HTTP action (Worker → Convex)           | 534 / 544 | 692 / 624     |               |
| Commit mutation (turn/action)                  | 294 / 305 | 400 / 364     |               |
| Commit HTTP action                             | 364 / 381 | 500 / 454     |               |
| Time in the Worker/DO outside both HTTP calls  | 28 / 28   | 38 / 35       |               |
| Direct bundle, `TURN_COMMAND`, client (n=40)   | 504 / 490 | 665 / 708     |               |
| Direct bundle, `TURN_COMMAND`, query           | 493 / 482 | 643 / 700     |               |
| Direct bundle, `ACTION_COMMAND`, client (n=40) | 534 / 424 | 755 / 486     |               |
| Direct bundle, `ACTION_COMMAND`, query         | 517 / 407 | 741 / 472     |               |

At 11 actors each bundle reads 145 documents (204 KB) and returns 286 KB, in 25 encounter parts and 5 Character parts. `encounters/runs:create` reads 289 documents (1.06 MB) in 432 ms.

## Results: cap (12 Characters + 88 Creatures = 100 actors)

**Not measurable.** `encounters/runs:create` fails at 100 actors with Convex's "Too many bytes read" error: it reads 16,961,466 bytes (limit 16,777,216) and 919 documents, in 949 ms. This is a V15/F02 cutover defect, not a harness limit.

A near-cap retry used 12 Characters + 72 Creatures (84 actors). There, `runs:create` succeeded, but it read 13.4 MB (80% of the limit) in 804 ms. START then did not complete because a concurrent agent's uncommitted edits stopped the Worker bundle building: `src/nativeExternalSceneCommit.ts` imports `@artificer-toolkit/rules-runtime/encounterMovementPublication`, which has no `dist` output. No bundle or command timing exists at 84 or 100 actors.

## Comparison to budget

| Threshold (acceptance "Performance contract", `live-sessions.md`) | Typical, 11 actors                                                                                                            | Cap, 100 actors                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Rule-bound host p95 < 250 ms                                      | **Missed.** Command p95 is 1,082–1,185 ms. The bundle query alone has p95 529–575 ms (twice the budget) and p50 about 450 ms. | Not reachable; the Run cannot be created. |
| Authoritative gameplay command p95 ≤ 1,000 ms                     | **Missed**, at 1,082–1,185 ms.                                                                                                | Not reachable.                            |

## Bottleneck observations

- **Convex execution is almost the whole command.** The bundle HTTP call (about 540 ms) plus the commit HTTP call (about 370 ms) accounts for everything except about 28 ms of Worker/DO planning. Optimize Convex execution before looking at the Worker.
- **The bundle cost is JavaScript, not I/O.** About 320 of 450 ms is user code: 25 parts each rerun their capture builder with its authorization, Zod parsing and checksums, over only 145 documents / 204 KB. The memo removes duplicate reads, but not the per-part builder and validation work. The response is also 286 KB for 11 actors, so it grows about linearly with actors.
- **The commit costs about 300 ms,** close to a second bundle. It should be profiled the same way.
- **`runs:create` has no headroom.** It reads about 160–170 KB per extra actor (1.06 MB at 11 actors, 13.4 MB at 84, 17.0 MB at 100). The 100-actor maximum fails outright.

## Caveats

- **Hardware.** Everything ran on one dev laptop: Ryzen 7 7840HS (8 cores / 16 threads) with 15 GB RAM. The laptop was under memory pressure, with about 0.5 GB free and 2.4 GB compressed. The Convex container used 6.2 of its 7.35 GiB limit, and background CPU load was 37–51%. Absolute numbers are likely inflated compared with hosted Convex. Relative costs (bundle compared with commit compared with DO time) and read sizes are not affected.
- **Worker source.** The Worker ran from a working tree that other agents were editing (20 modified files, including Scene/movement schemas and `liveSessionEncounterCaptureBundle.ts`). The Convex deployment is `dd074aef`. The measured Encounter action/turn path was not among the edited files, but the Worker reloaded several times during the runs.
- **Scope of the load.** The load is a single GM with no player sockets, no Scene binding and no reactions. It is not the frozen V15 workload.

Disposable evidence (logs, raw samples, analyses and the driver) is under ignored `local-validation/perf-bundle/`.
