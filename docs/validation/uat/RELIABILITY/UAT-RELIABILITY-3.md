# UAT-RELIABILITY-3: The room closes after everyone leaves and reopens with state intact

The room closes after everyone leaves and reopens with state intact.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1, P3) · Path position 126 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Note the round, whose turn it is, Aria's and the Wolf's hit points, and the last three chat entries.
2. [ ] **P3:** On the Campaign page outside the table, note the hit points and conditions shown for each Character, and the round number.
3. [ ] **GM:** Make a change at the table, such as damaging the Wolf or changing Aria's hit points through the action drawer.
4. [ ] **P3:** Without refreshing, watch the Campaign page for the change.
5. [ ] **P1:** Open Aria's Sheet in another tab, change a play value (for example spend a hit die or edit hit points) and save it.
6. [ ] **GM:** Look at the live table for Aria's changed value, make one table action (for example **Next turn**) and look again.
7. [ ] **GM and P1:** Close every tabletop tab and window (stay signed in and stay members; do not use any Leave Campaign control).
8. [ ] Wait about six minutes with nobody in the room (the room closes about five minutes after the last person leaves).
9. [ ] **GM:** Reopen the live table with **Open tabletop window** in the **Live tabletop** panel.
10. [ ] **P1:** Reopen the live table.
11. [ ] **GM and P1:** Compare the round, current turn, hit points, positions, conditions and chat with your notes from step 1 and the changes from steps 3 and 5.
        R1. **GM:** Undo the changes of steps 3 and 5 through the normal controls (restore the hit points and position you noted).

## Expected

- Step 4: The Campaign page in P3's window updates by itself, with no refresh, to show the new hit points (and the round) for Characters P3 is allowed to see.
- Steps 2 and 4: P3 does not see another member's Character details unless that Character's Sheet is shared with the party; for one that is not shared, no hit points or conditions appear.
- Step 6: Aria's Sheet edit shows on the table at once or by the next table action, and no other play state (initiative, reactions, positions) is lost.
- Step 11: everything matches: same round and turn, same hit points including the Sheet edit, same positions and chat. Nothing is reset to the start.

## Other users see

- **P3:** Sees only party-visible values on the Campaign page, never another member's private Character details.
- **P1:** Sees the same restored state as the GM after reopening.

## ACs covered

RELIABILITY-2.5, RELIABILITY-2.6

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
