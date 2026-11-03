# UAT-ACCOUNTS-4: Public sign-up is closed

Public sign-up is closed.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (any one role) · Path position 11 of 188

## Prerequisites

- The review data provides no account for the browser: you are signed out, and the sign-up page is the only thing you need.

## Accounts and windows

- **Roles used:** none (signed out)
- **Windows:** One browser window, signed in as the account named in the steps with the account from your set. Your normal browser is fine.

## Steps

1. Open `<STAGING_URL>/sign-up`.
2. Read the page title and message.
3. Look for any form that lets you choose a username and password.
4. Try to fill and submit it if one is present.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
