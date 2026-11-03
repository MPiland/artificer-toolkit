# UAT-ACCOUNTS-10: Superadmin moderation

Superadmin moderation.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1, SUPERADMIN) · Path position 19 of 188

## Prerequisites

- The review data provides the account **SUPERADMIN**, a superadmin who is a member of no Campaign.

## Accounts and windows

- **Roles used:** GM, P1, SUPERADMIN
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **SUPERADMIN:** Sign in and open `<STAGING_URL>/social/moderation`.
2. **SUPERADMIN:** Read the list of items waiting for review.
3. **GM:** Create or report a Social listing so there is something to moderate, if the list is empty.
4. **SUPERADMIN:** Open an item and record a review decision.
5. **SUPERADMIN:** Reload the page.
6. **P1:** Sign in and check the affected listing.

## Expected

- The moderation list loads for the superadmin and only for them.
- Opening and reviewing an item works and the decision persists after reload.
- The ordinary account sees the effect of the decision on the listing but never the moderation tools.

## Other users see

- **P1:** Sees the listing outcome only; no moderation controls.

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
