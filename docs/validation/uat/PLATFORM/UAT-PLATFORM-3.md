# UAT-PLATFORM-3: Artwork is private to its owner until shared

Artwork is private to its owner until shared.

Level 1 (Single-user basics) · Feature PLATFORM · Mode: Group (P1, P2) · Path position 24 of 190

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Use the provided file [assets/artwork.png](../assets/artwork.png): the Spell artwork uploaded in step 2.

## Accounts and windows

- **Roles used:** P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open `<STAGING_URL>/spells/new`.
2. **P1:** Type the name "UAT Image Spark" and upload [artwork.png](../assets/artwork.png) as the Spell's artwork.
3. **P1:** Choose **Save Draft**, then reload and confirm the artwork is still shown.
4. **P1:** Right-click the artwork and choose Copy image address (or Open image in new tab and copy the address bar).
5. **P2:** Paste that address into a new tab in P2's own window and press Enter.
6. **P2:** Open `<STAGING_URL>/spells` and search "UAT Image".
7. **P1:** Back on the draft, choose **Discard draft** and confirm.
8. **P1:** Open the copied image address again in a new tab.

## Expected

- P1 sees the artwork on the draft after reload.
- P2 cannot load P1's image from the copied address (a refusal, blank or error, not the picture).
- P2's search finds no "UAT Image Spark".
- After the discard the draft is gone from P1's lists and the copied address no longer shows the picture.

## Other users see

- **P2:** Nothing of P1's draft or its artwork at any point.

## ACs covered

PLATFORM-4.1, PLATFORM-4.3, PLATFORM-4.4

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
