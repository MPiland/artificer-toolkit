# Social and notifications — UAT scenarios

Feature `SOCIAL` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves players can find a table, apply, be accepted or refused, block and be blocked, receive notifications they chose, and that plan limits stop over-use without destroying data. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results). Read email as [Reading email](../TESTERS.md#reading-email) describes.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC         | Why not a UAT step                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOCIAL-1.3 | Needs two final-slot actions committing in the same instant, which a person cannot cause by hand; an OCC harness. The sequential full-table refusal is [UAT-SOCIAL-1](UAT-SOCIAL-1.md) step 7. |
| SOCIAL-1.4 | Retention and cleanup run on a schedule over aged rows; nothing in the app brings a row to its purge age.                                                                                      |
| SOCIAL-3.3 | Parallel final-slot race needs a harness; the sequential over-limit refusal is [UAT-SOCIAL-6](UAT-SOCIAL-6.md) step 4.                                                                         |
