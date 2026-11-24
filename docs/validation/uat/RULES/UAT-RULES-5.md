# UAT-RULES-5: An attack with two damage parts keeps each part visible

An attack with two damage parts keeps each part visible.

Level 4 (Advanced play) · Feature RULES · Mode: Group (GM, P2) · Path position 150 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **P2**'s Campaign Character is **Bryn** (a level 1 Fighter P2 built), seated in The Campaign.

## Accounts and windows

- **Roles used:** GM, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** In The Campaign choose **Complete encounter** in the turn menu on any running Encounter, then create and start a new Encounter with Bryn in it (standard initiative is not needed). Find an SRD Creature whose attack has two damage types at `/creatures` and add it.

1. [ ] **GM:** Open the Creature's page and read its attack: note each damage part (dice and damage type).
2. [ ] **GM:** Start the Encounter and bring the turn to that Creature (Bryn answers any initiative prompt as in [UAT-RULES-2](UAT-RULES-2.md)).
3. [ ] **GM:** From the action drawer choose that attack against Bryn. Answer the attack roll (and any damage prompt) so it hits; if it misses, undo or repeat on its next turn.
4. [ ] **GM:** Read the roll card in chat and the Encounter history entry for the hit.
5. [ ] **P2:** Read the same card in P2's window, then read Bryn's hit points before and after.
6. [ ] **GM:** Reload the tabletop and read the card again.

## Expected

- The roll card lists each damage part as its own line with its dice, damage type and result, then one total; the parts are not merged into a single untyped number.
- Bryn's hit points drop by the total (less any resistance she has: Bryn has none).
- The Encounter history shows one hit with the same parts, once.
- After the reload the card and history show the same parts and total.

## Other users see

- **P2:** The same roll card (or the same totals) once the attack resolves; no pending prompts belonging to the GM's monster rolls.

## ACs covered

RULES-1.6

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
