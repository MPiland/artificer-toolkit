# UAT-ACCOUNTS-9: Ordinary users cannot use superadmin tools

Ordinary users cannot use superadmin tools.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 16 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open http://localhost:3000/social/moderation.
2. **P1:** Open http://localhost:3000/social/moderation.
3. **GM:** Open http://localhost:3000/social and look for any moderation entry in the navigation.

## Expected

- Steps 1 and 2: access is refused (a denied, not-found or redirect result); no moderation list or review actions are shown, even though the GM owns Campaigns and has a higher plan.
- Step 3: no moderation link is offered to the GM.

## Other users see

- Not applicable: both are refused independently.

## ACs covered

ACCOUNTS-9.2, ACCOUNTS-9.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
