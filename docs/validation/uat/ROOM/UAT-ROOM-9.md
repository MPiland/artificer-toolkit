# UAT-ROOM-9: Live play commands go through the room

Live play commands go through the room.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1) · Path position 84 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open Aria's Sheet in a second tab; note hit points.
2. **GM:** Apply 2 damage to Aria through the Encounter actor controls.
3. **P1:** Check the Sheet and the tabletop.
4. **P1:** On the Sheet apply 1 point of healing.
5. **GM:** Check Aria's hit points on the tabletop.
6. **GM:** Move Aria's token one square.
7. **P1:** In the tabletop window, try to drag Bryn's token one square. **GM:** check Bryn's token on the GM's tabletop and reload it.
8. **Both:** Close the Sheet and the tabletop windows and wait six minutes (the room saves and closes).
9. **GM:** Open the tabletop window again and the Sheet in another tab.

## Expected

- Damage and healing show in the Sheet and tabletop right away and agree.
- Step 7: P1 cannot move a token P1 does not control; the move is refused, Bryn's token stays in its square on both windows, and nothing is written (still so after the GM's reload and after the room reopens). The refusal on the Convex path is proved by the room and Convex tests.
- The token's new square, Aria's hit points and the Encounter round are the same after the room has closed and reopened.
- No edit is lost or doubled.

## Other users see

- **GM:** sees P1's Sheet healing on the tabletop within a second.

## ACs covered

ROOM-5.1, ROOM-5.3, ROOM-5.4, ROOM-6.14

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
