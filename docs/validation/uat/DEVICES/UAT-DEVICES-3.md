# UAT-DEVICES-3: Character Builder on a phone: create, draft, resume, commit

Character Builder on a phone: create, draft, resume, commit.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 3 of 9

## Prerequisites

- The account **P1** exists. Aria is committed ([UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md)).
- P1 has fewer than 6 personal Characters (the FREE plan limit), so one more can be created. Check **Characters** first.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** At phone width open **Characters** and choose **Create Character**.
2. [ ] **P1:** Enter **Character Name** "UAT Pocket" and choose a Race, the Fighter Class and a Background.
3. [ ] **P1:** Fill the ability scores with the **Ability Method** the page offers and pick the equipment choices. Move between steps with the page's own step controls.
4. [ ] **P1:** Choose **Save Character Draft**.
5. [ ] **P1:** Close the tab. Reopen **Characters** and open the draft.
6. [ ] **P1:** Confirm your earlier choices are intact and change the Background, then save the draft again.
7. [ ] **P1:** Go to the **Review** step. If it says **Needs attention**, fix the listed items until it says **Ready to activate**.
8. [ ] **P1:** Choose **Activate** and open the new Character's Sheet.
9. [ ] **P1:** Back on **Characters**, open "UAT Pocket" and choose Delete, then confirm.

## Expected

- Every Builder step fits the phone width with no sideways scroll, and each control you used is reachable with a thumb without being covered by the footer or the keyboard.
- The draft survives closing the tab and reopens with every choice, as in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md).
- **Ready to activate** appears only when nothing needs attention, and the Sheet opens with the chosen Race, Class and Background.
- After step 9 "UAT Pocket" is gone and P1's Characters are as before the scenario (Aria is untouched).

## Other users see

- Not applicable: single user. The Character is private and is deleted at the end.

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
