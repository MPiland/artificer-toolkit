# UAT-SOCIAL-3: Blocks and what they do

Blocks and what they do.

Level 4 (Advanced play) · Feature SOCIAL · Mode: Group (GM, P1, P2, SUPERADMIN) · Path position 150 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2, SUPERADMIN
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open P2's Social Hub profile and choose **Block**; confirm.
2. **P1:** Open the **Blocked profiles** panel and check P2 is listed.
3. **P2:** Try to open P1's Social profile.
4. **P2:** Try to invite P1 to a Campaign P2 owns, if P2 owns one; P1 hosts no table, so record the apply check as not applicable.
5. **P1 and P2:** Open Review: Party in the Field and its Campaign chat; each posts one line in the Table conversation.
6. **P1:** In **Blocked profiles**, choose **Unblock** next to P2.
7. **P2:** Reload P1's profile.
8. **SUPERADMIN:** Moderate P2 (suspend or restrict the profile) and check P1 and P2 stay members of Review: Party in the Field; then reverse the moderation.

## Expected

- The block succeeds with a message; the Blocked profiles panel lists P2, and **Unblock** reverses it.
- While blocked, P2 sees an "unavailable" profile for P1 and cannot invite or apply to P1.
- Both players remain members of Review: Party in the Field and can still chat and play together: a block never removes accepted membership.
- After unblocking, profile and invitation actions work again.
- Step 8: moderation leaves accepted membership in place, as a block does.

## Other users see

- **P2:** must NOT see that P1 blocked them beyond the "unavailable" or refusal message.
- **GM:** sees both players still in the Party at every step.

## ACs covered

SOCIAL-1.5

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
