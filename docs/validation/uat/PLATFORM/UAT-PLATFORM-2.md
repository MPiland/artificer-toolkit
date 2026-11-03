# UAT-PLATFORM-2: Upload, replace and remove an avatar

Upload, replace and remove an avatar.

Level 1 (Single-user basics) · Feature PLATFORM · Run order 19 of 188

## Prerequisites

- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Use the provided file [assets/avatar-a.png](../assets/avatar-a.png): the first image (steps 2 to 4).
- Use the provided file [assets/avatar-b.png](../assets/avatar-b.png): the second, different image (step 5).
- Use the provided file [assets/not-an-image.txt](../assets/not-an-image.txt): the plain text file refused in step 6.
- Use the provided file [assets/oversize-9000x100.png](../assets/oversize-9000x100.png): the image larger than the limit shown on the page, for step 7.

## Accounts and windows

- **Accounts:** P3
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P3:** Open http://localhost:3000/settings/profile.
2. **P3:** Choose **Change avatar** and pick the first image, [avatar-a.png](../assets/avatar-a.png).
3. **P3:** Wait for the upload to finish, then choose **Save profile** if the page asks for it.
4. **P3:** Reload the page.
5. **P3:** Choose **Change avatar** again and pick the second image, [avatar-b.png](../assets/avatar-b.png). Confirm it replaces the first.
6. **P3:** Choose **Change avatar** and pick the text file [not-an-image.txt](../assets/not-an-image.txt).
7. **P3:** Choose **Change avatar** and pick [oversize-9000x100.png](../assets/oversize-9000x100.png). If the page states a size limit that this file does not exceed, note the limit in the Notes and skip the oversized line in Expected.
8. **P3:** Remove the avatar using the remove control next to it, then reload.

## Expected

- After step 3 and 4 the first image shows as your avatar and survives the reload.
- After step 5 only the second image shows; the first is gone from the page.
- The .txt file is refused with a visible error; the avatar does not change.
- The oversized image (if tried) is refused with a visible error; the avatar does not change.
- After step 8 the avatar returns to the default placeholder and stays that way after reload.

## Other users see

- **P1:** After step 5, anywhere P3's avatar appears (for example the Campaign member list of Review: Party in the Field), the second image appears; after step 8 the placeholder appears. The refused files never appear.

## ACs covered

PLATFORM-4.1, PLATFORM-4.2, PLATFORM-4.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
