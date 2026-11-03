# UAT-AUTHORING-10: Another account cannot see or edit your drafts

Another account cannot see or edit your drafts.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 25 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.

## Accounts and windows

- **Accounts:** P1, P2, GM
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open http://localhost:3000/backgrounds/new, name it "UAT Private Draft", **Save Draft**.
2. **P1:** Copy the draft's page URL from the address bar.
3. **P2:** Paste the same URL into P2's browser.
4. **P2:** Append `/edit` if the page has no edit form, and try again.
5. **P2:** Search Backgrounds for "UAT Private Draft".
6. **GM:** Repeat steps 3 and 5.
7. **P1:** **Activate** the Background so it is published but still private.
8. **P2:** Repeat steps 3-5.
9. **P2:** Open the SRD Acolyte and look for any delete or direct edit control.
10. **P1:** Delete "UAT Private Draft".

## Expected

- Step 3-6: P2 and the GM see not-found/unavailable, never the draft's contents, and cannot save or delete.
- Step 8: a published private homebrew is still invisible to P2 and the GM.
- Step 9: SRD records offer P2 only the copy action.
- Step 10: P1 can delete their own record.

## Other users see

- **P2 / GM:** Nothing of the draft or its content at any time.

## ACs covered

AUTHORING-15.1, AUTHORING-12.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
