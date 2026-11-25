# UAT-CAMPAIGN-3: Players see only what the GM made visible

Players see only what the GM made visible.

Level 3 (Core play) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 74 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open The Campaign and the notes area.
2. [ ] **GM:** Create a GM note and leave it private (not shared with the party). Create a second note and mark it **Shared with party**.
3. [ ] **P1:** Open the same Campaign and its notes.
4. [ ] **P2:** Open the Campaign and its notes.
5. [ ] **P1:** Open Aria's Sheet from the Campaign and add a private note on the Sheet.
6. [ ] **GM:** Open Aria's Sheet from the Campaign Party.
7. [ ] **P1:** Open Bryn's Sheet address in P1's window (copy it from P2).

## Expected

- P1 and P2 see the shared note, written by the GM, without internal attribution fields; they do not see the private note.
- Step 6: the GM sees Aria's Sheet as the GM does but cannot read the private note P1 added to the Sheet, if the Sheet marks it private.
- Step 7: P1 is refused Bryn's Sheet unless Bryn has Party can view on.

## Other users see

- **P2:** must NOT see the GM's private note, P1's private Sheet note, or Aria's Sheet unless its owner enabled Party can view.

## ACs covered

CAMPAIGN-2.1, CAMPAIGN-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
