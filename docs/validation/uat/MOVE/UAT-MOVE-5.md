# UAT-MOVE-5: Moving outside an Encounter and in a sandbox

Moving outside an Encounter and in a sandbox.

Level 2 (GM setup) · Feature MOVE · Run order 68 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-SCENE-4](../SCENE/UAT-SCENE-4.md): "UAT Cavern" is presented in the Sandbox Campaign with a token for UAT Dara, and no Encounter is running.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Present the Scene with a token for P1's Character, a wall, and an unbound token (add a plain token "Marker" with **Controlled by players** on).
2. **P1:** Move P1's Character's token.
3. **P1:** Move the Marker.
4. **GM:** Turn **Controlled by players** off for the Marker.
5. **P1:** Try to move the Marker.
6. **P1:** Try to move P1's Character's token to a place behind the wall.

## Expected

- Outside an Encounter a player moves tokens they control, including a plain token the GM allowed.
- With control turned off, the Marker cannot be moved by P1.
- Walls still refuse moves.

## Other users see

- **GM:** sees every move as it happens.

## ACs covered

MOVE-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
