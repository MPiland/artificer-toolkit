# UAT-SCENE-7: Map ownership and deletion

Map ownership and deletion.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1) · Path position 72 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is a member of The Campaign.
- Done in [UAT-SCENE-1](UAT-SCENE-1.md): "UAT Cavern" exists.
- Use the provided file [assets/sample-battle-map-b.png](../assets/sample-battle-map-b.png): the map for the spare Scene "UAT Spare Map" that this scenario deletes.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** in The Campaign create a spare Scene named "UAT Spare Map" from [sample-battle-map-b.png](../assets/sample-battle-map-b.png) as in [SCENE-1](UAT-SCENE-1.md) steps 2 to 6 (grid 5 ft, calibrate on the 50-pixel intersections). Scenes "UAT Cavern" and "UAT Spare Map" now both exist.

1. [ ] **GM:** Open Settings and Account and note the used media storage.
2. [ ] **GM:** Transfer ownership of The Campaign to P1 and have **P1** accept.
3. [ ] **P1:** Open Settings and Account and note the media storage. **GM:** do the same.
4. [ ] **P1:** Present "UAT Spare Map" in the tabletop window, then try to delete it while it is presented.
5. [ ] **P1:** Present "UAT Cavern" instead, then delete "UAT Spare Map".
6. [ ] **P1:** Reload and check the Scene list and storage.
       R1. **P1:** Transfer ownership of The Campaign back to the original GM (Settings, ownership transfer); **GM:** accept (as [CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) steps 14 and 15).

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
