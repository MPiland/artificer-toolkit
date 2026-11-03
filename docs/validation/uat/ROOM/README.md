# Sessions and live room — UAT scenarios

Feature `ROOM` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves the GM and three players can all join the same live table, see each other, talk, share notes and maps, plan Sessions, survive a dropped connection, lose access when removed, and that the table keeps its state when everyone leaves and comes back. Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several windows: [README](../README.md#role-setup-for-the-owner). Record results: [README](../README.md#recording-results). "Tabletop window" means the window opened with **Open tabletop window** in the **Live tabletop** panel of the Campaign's session page (or **Open live tabletop window** on a Character Sheet).

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                      | Title                                     |
| ------------- | ----- | ----------------------------- | ----------------------------------------- |
| 80            | 3     | [UAT-ROOM-1](UAT-ROOM-1.md)   | GM and three players join at once         |
| 81            | 3     | [UAT-ROOM-2](UAT-ROOM-2.md)   | Previews and pings                        |
| 82            | 3     | [UAT-ROOM-4](UAT-ROOM-4.md)   | Chat — Table, Party and Direct            |
| 83            | 3     | [UAT-ROOM-5](UAT-ROOM-5.md)   | Rolls, private GM rolls and chat limits   |
| 84            | 3     | [UAT-ROOM-6](UAT-ROOM-6.md)   | Notes — private and shared                |
| 85            | 3     | [UAT-ROOM-8](UAT-ROOM-8.md)   | Plan and log Sessions                     |
| 86            | 3     | [UAT-ROOM-9](UAT-ROOM-9.md)   | Live play commands go through the room    |
| 87            | 3     | [UAT-ROOM-7](UAT-ROOM-7.md)   | Show a map to players without presenting  |
| 88            | 3     | [UAT-ROOM-10](UAT-ROOM-10.md) | Archiving a Campaign closes its live room |
| 129           | 3     | [UAT-ROOM-3](UAT-ROOM-3.md)   | Reconnect after a dropped connection      |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROOM-1.2  | Ticket signing, single use and one-minute expiry are security-token checks; a tester cannot read or replay a ticket.                                                                                                                           |
| ROOM-1.3  | Durable Object origin, signature, claim and replay rejection are contract tests needing forged requests.                                                                                                                                       |
| ROOM-4.3  | Clock version contention and DAILY recovery watermarks are timing harnesses.                                                                                                                                                                   |
| ROOM-4.4  | Contention and archived-authorization ordering are contract tests; the app has no verified tester path for GM adjustments outside live play, so its visible half has no step (owner: confirm).                                                 |
| ROOM-5.2  | Which writer applies an Encounter move (room command rather than Convex) is internal; the move itself and its refusals are in [UAT-MOVE-1](../MOVE/UAT-MOVE-1.md), [UAT-MOVE-2](../MOVE/UAT-MOVE-2.md) and [UAT-ROOM-9](UAT-ROOM-9.md) step 7. |
| ROOM-6.1  | Room test fixture (a player-socket helper); test code only.                                                                                                                                                                                    |
| ROOM-6.2  | Room test of a spatial save-effect hazard; the hazard play itself is [UAT-MOVE-8](../MOVE/UAT-MOVE-8.md).                                                                                                                                      |
| ROOM-6.3  | Room tests of maintenance variants; no maintenance prompt exists in the review data to drive by hand.                                                                                                                                          |
| ROOM-6.4  | Room test asserting a movement receipt counter; internal bookkeeping.                                                                                                                                                                          |
| ROOM-6.5  | Room test of empty-prior maintenance; internal.                                                                                                                                                                                                |
| ROOM-6.6  | Room test of maintenance pauses and stale refusals through a test-only seed route.                                                                                                                                                             |
| ROOM-6.7  | Room test of a Character initiating Disarm; the Disarm play itself is [UAT-REACTION-6](../REACTION/UAT-REACTION-6.md).                                                                                                                         |
| ROOM-6.8  | Test fixture item change (Longsword instead of Club); test code only.                                                                                                                                                                          |
| ROOM-6.9  | Room test of Concentration with two Characters; Concentration play itself is in the SPELLS file.                                                                                                                                               |
| ROOM-6.10 | Room test of equipment commands with content seeding; test code only.                                                                                                                                                                          |
| ROOM-6.11 | Room test of Legendary Action controller cases; Legendary play itself is in [UAT-ENCOUNTER-6](../ENCOUNTER/UAT-ENCOUNTER-6.md) and [UAT-SPELLS-18](../SPELLS/UAT-SPELLS-18.md).                                                                |
| ROOM-6.12 | Room test of Concentration advantage on movement and a shared spatial effect; test code only.                                                                                                                                                  |
| ROOM-6.13 | Room test of initiative receipt metadata; internal.                                                                                                                                                                                            |
