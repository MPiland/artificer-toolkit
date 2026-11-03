# UAT-ROOM-10: Archiving a Campaign closes its live room

Archiving a Campaign closes its live room.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1) · Path position 88 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Create a throwaway Campaign "UAT Archive Room" as in [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) steps 1 and 2; invite P1 by username and **P1:** accept, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md).

1. **GM and P1:** Open the tabletop window of "UAT Archive Room".
2. **GM:** Post a chat line and note it.
3. **GM:** Archive the Campaign (as in [UAT-CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) step 8).
4. **P1:** Watch the tabletop window, try to post a chat line, then reload it.
5. **GM:** Try to open the tabletop window of the archived Campaign.

## Expected

- Step 4: P1's window closes or shows that the Campaign is archived; the chat line is not posted and a reload does not reopen the room.
- Step 5: the GM cannot open a live room on the archived Campaign; the Campaign is read-only.

## Other users see

- **P1:** sees the archived, read-only Campaign and nothing of a live table after step 3.

## ACs covered

ROOM-1.5

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
