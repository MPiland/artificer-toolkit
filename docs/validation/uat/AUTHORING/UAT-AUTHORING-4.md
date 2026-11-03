# UAT-AUTHORING-4: Author, publish and filter a homebrew Spell with artwork

Author, publish and filter a homebrew Spell with artwork.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 26 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Use the provided file [assets/artwork.png](../assets/artwork.png): the Spell artwork (step 3).
- Use the provided file [assets/avatar-a.png](../assets/avatar-a.png): the different image used in step 5.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P1:** Open http://localhost:3000/spells/new.
2. **P1:** Name it "UAT Ember Dart", set a level (for example 1), a school, a casting time, and add the Wizard Class (or another SRD Class) to the Class list.
3. **P1:** Upload [artwork.png](../assets/artwork.png) as the artwork, choose **Save Draft**, reload and confirm the artwork shows.
4. **P1:** Publish with **Activate**.
5. **P1:** Open the Active Spell for editing (this starts a new draft), upload [avatar-a.png](../assets/avatar-a.png) as a different image, then choose **Discard draft** and confirm. Open the Spell again.
6. **P1:** Open http://localhost:3000/spells, filter by the level, school, Class and casting time you chose and find "UAT Ember Dart".
7. **P1:** Change a filter so it should not match and confirm it disappears.
8. **P1:** Choose **Export JSON** on it.
9. **P1:** Choose **Duplicate**, name the copy "UAT Ember Dart Copy", and save the draft.
10. **P1:** Open the signed-out page http://localhost:3000/spells in a private window (not signed in).

## Expected

- Step 3: the draft artwork survives reload.
- Step 5: the draft's image and the Active version's image are separate: discarding the new draft image leaves the first image on the Active Spell.
- Step 6: the Spell appears under every matching filter and the result count includes it; the row shows current labels for level, school and Class.
- Step 7: it no longer appears under a non-matching filter, with the count updated.
- Step 9: the copy opens as a new draft with a different URL and the same content; the original is unchanged.
- Step 10: the signed-out visit shows no homebrew and requires sign-in.

## Other users see

- **P2:** Searching Spells for "UAT Ember" finds nothing (private homebrew).

## ACs covered

AUTHORING-9.1, AUTHORING-9.2, AUTHORING-9.3, AUTHORING-12.3, AUTHORING-4.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
