# UAT-REACTION-7: Reconnect while a decision is open

Reconnect while a decision is open.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1) · Path position 117 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 built **Ember**, a level 3 Wizard with Shield and Hold Person prepared and 1st-level slots. Ember is benched in The Campaign (added in REACTION-1).
- Done in [UAT-REACTION-1](UAT-REACTION-1.md): setup and steps 1 to 3 (Ember is P1's Active Character, a running Encounter, and a reaction prompt for P1 that is still waiting; do not answer it yet).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** In your browser's Network panel set throttling to "Offline" for 30 seconds, then back to "No throttling".
2. [ ] **P1:** Confirm the page reconnects by itself and the Shield prompt is still waiting.
3. [ ] **GM:** Meanwhile confirm the attack is still held.
4. [ ] **P1:** Answer **Use**. Confirm the result is applied once.
       R1. **GM:** Complete the Encounter. **P1:** Choose **Mark active** on Aria again (the wizard sits out the next arc); Ember stays on the bench.

## Expected

- The decision survives reconnect; temporary previews may vanish but the decision does not.

## Other users see

- **GM:** Sees the attack stay held throughout and sees no duplicate prompt for P1 after P1 returns.

## ACs covered

REACTION-1.1, REACTION-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
