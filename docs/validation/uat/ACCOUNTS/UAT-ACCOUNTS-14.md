# UAT-ACCOUNTS-14: Change your password in Account Settings

Change your password in Account Settings.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (OWN) · Path position 14 of 190

## Prerequisites

- Done in [UAT-ACCOUNTS-6](UAT-ACCOUNTS-6.md): you have your own account, created with your own email address.

## Accounts and windows

- **Roles used:** OWN
- **Windows:** One browser window, signed in to the account you created in [ACCOUNTS-6](UAT-ACCOUNTS-6.md). Your normal browser is fine.

## Steps

1. **OWN:** Open **Account Settings** from the account menu and find the password change section.
2. **OWN:** Enter a wrong value in **Current password** and a new password you will remember in the new-password fields. Submit.
3. **OWN:** Enter your real current password and the same new password. Submit.
4. **OWN:** Sign out, then try to sign in with your old password.
5. **OWN:** Sign in with the new password.

## Expected

- Step 2: the change is refused with a message that the current password is wrong; nothing changes.
- Step 3: the change is accepted and confirmed.
- Step 4: the old password no longer signs in.
- Step 5: the new password signs in. Keep the new password: your later scenarios use it.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-11.1

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
