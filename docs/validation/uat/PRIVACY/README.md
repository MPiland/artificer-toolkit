# Privacy and redaction — UAT scenarios

Feature `PRIVACY` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves that at a live table the GM sees everything, each player sees only what their Character may know, and nobody else ever sees hidden tokens, private rolls, monster statistics, or another player's private data. Every scenario names what each window must NOT show; look for those on purpose and report any leak as a failure. Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several windows: [README](../README.md#role-setup-for-the-owner). Record results: [README](../README.md#recording-results). Use three browser profiles at once, one for the GM and one each for P1 and P2, with the tabletop window open in each.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                          | Title                                                |
| ------------- | ----- | --------------------------------- | ---------------------------------------------------- |
| 99            | 3     | [UAT-PRIVACY-1](UAT-PRIVACY-1.md) | What a player sees of the Encounter                  |
| 100           | 3     | [UAT-PRIVACY-2](UAT-PRIVACY-2.md) | GM private rolls and monster rolls                   |
| 101           | 3     | [UAT-PRIVACY-5](UAT-PRIVACY-5.md) | Reloads and replays do not leak                      |
| 102           | 3     | [UAT-PRIVACY-6](UAT-PRIVACY-6.md) | Health display settings                              |
| 103           | 3     | [UAT-PRIVACY-7](UAT-PRIVACY-7.md) | Other players' Sheets and Campaign roster            |
| 118           | 3     | [UAT-PRIVACY-9](UAT-PRIVACY-9.md) | A hidden Concentration source stays hidden           |
| 128           | 3     | [UAT-PRIVACY-4](UAT-PRIVACY-4.md) | Ownership transfer changes who sees what             |
| 130           | 3     | [UAT-PRIVACY-3](UAT-PRIVACY-3.md) | Non-members, removed players and signed-out visitors |
| 131           | 3     | [UAT-PRIVACY-8](UAT-PRIVACY-8.md) | Campaign content stays hidden until revealed         |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                          |
| ----------- | --------------------------------------------------------------------------- |
| PRIVACY-1.3 | Every producer using the reviewed dispatcher is a code and contract review. |
