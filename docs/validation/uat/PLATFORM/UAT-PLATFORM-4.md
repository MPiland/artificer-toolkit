# UAT-PLATFORM-4: Password reset email is requested from the app

Password reset email is requested from the app.

Level 1 (Single-user basics) · Feature PLATFORM · Run order 21 of 188

## Prerequisites

- The review data provides a browser that is signed out.
- Done in [UAT-ACCOUNTS-1](../ACCOUNTS/UAT-ACCOUNTS-1.md): you know the sign-in page.

## Accounts and windows

- **Accounts:** P3
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P3:** Open http://localhost:3000/sign-in and follow the forgot-password link to the **Reset your password** page.
2. **P3:** Enter `review_pl_cade@example.invalid` in **Email address** and submit.
3. **P3:** On the next page (**Verify your reset code**) read the message shown.
4. **P3:** Go back and repeat with an address that has no account, `nobody-here@example.invalid`.
5. **P3:** Compare the messages from both attempts.
6. **P3:** Sign in normally with the old password to confirm nothing changed.

## Expected

- Both attempts show the same neutral message (the app does not reveal whether an account exists) and the page asking for the six-digit code.
- No error about email delivery appears.
- The old password still signs in.
- [Local email](../README.md#reading-local-email) holds one reset email for `review_pl_cade@example.invalid` and none for `nobody-here@example.invalid`.

## Other users see

- Not applicable: single user.

## ACs covered

PLATFORM-3.1, PLATFORM-3.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
