# UAT-BUILDER-1: Build a Character for a review player, save, resume and commit

Build a Character for a review player, save, resume and commit.

Level 1 (Single-user basics) · Feature BUILDER · Run order 36 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.

## Accounts and windows

- **Accounts:** P1, GM
- **Windows:** Two browser profiles: P1 builds; GM only checks the Party panel in step 13 ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open http://localhost:3000/characters and choose **Create Character**.
2. **P1:** Enter **Character Name** "UAT Dara" and choose a Race, a Class and a Background.
3. **P1:** Fill the ability scores (use the **Ability Method** the page offers) and pick the equipment choices.
4. **P1:** Choose **Save Character Draft**.
5. **P1:** Close the tab. Reopen http://localhost:3000/characters and find the draft; open it.
6. **P1:** Confirm your earlier choices are intact, then change the Background and save the draft again.
7. **P1:** Start a second Character, enter the name "UAT Throwaway", save the draft, then choose **Discard draft** and confirm.
8. **P1:** Back on "UAT Dara", go to the **Review** step.
9. **P1:** Read the status. If it says **Needs attention**, open the listed items and fix them until it says **Ready to activate**.
10. **P1:** Choose **Activate** to commit the Character.
11. **P1:** Open the new Character's Sheet.
12. **P1:** Reload the Sheet and check the Characters list.

## Expected

- Step 4-6: the draft survives closing the tab and reopens with every choice; the draft list shows it as a draft, not a Character.
- Step 7: the discarded draft disappears and cannot be reopened.
- Step 9: **Ready to activate** appears only when nothing needs attention; committing before then is refused with the reason.
- Step 10-11: a Sheet opens with the chosen Race, Class and Background, correct ability scores, starting equipment in the inventory and hit points at maximum.
- Step 12: the Character is listed once under Characters and the draft is gone; the starting equipment is not added a second time on reload.

## Other users see

- **GM:** After step 4 and after step 10, open Review: Party in the Field's Party panel: "UAT Dara" and the draft are not shown (P1's Character there is still Aria).

## ACs covered

BUILDER-1.1, BUILDER-1.3, BUILDER-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
