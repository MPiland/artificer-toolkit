# UAT-ACCOUNTS-5: Reset a forgotten password (wrong code, mismatch, then success)

Reset a forgotten password (wrong code, mismatch, then success).

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Run order 181 of 188

## Prerequisites

- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides a local mail catcher that shows the six-digit code (see [Reading local email](../README.md#reading-local-email)).

## Accounts and windows

- **Accounts:** P3
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P3:** Open http://localhost:3000/sign-in and go to **Reset your password**.
2. **P3:** Enter `review_pl_cade@example.invalid` and submit to reach **Verify your reset code**.
3. **P3:** Enter a wrong six-digit code such as 000000 and submit.
4. **P3:** Request a new code from the same page (resend) a few times in a row.
5. **P3:** Reload the page and look at the address bar.
6. **P3:** Before the reset, keep a second tab open and signed in as P3. Then enter the real code from the newest reset email to `review_pl_cade@example.invalid`.
7. **P3:** On **Update password**, type different values in **New password** and **Confirm password**; submit.
8. **P3:** Type the same new password in both fields; submit.
9. **P3:** Try to sign in with the old password, and reload the second tab.
10. **P3:** Sign in with the new password. Try the code from step 6 again. Then reset the password back to the review password the same way.
11. **GM:** Meanwhile, with the GM signed in on another profile, confirm the GM can still use the app.

## Expected

- Step 3: "That verification code is invalid or has expired."
- Step 4: resends work a limited number of times, then are refused with a message; no crash.
- Step 5: the address bar carries no code or secret and the page still works after reload.
- Step 7: "Enter the same password in both fields." and nothing changes.
- Step 8: the password changes; you can sign in with it.
- Step 9: the old password is refused, and the second tab signed in as P3 before the reset is signed out after reload.
- Step 10: new password signs in; the code from step 6 is refused as invalid or already used.

## Other users see

- **GM:** Unaffected.

## ACs covered

ACCOUNTS-6.1, ACCOUNTS-6.2, ACCOUNTS-6.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
