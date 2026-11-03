# UAT-AUTHORING-2: SRD records are locked but can be copied into an owned draft

SRD records are locked but can be copied into an owned draft.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (GM) · Path position 27 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser window, signed in as GM with the account from your set. Your normal browser is fine.
- **Settings:** **Authoring experience** in Settings, Preferences is **Guided** (check it; the default may differ).

## Steps

1. **GM:** Open `<STAGING_URL>/backgrounds` and open an SRD Background (for example Acolyte).
2. **GM:** Try to type into any field on the page.
3. **GM:** Look for any edit or delete controls.
4. **GM:** Choose **Duplicate to edit**.
5. **GM:** Note the new page: its URL, the name and the Draft badge. Edit the name to "UAT Acolyte Copy".
6. **GM:** Choose **Save Draft**, then reload.
7. **GM:** Go back to the SRD Acolyte and confirm it is unchanged.
8. **GM:** Repeat steps 1-4 for an SRD Creature (Wolf at `<STAGING_URL>/creatures`) and an SRD Spell, without editing.
9. **GM:** In Settings, Preferences set **Authoring experience** to Advanced, then repeat step 4 on another Background.
10. **GM:** On each copy choose **Discard draft** so no clutter remains.

## Expected

- Step 2-3: SRD fields cannot be edited and no Delete is offered for the SRD record.
- Step 4-5: a new Draft with a different URL (its own identity) opens, with the SRD contents copied in.
- Step 6: the edited name survives the reload and the draft reappears in your Background list marked as a draft.
- Step 7: the SRD Acolyte still has its original name and contents.
- Step 8: Wolf and Fireball (or any Spell) also offer only the copy action.
- Step 9: Guided and Advanced both lead to an editable owned copy; the page makes clear whether you are editing a copy, overriding, or creating new.
- Step 10: discarded drafts disappear from your list; the SRD records remain.

## Other users see

- Not applicable: single user.

## ACs covered

AUTHORING-2.2, AUTHORING-12.1, AUTHORING-12.4, AUTHORING-14.2, AUTHORING-14.3, AUTHORING-15.1

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
