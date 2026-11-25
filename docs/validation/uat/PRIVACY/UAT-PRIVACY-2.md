# UAT-PRIVACY-2: GM private rolls and monster rolls

GM private rolls and monster rolls.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2) · Path position 102 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).
- Done in [UAT-PRIVACY-1](UAT-PRIVACY-1.md): the Encounter has a hidden Goblin token (step 4).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Set the roll switch to **Private**.
2. [ ] **GM:** Make the Wolf attack Aria.
3. [ ] **GM:** Open chat **Enemy rolls** and **My rolls**.
4. [ ] **P1:** Look at the Table chat and the Encounter history.
5. [ ] **P2:** Look at the Table chat and the Encounter history.
6. [ ] **GM:** Switch the roll switch to **Public** and have the Wolf attack Bryn.
7. [ ] **GM:** Make a hidden Goblin ([UAT-PRIVACY-1](UAT-PRIVACY-1.md)) roll with the switch on Public.
8. [ ] **P1:** Make a skill roll with **Just me** as the destination.
9. [ ] **GM:** Look in chat for P1's Just me roll. **P2:** confirm you also do not see it.

## Expected

- The GM sees the Private roll in **Enemy rolls** and **My rolls**. Players see only the consequences (hit or miss, damage taken), not the dice, total or attack bonus.
- The Public attack shows the roll card to everyone.
- A hidden Goblin's roll is always Private, even when the switch is on Public.
- The GM does not see P1's Just me roll.

## Other users see

- **P1 and P2:** must NOT see the Wolf's Private roll dice, the hidden Goblin's roll, or each other's Just me rolls.
- **GM:** must NOT see P1's Just me roll.

## ACs covered

PRIVACY-1.1, PRIVACY-1.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
