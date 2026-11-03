# UAT-SCENE-3: Present a Scene and build it live

Present a Scene and build it live.

Level 2 (GM setup) · Feature SCENE · Run order 63 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-SCENE-1](UAT-SCENE-1.md): the Scene "UAT Cavern" exists in the Sandbox Campaign, calibrated at 5 ft squares.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are Sandbox members with Characters.

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).
- **Settings:** Fog is off.

## Steps

1. **GM:** Open the tabletop window and choose **Present a scene**, then pick "UAT Cavern".
2. **P1:** Open the tabletop window.
3. **P2:** Open the tabletop window.
4. **GM:** Add a token for P1's Character and place it on the map.
5. **GM:** Add a second token for a creature (for example a Goblin) and mark it **Hidden from players**.
6. **GM:** Draw a wall across the map.
7. **GM:** Add a door, a window, a one-way barrier and a light on the map.
8. **GM:** Draw a darkness zone.
9. **GM:** Add a GM note with **GM only** visibility.
10. **GM:** Check the **Scene objects** list.
11. **P1:** Compare the map with what the GM sees.
12. **GM:** Make the goblin visible (turn off Hidden from players).
13. **GM:** Move the wall a little.

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
- **Failed step:**
- **Notes:**
