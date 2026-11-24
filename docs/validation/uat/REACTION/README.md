# Reactions and decisions — UAT scenarios

Feature `REACTION` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Every role is a different person on their own device, signed in to their own account. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

This file proves that when an attack or spell triggers a reaction, the right person is asked, the hit waits with no timer, the GM can skip a stuck decision, the dice flow works with Auto-roll on and off, and Shield, Counterspell and authored reaction spells resolve correctly.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                            | Title                                                    |
| ------------- | ----- | ----------------------------------- | -------------------------------------------------------- |
| 109           | 3     | [UAT-REACTION-2](UAT-REACTION-2.md) | Only the right controller answers; GM Skip decision      |
| 110           | 3     | [UAT-REACTION-1](UAT-REACTION-1.md) | Shield prompts the right player while the attacker waits |
| 111           | 3     | [UAT-REACTION-3](UAT-REACTION-3.md) | Roll prompts, Auto-roll on versus off                    |
| 112           | 3     | [UAT-REACTION-5](UAT-REACTION-5.md) | An authored reaction spell (Absorb Elements)             |
| 113           | 3     | [UAT-REACTION-7](UAT-REACTION-7.md) | Reconnect while a decision is open                       |
| 137           | 3     | [UAT-REACTION-4](UAT-REACTION-4.md) | Counterspell and chains                                  |
| 138           | 3     | [UAT-REACTION-6](UAT-REACTION-6.md) | Disarm evidence from participants                        |
