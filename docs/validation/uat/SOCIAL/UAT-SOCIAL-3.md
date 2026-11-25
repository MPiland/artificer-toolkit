# UAT-SOCIAL-3: Blocks and what they do

Blocks and what they do.

Level 4 (Advanced play) · Feature SOCIAL · Mode: Group (GM, P1, P2, SUPERADMIN) · Path position 155 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).

## Accounts and windows

- **Roles used:** GM, P1, P2, SUPERADMIN
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open P2's Social Hub profile and choose **Block**; confirm.
2. [ ] **P1:** Open the **Blocked profiles** panel and check P2 is listed.
3. [ ] **P2:** Try to open P1's Social profile.
4. [ ] **P2:** Try to invite P1 to a Campaign P2 owns, if P2 owns one; P1 hosts no table, so record the apply check as not applicable.
5. [ ] **P1 and P2:** Open The Campaign and its Campaign chat; each posts one line in the Table conversation.
6. [ ] **P1:** In **Blocked profiles**, choose **Unblock** next to P2.
7. [ ] **P2:** Reload P1's profile.
8. [ ] **SUPERADMIN:** Moderate P2 (suspend or restrict the profile) and check P1 and P2 stay members of The Campaign; then reverse the moderation.

## Expected

- The block succeeds with a message; the Blocked profiles panel lists P2, and **Unblock** reverses it.
- While blocked, P2 sees an "unavailable" profile for P1 and cannot invite or apply to P1.
- Both players remain members of The Campaign and can still chat and play together: a block never removes accepted membership.
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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
