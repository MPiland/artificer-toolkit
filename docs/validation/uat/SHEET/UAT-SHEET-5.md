# UAT-SHEET-5: GM Public and Private rolls with reveals

GM Public and Private rolls with reveals.

Level 3 (Core play) · Feature SHEET · Mode: Solo (GM) · Path position 92 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- **The Campaign** is on a presented Scene in Assisted mode with the Speed Factor initiative, with a Wolf token and a Goblin token, and its Encounter started and in round 2 (built in the SCENE and ENCOUNTER scenarios). P1 has Aria in it: a Level 1 Fighter that P1 built in the Character Builder.

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser, signed in as GM.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** In the GM roller (or the roll prompt), find the **Public / Private** switch (Roll visibility). Confirm it starts on Public the first time.
2. [ ] **GM:** Roll a d20 with Public selected.
3. [ ] **GM:** Switch to **Private** and roll a d20 for the Wolf.
4. [ ] **GM:** In chat, open **My rolls**. Find the private roll.
5. [ ] **GM:** Choose **Show that I rolled** on the private roll.
6. [ ] **GM:** Choose **Show roll** on the same roll.
7. [ ] **GM:** Try **Show roll** on the same card again.
8. [ ] **GM:** Reload the page and check the switch.
9. [ ] **GM:** Roll again with Private, and do not reveal it.

## Expected

- Public roll shows to everyone as a roll card.
- The Private roll shows nothing in the Table chat for players. Step 4 lists it under **My rolls** with the two buttons.
- Step 5 posts a notice that the GM rolled (naming the Wolf only if players can see it). Step 6 posts the full roll marked "Revealed by GM". Each button works once; step 7 is unavailable or refused.
- After reload the switch is still on Private (last choice is remembered).
- The step 9 roll is in **My rolls** only.

## Cross-role check

Run by two other people after the tester finishes, each signed in to their own account in their own browser (P1 and P2, not part of the tester's run):

- **P1:** sees the Public roll card, the "rolled" notice from step 5 and the revealed roll from step 6. Must NOT see the step 3 roll before it is revealed, nor the unrevealed step 9 roll, nor the Wolf's name in the step 5 notice if the Wolf is hidden from P1.
- **P2:** same as P1.

## ACs covered

SHEET-3.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
