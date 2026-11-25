# UAT-SCENE-4: Fog of war off, shared and per player

Fog of war off, shared and per player.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1, P2) · Path position 62 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-3](UAT-SCENE-3.md): "UAT Cavern" is presented with a token for Aria, a wall and a door.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Add a token for Bryn (P2) to the presented Scene, so P1's and P2's Characters both have tokens.

1. [ ] **GM:** In the Scene settings check **Fog of war** is off. **P1:** note what is visible.
2. [ ] **GM:** Turn **Fog of war** on and choose **Shared party** fog.
3. [ ] **P1 and P2:** Look at the map.
4. [ ] **GM:** Move P1's Character's token across the map.
5. [ ] **P2:** Look at the map.
6. [ ] **GM:** Change **Fog visibility** to **Per player**. Choose **Choose player**, pick P2, and drag an area to edit that player's fog (**Drag an area on the map to edit fog.**).
7. [ ] **P1 and P2:** Compare the maps.
8. [ ] **GM:** Choose **Reveal entire map**, then switch fog off.
9. [ ] **GM:** Use **Full GM view** and then **GM vision preview** for P1.

## Expected

- With fog off, players see every non-hidden token, wall, door and light. With fog on they see only explored or visible areas.
- In shared mode moving P1's Character reveals the map for both P1 and P2. In per-player mode P2 sees only P2's own explored area.
- **Reveal entire map** shows everything to players; switching fog off removes the fog.
- The GM vision preview shows what P1 would see and does not change what P1 sees.

## Other users see

- **P1:** must NOT see areas only P2 has explored (per-player mode), tokens in unexplored areas, or hidden tokens.
- **P2:** same, with P1's areas.

## ACs covered

SCENE-2.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
