# UAT-PRIVACY-5: Reloads and replays do not leak

Reloads and replays do not leak.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2) · Path position 102 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **All:** Make sure **Roll my dice automatically** is OFF.

1. [ ] **P1:** Make an attack from the action drawer.
2. [ ] **P1:** Reload the page immediately and check that the result and history appear.
3. [ ] **P1:** Press the browser back and forward.
4. [ ] **P2:** Look at the Encounter history; then reload.
5. [ ] **GM:** Make a Private monster roll.
6. [ ] **P2:** Reload several times and open the history each time.
7. [ ] **P1:** Open the same Encounter from a second tab.

## Expected

- P1 sees their own result after reload exactly once (no duplicate attack).
- P2 sees the same public result, and after reload never sees more than before.
- Repeated reloads by players never reveal the Private roll.
- Opening the same Encounter in a second tab (step 7) shows P1 the same single result, not a second attack.

## Other users see

- **P2:** must NOT see P1's decision prompts or P1's Just me roll, even after several reloads or reconnects.

## ACs covered

PRIVACY-1.5, PRIVACY-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
