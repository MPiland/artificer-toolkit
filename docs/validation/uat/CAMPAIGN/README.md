# Campaigns — UAT scenarios

Feature `CAMPAIGN` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a GM can create, run, copy, archive and delete a Campaign, bring players in and take them out, share content and party gear, post announcements and play a Character of their own, and that players only ever see what the GM has made visible to them. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                              | Title                                              |
| ------------- | ----- | ------------------------------------- | -------------------------------------------------- |
| 47            | 2     | [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md)   | Create, edit, copy, archive and delete a Campaign  |
| 48            | 2     | [UAT-CAMPAIGN-2](UAT-CAMPAIGN-2.md)   | Invite, accept, leave, remove, rejoin and transfer |
| 49            | 2     | [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md)   | Seat the whole party in The Campaign               |
| 50            | 2     | [UAT-CAMPAIGN-10](UAT-CAMPAIGN-10.md) | Bench a second Character and mark it active        |
| 55            | 2     | [UAT-CAMPAIGN-4](UAT-CAMPAIGN-4.md)   | Campaign content, sources and removals             |
| 56            | 2     | [UAT-CAMPAIGN-5](UAT-CAMPAIGN-5.md)   | Party inventory and Vehicles                       |
| 57            | 2     | [UAT-CAMPAIGN-7](UAT-CAMPAIGN-7.md)   | The GM plays a Character                           |
| 58            | 2     | [UAT-CAMPAIGN-6](UAT-CAMPAIGN-6.md)   | Announcements                                      |
| 73            | 3     | [UAT-CAMPAIGN-8](UAT-CAMPAIGN-8.md)   | Not a member                                       |
| 74            | 3     | [UAT-CAMPAIGN-3](UAT-CAMPAIGN-3.md)   | Players see only what the GM made visible          |
| 112           | 3     | [UAT-CAMPAIGN-11](UAT-CAMPAIGN-11.md) | Mid-fight Character swap needs the GM's approval   |
| 113           | 3     | [UAT-CAMPAIGN-12](UAT-CAMPAIGN-12.md) | Character swap on the player's own turn            |
| 114           | 3     | [UAT-CAMPAIGN-13](UAT-CAMPAIGN-13.md) | Swap in a Prepared Encounter needs no request      |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC           | Why not a UAT step                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAMPAIGN-1.3 | Staged publication, replay, rollback and quota contracts; checked by contract tests with injected faults a tester cannot cause. The create, copy, archive and delete flow itself is [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md). |
| CAMPAIGN-4.2 | Bounded background cleanup of oversized inventories; needs an inventory far larger than anyone can enter by hand.                                                                                                        |
| CAMPAIGN-4.3 | Real-backend source-loss and Vehicle cleanup under contention; a concurrency harness.                                                                                                                                    |
| CAMPAIGN-5.2 | Oversized cargo cleanup under contention; a concurrency harness.                                                                                                                                                         |
| CAMPAIGN-8.2 | The exact-message match in notification code and the live-backend test patterns; a code check. The refusal wording a tester sees is [UAT-CAMPAIGN-8](UAT-CAMPAIGN-8.md).                                                 |
