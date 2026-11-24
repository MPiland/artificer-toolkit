# UAT-AUTHORING-3: Background lifecycle — create, save, publish, replace, export, delete

Background lifecycle — create, save, publish, replace, export, delete.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (P1) · Path position 21 of 191

## Prerequisites

- The account **P1** exists (a free account).
- The account **P2** exists (a free account), used only for the cross-role check.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/backgrounds/new`.
2. [ ] **P1:** Try to publish (**Activate**) with the name empty.
3. [ ] **P1:** Enter the name "UAT Wanderer", fill the required fields, and choose **Save Draft**.
4. [ ] **P1:** Reload, then go to `<STAGING_URL>/backgrounds` and find your draft.
5. [ ] **P1:** Open it, change the description, and choose **Activate**.
6. [ ] **P1:** Confirm it now shows as Active/Published in the list and use the search box and filters to find it.
7. [ ] **P1:** Open it, edit the name to "UAT Wanderer II", save the draft, and make another change that is invalid (for example clear a required field).
8. [ ] **P1:** Try to **Activate** the invalid version.
9. [ ] **P1:** Fix the field and choose **Activate** again.
10. [ ] **P1:** Choose **Export JSON** on it.
11. [ ] **P1:** Choose Delete and confirm. Then look at the list.
12. [ ] **P1:** In a new draft, choose **Discard draft** and confirm.

## Expected

- Step 2: publishing is refused with a message naming the missing required field; nothing becomes active.
- Step 4: your saved draft survives reload and is listed as a draft.
- Step 5-6: it becomes the Active version and appears in the list when searched and filtered.
- Step 8: the invalid draft is refused with a clear message, and the previously active "UAT Wanderer" is still the Active version everyone sees.
- Step 9: the corrected version replaces the old one atomically: the list shows "UAT Wanderer II" and the old name is gone.
- Step 10: a JSON file downloads.
- Step 11: the Background is deleted from the active list; if a draft exists it is kept or offered back, not silently lost.
- Step 12: the discarded draft is gone and the list returns.

## Cross-role check

Run by a second person after the tester finishes, signed in to their own P2 account in their own browser (not part of the tester's run):

- **P2:** After step 3 and again after step 9, search Backgrounds for "UAT Wanderer": it never appears (a draft is private, and homebrew stays private until shared; see [UAT-AUTHORING-11](UAT-AUTHORING-11.md)).

## ACs covered

AUTHORING-3.1, AUTHORING-3.2, AUTHORING-12.2, AUTHORING-13.1, AUTHORING-13.2, AUTHORING-2.3, PLATFORM-21.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
