# UAT-ENCOUNTER-7: Blueprint edits and who can reach them

Blueprint edits and who can reach them.

Level 2 (GM setup) · Feature ENCOUNTER · Mode: Group (GM, P1) · Path position 69 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- Done in [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md): The Campaign has the Wolf and Goblin Blueprint from step 2 and P1 as a member.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open the Blueprint in the Encounter builder in two browser tabs, A and B.
2. [ ] **GM (tab A):** Rename the Blueprint and save.
3. [ ] **GM (tab B), without reloading:** Add a second Goblin and save.
4. [ ] **GM:** Reload both tabs and compare the Blueprint name and creature list.
5. [ ] **GM (tab A):** Double-click the save control (two clicks in under a second) after a small change, then open the Encounter history or list.
6. [ ] **P1:** Open the Campaign's Encounter list and look for the Blueprint. Then ask the GM to send the Blueprint builder's address and open it in P1's browser.
7. [ ] **Anyone not signed in (a private window is fine):** Open the live table address of The Campaign.

## Expected

- Step 3: the stale save is refused with a message that the Blueprint changed (or it merges visibly); after reload both tabs show the same name and the same creature list, and the Blueprint is never half-saved.
- Step 5: the Blueprint changes once and there is one copy of it.
- Step 6: P1 does not see the Blueprint in a list, and the pasted address shows a not-allowed or not-found message, not the GM's Blueprint.
- Step 7: the signed-out window is sent to sign-in and shows no table data.

## Other users see

- **P1:** must NOT see the Blueprint's name, creatures or any edit.

## ACs covered

ENCOUNTER-1.2, ENCOUNTER-1.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
