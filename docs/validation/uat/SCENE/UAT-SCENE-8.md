# UAT-SCENE-8: GM loot tables

GM loot tables.

Level 4 (Advanced play) · Feature SCENE · Run order 141 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Party Encounter was completed; the Party Scene is still presented.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** If Review: Party in the Field has no running Encounter, create and start one with Aria, Bryn, Cade, a Wolf and a Goblin, as in [ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) steps 12 to 16, and advance until Aria is the active actor.

1. **GM:** Open the Scene's loot tables and create a table with a name, a skill check, and two ranges (1 to 10 and 11 to 20) with different items and coins.
2. **GM:** Add a third range that overlaps the first and save.
3. **GM:** Fix the overlap and save.
4. **GM:** Add a loot table to the Wolf in the Encounter.
5. **GM:** Reload and open the tables.
6. **GM:** Defeat the Wolf (reduce its hit points to zero).
7. **GM:** Open the **Loot** panel in the tabletop window and look at the Scene's tables and the Wolf's table.
8. **GM:** Enter a roll of 14 and look at the highlight.
9. **P1:** Look at the tabletop window.

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
- **Tester:**
- **Failed step:**
- **Notes:**
