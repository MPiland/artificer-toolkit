# UAT-RELIABILITY-4: A new Scene measures lengths correctly in every unit

A new Scene measures lengths correctly in every unit.

Level 2 (GM setup) · Feature RELIABILITY · Mode: Solo (GM) · Path position 76 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Use the provided file [assets/sample-battle-map.png](../assets/sample-battle-map.png): the map to upload (replaces "any small JPEG, PNG or WebP image").

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser window, signed in as GM with the account from your set. Your normal browser is fine.

## Steps

1. **GM:** In **Live maps** upload the image and name it "Reliability squares".
2. **GM:** Choose **Square** and the unit feet. Note the default distance per cell shown.
3. **GM:** Switch the unit to metres. Note the new default distance per cell.
4. **GM:** Switch the unit to squares. Note the new default distance per cell.
5. **GM:** Switch back to feet and save the Scene.
6. **GM:** Present the Scene and add a token for a creature.
7. **GM:** Start a new Encounter on this Scene (Campaign mode Assisted; [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 and 5), with a creature a few squares from another.
8. **GM:** Move a token, then pick an attack action against a creature a few squares away and read the range shown.
9. **GM:** Set a second new Scene's unit to squares, present it, start an Encounter and repeat step 8.

## Expected

- Step 2: default distance per cell is 5 ft.
- Step 3: it becomes about 1.524 m.
- Step 4: it becomes 1 square.
- Step 5: back to 5 ft.
- Steps 7-9: the Encounter opens, and the movement readout and action drawer show range and reach without any error message or blank screen, on both the feet and squares Scenes.

## Other users see

- Not applicable: single user.

## ACs covered

RELIABILITY-4.1, RELIABILITY-4.2

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
