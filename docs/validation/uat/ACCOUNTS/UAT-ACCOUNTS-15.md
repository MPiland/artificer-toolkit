# UAT-ACCOUNTS-15: Change your email in Account Settings

Change your email in Account Settings.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (OWN) · Path position 15 of 190

## Prerequisites

- Done in [UAT-ACCOUNTS-5](UAT-ACCOUNTS-5.md): you have your own account and its inbox receives email.
- The review data provides a second email address you own, used by no account, whose inbox you can read

## Accounts and windows

- **Roles used:** OWN
- **Windows:** One browser window, signed in to the account you created in [ACCOUNTS-6](UAT-ACCOUNTS-6.md). Your normal browser is fine.

## Steps

1. **OWN:** Open **Account Settings** and find the email change section.
2. **OWN:** Enter the second email address you own as the new email. Submit. Do not open any link yet.
3. **OWN:** Reload Account Settings and read the email shown for the account. Sign out and sign in again with your usual details.
4. **OWN:** Choose **Forgot password** for your account and check which inbox receives the reset email.
5. **OWN:** Open the inbox of the second address and find the confirmation email. Check its branding and links, then open the confirmation link.
6. **OWN:** Open **Account Settings** again and read the email shown. Sign out and sign in again.
7. **OWN:** Choose **Forgot password** again and check which inbox receives the reset email.
8. **OWN:** Sign out. While signed out, open Account Settings directly and try to change the email.

## Expected

- Step 2: the app says a confirmation was sent to the new address; the account email is not changed yet.
- Step 3: the account still shows the old address and still signs in.
- Step 4: the reset email arrives at the old address, not the new one.
- Step 5: the confirmation email arrives within a few minutes at the new address and the link works.
- Step 6: the account now shows the new address and signs in.
- Step 7: the reset email arrives at the new address.
- Step 8: you are asked to sign in; no email change is possible while signed out.

- Staging: every email this scenario sends arrives in the inbox within a few minutes, shows the product branding, has working links and is not in spam.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-11.2

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
