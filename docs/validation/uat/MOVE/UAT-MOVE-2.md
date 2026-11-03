# UAT-MOVE-2: Refusals at walls, hostile spaces and the map edge

Refusals at walls, hostile spaces and the map edge.

Level 3 (Core play) · Feature MOVE · Mode: Group (GM, P1) · Path position 123 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Sandbox** (owner GM; members P1, P2 and P3 with Iris, Juno and Kit; Manual mode; dim light and per-player fog; a wall with a closed door, a rubble line and one light; a visible Ogre in the east room and a hidden Goblin and a hidden Wolf; the review Encounter started and nobody has acted).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. Read "Aria" as Iris (P1) and "the Wolf" as the Ogre throughout. The GM draws the extra pieces with the tools described in [SCENE-3](../SCENE/UAT-SCENE-3.md).

1. **GM:** Draw a Wall across the map in front of Aria, and a Door (closed) in a second wall.
2. **P1:** Drag Aria's token through the wall.
3. **P1:** Drag Aria's token to the door while it is closed.
4. **P1:** Open the door (from the **Doors** list) and drag through it.
5. **GM:** Lock the door; **P1:** try to open it, then drag through.
6. **P1:** Drag Aria onto the square the Wolf occupies.
7. **P1:** Drag Aria off the edge of the map.
8. **GM:** Use **Lock token movement** on Aria's token (token properties).
9. **P1:** Try to move Aria's token.
10. **GM:** Unlock it; **P1:** move it one square.
11. **GM:** Add a one-way barrier and a window and try dragging through each.
12. **GM:** Add difficult terrain with a movement cost multiplier of 2 and walk Aria through two squares of it.
    R1. **GM:** Delete the extra wall, door, one-way barrier, window and terrain line you drew (select each, delete), so the Scene again has only the wall at x=400 with its closed door and the rubble line.

## Expected

- Steps 2, 3, 5 and 6 are refused with a clear message and the token returns to where it started.
- A wall, a closed door, a locked door and a one-way barrier block the crossing from the blocked side; a window and an open door follow their rules.
- Step 7 refuses to leave the map. Step 9 is refused because the token is locked. Step 10 works.
- Difficult terrain raises the used movement above the straight-line distance (a multiplier of 2 doubles the cost of the squares crossed).
- Nothing is written when a move is refused: reload shows the old square.

## Other users see

- **GM:** sees the token stay where it was after each refusal; sees no half-finished move.

## ACs covered

MOVE-1.1

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
