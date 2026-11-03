# UAT-SCENE-2: Map upload refusals

Map upload refusals.

Level 2 (GM setup) · Feature SCENE · Run order 62 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): the Sandbox Campaign exists.
- Use the provided file [assets/sample.gif](../assets/sample.gif): the GIF (step 2).
- Use the provided file [assets/sample.pdf](../assets/sample.pdf): the PDF (step 2).
- Use the provided file [assets/not-an-image.png](../assets/not-an-image.png): the text file renamed .png (step 3).
- Use the provided file [assets/oversize-9000x100.png](../assets/oversize-9000x100.png): the image over 8192 pixels on a side (step 4).
- Use the provided file [assets/sample-battle-map.png](../assets/sample-battle-map.png): the valid map (step 5).

## Accounts and windows

- **Accounts:** GM
- **Windows:** One browser window signed in as the account above.

## Steps

1. **GM:** Open the Scene creation area and choose **Map image**.
2. **GM:** Select [sample.gif](../assets/sample.gif) and then [sample.pdf](../assets/sample.pdf).
3. **GM:** Select [not-an-image.png](../assets/not-an-image.png).
4. **GM:** Select [oversize-9000x100.png](../assets/oversize-9000x100.png).
5. **GM:** Select [sample-battle-map.png](../assets/sample-battle-map.png), then clear it and select it again.
6. **GM:** Try **Create scene** with no Scene name.

## Expected

- A non-image shows "Maps must be JPEG, PNG, or WebP images."; a file that cannot be read shows "That map could not be processed. Check its dimensions and try again."; an oversized file is refused with a clear message.
- Nothing is created for a refused file.
- Without a name the form says "Name this scene." and does not submit.

## Other users see

- Not applicable: single user.

## ACs covered

SCENE-3.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
