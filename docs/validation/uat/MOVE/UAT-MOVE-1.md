# UAT-MOVE-1: A player moves their own token

A player moves their own token.

Level 3 (Core play) · Feature MOVE · Run order 100 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **All:** Roll my dice automatically OFF.

1. **P1:** Click Aria's token and drag it one square away from the Wolf to an empty square, then confirm if asked.
2. **P1:** Read the movement readout.
3. **P1:** Drag Aria's token several squares further, farther than Aria's speed.
4. **P1:** Read the readout and any warning.
5. **P1:** Try to drag the Wolf's token.
6. **P1:** Try to drag Bryn's token.
7. **P2:** Try to drag Aria's token.
8. **GM:** Move Aria's token and the Wolf's token.
9. **P1:** Reload the page.

## Expected

- Step 1: the token moves and the readout shows "used / budget ft" (for example "Movement 15 / 30 ft"). Diagonal steps count 5, 10, 5 feet.
- Step 3: the move is allowed; Assisted mode shows a yellow "N ft over" but does not stop the move (movement is advisory).
- Steps 5 to 7 are refused: the token does not move, and the app refuses with a message (read and record its exact wording). Nothing changes on the other windows.
- The GM can move every token.
- After reload everyone still sees the final positions.

## Other users see

- **P2 and GM:** see Aria's token move as P1 drags it, and end in the same square. They never see tokens move that the player had no right to move.
- **P2:** must NOT see anything that P1's refused drag did.

## ACs covered

MOVE-1.1, MOVE-1.5, MOVE-1.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
