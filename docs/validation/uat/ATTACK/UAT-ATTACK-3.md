# UAT-ATTACK-3: Assisted warnings and "Do it anyway"

Assisted warnings and "Do it anyway".

Level 4 (Advanced play) · Feature ATTACK · Run order 142 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Party Encounter was completed; the Party Scene is still presented.

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** If Review: Party in the Field has no running Encounter, create and start one with Aria, Bryn, Cade, a Wolf and a Goblin, as in [ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) steps 12 to 16, and advance until Aria is the active actor.
S2. **P1:** Switch **Auto-roll** ON.

1. **P1:** On Aria's turn, pick an attack and aim at the Wolf. Move Aria's token away first so the Wolf is out of weapon range (use a square or two more than her reach).
2. **P1:** Confirm. Read the warning and confirm it has a **Do it anyway** button.
3. **P1:** Choose **Do it anyway**. Confirm the attack resolves.
4. **GM:** Open the Encounter history. Confirm the entry shows an override badge.
5. **P1:** Spend the Action (attack), then try a second action that needs an Action. Read the warning and choose **Do it anyway**.
6. **P1:** Use Aria's Second Wind (a limited-use feature), then try it a second time and, if a warning with **Do it anyway** appears, choose it. Check Aria's Second Wind uses on the Sheet: confirm they never go below zero.
7. **P1:** Target a friendly creature (Bryn) with an attack. Read the disposition warning and confirm it offers **Do it anyway** (the dimmed-with-reason actions of [UAT-ATTACK-1](UAT-ATTACK-1.md) step 3 and this friendly-target warning are ATTACK-3.1, covered in [UAT-ATTACK-1](UAT-ATTACK-1.md)).
8. **P1:** On the Sheet unequip Aria's club, then try an attack with it from the drawer. Read the warning.
9. **P2:** On Bryn's turn, try to act out of turn for Aria. Confirm the refusal has no **Do it anyway** button.
10. **P1:** In a duplicate browser tab with an old copy of the page (do not reload), try to act again after the Encounter changed in the other tab. Confirm a stale-information refusal with no **Do it anyway**.
11. **GM:** Complete the Encounter (this ends the Review Encounter; the Party Encounter is not needed again). **P1:** From the old tab try an action on the completed Encounter. Confirm refusal with no **Do it anyway**.

## Expected

- Out of range, wrong target disposition, no action left and unequipped weapon warn with **Do it anyway**; an overridden action works and the GM sees a badge on it in history.
- Never overridable: not allowed to act, acting out of turn, stale information, an invalid game state. These have no **Do it anyway**.
- Overrides never drive a resource such as a spell slot or charges negative.
- Aria's Attack action has one attack, so a second attack is not offered as part of it and shows the action-economy warning with **Do it anyway** (step 5). That an extra attack that fits the open action raises no warning is shown in [UAT-ATTACK-9](UAT-ATTACK-9.md) step 6a.

## Other users see

- **GM:** The history shows each override with a badge and the player's name; other players do not see the override badge.

## ACs covered

ATTACK-3.2, ATTACK-8.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
