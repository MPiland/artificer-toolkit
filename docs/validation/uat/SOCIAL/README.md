# Social and notifications — UAT scenarios

Feature `SOCIAL` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves players can find a table, apply, be accepted or refused, block and be blocked, receive notifications they chose, and that plan limits stop over-use without destroying data. Accounts: [README](../README.md#accounts). Several windows: [README](../README.md#running-several-users-side-by-side). Record results: [README](../README.md#recording-results). Read email as [Reading local email](../README.md#reading-local-email) describes.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Run order | Level | Scenario                        | Title                                            |
| --------- | ----- | ------------------------------- | ------------------------------------------------ |
| 53        | 2     | [UAT-SOCIAL-1](UAT-SOCIAL-1.md) | Create a listing, apply, accept and fill a table |
| 54        | 2     | [UAT-SOCIAL-2](UAT-SOCIAL-2.md) | Invitations and Social Hub navigation            |
| 146       | 4     | [UAT-SOCIAL-3](UAT-SOCIAL-3.md) | Blocks and what they do                          |
| 147       | 4     | [UAT-SOCIAL-4](UAT-SOCIAL-4.md) | Private profiles and masking                     |
| 148       | 4     | [UAT-SOCIAL-5](UAT-SOCIAL-5.md) | Notification feed, read state and preferences    |
| 185       | 5     | [UAT-SOCIAL-6](UAT-SOCIAL-6.md) | Plan limits and capacity                         |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC         | Why not a UAT step                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOCIAL-1.3 | Needs two final-slot actions committing in the same instant, which a person cannot cause by hand; an OCC harness. The sequential full-table refusal is [UAT-SOCIAL-1](UAT-SOCIAL-1.md) step 7. |
| SOCIAL-1.4 | Retention and cleanup run on a schedule over aged rows; nothing in the app brings a row to its purge age.                                                                                      |
| SOCIAL-3.3 | Parallel final-slot race needs a harness; the sequential over-limit refusal is [UAT-SOCIAL-6](UAT-SOCIAL-6.md) step 4.                                                                         |
