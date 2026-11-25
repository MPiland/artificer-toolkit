# UAT-DEVICES-1: Sign in, account menu, Settings and sign out on a phone

Sign in, account menu, Settings and sign out on a phone.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 1 of 9

## Prerequisites

- The account **P1** exists and its password is known.
- Done in [UAT-ACCOUNTS-1](../ACCOUNTS/UAT-ACCOUNTS-1.md): P1 can sign in and out.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed out at the start.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** At phone width, open the sign-in page. Enter **Email or username** and **Password** and choose **Sign in**.
2. [ ] **P1:** Open the account menu from the footer's **Account** button. Choose **Settings**.
3. [ ] **P1:** Open **Open settings navigation** and go to **Preferences**, then reopen it and go to **Account**, then **Profile**.
4. [ ] **P1:** On each Settings page scroll to the bottom and tap one field to bring up the on-screen keyboard.
5. [ ] **P1:** Open the account menu again and choose **Sign out**.
6. [ ] **P1:** Sign back in.

## Expected

- No page needs horizontal scrolling and no field, button or menu item is cut off or covered by the footer or the keyboard.
- The Settings navigation opens as a panel from the left and closes after you choose a section; the heading above the content names the current section.
- Sign out returns you to a signed-out page, and you can sign back in.

## Other users see

- Not applicable: single user.

## ACs covered

Not tied to an AC: device coverage.

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
