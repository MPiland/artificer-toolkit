# UAT-SHEET-4: Roll from the Sheet and choose who sees it

Roll from the Sheet and choose who sees it.

Level 3 (Core play) · Feature SHEET · Mode: Group (GM, P1, P2) · Path position 87 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): "UAT Dara" exists.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open Review: Party in the Field and its Campaign chat; leave it on the Table conversation.
2. **P2:** Open the same Campaign chat on the Table conversation.
3. **P1:** Open Aria's Sheet and click a skill (for example Athletics) to start a roll. Read the **Roll destination** choices.
4. **P1:** Leave the destination at **Table** and choose **Roll dice**.
5. **P1:** Start another roll, set the destination to **To GM**, and roll.
6. **P1:** Start a third roll, set the destination to **Just me**, and roll.
7. **P1:** Open **Open roll history** on the Sheet.
8. **P1:** Start a short rest preview and roll a hit die; look at the destination choices offered for this roll.
9. **P1:** Reload the Sheet and open the roll history again.
10. **P1:** In the roll history, use the clear or discard control (if the history offers one) on one entry, then reload and reopen the history.
11. **P2:** Paste the address of Aria's Sheet (copied from P1's window) into P2's window and try to open it and its roll history.

## Expected

- Table is the default destination. Step 8 offers only Table and To GM (never Just me) because the roll changes the Character.
- Roll history on the Sheet lists all three rolls from steps 4 to 6 (and the hit die roll), most recent first, with the totals; it is still available after reload.
- The Table roll appears in the Table chat as a card with the roller's name and total.
- Step 10: the discarded entry is gone from the history after reload and the others remain.
- Step 11: P2 is refused or sees not-found (unless P1 has Party can view on, in which case the roll history is still not shown); none of P1's rolls appear.

## Other users see

- **GM:** sees the Table roll and the To GM roll in the Campaign chat; does NOT see the Just me roll.
- **P2:** sees only the Table roll card. Must NOT show the To GM roll, the Just me roll, or the hit die roll if it was sent To GM.

## ACs covered

SHEET-3.1, SHEET-3.2, SHEET-3.3, SHEET-3.4

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
