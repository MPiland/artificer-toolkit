# Encounter setup — UAT scenarios

Feature `ENCOUNTER` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

This file proves a GM and up to three players can prepare, start, run and finish an Encounter in both Assisted and Manual mode, with the right people controlling the right creatures, every initiative style working, and the table seeing the same thing at the same time.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in. Set the Status column to the same result (PASSED, FAILED, BLOCKED or SKIPPED) so you can see where you left off.

| Path position | Level | Scenario                              | Title                                                       | Status  |
| ------------- | ----- | ------------------------------------- | ----------------------------------------------------------- | ------- |
| 68            | 2     | [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md) | Prepare, start, delete and persist a Run                    | NOT RUN |
| 69            | 2     | [UAT-ENCOUNTER-7](UAT-ENCOUNTER-7.md) | Blueprint edits and who can reach them                      | NOT RUN |
| 140           | 3     | [UAT-ENCOUNTER-5](UAT-ENCOUNTER-5.md) | Morale                                                      | NOT RUN |
| 146           | 4     | [UAT-ENCOUNTER-6](UAT-ENCOUNTER-6.md) | Roll cards for turn-stage rolls                             | NOT RUN |
| 147           | 4     | [UAT-ENCOUNTER-4](UAT-ENCOUNTER-4.md) | Controllers, dispositions and removing a member             | NOT RUN |
| 148           | 4     | [UAT-ENCOUNTER-1](UAT-ENCOUNTER-1.md) | Assisted and Manual Encounter journeys pass                 | NOT RUN |
| 149           | 4     | [UAT-ENCOUNTER-2](UAT-ENCOUNTER-2.md) | Initiative and optional-combat combinations pass end to end | NOT RUN |

## Covered elsewhere

| AC            | Why not a UAT step                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENCOUNTER-2.6 | Forced rollbacks need injected failures a tester cannot cause; the race outcomes on lifecycle, binding and presentation are exercised by hand in [UAT-RELIABILITY-2](../RELIABILITY/UAT-RELIABILITY-2.md). |
