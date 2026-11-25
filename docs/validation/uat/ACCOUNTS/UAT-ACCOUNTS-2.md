# UAT-ACCOUNTS-2: Wrong password and unknown account are refused

Wrong password and unknown account are refused.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (P1) · Path position 3 of 195

## Prerequisites

- **P1** has an account created from the owner's invitation, and you know its email address, username and password. You are signed out.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [P] **P1:** Open `<STAGING_URL>/sign-in`.
2. [P] **P1:** Enter the email address of P1 and a wrong password; submit.
3. [P] **P1:** Enter an unknown username `nobody_here_uat` and any password; submit.
4. [P] **P1:** Submit with both fields empty.
5. [P] **P1:** Sign in correctly.

## Expected

- Steps 2 and 3 show the same message: "Check your email or username and password, then try again." You stay signed out and on the sign-in page.
- Step 4 shows a field-level prompt instead of signing in.
- Step 5 succeeds.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** PASSED
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** N/A
- **Notes:**
