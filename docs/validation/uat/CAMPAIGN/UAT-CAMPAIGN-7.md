# UAT-CAMPAIGN-7: The GM plays a Character

The GM plays a Character.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1) · Path position 56 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria assigned in The Campaign (done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md)). GM has no Character yet.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Build and **Activate** a Fighter named "UAT GM Hero" in the Builder (as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10).

1. [ ] **GM:** Open the Campaign **Party**, choose **Add Character**, and assign the GM's own Character to the Campaign.
2. [ ] **P1:** Open the Campaign and check the Party roster.
3. [ ] **GM:** In the Campaign chat, switch **Message voice** to roleplay and send an in-character line on the Table conversation.
4. [ ] **GM:** Open the Party conversation (players only).
5. [ ] **P1:** Send a message to the Party conversation.
6. [ ] **GM:** Try to move an item from the GM Character's inventory to P1's Character.
7. [ ] **GM:** Start an ownership transfer to P1 (as in [UAT-CAMPAIGN-2](UAT-CAMPAIGN-2.md) steps 12 to 14; P1 hosts no Campaign, so accepting works). **P1:** accept, then check the Party roster from both windows.
8. [ ] **P1:** Transfer ownership back to GM. **GM:** accept.
        R1. **GM:** Open the Party, remove "UAT GM Hero" from The Campaign, then delete the Character from **Characters** (GM is back to 0 of 6 personal Characters).

## Expected

- The GM's Character appears on the Party roster like any other player's.
- The in-character line posts in the public Table conversation under the Character's name.
- The Party conversation is not available to the GM; the GM cannot read it.
- The inventory transfer works as for any player.
- After the transfer P1, now the owner, still has their own Character Aria on the Party roster; the former GM's Character is still listed and is now a player's Character.
- After the transfer back GM hosts The Campaign again and the roster is as before step 7.

## Other users see

- **P1:** sees the GM Character in the Party and the in-character line in the Table chat; must NOT see anything else that reveals the GM's private notes.

## ACs covered

CAMPAIGN-7.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
