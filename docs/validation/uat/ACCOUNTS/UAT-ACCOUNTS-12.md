# UAT-ACCOUNTS-12: Delete my account, shared history survives

Delete my account, shared history survives.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Mode: Solo (OWN) with a facilitator playing GM · Path position 190 of 190

## Prerequisites

- Done in [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md): you have your own account, created with your own email address. Run this last: it deletes that account.
- The review data provides the account **GM**, owner of the four review Campaigns (played by the owner as facilitator).

## Accounts and windows

- **Roles used:** OWN, GM
- **Facilitator:** the owner plays GM in a separate profile and does every step labelled **GM**: S1 first (the tester accepts the invitation), and steps 6 to 8 once the tester says the account is deleted.
- **Windows:** One browser window for OWN, your own account from [ACCOUNTS-6](UAT-ACCOUNTS-6.md). The owner is the facilitator in a separate profile.

## Steps

S1. **GM:** Create a throwaway Campaign "UAT Delete Camp" as in [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) steps 1 and 2. Invite OWN by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **OWN:** accept.
S2. **OWN:** Build a Fighter Character as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) and assign it to "UAT Delete Camp". Create a homebrew Spell as in [AUTHORING-4](../AUTHORING/UAT-AUTHORING-4.md).
S3. **GM:** Start a Session, present a Scene and start a short Encounter with the Character; **OWN:** post one chat message and make one roll.

1. **OWN:** Open the live tabletop of the shared Campaign and post a chat message and make one roll.
2. **OWN:** Note the Characters and homebrew you own.
3. **OWN:** Open `<STAGING_URL>/settings/account` and choose **Delete account**.
4. **OWN:** Type the account email and the password; confirm.
5. **OWN:** Try to sign in again.
6. **GM:** Reload the tabletop and read the chat, roll history and Session log.
7. **GM:** Open the Encounter history and the member list.
8. **GM:** Reload the tabletop after a minute.

## Expected

- Step 4: the account is deleted and every other tab is signed out.
- Step 5: sign-in fails for that account.
- Step 6: the earlier chat and roll remain, attributed to **Deleted user**.
- Step 7: the Encounter history and any finished Run remain; the deleted player's Character is gone from the member list and from the live table (its token is removed).
- Step 8: still gone and nothing reappears; the player's private Characters and homebrew no longer exist for anyone.

## Other users see

- **GM:** See Steps 6-8. Any other member of the throwaway Campaign sees the deleted player's lines as **Deleted user** and no profile.

## ACs covered

ACCOUNTS-10.2, ACCOUNTS-10.3, ACCOUNTS-10.4, ACCOUNTS-10.5

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
