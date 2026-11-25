# Campaigns — UAT scenarios

Feature `CAMPAIGN` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a GM can create, run, copy, archive and delete a Campaign, bring players in and take them out, share content and party gear, post announcements and play a Character of their own, and that players only ever see what the GM has made visible to them. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC           | Why not a UAT step                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAMPAIGN-1.3 | Staged publication, replay, rollback and quota contracts; checked by contract tests with injected faults a tester cannot cause. The create, copy, archive and delete flow itself is [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md). |
| CAMPAIGN-4.2 | Bounded background cleanup of oversized inventories; needs an inventory far larger than anyone can enter by hand.                                                                                                        |
| CAMPAIGN-4.3 | Real-backend source-loss and Vehicle cleanup under contention; a concurrency harness.                                                                                                                                    |
| CAMPAIGN-5.2 | Oversized cargo cleanup under contention; a concurrency harness.                                                                                                                                                         |
| CAMPAIGN-8.2 | The exact-message match in notification code and the live-backend test patterns; a code check. The refusal wording a tester sees is [UAT-CAMPAIGN-8](UAT-CAMPAIGN-8.md).                                                 |
