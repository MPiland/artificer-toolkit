# UAT-PRIVACY-5: Reloads and replays do not leak

Reloads and replays do not leak.

Level 3 (Core play) · Feature PRIVACY · Run order 97 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **All:** Make sure **Roll my dice automatically** is OFF.

1. **P1:** Make an attack from the action drawer.
2. **P1:** Reload the page immediately and check that the result and history appear.
3. **P1:** Press the browser back and forward.
4. **P2:** Look at the Encounter history; then reload.
5. **GM:** Make a Private monster roll.
6. **P2:** Reload several times and open the history each time.
7. **P1:** Open the same Encounter from a second tab.

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
- **Failed step:**
- **Notes:**
