# UAT-SCENE-1: Upload a map, calibrate and create a Scene

Upload a map, calibrate and create a Scene.

Level 2 (GM setup) · Feature SCENE · Run order 61 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): the Sandbox Campaign has P1, P2 and P3 as members, each with a Character.
- Use the provided file [assets/sample-battle-map.png](../assets/sample-battle-map.png): a 1000 x 750 map with a 50-pixel grid; grid intersections are 50 pixels apart.

## Accounts and windows

- **Accounts:** GM
- **Windows:** One browser window signed in as the account above.

## Steps

1. **GM:** Open the Sandbox Campaign and go to the Live maps area (**Prepared scenes**).
2. **GM:** Choose **Map image** and select [sample-battle-map.png](../assets/sample-battle-map.png). Watch **Map upload progress**.
3. **GM:** Type a **Scene name** (for example "UAT Cavern").
4. **GM:** Choose Grid type **Square**, set **Distance per cell** to 5 and **Distance unit** to **Feet**.
5. **GM:** Choose **Calibrate on map**, click a grid intersection to set the origin, then click the adjacent intersection 50 pixels away to set the cell size.
6. **GM:** Check the **Map calibration preview**, then choose **Create scene**.
7. **GM:** Reload the page and open the Scene again.
8. **GM:** Edit the Scene name and the cell size, save, and reload.

## Expected

- Upload shows progress and ends with a preview of the map; the Scene appears in **Prepared scenes**.
- After reload the Scene opens with the same map, name, grid and calibration.
- Edits persist after reload.

## Other users see

- Not applicable: single user.

## ACs covered

SCENE-1.1, SCENE-3.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
