# UAT-MOVE-1: A player moves their own token

A player moves their own token.

Level 3 (Core play) · Feature MOVE · Mode: Group (GM, P1, P2) · Path position 106 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **All:** Roll my dice automatically OFF.

1. [ ] **P1:** Click Aria's token and drag it one square away from the Wolf to an empty square, then confirm if asked.
2. [ ] **P1:** Read the movement readout.
3. [ ] **P1:** Drag Aria's token several squares further, farther than Aria's speed.
4. [ ] **P1:** Read the readout and any warning.
5. [ ] **P1:** Try to drag the Wolf's token.
6. [ ] **P1:** Try to drag Bryn's token.
7. [ ] **P2:** Try to drag Aria's token.
8. [ ] **GM:** Move Aria's token and the Wolf's token.
9. [ ] **P1:** Reload the page.

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
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
