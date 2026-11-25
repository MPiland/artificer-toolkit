# Character Builder — UAT scenarios

Feature `BUILDER` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a player can build a Character from choices, save and resume drafts, commit it to a playable Sheet, and that Characters stay playable and repair themselves when the content they use is changed or removed. Authoring itself is in [AUTHORING](../AUTHORING/README.md). The Sheet on a phone is in the Sheet file.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUILDER-2.3 | Convex limits, per-edit call counts, autosave bytes, commit database I/O and worker chunk size; measured by a harness and the build, not visible on screen (the Builder working is [UAT-BUILDER-1](UAT-BUILDER-1.md) and 3). |
| BUILDER-2.4 | Exact removal of test fixtures and stale-JWT denial; a test-harness property.                                                                                                                                                |
