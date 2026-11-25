# UAT-ACCOUNTS-4: Public sign-up is closed

Public sign-up is closed.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (any one role) · Path position 4 of 195

## Prerequisites

- No account is needed: you are signed out, and the sign-up page is the only thing you need.

## Accounts and windows

- **Roles used:** none (signed out)
- **Windows:** One browser, not signed in.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] Open `<STAGING_URL>/sign-up`.
2. [ ] Read the page title and message.
3. [ ] Look for any form that lets you choose a username and password.
4. [ ] Try to fill and submit it if one is present.

## Expected

- The page says **Access is currently invite-only** (or equivalent) and offers no way to create an account without an invitation.
- If a form is present, submitting it creates no account and shows a refusal; signing in with the new details fails.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-2.1, ACCOUNTS-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
