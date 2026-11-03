# Attacks and actions — UAT scenarios

Feature `ATTACK` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup). Accounts: [README](../README.md#roles-and-accounts). Review data: [README](../OPERATOR.md#review-data). Several users: [README](../README.md#role-setup-for-the-owner). Record results: [TESTERS](../TESTERS.md#recording-results). Gaps: [README](../OPERATOR.md#known-uat-gaps).

In this file "Auto-roll ON" means the players' setting; the GM's stays OFF, so monster rolls raise a roll prompt the GM answers. Aria, Bryn and Cade are level-1 Fighters with a club: no Extra Attack and no spells. Casters are Ember (Review: Shield and Hold) and Pyra (Review: Fire and Thunder). Scenarios that need other Characters (levelled, multiclassed or two-weapon) use P1's Character in your own Sandbox Campaign ([UAT-SCENE-1](../SCENE/UAT-SCENE-1.md), not Review: Sandbox) built in the Builder (Heavy setup: build the Character by hand; a player can have only one Character per Campaign, so swap with **Change Character** on the Party panel). Several scenarios change review data: reset it (README setup steps 2 to 5) when you need it clean again.

This file proves a GM and up to three players can fight at the same time: each player acts only for their own Characters on their own turn, Assisted mode warns (and lets the GM or player proceed when the rule is bendable), the GM can undo the last action, and the combat rules, monster attacks and class features resolve as the SRD says.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                          | Title                                                               |
| ------------- | ----- | --------------------------------- | ------------------------------------------------------------------- |
| 93            | 3     | [UAT-ATTACK-1](UAT-ATTACK-1.md)   | Effects, movement, reactions and the turn lifecycle pass end to end |
| 94            | 3     | [UAT-ATTACK-2](UAT-ATTACK-2.md)   | Players control only their own actors                               |
| 95            | 3     | [UAT-ATTACK-5](UAT-ATTACK-5.md)   | Targeting, hidden creatures and private roll cards                  |
| 96            | 3     | [UAT-ATTACK-6](UAT-ATTACK-6.md)   | Hiding, invisibility and unseen attackers                           |
| 97            | 3     | [UAT-ATTACK-8](UAT-ATTACK-8.md)   | Grapple, shove and basic actions                                    |
| 98            | 3     | [UAT-ATTACK-10](UAT-ATTACK-10.md) | Multiattack and SRD monster attacks                                 |
| 132           | 3     | [UAT-ATTACK-7](UAT-ATTACK-7.md)   | Optional combat rules in play                                       |
| 133           | 3     | [UAT-ATTACK-9](UAT-ATTACK-9.md)   | Class features in play                                              |
| 134           | 3     | [UAT-ATTACK-11](UAT-ATTACK-11.md) | Weapons in hand, loadouts and Disarm                                |
| 146           | 4     | [UAT-ATTACK-3](UAT-ATTACK-3.md)   | Assisted warnings and "Do it anyway"                                |
| 147           | 4     | [UAT-ATTACK-4](UAT-ATTACK-4.md)   | Undo last action and its refusals                                   |

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATTACK-6.1  | The loadout's stored contract shared by authoring and Encounters; checked by schema tests. The behaviour it supports is [UAT-ATTACK-11](UAT-ATTACK-11.md) step 5. |
| ATTACK-6.2  | A source-data audit of the Creature equipment, not something a screen shows.                                                                                      |
| ATTACK-6.3  | A shared derivation path (Creature and Character gear use one code path) with no behaviour change a tester could see.                                             |
| ATTACK-11.2 | A stat-block audit over all 142 SRD Multiattacks. [UAT-ATTACK-10](UAT-ATTACK-10.md) spot-checks the visible effect on a sample of monsters.                       |
