# UAT-ACCOUNTS-12: Delete my account, shared history survives

Delete my account, shared history survives.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Run order 184 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **SPARE1** (`Review_Pl_Dara`), a player who is a member of no Campaign and owns no Character.

## Accounts and windows

- **Accounts:** SPARE1 (Review_Pl_Dara), GM
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Create a throwaway Campaign "UAT Delete Camp" as in [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) steps 1 and 2. Invite SPARE1 by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **SPARE1:** accept.
S2. **SPARE1:** Build a Fighter Character as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) and assign it to "UAT Delete Camp". Create a homebrew Spell as in [AUTHORING-4](../AUTHORING/UAT-AUTHORING-4.md).
S3. **GM:** Start a Session, present a Scene and start a short Encounter with the Character; **SPARE1:** post one chat message and make one roll.

1. **SPARE1:** Open the live tabletop of the shared Campaign and post a chat message and make one roll.
2. **SPARE1:** Note the Characters and homebrew you own.
3. **SPARE1:** Open http://localhost:3000/settings/account and choose **Delete account**.
4. **SPARE1:** Type the account email and the password; confirm.
5. **SPARE1:** Try to sign in again.
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
- **Failed step:**
- **Notes:**
