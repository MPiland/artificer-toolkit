# UAT-ENCOUNTER-7: Blueprint edits and who can reach them

Blueprint edits and who can reach them.

Level 2 (GM setup) · Feature ENCOUNTER · Mode: Group (GM, P1) · Path position 75 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-ENCOUNTER-3](UAT-ENCOUNTER-3.md): the Sandbox Campaign has the Wolf and Goblin Blueprint from step 2 and P1 as a member.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open the Blueprint in the Encounter builder in two browser tabs, A and B.
2. **GM (tab A):** Rename the Blueprint and save.
3. **GM (tab B), without reloading:** Add a second Goblin and save.
4. **GM:** Reload both tabs and compare the Blueprint name and creature list.
5. **GM (tab A):** Double-click the save control (two clicks in under a second) after a small change, then open the Encounter history or list.
6. **P1:** Open the Campaign's Encounter list and look for the Blueprint. Then paste the Blueprint builder's address (copy it from the GM's tab) into P1's browser.
7. **Signed-out window:** Paste the live table address of the Sandbox Campaign.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
