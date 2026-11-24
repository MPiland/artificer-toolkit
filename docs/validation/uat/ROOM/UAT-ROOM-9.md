# UAT-ROOM-9: Live play commands go through the room

Live play commands go through the room.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1) · Path position 80 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open Aria's Sheet in a second tab; note hit points.
2. [ ] **GM:** Apply 2 damage to Aria through the Encounter actor controls.
3. [ ] **P1:** Check the Sheet and the tabletop.
4. [ ] **P1:** On the Sheet apply 1 point of healing.
5. [ ] **GM:** Check Aria's hit points on the tabletop.
6. [ ] **GM:** Move Aria's token one square.
7. [ ] **P1:** In the tabletop window, try to drag Bryn's token one square. **GM:** check Bryn's token on the GM's tabletop and reload it.
8. [ ] **Both:** Close the Sheet and the tabletop windows and wait six minutes (the room saves and closes).
9. [ ] **GM:** Open the tabletop window again and the Sheet in another tab.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
