# UAT-SPELLS-3: Fireball on a group with saves answered by different controllers

Fireball on a group with saves answered by different controllers.

Level 4 (Advanced play) · Feature SPELLS · Run order 151 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Drag Hale's token into the goblin group's blast zone on purpose. GM's and P2's Auto-roll OFF. **Everyone:** Take a Long Rest on the Sheet first if the scenario needs spare slots, and clear old grants and conditions from earlier scenarios. Sage needs two 3rd-level and one 4th-level slot spare.

1. **P1:** On Sage's turn choose **Fireball (3rd level)** and click a point on the map near the three Goblins and Hale.
2. **P1:** Before it resolves, read the list of creatures caught. Confirm Hale (an ally) and the Goblins are listed.
3. **P1:** Aim a second point far beyond the spell's range. Confirm an overridable warning, then cancel.
4. **GM:** On the pending area, remove one Goblin from the list. Confirm only the GM has that control (P1 and P2 do not).
5. **P2:** Confirm Hale's own save prompt appears for P2 only. Answer by typing a roll.
6. **GM:** Answer the two remaining Goblin save prompts, in any order, one with a low roll and one with a high roll.
7. **P1:** Confirm the action only settles after the last save is in. Read the damage on each target in the history.
8. **GM:** Open the history. Confirm damage was rolled once for the area (8d6), full on a failed save and half on a success, per target.
9. **GM:** Choose Undo last action. Confirm every target's hit points return and Sage's slot returns.
10. **P1:** Recast at the 4th-level row. Confirm 9d6 is rolled for the area and a 4th-level slot is spent.
11. **GM:** Undo the 4th-level cast. **P1 (Sage, Evocation):** Cast Fireball at the 3rd-level row again and in the caster's choices use **Sculpt Spells** to spare Hale. Confirm Hale automatically succeeds and takes no damage while the Goblins still save.
12. **GM:** Undo that cast, then switch your own Auto-roll switch ON, and have **P1** recast Fireball. Confirm the Goblin saves are rolled without a prompt, while **P2** is still asked for Hale unless P2's own Auto-roll is on. Switch the GM's Auto-roll back OFF afterwards.

## Expected

- Each caught creature, allies and Sage's own side included, gets a save asked at once of its own controller; the area commits once.
- Removing a creature and undoing both work; undo reverts every target and the slot.
- Area actions that leave a condition on each caught creature (scenario 18) are undone together; this scenario only proves damage.

## Other users see

- **P2:** Sees only Hale's prompt, not the Goblin prompts. Sees the final damage cards.
- **P3 (if open):** Sees the result cards but no prompts.

## ACs covered

SPELLS-7.1, SPELLS-7.2, SPELLS-8.4, SPELLS-1.1, SPELLS-1.2, SPELLS-16.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
