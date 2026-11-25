# UAT-ACCOUNTS-11: Refused account deletions

Refused account deletions.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Mode: Group (GM, P1, P5) · Path position 190 of 195

## Prerequisites

- **GM** hosts **The Campaign**, with P1 to P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- **P5** is a player who is a member of P3's Campaign only (see [UAT-SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md)) and hosts no Campaign.

## Accounts and windows

- **Roles used:** GM, P1, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open `<STAGING_URL>/settings/account`.
2. [ ] **GM:** Choose **Delete account** (the dialog opens).
3. [ ] **GM:** Read the dialog, type the account email as asked ("Type ... to confirm"), and enter a deliberately wrong password; confirm. Do not enter the real password.
4. [ ] **GM:** Close the dialog, reload the page and open `<STAGING_URL>/campaigns`.
5. [ ] **P5:** Create the Campaign "P5's Campaign" at `<STAGING_URL>/campaigns/new`, then open `<STAGING_URL>/settings/account` and choose **Delete account**.
6. [ ] **P5:** Type the account email, enter the correct password and confirm. P5 owns an active Campaign.
7. [ ] **P5:** Reload the page and open `<STAGING_URL>/campaigns`.
8. [ ] **P5:** Archive "P5's Campaign", then repeat steps 5-6 (without creating a Campaign).
9. [ ] **P5:** Delete "P5's Campaign" and wait for **Campaign deleted.** P5 now owns no Campaign, so [UAT-RELIABILITY-13](../RELIABILITY/UAT-RELIABILITY-13.md) can delete the account.
10. [ ] **P1:** Open `<STAGING_URL>/campaigns` and The Campaign.

## Expected

- Step 3: refused ("Could not delete your account. Try again." or a wrong-password message); nothing is deleted.
- Step 4: still signed in; The Campaign is intact.
- Step 6: refused because P5 owns an active Campaign; the message says to transfer or delete your Campaigns first; no data is removed.
- Step 7: still signed in; P5's Campaign is listed.
- Step 8: still refused with the same message: an Archived Campaign still blocks account deletion.
- Step 9: the Campaign is gone and P5 is still signed in with the account intact. Deleting P5's account is left to [UAT-RELIABILITY-13](../RELIABILITY/UAT-RELIABILITY-13.md).
- Step 10: The Campaign still lists the GM as owner.

## Other users see

- **P1:** Nothing changes; The Campaign still lists the GM.

## ACs covered

ACCOUNTS-10.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
