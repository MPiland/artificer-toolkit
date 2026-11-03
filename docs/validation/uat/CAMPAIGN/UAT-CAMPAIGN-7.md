# UAT-CAMPAIGN-7: The GM plays a Character

The GM plays a Character.

Level 2 (GM setup) · Feature CAMPAIGN · Run order 59 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign with "UAT Dara" assigned.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Build and **Activate** a Fighter named "UAT GM Hero" in the Builder (as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10). The GM has no Character in the review data.

1. **GM:** Open the Campaign **Party**, choose **Add Character**, and assign the GM's own Character to the Campaign.
2. **P1:** Open the Campaign and check the Party roster.
3. **GM:** In the Campaign chat, switch **Message voice** to roleplay and send an in-character line on the Table conversation.
4. **GM:** Open the Party conversation (players only).
5. **P1:** Send a message to the Party conversation.
6. **GM:** Try to move an item from the GM Character's inventory to P1's Character.
7. **GM:** Transfer ownership to P1 (see [UAT-CAMPAIGN-2](UAT-CAMPAIGN-2.md); the same plan-capacity note applies) and check the Party roster from both windows.

## Expected

- The GM's Character appears on the Party roster like any other player's.
- The in-character line posts in the public Table conversation under the Character's name.
- The Party conversation is not available to the GM; the GM cannot read it.
- The inventory transfer works as for any player.
- After the transfer (if P1's plan allows it) P1, now the owner, still has their own Character "UAT Dara" on the Party roster; the former GM's Character is still listed and is now a player's Character. If the transfer is refused for plan capacity, record that and the roster is unchanged.

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
- **Failed step:**
- **Notes:**
