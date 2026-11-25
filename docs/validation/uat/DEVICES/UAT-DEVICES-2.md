# UAT-DEVICES-2: Mobile footer, search drawer and Library menu

Mobile footer, search drawer and Library menu.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 2 of 9

## Prerequisites

- The account **P1** exists and is signed in.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open the home page at phone width and look at the footer bar. Note each button's name.
2. [ ] **P1:** Choose **Library** in the footer and open one of the listed content pages (for example **Spells**), then return.
3. [ ] **P1:** Choose **Create** in the footer and read the choices, then close it without choosing one.
4. [ ] **P1:** Choose **Social** in the footer.
5. [ ] **P1:** Choose **Search** in the footer. In the **Search** drawer, tap the **Search the library** field and type "fire".
6. [ ] **P1:** Close the drawer (swipe down or use its close control).
7. [ ] **P1:** Choose **Account** in the footer and read the menu: the **Theme** choice, **Settings** and **Sign out**. Change the theme to **Dark** and back.
8. [ ] **P1:** Open **Characters** and **Campaigns** through the app navigation and check the footer stays in place on each.

## Expected

- The footer shows Library, Create, Social, Search and Account, stays at the bottom of the screen without covering page content, and marks the current area.
- Each footer button opens its menu, page or drawer, and each menu can be closed again.
- The search drawer opens from the bottom with a field and a **Search** button. Record whether the button is usable; it must not hide the field or leave the page unscrollable when closed.
- The account menu's theme change applies at once to the whole page.

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
