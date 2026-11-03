# UAT-ACCOUNTS-11: Refused account deletions

Refused account deletions.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Run order 183 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **SPARE1** (`Review_Pl_Dara`), a player who is a member of no Campaign and owns no Character.

## Accounts and windows

- **Accounts:** GM, SPARE1 (Review_Pl_Dara)
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **SPARE1:** Sign in, create a throwaway Campaign "UAT Spare Camp" at `/campaigns/new` and keep it open for step 5.

1. **GM:** Open http://localhost:3000/settings/account.
2. **GM:** Choose **Delete account** (the dialog opens).
3. **GM:** Read the dialog, type the account email as asked ("Type ... to confirm"), and enter a deliberately wrong password; confirm. Do not enter the real password.
4. **GM:** Close the dialog, reload the page and open http://localhost:3000/campaigns.
5. **SPARE1:** Sign in, create a throwaway Campaign at http://localhost:3000/campaigns/new, then open http://localhost:3000/settings/account and choose **Delete account**.
6. **SPARE1:** Type the account email, enter the correct password and confirm. SPARE1 owns an active Campaign.
7. **SPARE1:** Reload the page and open http://localhost:3000/campaigns.
8. **SPARE1:** Archive the throwaway Campaign, repeat steps 5-6, and confirm the refusal still applies to an Archived Campaign. Then delete the Campaign.

## Expected

- Step 3: refused ("Could not delete your account. Try again." or a wrong-password message); nothing is deleted.
- Step 4: still signed in; the four review Campaigns are intact.
- Step 6: refused because SPARE1 owns an active Campaign; the message names the reason (hand over, archive or delete the Campaign first); no data is removed.
- Step 7: still signed in; the throwaway Campaign is listed.
- Step 8: the refusal also applies while the Campaign is Archived. Deleting the account itself is left to [UAT-ACCOUNTS-12](UAT-ACCOUNTS-12.md).

## Other users see

- **P1:** Nothing changes; the Campaigns still list the GM.

## ACs covered

ACCOUNTS-10.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
