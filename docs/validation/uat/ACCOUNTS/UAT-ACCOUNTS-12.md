# UAT-ACCOUNTS-12: Delete my account, shared history survives

Delete my account, shared history survives.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Mode: Group (OWN, P3) · Path position 195 of 195

## Prerequisites

- Done in [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md): you have your own account, created with your own email address. Run this last: it deletes that account.
- Done in [UAT-SOCIAL-1](../SOCIAL/UAT-SOCIAL-1.md): **P3** hosts **P3's Campaign** (GM already hosts The Campaign, and a free account hosts one active Campaign, so the throwaway table belongs to P3).

## Accounts and windows

- **Roles used:** OWN, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P3:** Invite OWN to P3's Campaign by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **OWN:** accept.
S2. **OWN:** Build a Fighter Character as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) (OWN has 1 of 6 Characters) and assign it to P3's Campaign. Create a homebrew Spell as in [AUTHORING-4](../AUTHORING/UAT-AUTHORING-4.md).
S3. **P3:** Add and present a Scene with a map in P3's Campaign (as in [SCENE-1](../SCENE/UAT-SCENE-1.md) steps 1 to 6), start a Session and start a short Encounter with OWN's Character; **OWN:** post one chat message and make one roll.

1. [ ] **OWN:** Open the live tabletop of P3's Campaign and post a chat message and make one roll.
2. [ ] **OWN:** Note the Characters and homebrew you own.
3. [ ] **OWN:** Open `<STAGING_URL>/settings/account` and choose **Delete account**.
4. [ ] **OWN:** Type the account email and the password; confirm.
5. [ ] **OWN:** Try to sign in again.
6. [ ] **P3:** Reload the tabletop and read the chat, roll history and Session log.
7. [ ] **P3:** Open the Encounter history and the member list.
8. [ ] **P3:** Reload the tabletop after a minute.

## Expected

- Step 4: the account is deleted and every other tab of that account is signed out.
- Step 5: sign-in fails for that account.
- Step 6: the earlier chat and roll remain, attributed to **Deleted user**.
- Step 7: the Encounter history and any finished Run remain; the deleted player's Character is gone from the member list and from the live table (its token is removed).
- Step 8: still gone and nothing reappears; the player's private Characters and homebrew no longer exist for anyone.

## Other users see

- **P3:** See Steps 6-8. Any other member of P3's Campaign sees the deleted player's lines as **Deleted user** and no profile.

## ACs covered

ACCOUNTS-10.2, ACCOUNTS-10.3, ACCOUNTS-10.4, ACCOUNTS-10.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
