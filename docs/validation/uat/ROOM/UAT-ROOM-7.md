# UAT-ROOM-7: Show a map to players without presenting

Show a map to players without presenting.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1, P2) · Path position 85 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Use the provided file [assets/sample-battle-map-b.png](../assets/sample-battle-map-b.png): the different map image for the throwaway Scene "UAT Map B".

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Party in the Field create a Scene "UAT Map B" with the provided map, one token and, if the editor offers it, one wall (as in [SCENE-1](../SCENE/UAT-SCENE-1.md)). Do not delete any other Scene.

1. **GM:** In the tabletop window choose to show "UAT Map B" to players (**Choose a Campaign scene to show at the table**, then show it).
2. **P1:** Look at the tabletop window.
3. **GM:** Check that the presented Scene (with its tokens) has not changed for the Encounter.
4. **GM:** Stop showing it.
5. **P1:** Try to open the shown map again (browser back).
6. **GM:** Show it again, then delete "UAT Map B".
7. **P2:** Check the window.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
