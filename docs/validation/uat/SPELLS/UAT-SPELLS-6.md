# UAT-SPELLS-6: Cover from walls and manual cover

Cover from walls and manual cover.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 159 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in The Campaign with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Turn **Automatic cover** ON and draw the walls the steps need with the wall tool ([SCENE-3](../SCENE/UAT-SCENE-3.md)).

1. [ ] **GM:** Draw a wall between Sage and a Goblin leaving a gap, so the Goblin is half-covered.
2. [ ] **P1:** Cast Ray of Frost (an attack) at the Goblin. Confirm the roll shows a labelled cover bonus (+2).
3. [ ] **P1:** Cast Fireball with the cover boundary near a second Goblin. Confirm that Goblin's Dexterity save shows its cover bonus.
4. [ ] **GM:** Move a Goblin entirely behind a solid wall. Confirm total cover blocks the attack.
5. [ ] **GM:** On a creature's cover, change the tier by hand (for example to three-quarters, +5). Confirm the roll shows +5.
6. [ ] **GM:** Choose **Complete encounter**, then in table settings untick **Automatic cover** and save (the setting is frozen into an Encounter when it is created). Rebuild the arena as a new Encounter with scenario 2 steps 4 and 5, keeping the wall.
7. [ ] **GM:** In the new Encounter, confirm a Goblin half behind the wall now gets no automatic bonus. Set that target's cover tier by hand. **P1:** Attack it with Ray of Frost. Confirm the same bonus applies as when cover was automatic.
8. [ ] **GM:** To leave the later scenarios as they were, choose **Complete encounter**, tick **Automatic cover** again, save, and rebuild the arena with scenario 2 steps 4 and 5.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
