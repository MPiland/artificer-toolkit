# UAT-ROOM-1: GM and three players join at once

GM and three players join at once.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1, P2, P3) · Path position 75 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- The account **P3** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open The Campaign and its session page. In the **Live tabletop** panel choose **Open tabletop window**.
2. [ ] **P1:** Open the same Campaign and choose **Open tabletop window**.
3. [ ] **P2:** Do the same.
4. [ ] **P3:** Do the same.
5. [ ] **GM:** Read the header badge and the text beside it.
6. [ ] **P1:** Read the header badge and the text beside it.
7. [ ] **GM:** Look for who is present in the room (names or portraits on the live table).
8. [ ] **P2:** Close the tabletop window.
9. [ ] **GM:** Check the presence list again.
10. [ ] **P2:** Reopen the tabletop window.
11. [ ] **All four:** Close every tabletop window and wait six minutes.
12. [ ] **GM:** Open the tabletop window again.

## Expected

- Every active member gets in without a Session being open. The GM sees a **GM** badge and "Live editing available"; players see a **Player** badge and "Play view". The header holds the **Auto-roll** switch.
- Presence updates as people join and leave without a reload.
- The Encounter, tokens and chat are the same for everyone after they join (as far as each may see).
- After step 12 the room starts again from the last saved state: the Encounter round, tokens and Scene are as you left them.

## Other users see

- **P1, P2, P3:** each see the other members as present; none sees GM-only controls ("Live editing available" is absent).

## ACs covered

ROOM-1.1, ROOM-1.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
