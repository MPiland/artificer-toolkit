# Token movement — UAT scenarios

Feature `MOVE` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

Proves a player can move only their own token, that the table stops illegal moves (walls, hostile spaces, the map edge, locked tokens), that leaving an enemy's reach pauses for the GM's answer, that the GM can undo a token move, and that traps, hidden hazards and climbing behave and stay hidden from players. Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several windows: [README](../README.md#role-setup-for-the-owner). Record results: [README](../README.md#recording-results). Scenes with walls, doors and zones do not exist in the review data: build them in a sandbox Campaign (see SCENE UAT, [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md) and [UAT-SCENE-3](../SCENE/UAT-SCENE-3.md)) or add them to Review: Party in the Field in the steps.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                    | Title                                              |
| ------------- | ----- | --------------------------- | -------------------------------------------------- |
| 72            | 2     | [UAT-MOVE-5](UAT-MOVE-5.md) | Moving outside an Encounter and in a sandbox       |
| 73            | 2     | [UAT-MOVE-6](UAT-MOVE-6.md) | Peers converge, reload and departure               |
| 104           | 3     | [UAT-MOVE-1](UAT-MOVE-1.md) | A player moves their own token                     |
| 105           | 3     | [UAT-MOVE-3](UAT-MOVE-3.md) | Opportunity attack pauses the move                 |
| 106           | 3     | [UAT-MOVE-4](UAT-MOVE-4.md) | Undo last token move                               |
| 107           | 3     | [UAT-MOVE-7](UAT-MOVE-7.md) | Overrun, Shove Aside and Tumble                    |
| 125           | 3     | [UAT-MOVE-2](UAT-MOVE-2.md) | Refusals at walls, hostile spaces and the map edge |
| 126           | 3     | [UAT-MOVE-8](UAT-MOVE-8.md) | Hidden hazards, traps and auras                    |
| 127           | 3     | [UAT-MOVE-9](UAT-MOVE-9.md) | Climb onto a larger creature                       |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC       | Why not a UAT step                                                                                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-2.1 | The Overrun policy's authored shape and typing is a contract check; what it produces (the contested Overrun move) is exercised by MOVE-2.2 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                         |
| MOVE-2.3 | Same for the Shove Aside policy; its behaviour is MOVE-2.4 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                                                                                                         |
| MOVE-2.5 | Same for the Tumble policy; its behaviour is MOVE-2.6 in [UAT-MOVE-7](UAT-MOVE-7.md).                                                                                                                                                                                              |
| MOVE-3.4 | A camouflaged zone comes only from an authored zone manifest on a Spell, which a tester would have to author and cast; the ledger proof is an authoring-parity test through the real form. The GM-set Spot DC in [UAT-MOVE-8](UAT-MOVE-8.md) shows the same concealment on screen. |
