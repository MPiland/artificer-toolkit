# UAT-ACCOUNTS-10: Superadmin moderation

Superadmin moderation.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1, SUPERADMIN) · Path position 14 of 195

## Prerequisites

- **SUPERADMIN** is a superadmin account (the owner's own) that is a member of no Campaign.
- **GM** and **P1** have accounts. No Campaign is needed.

## Accounts and windows

- **Roles used:** GM, P1, SUPERADMIN
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **SUPERADMIN:** Sign in and open `<STAGING_URL>/social/moderation`.
2. [ ] **SUPERADMIN:** Read the list of items waiting for review.
3. [ ] **GM:** If the list is empty, open P1's profile in **Social** and use the report action so there is something to moderate.
4. [ ] **SUPERADMIN:** Open an item and record a review decision.
5. [ ] **SUPERADMIN:** Reload the page.
6. [ ] **P1:** Sign in and check the reported item (your own profile).

## Expected

- The moderation list loads for the superadmin and only for them.
- Opening and reviewing an item works and the decision persists after reload.
- The ordinary account sees the effect of the decision but never the moderation tools.

## Other users see

- **P1:** Sees the outcome only; no moderation controls.

## ACs covered

ACCOUNTS-9.2, ACCOUNTS-9.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
