# UAT-MOVE-5: Moving outside an Encounter and in a sandbox

Moving outside an Encounter and in a sandbox.

Level 2 (GM setup) · Feature MOVE · Mode: Group (GM, P1) · Path position 72 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-SCENE-4](../SCENE/UAT-SCENE-4.md): "UAT Cavern" is presented in the Sandbox Campaign with a token for UAT Dara, and no Encounter is running.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
