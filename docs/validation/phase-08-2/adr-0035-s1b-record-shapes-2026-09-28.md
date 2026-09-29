# ADR 0035 Amendment 12 Encounter record shapes, 2026-09-28

**Status:** local evidence for the Encounter part of
[ADR 0035](../../adr/0035-room-authoritative-live-encounters.md) Amendment 12 (plan slice S1b in the
[implementation plan](../../handoffs/adr-0035-implementation-plan.md)). No Docker or cloud deployment
was used. It is not acceptance evidence, and the ledger is unchanged.

**Change.** The Run stores no projection, a command stores a replay receipt instead of its result,
and initiative and occurrence updates patch only changed fields. The follow-ups add per-actor
projection facts, pending snapshots stored as a base and deltas, and Run summaries for the Run list.
See
[Encounter record shapes](../../architecture/persistence.md#encounter-record-shapes-adr-0035-amendment-12).

## Method

`apps/apis/convex/encounters/encounterWriteSets.test.ts` (convex-test) snapshots every table before
and after each command and sums the stored JSON bytes of every written document; "changed fields"
counts only the fields that differ. The fixture is `playerControlFixture` with extra identical Wolves
(11 and 100 actors, ACTIVE, Assisted, auto-roll). Commands go through the room path
(`executeInRoom`). The projection read runs `presentRun` through a reader that counts returned
documents and bytes, including the Run row, median of five; `queryMs` is the whole
`projectionReads:get` call. The same test ran on `c5d833223` ("before") and on this change ("after").
Timings are convex-test wall time on this machine and only comparable with each other.

## Bytes written per command (whole documents)

| Command           | Actors | Before   | After   | Run document   | Command row    |
| ----------------- | ------ | -------- | ------- | -------------- | -------------- |
| GM `UPDATE_ACTOR` | 11     | 46.7 KB  | 8.8 KB  | 21.0 → 2.0 KB  | 19.8 → 0.9 KB  |
| `RESOLVE_ACTION`  | 11     | 58.5 KB  | 20.5 KB | 21.1 → 2.0 KB  | 20.5 → 1.6 KB  |
| `ADVANCE_TURN`    | 11     | 44.1 KB  | 6.1 KB  | 21.1 → 2.0 KB  | 20.0 → 1.0 KB  |
| GM `UPDATE_ACTOR` | 100    | 383.4 KB | 12.4 KB | 191.2 → 5.7 KB | 186.3 → 0.9 KB |
| `RESOLVE_ACTION`  | 100    | 395.2 KB | 24.1 KB | 191.2 → 5.7 KB | 187.1 → 1.6 KB |
| `ADVANCE_TURN`    | 100    | 380.8 KB | 9.7 KB  | 191.2 → 5.7 KB | 186.5 → 1.0 KB |

What remains per action is the changed actor documents (5.8 KB each, whole), the rule receipt
(4.8 KB) and the Run state.

**Tied initiative (Assisted START of identical Wolves, dice tying in pairs).** At 100 actors the
START writes the pending occurrence (308 KB) and each of the 50 order choices rewrites it
(339 KB) before and after: 17.6 MB before, 17.2 MB after. The occurrence's sealed pending snapshot
changes with each choice, so field-level patches do not shrink it; only a split snapshot would. At
11 actors the dice produced no tie; START wrote 84.7 KB before and 41.3 KB after.

## Projection read cost (`projectionReads:get`)

| Actors | Viewer | Before: documents, bytes, present, query | After: documents, bytes, present, query |
| ------ | ------ | ---------------------------------------- | --------------------------------------- |
| 11     | GM     | 15, 78 KB, 4.0 ms, 9.9 ms                | 38, 120 KB, 9.8 ms, 16.7 ms             |
| 11     | Player | 16, 86 KB, 3.8 ms, 7.5 ms                | 39, 127 KB, 10.6 ms, 16.3 ms            |
| 100    | GM     | 15, 248 KB, 8.5 ms, 67 ms                | 216, 691 KB, 54.7 ms, 112 ms            |
| 100    | Player | 16, 256 KB, 10.0 ms, 46 ms               | 217, 699 KB, 57.2 ms, 93 ms             |

Building on read reads every actor document (about 6 KB each, mostly its source snapshot) and the
initiative round, and evaluates the actor rules. It costs about 1.5 times the bytes at 11 actors and
2.8 times at 100; the Character document is still read once.

## Follow-ups: projection facts, snapshot parts and Run summaries

The three follow-ups the plan recorded, measured with the same test on `51f9e71ee` ("after") against
the numbers above ("before").

**(a) Projection facts.** Projections read each actor's projection facts (about 0.9 KB for a Wolf)
and one stat block and Feature set per Creature source, never the actor documents.

| Actors | Viewer | Before: documents, bytes | After: documents, bytes, present, query |
| ------ | ------ | ------------------------ | --------------------------------------- |
| 11     | GM     | 38, 120 KB               | 39, 77 KB, 5.4 ms, 11.3 ms              |
| 11     | Player | 39, 127 KB               | 40, 85 KB, 5.0 ms, 7.8 ms               |
| 100    | GM     | 216, 691 KB              | 217, 218 KB, 11.5 ms, 66 ms             |
| 100    | Player | 217, 699 KB              | 218, 225 KB, 11.7 ms, 48 ms             |

The remaining 100-actor bytes are the facts rows (about 100 KB), the initiative participants and the
Character. Each changed actor now also writes its facts row, so a command writes about 1 KB more per
changed actor: GM `UPDATE_ACTOR` 8.8 → 9.7 KB (11 actors) and 12.4 → 13.3 KB (100), `RESOLVE_ACTION`
20.5 → 22.3 KB and 24.1 → 26.0 KB; `ADVANCE_TURN` is unchanged (6.1 and 9.7 KB).

**(b) Pending snapshot parts.** At 100 actors the tied START writes the snapshot's base once
(308 KB) and each of the 50 order choices writes a delta part and the occurrence's small row: the
median choice writes 2.9 KB (339 KB before). The whole START writes 0.82 MB instead of 17.2 MB. At 11
actors the dice produced no tie; START wrote 41.3 KB, as before. Settling the occurrence deletes its
parts.

**(c) Run summaries.** `projectionReads:list` built a full projection per Run (at 100 actors, 216
documents and 691 KB per Run). It now reads one document per Run: about 2.0 KB per Run at 11 actors
and 5.7 KB at 100 (the Run's actor list), whatever the number of Runs.

## Tests

- `encounterProjectionParity.test.ts`: the GM, player and second-player projections, timelines and
  pending decisions after each conformance operation match goldens recorded before the change. One
  golden changed: after a bare mechanics batch the stored projection still showed the target's old
  hit points (11), because the caller used to rewrite it; the built projection shows 9.
- The same file checks that an immediate replay returns identical bytes to the GM (GM tool, action,
  turn, actor removal), to a player for their action, and for a paused action.
- `encounterStoreConformance.test.ts` goldens changed only by the removed fields and the new receipt.
- Follow-ups: the parity suite also checks, after every conformance operation, that the stored
  projection facts project exactly what projecting the actor documents does; the goldens stayed
  unchanged. `encounterWriteSets.test.ts` asserts a 100-actor projection read of at most 250 KB, a
  tied 100-actor START of at most 2 MB with no snapshot parts left afterwards, and a Run list of one
  document per Run. `jsonDelta.test.ts` checks that deltas rebuild the next value. The store
  conformance goldens gained the facts and part rows.

## Uncertainty

- Convex bills the whole document on a patch; changed-field bytes are what a checkpoint delta would
  carry, not what Convex bills.
- The read numbers come from convex-test, not a Convex deployment.
