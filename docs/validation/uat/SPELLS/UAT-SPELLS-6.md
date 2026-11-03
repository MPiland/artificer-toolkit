# UAT-SPELLS-6: Cover from walls and manual cover

Cover from walls and manual cover.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 158 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Turn **Automatic cover** ON and draw the walls the steps need with the wall tool ([SCENE-3](../SCENE/UAT-SCENE-3.md)).

1. **GM:** Draw a wall between Sage and a Goblin leaving a gap, so the Goblin is half-covered.
2. **P1:** Cast Ray of Frost (an attack) at the Goblin. Confirm the roll shows a labelled cover bonus (+2).
3. **P1:** Cast Fireball with the cover boundary near a second Goblin. Confirm that Goblin's Dexterity save shows its cover bonus.
4. **GM:** Move a Goblin entirely behind a solid wall. Confirm total cover blocks the attack.
5. **GM:** On a creature's cover, change the tier by hand (for example to three-quarters, +5). Confirm the roll shows +5.
6. **GM:** Choose **Complete encounter**, then in table settings untick **Automatic cover** and save (the setting is frozen into an Encounter when it is created). Rebuild the arena as a new Encounter with scenario 2 steps 4 and 5, keeping the wall.
7. **GM:** In the new Encounter, confirm a Goblin half behind the wall now gets no automatic bonus. Set that target's cover tier by hand. **P1:** Attack it with Ray of Frost. Confirm the same bonus applies as when cover was automatic.
8. **GM:** To leave the later scenarios as they were, choose **Complete encounter**, tick **Automatic cover** again, save, and rebuild the arena with scenario 2 steps 4 and 5.

## Expected

- With automatic cover on, the app shows a labelled bonus and total cover blocks; with it off, nothing is applied until the GM sets the tier by hand.

## Other users see

- **P2:** Sees the labelled bonus in cards only on rolls they can see.

## ACs covered

SPELLS-14.1, SPELLS-14.2

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
