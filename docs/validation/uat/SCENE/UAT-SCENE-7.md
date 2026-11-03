# UAT-SCENE-7: Map ownership and deletion

Map ownership and deletion.

Level 2 (GM setup) · Feature SCENE · Run order 73 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign.
- Done in [UAT-SCENE-1](UAT-SCENE-1.md): "UAT Cavern" exists.
- Use the provided file [assets/sample-battle-map-b.png](../assets/sample-battle-map-b.png): the map for the spare Scene "UAT Spare Map" that this scenario deletes.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** In the Sandbox Campaign create a spare Scene named "UAT Spare Map" from [sample-battle-map-b.png](../assets/sample-battle-map-b.png) as in [SCENE-1](UAT-SCENE-1.md) steps 2 to 6 (grid 5 ft, calibrate on the 50-pixel intersections). Scenes "UAT Cavern" and "UAT Spare Map" now both exist.

1. **GM:** Open Settings and Account and note the used media storage.
2. **GM:** Transfer ownership of the Sandbox Campaign to P1 and have **P1** accept.
3. **P1:** Open Settings and Account and note the media storage. **GM:** do the same.
4. **P1:** Present "UAT Spare Map" in the tabletop window, then try to delete it while it is presented.
5. **P1:** Present "UAT Cavern" instead, then delete "UAT Spare Map".
6. **P1:** Reload and check the Scene list and storage.
   R1. **P1:** Transfer ownership of the Sandbox Campaign back to the original GM (Settings, ownership transfer); **GM:** accept (as [CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) steps 14 and 15).

## Expected

- After transfer the map's storage is charged to the account that uploaded it, and the Scene and map still open for the new owner.
- A Scene that is live or in use cannot be deleted; a message explains why.
- After deletion the Scene is gone and the storage drops.

## Other users see

- **GM (now a player):** must NOT see GM-only Scene objects after the transfer.

## ACs covered

SCENE-3.2, SCENE-3.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
