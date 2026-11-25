# Character Sheet — UAT scenarios

Feature `SHEET` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a player can run their Character from the Sheet (hit points, rests, spells, rolls, gear, hands, Speed) on desktop and on a phone, that what they share or hide at the table is exactly what they chose, and that the Sheet and the live table never disagree. Accounts: [README](../README.md#roles-and-accounts), [README](../OPERATOR.md#review-data). Several windows side by side: [README](../README.md#role-setup-for-the-owner). Record results: [TESTERS](../TESTERS.md#recording-results).

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                   |
| --------- | ------------------------------------------------------------------------------------ |
| SHEET-5.1 | Two simultaneous Builder commits is a concurrency harness; not reproducible by hand. |
| SHEET-5.4 | Post-write failure rollback needs fault injection.                                   |
| SHEET-7.1 | Records read by a note edit is a storage measurement.                                |
