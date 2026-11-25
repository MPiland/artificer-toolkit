# UAT-MOVE-6: Peers converge, reload and departure

Peers converge, reload and departure.

Level 2 (GM setup) · Feature MOVE · Mode: Group (GM, P1, P2) · Path position 67 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SCENE-4](../SCENE/UAT-SCENE-4.md): "UAT Cavern" is presented in The Campaign with tokens for **Aria** (P1) and **Bryn** (P2), level 1 Fighters their players built, and no Encounter is running.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Move P1's Character's token.
2. [ ] **P2:** Move P2's Character's token at about the same time.
3. [ ] **GM, P1, P2:** Each compare your own map with what the others describe.
4. [ ] **P2:** Reload the page.
5. [ ] **P1:** Go offline (Network panel) and move P1's Character's token; go back online.
6. [ ] **GM:** Remove P2 from the Campaign (see CAMPAIGN UAT).
7. [ ] **P2:** Try to move P2's Character's token and reload.
       R1. **GM:** Re-seat P2 and add P2's token back to the Scene in The Campaign as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md) (**GM:** invite P2 by username; **P2:** accept and assign Bryn as P2's Character).

## Expected

- All three windows show the same positions after each step, including after reload.
- A move made offline is either committed once or shown as failed; it is not duplicated.
- After removal P2 cannot move anything and is refused on reload.

## Other users see

- **GM and P1:** see the same final positions; P2's refused attempts change nothing.

## ACs covered

MOVE-1.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
