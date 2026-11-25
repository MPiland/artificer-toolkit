# UAT-ACCOUNTS-3: Sign-out ends every tab of your account and nobody else's

Sign out in one tab and every other tab of your own account is signed out too; other people stay signed in.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (P1, GM) · Path position 12 of 195

## Prerequisites

- **P1** and **GM** each have an account created from the owner's invitation and know its password.

## Accounts and windows

- **Roles used:** P1, GM
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** On your own device, sign in and open `<STAGING_URL>/campaigns`. Leave the page open.
2. [ ] **P1:** Sign in and open `<STAGING_URL>/campaigns`.
3. [ ] **P1:** Open `<STAGING_URL>/characters` and note the Characters listed.
4. [ ] **GM:** Open `<STAGING_URL>/characters` and note the Characters listed.
5. [ ] **P1:** Open a second tab in the same browser on `<STAGING_URL>/home`. You are already signed in there.
6. [ ] **P1:** In the second tab, sign out (open `<STAGING_URL>/logout`).
7. [ ] **P1:** Switch to the first tab and click any navigation link (for example Characters).
8. [ ] **GM:** Reload your page.

## Expected

- Step 3 shows only P1's own Characters; step 4 shows only the GM's own Characters and none of P1's.
- Step 7: the first tab ends up on the sign-in page (or shows the signed-out state); it does not stay on a blank page and does not keep showing P1's data.
- Step 8: the GM is still signed in and unaffected.

## Other users see

- **GM:** Signing out P1 does not sign out or change anything for the GM.

## ACs covered

ACCOUNTS-1.1, ACCOUNTS-1.2, ACCOUNTS-5.2, ACCOUNTS-5.3, ACCOUNTS-7.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
