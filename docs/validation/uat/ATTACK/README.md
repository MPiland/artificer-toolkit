# Attacks and actions — UAT scenarios

Feature `ATTACK` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Every role is a different person on their own device, signed in to their own account. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results).

In this file "Auto-roll ON" means the players' setting; the GM's stays OFF, so monster rolls raise a roll prompt the GM answers. The Campaign is hosted by GM with P1, P2 and P3 seated. Each player built their own Characters in the Character Builder. Aria (P1), Bryn (P2) and Cade (P3) are level-1 Fighters with a club: no Extra Attack and no spells. Ember (P1's level 3 Wizard with Shield and Hold Person prepared) is the caster the scenarios that need one bring in. Scenarios that need other Characters (levelled, multiclassed or two-weapon) say what the player must build; a player can keep several Characters on the Party roster but only one is the Active Character that plays, so the player adds the new Character (**Add Character**, it lands on the bench) and chooses **Mark active** between Encounters, as when a party's caster joins for an arc. A free account holds 6 personal Characters. Scenarios that change the Campaign say how to put it back in their restore steps.

This file proves a GM and up to three players can fight at the same time: each player acts only for their own Characters on their own turn, Assisted mode warns (and lets the GM or player proceed when the rule is bendable), the GM can undo the last action, and the combat rules, monster attacks and class features resolve as the SRD says.

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATTACK-6.1  | The loadout's stored contract shared by authoring and Encounters; checked by schema tests. The behaviour it supports is [UAT-ATTACK-11](UAT-ATTACK-11.md) step 5. |
| ATTACK-6.2  | A source-data audit of the Creature equipment, not something a screen shows.                                                                                      |
| ATTACK-6.3  | A shared derivation path (Creature and Character gear use one code path) with no behaviour change a tester could see.                                             |
| ATTACK-11.2 | A stat-block audit over all 142 SRD Multiattacks. [UAT-ATTACK-10](UAT-ATTACK-10.md) spot-checks the visible effect on a sample of monsters.                       |
