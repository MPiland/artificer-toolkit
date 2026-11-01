# PERF-4.T1: stat block cost at the actor cap (2026-11-01)

Closes AC PERF-4.4. Proof: `apps/apis/convex/liveSessions/encounterActorCapProjection.test.ts`.

## Workload

A Run of 1 Character and 99 Creatures built through real product commands (`blueprints.create`,
`createEncounterRun`), activated, then read through `readRunActors` and `readEncounterSessionState`
(the Convex projection read). The Creatures are Hill Giant, Grimlock and Ogre Zombie, the smallest
SRD Creatures that wear equipment, so armor class reads an equipment loadout. They are the heaviest
mix that fits the Blueprint limit (below). Local, in-process `convex-test`; 20 warm passes.

## Budgets (derived from PERF-1: command p95 1 s, convergence 250 ms)

A pass over every Creature may take 10% of the target of the path that runs it.

| Path        | Caller                                                              | Budget per 99-Creature pass |
| ----------- | ------------------------------------------------------------------- | --------------------------- |
| Convergence | `composeRoomSceneVision` (token moves, scene commits, cache builds) | 25 ms                       |
| Command     | `projectNativeGm`, `splitRunActorState`, movement, cleaving         | 100 ms                      |

## Results

| Measure                                  | p50          | p95          | Budget  |
| ---------------------------------------- | ------------ | ------------ | ------- |
| `snapshotStatBlock` pass (command paths) | 21.8–22.9 ms | 25.7–31.3 ms | 100 ms  |
| Scene vision senses pass, after the fix  | 0.17 ms      | 0.19–0.20 ms | 25 ms   |
| Convex `readEncounterSessionState` (GM)  | 94–102 ms    | 108–170 ms   | 1000 ms |

Before the fix the vision path ran `snapshotStatBlock` and discarded the armor class: pass p95
28–34 ms, over the 25 ms budget, with p50 about 23–25 ms. Fix: `snapshotCreatureSenses` reads the
senses alone and `snapshotStatBlock` shares it; `roomSceneVision.ts` uses it. No cache.

The session read does not call `snapshotStatBlock` (it reads stored projection facts).

## Finding: the Blueprint payload limit (separate task, not fixed here)

`buildEncounterBlueprintEnemies` stores one full snapshot per enemy and rejects the Blueprint above
`mutationPayloadBytes` (1,048,576 bytes), about 10,591 bytes per enemy at 99 enemies. Single-enemy
Blueprint snapshot sizes across the 317 SRD Creatures:

- smallest Sea Horse 3,132 B; Wolf 5,427 B; median 9,632 B; largest Duergar 66,807 B.
- 139 of 317 types exceed 10,591 B, so 99 of them cannot be created.
- Failing count for a type is `floor(1048576 / bytes) + 1`: 16 Duergar fail (15 fit).
- A 99-Creature Run of a varied SRD mix (five types including armored ones) is rejected.
