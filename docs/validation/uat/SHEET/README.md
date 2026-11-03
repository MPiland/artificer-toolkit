# Character Sheet — UAT scenarios

Feature `SHEET` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves a player can run their Character from the Sheet (hit points, rests, spells, rolls, gear, hands, Speed) on desktop and on a phone, that what they share or hide at the table is exactly what they chose, and that the Sheet and the live table never disagree. Accounts and review data: [README](../README.md#accounts), [README](../OPERATOR.md#review-data). Several windows side by side: [README](../README.md#running-several-users-side-by-side). Record results: [README](../README.md#recording-results).

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Run order | Level | Scenario                        | Title                                                 |
| --------- | ----- | ------------------------------- | ----------------------------------------------------- |
| 42        | 1     | [UAT-SHEET-1](UAT-SHEET-1.md)   | Edit a personal Sheet and reload                      |
| 43        | 1     | [UAT-SHEET-2](UAT-SHEET-2.md)   | Short and long rest                                   |
| 44        | 1     | [UAT-SHEET-3](UAT-SHEET-3.md)   | Learn, prepare and cast spells from the Sheet         |
| 45        | 1     | [UAT-SHEET-6](UAT-SHEET-6.md)   | Equipment, inventory, attunement and deleting an item |
| 46        | 1     | [UAT-SHEET-7](UAT-SHEET-7.md)   | Starting equipment on a new Character                 |
| 47        | 1     | [UAT-SHEET-8](UAT-SHEET-8.md)   | Hands, two-handed weapons and shields                 |
| 48        | 1     | [UAT-SHEET-9](UAT-SHEET-9.md)   | Speed on the overview and the Movement panel          |
| 49        | 1     | [UAT-SHEET-10](UAT-SHEET-10.md) | Sheet at phone width                                  |
| 85        | 3     | [UAT-SHEET-4](UAT-SHEET-4.md)   | Roll from the Sheet and choose who sees it            |
| 86        | 3     | [UAT-SHEET-5](UAT-SHEET-5.md)   | GM Public and Private rolls with reveals              |
| 87        | 3     | [UAT-SHEET-11](UAT-SHEET-11.md) | Sheet during live play and after reconnect            |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                   |
| --------- | ------------------------------------------------------------------------------------ |
| SHEET-5.1 | Two simultaneous Builder commits is a concurrency harness; not reproducible by hand. |
| SHEET-5.4 | Post-write failure rollback needs fault injection.                                   |
| SHEET-7.1 | Records read by a note edit is a storage measurement.                                |
