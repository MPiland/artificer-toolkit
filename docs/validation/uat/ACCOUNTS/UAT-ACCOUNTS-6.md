# UAT-ACCOUNTS-6: Create an account from an invitation

Create an account from an invitation.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (OWN) · Path position 5 of 195

## Prerequisites

- Public sign-up is closed, so each new account needs an invitation.
- The owner has issued two invitations before you start: one to your own email address and one to a second address you own (for example a +tag of the same inbox).

## Accounts and windows

- **Roles used:** OWN
- **Windows:** One browser, not signed in at first (OWN is the account you create in step 2).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **OWN:** Open the invitation link from the invitation email.
2. [ ] **OWN:** On **Complete registration**, enter a username and a password and submit.
3. [ ] **OWN:** Open the email-confirmation link that arrives; you should land on the email-confirmed page.
4. [ ] **OWN:** Sign in with the new email, then sign out and sign in with the new username.
5. [ ] **OWN:** Open the same invitation link again.
6. [ ] **OWN:** Open an invitation link whose code you have altered by one character.
7. [ ] **OWN:** Open a second invitation addressed to a different email, and try to register with the first person's email address.
8. [ ] **OWN:** Try to register with a username that is already taken (for example the GM's username, which the owner gives you).

## Expected

- Step 2: the account is created and is an ordinary account (not an admin); a confirmation email is sent.
- Step 3: the confirmation page appears and the account becomes verified.
- Step 4: both logins work.
- Steps 5-7: **This invitation link is unavailable** with a hint that it may have expired or already been used; no second account is created.
- Step 8: the username is refused as taken and the invitation is still usable afterwards (the failed attempt did not use it up).

- Staging: every email this scenario sends arrives in the inbox within a few minutes, shows the product branding, has working links and is not in spam.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-3.1, ACCOUNTS-3.2, ACCOUNTS-3.3, ACCOUNTS-4.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
