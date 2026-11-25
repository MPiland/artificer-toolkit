# UAT-SCENE-3: Present a Scene and build it live

Present a Scene and build it live.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1, P2) · Path position 61 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-1](UAT-SCENE-1.md): the Scene "UAT Cavern" exists in The Campaign, calibrated at 5 ft squares.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are members of The Campaign with Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.
- **Settings:** Fog is off.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open the tabletop window and choose **Present a scene**, then pick "UAT Cavern".
2. [ ] **P1:** Open the tabletop window.
3. [ ] **P2:** Open the tabletop window.
4. [ ] **GM:** Add a token for P1's Character and place it on the map.
5. [ ] **GM:** Add a second token for a creature (for example a Goblin) and mark it **Hidden from players**.
6. [ ] **GM:** Draw a wall across the map.
7. [ ] **GM:** Add a door, a window, a one-way barrier and a light on the map.
8. [ ] **GM:** Draw a darkness zone.
9. [ ] **GM:** Add a GM note with **GM only** visibility.
10. [ ] **GM:** Check the **Scene objects** list.
11. [ ] **P1:** Compare the map with what the GM sees.
12. [ ] **GM:** Make the goblin visible (turn off Hidden from players).
13. [ ] **GM:** Move the wall a little.

## Expected

- Players see the presented Scene's map. Every non-hidden token, wall, door, window, one-way barrier and light is visible to P1 and P2; the hidden token is not. The darkness zone shows to players as the GM drew it.
- Edits the GM makes (step 13) show on P1 and P2 within a second and they converge to the same picture as the GM.
- After step 12 the goblin token appears for P1 and P2.

## Other users see

- **P1 and P2:** must NOT see the hidden goblin token before step 12, the GM-only note, the Scene objects list, or the GM's editing tools.

## ACs covered

SCENE-1.2, SCENE-2.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
