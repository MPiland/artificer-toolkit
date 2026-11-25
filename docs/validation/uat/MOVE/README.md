# Token movement — UAT scenarios

Feature `MOVE` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Every role is a different person on their own device, signed in to their own account.

Proves a player can move only their own token, that the table stops illegal moves (walls, hostile spaces, the map edge, locked tokens), that leaving an enemy's reach pauses for the GM's answer, that the GM can undo a token move, and that traps, hidden hazards and climbing behave and stay hidden from players. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results). Scenes with walls, doors and zones are built by the GM in The Campaign (see SCENE UAT, [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md) and [UAT-SCENE-3](../SCENE/UAT-SCENE-3.md)) or added in the steps; The Campaign holds at most 5 Scenes on the free plan.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC       | Why not a UAT step                                                                                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-2.1 | The Overrun policy's authored shape and typing is a contract check; what it produces (the contested Overrun move) is exercised by MOVE-2.2 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                         |
| MOVE-2.3 | Same for the Shove Aside policy; its behaviour is MOVE-2.4 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                                                                                                         |
| MOVE-2.5 | Same for the Tumble policy; its behaviour is MOVE-2.6 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                                                                                                              |
| MOVE-3.4 | A camouflaged zone comes only from an authored zone manifest on a Spell, which a tester would have to author and cast; the ledger proof is an authoring-parity test through the real form. The GM-set Spot DC in [UAT-MOVE-8](UAT-MOVE-8.md) shows the same concealment on screen. |
