# UAT-BUILDER-1: Build a Character, save, resume and commit

Build a Character, save, resume and commit.

Level 1 (Single-user basics) · Feature BUILDER · Mode: Solo (P1) · Path position 33 of 195

## Prerequisites

- The account **P1** exists and has no Character yet (P1 has 0 of 6 personal Characters).

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/characters` and choose **Create Character**.
2. [ ] **P1:** Enter **Character Name** "Aria" (the Character P1 will play in The Campaign) and choose the Dwarf Race (it has darkvision, which a later scenario needs), the Fighter Class and a Background (Aria is a Level 1 Fighter).
3. [ ] **P1:** Fill the ability scores (use the **Ability Method** the page offers) and pick the equipment choices.
4. [ ] **P1:** Choose **Save Character Draft**.
5. [ ] **P1:** Close the tab. Reopen `<STAGING_URL>/characters` and find the draft; open it.
6. [ ] **P1:** Confirm your earlier choices are intact, then change the Background and save the draft again.
7. [ ] **P1:** Start a second Character, enter the name "UAT Throwaway", save the draft, then choose **Discard draft** and confirm.
8. [ ] **P1:** Back on "Aria", go to the **Review** step.
9. [ ] **P1:** Read the status. If it says **Needs attention**, open the listed items and fix them until it says **Ready to activate**.
10. [ ] **P1:** Choose **Activate** to commit the Character.
11. [ ] **P1:** Open the new Character's Sheet.
12. [ ] **P1:** Reload the Sheet and check the Characters list.

## Expected

- Step 4-6: the draft survives closing the tab and reopens with every choice; the draft list shows it as a draft, not a Character.
- Step 7: the discarded draft disappears and cannot be reopened.
- Step 9: **Ready to activate** appears only when nothing needs attention; committing before then is refused with the reason.
- Step 10-11: a Sheet opens with the chosen Race, Class and Background, correct ability scores, starting equipment in the inventory and hit points at maximum.
- Step 12: the Character is listed once under Characters and the draft is gone; the starting equipment is not added a second time on reload.

## Cross-role check

Run by a second person signed in as GM in their own browser, after the tester finishes:

- **GM:** After step 4 and after step 10, open your own **Characters** list: Aria and the draft are not shown (private Characters are visible only to their owner).

## ACs covered

BUILDER-1.1, BUILDER-1.3, BUILDER-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
