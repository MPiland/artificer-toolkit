# UAT-SHEET-4: Roll from the Sheet and choose who sees it

Roll from the Sheet and choose who sees it.

Level 3 (Core play) · Feature SHEET · Mode: Group (GM, P1, P2) · Path position 90 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- **The Campaign** is on a presented Scene in Assisted mode with the Speed Factor initiative, with a Wolf token and a Goblin token, and its Encounter started and in round 2 (built in the SCENE and ENCOUNTER scenarios). P1 has Aria in it: a Level 1 Fighter that P1 built in the Character Builder.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): Aria exists.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open The Campaign and its Campaign chat; leave it on the Table conversation.
2. [ ] **P2:** Open the same Campaign chat on the Table conversation.
3. [ ] **P1:** Open Aria's Sheet and click a skill (for example Athletics) to start a roll. Read the **Roll destination** choices.
4. [ ] **P1:** Leave the destination at **Table** and choose **Roll dice**.
5. [ ] **P1:** Start another roll, set the destination to **To GM**, and roll.
6. [ ] **P1:** Start a third roll, set the destination to **Just me**, and roll.
7. [ ] **P1:** Open **Open roll history** on the Sheet.
8. [ ] **P1:** Start a short rest preview and roll a hit die; look at the destination choices offered for this roll.
9. [ ] **P1:** Reload the Sheet and open the roll history again.
10. [ ] **P1:** In the roll history, use the clear or discard control (if the history offers one) on one entry, then reload and reopen the history.
11. [ ] **P1:** Send P2 the address of Aria's Sheet. **P2:** Open it and try to open its roll history.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
