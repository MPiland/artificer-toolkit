# UAT-ACCOUNTS-9: Ordinary users cannot use superadmin tools

Ordinary users cannot use superadmin tools.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1) · Path position 20 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open `<STAGING_URL>/social/moderation`.
2. **P1:** Open `<STAGING_URL>/social/moderation`.
3. **GM:** Open `<STAGING_URL>/social` and look for any moderation entry in the navigation.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
