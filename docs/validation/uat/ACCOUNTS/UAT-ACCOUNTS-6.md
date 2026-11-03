# UAT-ACCOUNTS-6: Create an account from an invitation

Create an account from an invitation.

Level 5 (Reliability, performance and release) · Feature ACCOUNTS · Run order 182 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **SUPERADMIN** (`Review_Admin_Sol`), a superadmin who is a member of no Campaign.
- The review data provides public sign-up closed, so each new account needs an invitation.
- Done in [UAT-ACCOUNTS-1](UAT-ACCOUNTS-1.md): you know how to read the local email.

## Accounts and windows

- **Accounts:** OUTSIDER (a new person with no account)
- **Windows:** One browser window signed in as the account above.

## Steps

1. **OUTSIDER:** Open the invitation link from the invitation email.
2. **OUTSIDER:** On **Complete registration**, enter a username and a password and submit.
3. **OUTSIDER:** Open the email-confirmation link that arrives; you should land on the email-confirmed page.
4. **OUTSIDER:** Sign in with the new email, then sign out and sign in with the new username.
5. **OUTSIDER:** Open the same invitation link again.
6. **OUTSIDER:** Open an invitation link whose code you have altered by one character.
7. **OUTSIDER:** Open a second invitation addressed to a different email, and try to register with the first person's email address.
8. **OUTSIDER:** Try to register with a username that is already taken (for example Review_Pl_Aria).

## Expected

- Step 2: the account is created and is an ordinary account (not an admin); a confirmation email is sent.
- Step 3: the confirmation page appears and the account becomes verified.
- Step 4: both logins work.
- Steps 5-7: **This invitation link is unavailable** with a hint that it may have expired or already been used; no second account is created.
- Step 8: the username is refused as taken and the invitation is still usable afterwards (the failed attempt did not use it up).

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-3.1, ACCOUNTS-3.2, ACCOUNTS-3.3, ACCOUNTS-4.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
