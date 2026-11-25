# UAT-RULES-2: A started Encounter pauses for answers and resumes with nothing half-applied

A started Encounter pauses for answers and resumes with nothing half-applied.

Level 4 (Advanced play) · Feature RULES · Mode: Group (GM, P2) · Path position 153 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **P2**'s Campaign Character is **Bryn** (a level 1 Fighter P2 built), seated in The Campaign.

## Accounts and windows

- **Roles used:** GM, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** In The Campaign choose **Complete encounter** in the turn menu on any running Encounter, then create and start a new Encounter as step 1 describes. P2: Roll my dice automatically OFF.

1. [ ] **GM:** In The Campaign, with standard initiative set in the Campaign's table settings, create a new Encounter on the presented Scene in Assisted mode and add the Wolf, one Goblin and Bryn (P2) to it.
2. [ ] **GM:** Choose **Start encounter**.
3. [ ] **GM:** Watch the Encounter panel while the start is waiting.
4. [ ] **P2:** Read the pending roll prompt for Bryn's initiative. Do not answer yet.
5. [ ] **P2:** Reload the tabletop page while the prompt is open.
6. [ ] **P2:** Answer the prompt with **Roll dice**.
7. [ ] **GM:** If asked to roll initiative for the monsters, answer each prompt.
8. [ ] **GM:** When the start finishes, read the initiative order and the round counter.
9. [ ] **P2:** Look at the same initiative order.

## Expected

- Step 3: while any answer is outstanding, the Encounter is shown as waiting; there is no half-built order, no partial round counter and no partial combat log.
- Step 5: the same prompt is still there after the reload (a decision survives a refresh).
- Step 8: after the last answer, the Encounter begins at round 1 with a complete initiative order. Nothing was applied twice.
- Step 9: P2 sees the identical order.

## Other users see

- **P2:** Sees only their own prompt, not the GM's monster initiative prompts or any partial results before the Encounter begins.
- **GM:** Sees every prompt that is theirs (monsters), and the player's roll only after it is answered.

## ACs covered

RULES-1.2, RULES-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
