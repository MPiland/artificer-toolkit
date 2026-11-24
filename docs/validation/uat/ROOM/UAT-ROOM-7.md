# UAT-ROOM-7: Show a map to players without presenting

Show a map to players without presenting.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1, P2) · Path position 81 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).
- Use the provided file [assets/sample-battle-map-b.png](../assets/sample-battle-map-b.png): the different map image for the throwaway Scene "UAT Map B".

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** In The Campaign create a Scene "UAT Map B" with the provided map, one token and, if the editor offers it, one wall (as in [SCENE-1](../SCENE/UAT-SCENE-1.md)). Do not delete any other Scene.

1. [ ] **GM:** In the tabletop window choose to show "UAT Map B" to players (**Choose a Campaign scene to show at the table**, then show it).
2. [ ] **P1:** Look at the tabletop window.
3. [ ] **GM:** Check that the presented Scene (with its tokens) has not changed for the Encounter.
4. [ ] **GM:** Stop showing it.
5. [ ] **P1:** Try to open the shown map again (browser back).
6. [ ] **GM:** Show it again, then delete "UAT Map B".
7. [ ] **P2:** Check the window.

## Expected

- Players see a view-only image of the shown map, with that Scene's fog if it has fog. They do not see any tokens or objects on the shown Scene.
- The presented Scene and the Encounter are unchanged.
- After stopping, or after the Scene is deleted, players cannot see the map any more.

## Other users see

- **P1, P2:** must NOT see the second Scene's tokens, walls or hidden objects at any time, only the map and fog.

## ACs covered

ROOM-3.6

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
