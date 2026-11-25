# UAT-SCENE-8: GM loot tables

GM loot tables.

Level 4 (Advanced play) · Feature SCENE · Mode: Group (GM, P1) · Path position 150 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- **The Campaign** has P1, P2 and P3 seated, with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters built by their players in the Character Builder), a presented Scene, and Assisted mode with the Speed Factor initiative.
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Party Encounter was completed; the Party Scene is still presented.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** If The Campaign has no running Encounter, create and start one with Aria, Bryn, Cade, a Wolf and a Goblin, as in [ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) steps 12 to 16, and advance until Aria is the active actor.

1. [ ] **GM:** Open the Scene's loot tables and create a table with a name, a skill check, and two ranges (1 to 10 and 11 to 20) with different items and coins.
2. [ ] **GM:** Add a third range that overlaps the first and save.
3. [ ] **GM:** Fix the overlap and save.
4. [ ] **GM:** Add a loot table to the Wolf in the Encounter.
5. [ ] **GM:** Reload and open the tables.
6. [ ] **GM:** Defeat the Wolf (reduce its hit points to zero).
7. [ ] **GM:** Open the **Loot** panel in the tabletop window and look at the Scene's tables and the Wolf's table.
8. [ ] **GM:** Enter a roll of 14 and look at the highlight.
9. [ ] **P1:** Look at the tabletop window.

## Expected

- Step 2 is refused with a message naming the overlap and nothing saves. Corrected tables save and reopen intact, with the item names, quantities, coins and note.
- The defeated Wolf's token shows a loot marker; the Loot panel lists its table and the Scene's.
- Entering 14 highlights the 11 to 20 range. Nothing is granted automatically.

## Other users see

- **P1:** must NOT see the Loot panel, the loot marker, tables or highlighted ranges, and nothing is given to P1's inventory.

## ACs covered

SCENE-4.1, SCENE-4.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
