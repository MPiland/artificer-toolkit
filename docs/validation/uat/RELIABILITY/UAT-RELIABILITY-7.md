# UAT-RELIABILITY-7: Authored speed and sense bonuses use the right length unit

Authored speed and sense bonuses use the right length unit.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1) · Path position 143 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open P1's Character's Sheet. Note the walking speed and the darkvision range if any.
2. [ ] **GM:** Create a Feature "Reliability Boots" that adds +30 to walking speed with the unit set to feet. Publish it.
3. [ ] **GM:** Copy it as "Reliability Yards" with the bonus set to +30 and the unit set to yards. Publish it.
4. [ ] **GM:** Create a Feature "Reliability Eyes" that adds +30 feet to a sense range, and grant it to a Character with a sense that is 20 yards (60 ft) if available.
5. [ ] **P1:** Have the GM give P1's Character "Reliability Boots" and read the Sheet speed. Then swap to "Reliability Yards" and read it again.
6. [ ] **P1:** Read the sense range with "Reliability Eyes" granted.
7. [ ] **P1:** Start a move on a Scene and read the movement budget shown.

## Expected

- Step 5: Boots add 30 ft to the speed; Yards add 90 ft (30 yards). Neither changes it by a different amount or by zero.
- Step 6: the sense range grows by exactly 30 ft, even when the base sense was authored in yards.
- Step 7: the movement budget shown matches the Sheet speed.

## Other users see

- **GM:** Sees the same speed and senses on the Character's token.

## ACs covered

RELIABILITY-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
