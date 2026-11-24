# UAT-RELIABILITY-12: Core pages open with their data

Core pages open with their data.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 185 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The product has not just been restarted (wait a few minutes after a restart before running this).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open the authoring tools (`/spells`, then a Class or Feature editor). Confirm each opens and lists its data.
2. [ ] **P1:** Open Aria's Sheet. Confirm it opens and every tab shows data.
3. [ ] **GM:** In The Campaign, open the party inventory and its equipment picker. Confirm the options list.
4. [ ] **GM:** Open the live table of the Campaign with the active Encounter. Confirm it opens and the Encounter appears.
5. [ ] **GM:** Read the browser console for timeout or limit errors on each page.

## Expected

- Each page opens with its data and no timeout, "limit exceeded" or blank-screen error.

## Other users see

- **P1:** Opens the Sheet and the live table the same way, with the same data.

## ACs covered

RELIABILITY-21.1, RELIABILITY-21.2, RELIABILITY-21.3, RELIABILITY-21.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
