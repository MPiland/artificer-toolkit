# UAT-MOVE-4: Undo last token move

Undo last token move.

Level 3 (Core play) · Feature MOVE · Mode: Group (GM, P1) · Path position 107 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Turn **Fog of war** on (Shared party) as in [SCENE-4](../SCENE/UAT-SCENE-4.md).

1. [ ] **GM:** Note Aria's square.
2. [ ] **P1:** Move Aria's token two squares.
3. [ ] **P1:** Look for an undo control.
4. [ ] **GM:** Choose **Undo last token move** (the stage icon).
5. [ ] **GM:** Press it again.
6. [ ] **P1:** Move Aria again and then have the GM move another token.
7. [ ] **GM:** Choose **Undo last token move** and read which token returns.
8. [ ] **GM:** Trigger an opportunity-attack pause ([UAT-MOVE-3](UAT-MOVE-3.md)) and try to undo during the pause.
       R1. **GM:** Turn **Fog of war** OFF again.

## Expected

- P1 has no undo for tokens. The GM's undo returns Aria to the step 1 square, and restores the fog as it was.
- A second press with nothing to undo is refused with a message. Step 7: undo acts only on the latest move (the other token); Aria's earlier move is not rewound by it. Step 8: undo is refused with "Waiting on a movement decision." while the decision is pending.
- Everyone sees the token return.
- Not exercised here: the refusals after a move that settled Encounter mechanics, or one made as part of an action (the play guide lists them).

## Other users see

- **P1:** sees the token move back immediately.

## ACs covered

MOVE-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
