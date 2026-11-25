# UAT-DEVICES-6: Social Hub on a phone

Social Hub on a phone.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 6 of 9

## Prerequisites

- The account **P1** exists and is signed in.
- Done in [UAT-SOCIAL-1](../SOCIAL/UAT-SOCIAL-1.md): P3's listing exists, so the discovery list has at least one entry.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** At phone width open **Social Hub** from the footer's **Social** button.
2. [ ] **P1:** Find the Social Hub navigation and visit each page: the discovery list, **Hosted listings**, **My applications**, **Received invitations** and **Blocked profiles**.
3. [ ] **P1:** On the discovery page set a filter (use **Show results** if offered) and open a listing.
4. [ ] **P1:** On the listing read the table details, and check the **Apply to join** control is visible. Do not submit an application.
5. [ ] **P1:** Open another player's social profile and check the invite control opens its dialog ("Invite to ..."). Close the dialog without sending.
6. [ ] **P1:** Scroll each page to the bottom.

## Expected

- Every Social Hub page and its navigation fit the phone width; each page shows a list or its matching "No ..." empty text.
- Filters, the listing, the profile and the invite dialog can be used without sideways scrolling, and the dialog's buttons are not hidden behind the footer or the keyboard.
- Nothing is created: no application or invitation is sent.

## Other users see

- Not applicable: nothing is sent.

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
