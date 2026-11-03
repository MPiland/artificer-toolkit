# UAT-SHEET-1: Edit a personal Sheet and reload

Edit a personal Sheet and reload.

Level 1 (Single-user basics) · Feature SHEET · Mode: Solo (P1) · Path position 44 of 188

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): "UAT Dara", a level-1 Fighter, is committed and in no Campaign.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser window, signed in as P1 with the account from your set. Your normal browser is fine.

## Steps

1. **P1:** Open Characters from the main menu and choose **UAT Dara** to open the Character Sheet.
2. **P1:** Note the current hit points shown in the vitals area.
3. **P1:** Choose **Manage hit points**, enter 3 in **Hit point amount**, apply it as damage, and close the panel.
4. **P1:** Turn **Inspiration** on.
5. **P1:** Choose **Manage conditions and exhaustion**, add one condition (for example Poisoned) with a short note, and close the panel.
6. **P1:** Open the inventory section and add or change a quantity of one item; then change a currency amount (for example add 5 copper pieces).
7. **P1:** Open the notes section, choose **Create Note**, type a short note, and save it.
8. **P1:** Reload the browser page.
9. **P1:** Compare every item you changed with what the Sheet now shows.
10. **P1:** In a second browser tab of the same account, open the same Sheet and change the hit point amount by one more point of damage; then, in the first tab (not reloaded), apply one more point of healing.
11. **P1:** Reload both tabs.

## Expected

- Step 3: current hit points drop by exactly 3 from step 2 (it cannot drop below 0).
- After step 8 the damage, Inspiration, the condition and its note, the inventory change, the currency change and the note are all still there, with no duplicates.
- Step 10: both edits land one after the other or one is refused with a visible message; no edit is silently lost. After step 11 both tabs show the same hit points.
- The Sheet shows only content from sources the Character is allowed to use (nothing from content disabled for the Campaign).

## Other users see

- Not applicable: single user.

## ACs covered

SHEET-1.1, SHEET-1.3, SHEET-1.4, SHEET-5.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
