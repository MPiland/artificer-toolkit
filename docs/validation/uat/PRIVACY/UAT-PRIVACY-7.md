# UAT-PRIVACY-7: Other players' Sheets and Campaign roster

Other players' Sheets and Campaign roster.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2) · Path position 105 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1:** Open Aria's Sheet settings and turn **Party can view** OFF if it is on.

1. [ ] **P2:** Open the Campaign roster.
2. [ ] **P2:** Try to open Aria's Sheet.
3. [ ] **P1:** On Aria's Sheet, find **What the party sees**, and turn **Party can view** on.
4. [ ] **P2:** Reload and open Aria's Sheet.
5. [ ] **P2:** Look for Aria's personality and background.
6. [ ] **P1:** Turn **Party can view** off again.
7. [ ] **P2:** Reload Aria's Sheet.
8. [ ] **GM:** Open Aria's Sheet.

## Expected

- The roster shows only name, portrait, level and class for each Character.
- Step 2 is refused (GM only). Step 4 shows the Sheet in a read-only form. Personality and background are never shown to P2 at any step.
- After step 6 P2 is refused again. The GM can always open the Sheet.

## Other users see

- **P2:** must NOT see Aria's personality, background, private notes, inventory details (unless the shared view lists them) or any private Sheet data, in any step.

## ACs covered

PRIVACY-3.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
