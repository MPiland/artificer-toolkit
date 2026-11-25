# Reactions and decisions — UAT scenarios

Feature `REACTION` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Every role is a different person on their own device, signed in to their own account. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

This file proves that when an attack or spell triggers a reaction, the right person is asked, the hit waits with no timer, the GM can skip a stuck decision, the dice flow works with Auto-roll on and off, and Shield, Counterspell and authored reaction spells resolve correctly.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in. Set the Status column to the same result (PASSED, FAILED, BLOCKED or SKIPPED) so you can see where you left off.

| Path position | Level | Scenario                            | Title                                                    | Status  |
| ------------- | ----- | ----------------------------------- | -------------------------------------------------------- | ------- |
| 110           | 3     | [UAT-REACTION-2](UAT-REACTION-2.md) | Only the right controller answers; GM Skip decision      | NOT RUN |
| 111           | 3     | [UAT-REACTION-1](UAT-REACTION-1.md) | Shield prompts the right player while the attacker waits | NOT RUN |
| 115           | 3     | [UAT-REACTION-3](UAT-REACTION-3.md) | Roll prompts, Auto-roll on versus off                    | NOT RUN |
| 116           | 3     | [UAT-REACTION-5](UAT-REACTION-5.md) | An authored reaction spell (Absorb Elements)             | NOT RUN |
| 117           | 3     | [UAT-REACTION-7](UAT-REACTION-7.md) | Reconnect while a decision is open                       | NOT RUN |
| 141           | 3     | [UAT-REACTION-4](UAT-REACTION-4.md) | Counterspell and chains                                  | NOT RUN |
| 142           | 3     | [UAT-REACTION-6](UAT-REACTION-6.md) | Disarm evidence from participants                        | NOT RUN |
