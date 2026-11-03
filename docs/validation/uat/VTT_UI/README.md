# VTT presentation — UAT scenarios

Feature `VTT_UI` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup). Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several users: [README](../README.md#role-setup-for-the-owner). Record results: [README](../README.md#recording-results). Gaps: [README](../OPERATOR.md#known-uat-gaps).

This file proves the live map shows each token's identity, conditions, facing and system state clearly, previews and perception match the rules, footprints and dragging behave, and the map is usable by keyboard, at low zoom, without relying on colour, and with a screen reader.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                        | Title                                                 |
| ------------- | ----- | ------------------------------- | ----------------------------------------------------- |
| 115           | 3     | [UAT-VTT_UI-1](UAT-VTT_UI-1.md) | Token identity, status rings, facing and system state |
| 116           | 3     | [UAT-VTT_UI-2](UAT-VTT_UI-2.md) | Previews, footprints, large tokens and dragging       |
| 117           | 3     | [UAT-VTT_UI-4](UAT-VTT_UI-4.md) | Keyboard, screen reader and low zoom                  |
| 140           | 3     | [UAT-VTT_UI-3](UAT-VTT_UI-3.md) | Light, fog, senses and the GM's view preview          |

## Covered elsewhere

| AC         | Why not a UAT step                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VTT_UI-5.1 | A source-data audit comparing every SRD Creature's structured senses with its printed ones. A tester cannot check all of them; [UAT-VTT_UI-3](UAT-VTT_UI-3.md) step 11 spot-checks one (the Wolf). |
