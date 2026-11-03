# UAT-ACCOUNTS-5: Reset a forgotten password (wrong code, mismatch, then success)

Reset a forgotten password (wrong code, mismatch, then success).

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (OWN) · Path position 13 of 188

## Prerequisites

- Done in [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md): you have your own account, created with your own email address, and its inbox receives email.

## Accounts and windows

- **Roles used:** OWN
- **Windows:** One browser window, signed in to the account you created in [ACCOUNTS-6](UAT-ACCOUNTS-6.md). Your normal browser is fine.

## Steps

1. **OWN:** Open `<STAGING_URL>/sign-in` and go to **Reset your password**.
2. **OWN:** Enter your own email address and submit to reach **Verify your reset code**.
3. **OWN:** Enter a wrong six-digit code such as 000000 and submit.
4. **OWN:** Request a new code from the same page (resend) a few times in a row.
5. **OWN:** Reload the page and look at the address bar.
6. **OWN:** Before the reset, keep a second tab open and signed in as OWN. Then enter the real code from the newest reset email to your own email address.
7. **OWN:** On **Update password**, type different values in **New password** and **Confirm password**; submit.
8. **OWN:** Type the same new password in both fields; submit.
9. **OWN:** Try to sign in with the old password, and reload the second tab.
10. **OWN:** Sign in with the new password. Try the code from step 6 again. Keep the new password.

## Expected

- Step 3: "That verification code is invalid or has expired."
- Step 4: resends work a limited number of times, then are refused with a message; no crash.
- Step 5: the address bar carries no code or secret and the page still works after reload.
- Step 7: "Enter the same password in both fields." and nothing changes.
- Step 8: the password changes; you can sign in with it.
- Step 9: the old password is refused, and the second tab signed in as OWN before the reset is signed out after reload.
- Step 10: new password signs in; the code from step 6 is refused as invalid or already used.

- Staging: every email this scenario sends arrives in the inbox within a few minutes, shows the product branding, has working links and is not in spam.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-6.1, ACCOUNTS-6.2, ACCOUNTS-6.3

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
