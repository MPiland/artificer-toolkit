# Character Builder — UAT scenarios

Feature `BUILDER` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a player can build a Character from choices, save and resume drafts, commit it to a playable Sheet, and that Characters stay playable and repair themselves when the content they use is changed or removed. Authoring itself is in [AUTHORING](../AUTHORING/README.md). The Sheet on a phone is in the Sheet file.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                          | Title                                                         |
| ------------- | ----- | --------------------------------- | ------------------------------------------------------------- |
| 33            | 1     | [UAT-BUILDER-1](UAT-BUILDER-1.md) | Build a Character, save, resume and commit                    |
| 34            | 1     | [UAT-BUILDER-2](UAT-BUILDER-2.md) | Two windows on one draft cannot overwrite each other          |
| 35            | 1     | [UAT-BUILDER-3](UAT-BUILDER-3.md) | Choice-heavy builds — multiclass and spellcaster              |
| 36            | 1     | [UAT-BUILDER-7](UAT-BUILDER-7.md) | Build the Characters P2 and P3 will use in The Campaign       |
| 37            | 1     | [UAT-BUILDER-4](UAT-BUILDER-4.md) | Removing content a Character uses repairs the Character       |
| 38            | 1     | [UAT-BUILDER-6](UAT-BUILDER-6.md) | Imported custom items keep their kind, properties and damage  |
| 54            | 2     | [UAT-BUILDER-5](UAT-BUILDER-5.md) | Withdrawing shared content reconciles assigned Characters     |
| 70            | 2     | [UAT-BUILDER-8](UAT-BUILDER-8.md) | Permanently delete a Character that is in a running Encounter |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUILDER-2.3 | Convex limits, per-edit call counts, autosave bytes, commit database I/O and worker chunk size; measured by a harness and the build, not visible on screen (the Builder working is [UAT-BUILDER-1](UAT-BUILDER-1.md) and 3). |
| BUILDER-2.4 | Exact removal of test fixtures and stale-JWT denial; a test-harness property.                                                                                                                                                |
