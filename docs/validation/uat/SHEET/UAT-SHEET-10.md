# UAT-SHEET-10: Sheet at phone width

Sheet at phone width.

Level 1 (Single-user basics) · Feature SHEET · Mode: Solo (P1) · Path position 46 of 195

## Prerequisites

- The account **P1** exists.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): Aria is committed.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** Browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Sign in at 375 px and open Aria's Sheet ([UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md)).
2. [ ] **P1:** Use the **Character sheet mobile pages** navigation to visit each page (overview, actions, spells or inventory, notes).
3. [ ] **P1:** Open **Manage hit points** and apply 1 damage, then heal 1.
4. [ ] **P1:** Open **Open manual dice roller** and roll a d20.
5. [ ] **P1:** Open **Open roll history**.
6. [ ] **P1:** Scroll each page to the bottom.

## Expected

- No page needs horizontal scrolling and no control is cut off or overlapped.
- Every control you used is reachable with a thumb-sized target and the HP change is correct.
- The roll appears in roll history.

## Other users see

- Not applicable: single user.

## ACs covered

SHEET-1.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
