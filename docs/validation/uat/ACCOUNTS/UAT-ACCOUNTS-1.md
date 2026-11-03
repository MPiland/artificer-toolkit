# UAT-ACCOUNTS-1: Sign in, reload, sign out, sign back in by username

Sign in, reload, sign out, sign back in by username.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 9 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox; you are signed out.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P1:** Open http://localhost:3000/characters while signed out.
2. **P1:** Note that you land on the sign-in page.
3. **P1:** In **Email or username** type `review_pl_aria@example.invalid`, enter the review password in **Password**, and sign in.
4. **P1:** Confirm you arrive on the Characters page you originally asked for.
5. **P1:** Reload the page (F5).
6. **P1:** Open http://localhost:3000/logout (or use the account menu's sign-out control).
7. **P1:** After the "Signing you out" page, open http://localhost:3000/characters again.
8. **P1:** Sign in again, this time typing the username `Review_Pl_Aria` in **Email or username**.
9. **P1:** Open http://localhost:3000/settings/profile and check the **Username** field.

## Expected

- Step 2: the signed-out visit redirects to sign-in rather than showing Characters.
- Step 4: after signing in you are returned to the Characters page, not to a generic home.
- Step 5: still signed in and the page renders fully (no blank screen).
- Step 7: signed out again; the protected page redirects to sign-in.
- Step 8-9: username sign-in works and the profile shows Review_Pl_Aria.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-1.1, ACCOUNTS-1.2, ACCOUNTS-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
