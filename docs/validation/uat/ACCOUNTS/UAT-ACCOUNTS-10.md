# UAT-ACCOUNTS-10: Superadmin moderation

Superadmin moderation.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 17 of 188

## Prerequisites

- The review data provides the account **SUPERADMIN** (`Review_Admin_Sol`), a superadmin who is a member of no Campaign.

## Accounts and windows

- **Accounts:** SUPERADMIN (Review_Admin_Sol)
- **Windows:** One browser window signed in as the account above.

## Steps

1. **SUPERADMIN:** Sign in and open http://localhost:3000/social/moderation.
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
- **Failed step:**
- **Notes:**
