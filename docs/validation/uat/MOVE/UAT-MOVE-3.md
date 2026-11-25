# UAT-MOVE-3: Opportunity attack pauses the move

Opportunity attack pauses the move.

Level 3 (Core play) · Feature MOVE · Mode: Group (GM, P1, P2) · Path position 107 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Turn **Fog of war** on for the Scene (Shared party). **GM:** Roll my dice automatically OFF.

1. [ ] **P1:** On your own turn (or if turn order does not matter in this build, now), drag Aria's token away from the Wolf, out of its reach.
2. [ ] **P1:** Read what appears, and note which part of the map is revealed to you beyond the point where the move stopped.
3. [ ] **GM:** Open the **Pending decision**. Read the prompt for the Wolf.
4. [ ] **P1 and P2:** While it is open, try to move another token and try to open a door.
5. [ ] **GM:** Try to undo the last token move.
6. [ ] **GM:** Choose **Use reaction** for the Wolf's opportunity attack.
7. [ ] **GM:** Answer any roll prompt (with auto-roll off, type or roll the attack).
8. [ ] **P1:** Watch the token and the chat.
9. [ ] **P1:** Move Aria back next to the Wolf and away again, to get a second pause.
10. [ ] **GM:** This time choose **Decline reaction**.
11. [ ] **P1:** Move Aria back next to the Wolf and away a third time to get another pause.
12. [ ] **GM:** Choose **Skip decision**.
        R1. **GM:** Turn **Fog of war** OFF again.

## Expected

- The move pauses at the point Aria leaves the Wolf's reach and shows a "Pending decision" to the GM (the Wolf's controller). While it is open every token move, undo and door change is blocked with "Waiting on a movement decision.".
- Use reaction runs an opportunity attack; its result shows in chat, and the move then continues to its destination. Decline reaction continues with no attack.
- Skip decision treats the choice as declined and the move continues.
- While the move is paused the fog is revealed only along the path travelled up to the pause point, not beyond it; it extends as the move continues.

## Other users see

- **P1:** sees that the move is paused waiting on a decision; sees the attack result card only after the GM resolves it. P1 cannot answer the Wolf's reaction.
- **P2:** sees the pause and the final outcome; must NOT see the GM's private roll if the GM rolled Private, nor map areas the party has not explored under shared fog.

## ACs covered

MOVE-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
