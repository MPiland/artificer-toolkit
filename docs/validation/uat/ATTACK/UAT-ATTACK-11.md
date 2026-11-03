# UAT-ATTACK-11: Weapons in hand, loadouts and Disarm

Weapons in hand, loadouts and Disarm.

Level 3 (Core play) · Feature ATTACK · Mode: Group (GM, P1) · Path position 132 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1:** In the Builder give "UAT Dara" two light melee weapons (main and off hand) and a shortbow with arrows, then commit. The Sheet owns equipment changes, so you may instead equip them on the Sheet as in [SHEET-8](../SHEET/UAT-SHEET-8.md).
S2. **GM:** In table settings enable **Track ammunition**. **GM:** In the Sandbox Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first). Add a Goblin if the Run lacks one. Open the Goblin's actor card in two browser tabs for steps 5 to 7. P1: Auto-roll ON.

1. **P1:** On P1's Character's turn, attack. Confirm the main-hand weapon and full damage are used; the off-hand attack as a bonus action adds no positive ability modifier unless the Character has Two-Weapon Fighting.
2. **P1:** Empty a hand (stow one weapon), then attack with the other. Confirm the attack draws the bound weapon into the free hand automatically.
3. **P1:** Throw a weapon. Confirm it leaves the hand. Swap weapons and confirm swaps are free.
4. **GM:** Attempt Disarm against P1's Character in Assisted mode. Confirm the player must give evidence (a roll) and the item leaves the held hand.
5. **GM:** Replace the Goblin's loadout (active Creature actor) from the actor card. Confirm the new loadout appears and the Goblin's next attack uses it.
6. **GM (tab A and tab B):** On the Goblin's turn, with its attack ready to confirm in tab A, replace the loadout in tab B and confirm the attack in tab A within a second of each other.
7. **GM:** Read the Encounter history and the Goblin's loadout.
8. **P1:** With ammunition tracking on, fire the shortbow until the stack is empty. Confirm the next shot is refused. Turn tracking off in a new Encounter and confirm the bonuses still apply and nothing is counted.

## Expected

- Weapons move between hands as described; ammunition is counted only when tracking is on, with one piece per shot.
- Steps 6 to 7: either the attack resolved with the old loadout and then the loadout changed, or the loadout changed and the attack was refused or resolved with the new one; the history shows each once, the Goblin's loadout is the new one, and nothing is half-applied.

## Other users see

- **P1:** Sees the item-held change on the Sheet and the Goblin's attack result on the table; sees no loadout internals.

## ACs covered

ATTACK-1.1, ATTACK-6.4, ATTACK-6.5, ATTACK-6.6, ATTACK-19.1, ATTACK-19.2, ATTACK-19.3, ATTACK-19.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
