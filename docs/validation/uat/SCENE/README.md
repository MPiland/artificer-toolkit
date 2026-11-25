# Scenes and maps — UAT scenarios

Feature `SCENE` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves a GM can upload and calibrate a map, build and present a Scene with tokens, walls, doors, light and fog, that players see exactly what they should and nothing hidden, and that several players can share one table screen. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results). The scenarios build on each other: run [UAT-SCENE-1](UAT-SCENE-1.md) first, because it creates the Scene the later ones use.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCENE-2.3 | Maximum-polygon and full fog-capacity coverage is a storage limit test; drawing the largest allowed polygon by hand is impractical, and the ordinary walls, fog and light of scenarios 3 and 4 show the same code working at normal size. |
