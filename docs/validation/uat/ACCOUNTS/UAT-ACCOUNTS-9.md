# UAT-ACCOUNTS-9: Ordinary users cannot use superadmin tools

Ordinary users cannot use superadmin tools.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1) · Path position 13 of 191

## Prerequisites

- **GM** and **P1** each have an account and are signed in on their own devices.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open `<STAGING_URL>/social/moderation`.
2. [ ] **P1:** Open `<STAGING_URL>/social/moderation`.
3. [ ] **GM:** Open `<STAGING_URL>/social` and look for any moderation entry in the navigation.

## Expected

- Steps 1 and 2: access is refused (a denied, not-found or redirect result); no moderation list or review actions are shown, whoever the account is.
- Step 3: no moderation link is offered to the GM.

## Other users see

- **GM and P1:** Each is refused independently; neither sees anything the other did.

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
