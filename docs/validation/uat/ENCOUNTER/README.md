# Encounter setup — UAT scenarios

Feature `ENCOUNTER` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup). Accounts: [README](../README.md#accounts). Review data: [README](../OPERATOR.md#review-data). Several users: [README](../README.md#running-several-users-side-by-side). Record results: [README](../README.md#recording-results). Gaps: [README](../OPERATOR.md#known-uat-gaps).

This file proves a GM and up to three players can prepare, start, run and finish an Encounter in both Assisted and Manual mode, with the right people controlling the right creatures, every initiative style working, and the table seeing the same thing at the same time.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Run order | Level | Scenario                              | Title                                                       |
| --------- | ----- | ------------------------------------- | ----------------------------------------------------------- |
| 70        | 2     | [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md) | Prepare, start, delete and persist a Run                    |
| 71        | 2     | [UAT-ENCOUNTER-7](UAT-ENCOUNTER-7.md) | Blueprint edits and who can reach them                      |
| 131       | 3     | [UAT-ENCOUNTER-5](UAT-ENCOUNTER-5.md) | Morale                                                      |
| 137       | 4     | [UAT-ENCOUNTER-6](UAT-ENCOUNTER-6.md) | Roll cards for turn-stage rolls                             |
| 138       | 4     | [UAT-ENCOUNTER-4](UAT-ENCOUNTER-4.md) | Controllers, dispositions and removing a member             |
| 139       | 4     | [UAT-ENCOUNTER-1](UAT-ENCOUNTER-1.md) | Assisted and Manual Encounter journeys pass                 |
| 140       | 4     | [UAT-ENCOUNTER-2](UAT-ENCOUNTER-2.md) | Initiative and optional-combat combinations pass end to end |

## Covered elsewhere

| AC            | Why not a UAT step                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENCOUNTER-2.6 | Forced rollbacks need injected failures a tester cannot cause; the race outcomes on lifecycle, binding and presentation are exercised by hand in [UAT-RELIABILITY-2](../RELIABILITY/UAT-RELIABILITY-2.md). |
