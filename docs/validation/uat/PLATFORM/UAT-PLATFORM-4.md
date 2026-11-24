# UAT-PLATFORM-4: Password reset email is requested from the app

Password reset email is requested from the app.

Level 1 (Single-user basics) · Feature PLATFORM · Mode: Solo (P3) · Path position 18 of 191

## Prerequisites

- **P3** has an account; you know its email address and password. The browser is signed out.
- Done in [UAT-ACCOUNTS-1](../ACCOUNTS/UAT-ACCOUNTS-1.md): you know the sign-in page.

## Accounts and windows

- **Roles used:** P3
- **Windows:** One browser, not signed in at first.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P3:** Open `<STAGING_URL>/sign-in` and follow the forgot-password link to the **Reset your password** page.
2. [ ] **P3:** Enter the email address of P3 in **Email address** and submit.
3. [ ] **P3:** On the next page (**Verify your reset code**) read the message shown.
4. [ ] **P3:** Go back and repeat with an address that has no account, `nobody-here@example.invalid`.
5. [ ] **P3:** Compare the messages from both attempts.
6. [ ] **P3:** Sign in normally with the old password to confirm nothing changed.

## Expected

- Both attempts show the same neutral message (the app does not reveal whether an account exists) and the page asking for the six-digit code.
- No error about email delivery appears.
- The old password still signs in.
- **Reading the email:** the owner reads the mailbox of P3's address and confirms it holds one reset email for P3; no email exists for `nobody-here@example.invalid`.

- Staging: every email this scenario sends arrives in the inbox within a few minutes, shows the product branding, has working links and is not in spam.

## Other users see

- Not applicable: one person acts in this scenario.

## ACs covered

PLATFORM-3.1, PLATFORM-3.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
