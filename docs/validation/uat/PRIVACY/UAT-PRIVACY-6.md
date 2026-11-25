# UAT-PRIVACY-6: Health display settings

Health display settings.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2) · Path position 104 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** In the Encounter drawer find the health display choice and read the default.
2. [ ] **P2:** Look at Aria's and the Wolf's health on the tabletop and in the turn order.
3. [ ] **P1:** Open the Character health setting for Aria and choose **Descriptive**.
4. [ ] **P2:** Read Aria's health again.
5. [ ] **P1:** Change Aria's setting to **Bar**, then **Exact**.
6. [ ] **GM:** Set the Encounter's health display to **Descriptive** for the Wolf, **Bar** for the Goblin, and give the Wolf a per-actor override of **Exact**.
7. [ ] **P1:** Read the Wolf and Goblin health.
8. [ ] **GM:** Read all health values.
       R1. **GM:** Set the health display for player-side and creature tokens back to its default (Hidden).

## Expected

- The default is **Hidden**: players see no health number or bar for other creatures.
- Aria's own setting controls what others see of Aria: Descriptive words, a Bar, or Exact numbers. Each player sets it for their own Character only.
- The GM's per-Encounter and per-actor settings control how the Wolf and Goblin appear to players.
- The GM always sees exact values.

## Other users see

- **P2:** must NOT see Aria's exact hit points unless Aria is set to Exact; must NOT see Bryn's setting changed by P1.
- **P1:** must NOT see the Wolf's hit points in a form stricter or looser than the GM's setting.

## ACs covered

PRIVACY-2.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
