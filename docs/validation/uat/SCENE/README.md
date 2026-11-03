# Scenes and maps — UAT scenarios

Feature `SCENE` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves a GM can upload and calibrate a map, build and present a Scene with tokens, walls, doors, light and fog, that players see exactly what they should and nothing hidden, and that several players can share one table screen. Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several windows: [README](../README.md#role-setup-for-the-owner). Record results: [README](../README.md#recording-results). The scenarios build on each other: run [UAT-SCENE-1](UAT-SCENE-1.md) first, because it creates the Scene the later ones use.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                      | Title                                       |
| ------------- | ----- | ----------------------------- | ------------------------------------------- |
| 65            | 2     | [UAT-SCENE-1](UAT-SCENE-1.md) | Upload a map, calibrate and create a Scene  |
| 66            | 2     | [UAT-SCENE-2](UAT-SCENE-2.md) | Map upload refusals                         |
| 67            | 2     | [UAT-SCENE-3](UAT-SCENE-3.md) | Present a Scene and build it live           |
| 68            | 2     | [UAT-SCENE-4](UAT-SCENE-4.md) | Fog of war off, shared and per player       |
| 69            | 2     | [UAT-SCENE-5](UAT-SCENE-5.md) | Doors                                       |
| 70            | 2     | [UAT-SCENE-6](UAT-SCENE-6.md) | Offline edits recover                       |
| 71            | 2     | [UAT-SCENE-9](UAT-SCENE-9.md) | One shared table screen for several players |
| 77            | 2     | [UAT-SCENE-7](UAT-SCENE-7.md) | Map ownership and deletion                  |
| 145           | 4     | [UAT-SCENE-8](UAT-SCENE-8.md) | GM loot tables                              |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCENE-2.3 | Maximum-polygon and full fog-capacity coverage is a storage limit test; drawing the largest allowed polygon by hand is impractical, and the ordinary walls, fog and light of scenarios 3 and 4 show the same code working at normal size. |
