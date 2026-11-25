# UAT-DEVICES-8: Library lists and authored detail pages on a phone

Library lists and authored detail pages on a phone.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 8 of 9

## Prerequisites

- The account **P1** exists and is signed in.
- The SRD content is present ([UAT-PLATFORM-1](../PLATFORM/UAT-PLATFORM-1.md)).

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** At phone width open **Library** in the footer and choose **Spells**.
2. [ ] **P1:** Use the list's search and filter controls (the phone's compact list tools) to find "Fireball".
3. [ ] **P1:** Scroll the list to the bottom and check every row is fully readable.
4. [ ] **P1:** Open "Fireball" to reach its detail page. Read it top to bottom.
5. [ ] **P1:** Go back and open **Library**, then **Races**, and open one Race's detail page.
6. [ ] **P1:** Repeat for **Classes** and **Equipment**.
7. [ ] **P1:** On each detail page, use any action it offers that belongs to the reader (for example a link to a related item) and come back.

## Expected

- Each list fits the phone width, its search and filters work from the compact controls, and rows do not overflow.
- Each detail page is a reader page: headings, tables and text wrap without sideways scrolling, and long tables can be read.
- Going back returns to the list with your search still applied.

## Other users see

- Not applicable: single user; nothing is changed.

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
