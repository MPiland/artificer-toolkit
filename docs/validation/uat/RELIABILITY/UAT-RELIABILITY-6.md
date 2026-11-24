# UAT-RELIABILITY-6: A contested passage holds, then spends once

A contested passage holds, then spends once.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 123 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).
- Done in [UAT-MOVE-7](../MOVE/UAT-MOVE-7.md): the optional movement rules are enabled and the Overrun choice is available.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** On Aria's turn note the movement readout, then start a move and choose **Overrun** to pass through the Wolf's space.
2. [ ] **P1:** While the contest is open, read the movement readout again.
3. [ ] **P1:** Reload the page. Confirm the contest is still open.
4. [ ] **GM:** Answer the contest so that Aria wins. Double-click the answering control (two clicks in under a second).
5. [ ] **P1:** Read the movement readout and Aria's position. Reload and read both again.
6. [ ] **P1:** On Aria's next turn, start another passage and choose **Decline passage**, or have the GM decline for the Wolf.
7. [ ] **P1:** Read the movement readout and Aria's position. Reload.

## Expected

- Steps 2-3: the movement readout is unchanged while the contest is open; nothing is spent before the passage finishes, and a reload shows the same single open contest.
- Steps 4-5: the movement is charged once, for the whole path, and Aria arrives once. The double-click does not charge or move twice.
- Steps 6-7: after the passage is declined Aria's token stays where it paused, and only the distance actually travelled is spent.

## Other users see

- **GM:** Sees the contest open, then one result in history.

## ACs covered

RELIABILITY-1.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
